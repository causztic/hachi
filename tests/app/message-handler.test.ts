import { describe, expect, it, vi } from "vitest";
import { createManagedMessageHandler } from "../../src/app";

describe("createManagedMessageHandler", () => {
  it("routes rp messages to the llama chat client", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const chatReply = vi.fn().mockResolvedValue("The lanterns sway above us.");

    const handleManagedMessage = createManagedMessageHandler({
      chatClient: {
        reply: chatReply
      },
      defaultConfig: {
        codex: {
          allowEditsByDefault: true,
          streamingUpdateIntervalMs: 1500
        },
        discord: {
          threadAutoCreate: true,
          threadIdleMinutes: 30
        },
        llm: {
          defaultModel: {
            filename: "Qwen3-14B-Q4_K_M.gguf",
            name: "qwen3-14b-q4-k-m",
            url: "https://example.invalid/model.gguf"
          },
          serverBinary: "llama-server"
        },
        router: {
          explicitPrefixes: ["/code", "!code"]
        }
      },
      promptBundle: {
        persona: "You are Hachi.",
        router: "Prefer codex only for coding work."
      },
      repoRoot: "/repo",
      runStore: {
        save: vi.fn()
      },
      runtimePaths: {
        databaseFile: "/repo/.hachi/db/hachi.sqlite",
        logsDir: "/repo/.hachi/logs/codex",
        modelsDir: "/repo/.hachi/models",
        rootDir: "/repo/.hachi",
        tmpDir: "/repo/.hachi/tmp"
      },
      sessionStore: {
        save: vi.fn()
      }
    });

    await handleManagedMessage({
      channelId: "c1",
      content: "walk with me through the shrine at sunset",
      guildId: "g1",
      history: async () => [],
      messageId: "m1",
      reply,
      threadId: "t1"
    });

    expect(chatReply).toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith("The lanterns sway above us.");
  });

  it("routes explicit code messages to codex and persists the run", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const runStoreSave = vi.fn();
    const runCodexImpl = vi.fn().mockResolvedValue({
      code: 0,
      logPath: "/repo/.hachi/logs/codex/run-123.log"
    });

    const handleManagedMessage = createManagedMessageHandler({
      chatClient: {
        reply: vi.fn()
      },
      createRunId: () => "run-123",
      defaultConfig: {
        codex: {
          allowEditsByDefault: true,
          streamingUpdateIntervalMs: 1500
        },
        discord: {
          threadAutoCreate: true,
          threadIdleMinutes: 30
        },
        llm: {
          defaultModel: {
            filename: "Qwen3-14B-Q4_K_M.gguf",
            name: "qwen3-14b-q4-k-m",
            url: "https://example.invalid/model.gguf"
          },
          serverBinary: "llama-server"
        },
        router: {
          explicitPrefixes: ["/code", "!code"]
        }
      },
      promptBundle: {
        persona: "You are Hachi.",
        router: "Prefer codex only for coding work."
      },
      repoRoot: "/repo",
      runCodexImpl,
      runStore: {
        save: runStoreSave
      },
      runtimePaths: {
        databaseFile: "/repo/.hachi/db/hachi.sqlite",
        logsDir: "/repo/.hachi/logs/codex",
        modelsDir: "/repo/.hachi/models",
        rootDir: "/repo/.hachi",
        tmpDir: "/repo/.hachi/tmp"
      },
      sessionStore: {
        save: vi.fn()
      }
    });

    await handleManagedMessage({
      channelId: "c1",
      content: "/code fix the failing tests",
      guildId: "g1",
      history: async () => [],
      messageId: "m1",
      reply,
      threadId: "t1"
    });

    expect(runCodexImpl).toHaveBeenCalledWith({
      cwd: "/repo",
      logsDir: "/repo/.hachi/logs/codex",
      prompt: "fix the failing tests",
      runId: "run-123"
    });
    expect(runStoreSave).toHaveBeenCalledTimes(2);
    expect(reply).toHaveBeenCalledWith("Starting Codex run run-123.");
    expect(reply).toHaveBeenCalledWith(
      "Codex run run-123 finished. Log: /repo/.hachi/logs/codex/run-123.log"
    );
  });
});
