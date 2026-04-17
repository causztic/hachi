import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { createDiscordBot, type ManagedDiscordMessage } from "./discord/discord-bot";
import { createManagedLlamaServer } from "./llm/llama-server";
import { createLlamaChatClient } from "./llm/llama-chat";
import { createDatabase } from "./persistence/database";
import { createRunStore, type CodexRunRecord } from "./persistence/run-store";
import {
  createSessionStore,
  type ThreadSessionRecord
} from "./persistence/session-store";
import { routeIntent } from "./router/intent-router";
import { runCodex } from "./codex/codex-runner";
import { loadDefaultConfig, type DefaultConfig } from "./config/defaults";
import { loadEnvConfig } from "./config/env";
import { loadPromptBundle, type PromptBundle } from "./config/prompts";
import { createRuntimePaths, type RuntimePaths } from "./config/runtime-paths";
import { ensureDir } from "./util/fs";

export type ManagedMessageHandlerDependencies = {
  chatClient: {
    reply(messages: Array<{ content: string; role: "assistant" | "system" | "user" }>): Promise<string>;
  };
  createRunId?: () => string;
  defaultConfig: DefaultConfig;
  promptBundle: PromptBundle;
  repoRoot: string;
  runCodexImpl?: typeof runCodex;
  runStore: {
    save(record: CodexRunRecord): void;
  };
  runtimePaths: RuntimePaths;
  sessionStore: {
    save(record: ThreadSessionRecord): void;
  };
};

export function createManagedMessageHandler(
  dependencies: ManagedMessageHandlerDependencies
) {
  const runCodexImpl = dependencies.runCodexImpl ?? runCodex;
  const createRunId = dependencies.createRunId ?? randomUUID;

  return async function handleManagedMessage(
    message: ManagedDiscordMessage
  ): Promise<void> {
    dependencies.sessionStore.save({
      channelId: message.channelId,
      guildId: message.guildId,
      lastActivityAt: new Date().toISOString(),
      summary: null,
      threadId: message.threadId
    });

    const route = routeIntent({
      content: message.content,
      explicitPrefixes: dependencies.defaultConfig.router.explicitPrefixes
    });

    if (route.target === "codex") {
      const runId = createRunId();
      const startedAt = new Date().toISOString();
      dependencies.runStore.save({
        finishedAt: null,
        logPath: `${dependencies.runtimePaths.logsDir}/${runId}.log`,
        runId,
        startedAt,
        status: "running",
        threadId: message.threadId
      });

      await message.reply(`Starting Codex run ${runId}.`);

      const result = await runCodexImpl({
        cwd: dependencies.repoRoot,
        logsDir: dependencies.runtimePaths.logsDir,
        prompt: message.content.replace(/^(!code|\/code)\s*/i, ""),
        runId
      });

      dependencies.runStore.save({
        finishedAt: new Date().toISOString(),
        logPath: result.logPath,
        runId,
        startedAt,
        status: result.code === 0 ? "completed" : "failed",
        threadId: message.threadId
      });

      await message.reply(
        result.code === 0
          ? `Codex run ${runId} finished. Log: ${result.logPath}`
          : `Codex run ${runId} failed. Log: ${result.logPath}`
      );

      return;
    }

    const history = await message.history();
    const reply = await dependencies.chatClient.reply([
      {
        content: dependencies.promptBundle.persona,
        role: "system"
      },
      {
        content: dependencies.promptBundle.router,
        role: "system"
      },
      ...history,
      {
        content: message.content,
        role: "user"
      }
    ]);

    await message.reply(reply);
  };
}

export async function createApp() {
  const [defaultConfig, envConfig, promptBundle] = await Promise.all([
    loadDefaultConfig(),
    Promise.resolve(loadEnvConfig()),
    loadPromptBundle()
  ]);
  const runtimePaths = createRuntimePaths(envConfig.repoRoot);

  await Promise.all([
    ensureDir(dirname(runtimePaths.databaseFile)),
    ensureDir(runtimePaths.logsDir),
    ensureDir(runtimePaths.modelsDir),
    ensureDir(runtimePaths.tmpDir)
  ]);

  const db = createDatabase(runtimePaths.databaseFile);
  const sessionStore = createSessionStore(db);
  const runStore = createRunStore(db);
  const llamaServer = createManagedLlamaServer({
    host: "127.0.0.1",
    model: defaultConfig.llm.defaultModel,
    modelsDir: runtimePaths.modelsDir,
    port: 8080,
    serverBinary: envConfig.llamaServerBin
  });
  const chatClient = createLlamaChatClient({
    baseUrl: "http://127.0.0.1:8080",
    model: defaultConfig.llm.defaultModel.name
  });
  const handleManagedMessage = createManagedMessageHandler({
    chatClient,
    defaultConfig,
    promptBundle,
    repoRoot: envConfig.repoRoot,
    runStore,
    runtimePaths,
    sessionStore
  });
  const discordBot = createDiscordBot(
    {
      allowedGuildIds: envConfig.allowedGuildIds,
      threadAutoCreate: defaultConfig.discord.threadAutoCreate,
      token: envConfig.discordBotToken ?? ""
    },
    {
      onManagedMessage: handleManagedMessage
    }
  );

  return {
    async start(): Promise<void> {
      await llamaServer.start();
      await discordBot.start();
    },
    async stop(): Promise<void> {
      await discordBot.stop();
      llamaServer.stop();
    }
  };
}
