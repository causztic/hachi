import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { createDiscordBot, type ManagedDiscordMessage } from "./discord/discord-bot";
import { createManagedLlamaServer } from "./llm/llama-server";
import { createLlamaChatClient } from "./llm/llama-chat";
import { type OfficialLlamaRuntimeConfig } from "./llm/runtime-bootstrap";
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
import {
  inboundPromptRefusalMessage,
  shouldRefuseInboundPrompt
} from "./safety/inbound-prompt-guard";
import { validateOutboundResponse } from "./safety/outbound-response-validator";
import { redactSecretsInText } from "./safety/secret-redaction";
import { ensureDir } from "./util/fs";
import { resolveServerBinary } from "./llm/model-registry";

const codexHandoffDeniedMessage =
  "Codex handoff is restricted to approved Discord users or roles.";

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
    get?(threadId: string): ThreadSessionRecord | null;
    save(record: ThreadSessionRecord): void;
  };
};

export function createManagedMessageHandler(
  dependencies: ManagedMessageHandlerDependencies
) {
  const runCodexImpl = dependencies.runCodexImpl ?? runCodex;
  const createRunId = dependencies.createRunId ?? randomUUID;

  function buildThreadSessionRecord(
    message: ManagedDiscordMessage,
    lastActivityAt: string,
    codexSessionId?: string | null
  ): ThreadSessionRecord {
    return {
      channelId: message.channelId,
      codexSessionId: codexSessionId ?? null,
      guildId: message.guildId,
      lastActivityAt,
      summary: null,
      threadId: message.threadId
    };
  }

  function canUseCodexHandoff(message: ManagedDiscordMessage): boolean {
    const allowedUserIds =
      dependencies.defaultConfig.discord.codexHandoffAllowedUserIds;
    const allowedRoleIds =
      dependencies.defaultConfig.discord.codexHandoffAllowedRoleIds;

    if (allowedUserIds.length === 0 && allowedRoleIds.length === 0) {
      return false;
    }

    if (allowedUserIds.includes(message.authorId)) {
      return true;
    }

    return message.roleIds.some((roleId) => allowedRoleIds.includes(roleId));
  }

  return async function handleManagedMessage(
    message: ManagedDiscordMessage
  ): Promise<void> {
    const lastActivityAt = new Date().toISOString();
    dependencies.sessionStore.save(
      buildThreadSessionRecord(message, lastActivityAt)
    );

    const route = routeIntent({
      content: message.content,
      explicitPrefixes: dependencies.defaultConfig.router.explicitPrefixes
    });

    if (route.target === "codex") {
      if (!canUseCodexHandoff(message)) {
        await message.reply(codexHandoffDeniedMessage);
        return;
      }

      const existingSession =
        dependencies.sessionStore.get?.(message.threadId) ?? null;
      const runId = createRunId();
      const startedAt = new Date().toISOString();
      let codexSessionId = existingSession?.codexSessionId ?? null;
      dependencies.runStore.save({
        finishedAt: null,
        logPath: `${dependencies.runtimePaths.logsDir}/${runId}.log`,
        runId,
        startedAt,
        status: "running",
        threadId: message.threadId
      });

      await message.reply(`Starting Codex run ${runId}.`);

      const persistCodexSessionId = (nextCodexSessionId: string) => {
        if (codexSessionId === nextCodexSessionId) {
          return;
        }

        codexSessionId = nextCodexSessionId;
        dependencies.sessionStore.save(
          buildThreadSessionRecord(message, lastActivityAt, nextCodexSessionId)
        );
      };

      const result = await runCodexImpl({
        cwd: dependencies.repoRoot,
        logsDir: dependencies.runtimePaths.logsDir,
        onThreadStarted: persistCodexSessionId,
        prompt: message.content.replace(/^(!code|\/code)\s*/i, ""),
        resumeSessionId: codexSessionId,
        runId
      });

      if (result.sessionId) {
        persistCodexSessionId(result.sessionId);
      }

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

    if (shouldRefuseInboundPrompt(message.content)) {
      await message.reply(inboundPromptRefusalMessage);
      return;
    }

    const history = await message.history();
    const redactedHistory = history.map((entry) => ({
      content: redactSecretsInText(entry.content),
      role: entry.role
    }));
    const reply = await dependencies.chatClient.reply([
      {
        content: dependencies.promptBundle.persona,
        role: "system"
      },
      {
        content: dependencies.promptBundle.router,
        role: "system"
      },
      ...redactedHistory,
      {
        content: message.content,
        role: "user"
      }
    ]);

    await message.reply(validateOutboundResponse(reply).content);
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
    runtime: {
      rootfsDir: runtimePaths.llamaRuntimeRootfsDir,
      serverBinaryRelativePath: "app/llama-server",
      source: defaultConfig.llm.runtimeSource,
      tmpDir: runtimePaths.tmpDir
    } satisfies OfficialLlamaRuntimeConfig,
    serverBinary: resolveServerBinary(
      envConfig.llamaServerBin ?? defaultConfig.llm.serverBinary,
      envConfig.repoRoot
    )
  }, {
    log(message) {
      console.info(`[hachi] ${message}`);
    }
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
