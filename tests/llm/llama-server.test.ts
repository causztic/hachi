import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createManagedLlamaServer } from "../../src/llm/llama-server";

class FakeChildProcess extends EventEmitter {
  kill = vi.fn();
  stderr = new PassThrough();
  stdout = new PassThrough();
}

describe("createManagedLlamaServer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for the readiness check before resolving start", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "hachi-llama-server-"));
    const modelsDir = join(tempRoot, "models");
    const childProcess = new FakeChildProcess();
    let releaseReady!: () => void;
    const waitForReady = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseReady = resolve;
        })
    );
    await mkdir(modelsDir, { recursive: true });
    await writeFile(join(modelsDir, "Qwen3-14B-Q5_K_M.gguf"), "model", "utf8");
    const llamaServer = createManagedLlamaServer(
      {
        host: "127.0.0.1",
        model: {
          filename: "Qwen3-14B-Q5_K_M.gguf",
          name: "qwen3-14b-q5-k-m",
          url: "https://example.invalid/model.gguf"
        },
        modelsDir,
        port: 8080,
        serverBinary: "llama-server"
      },
      {
        spawn: vi.fn(() => childProcess as never),
        waitForReady
      }
    );

    let resolved = false;
    const startPromise = llamaServer.start().then(() => {
      resolved = true;
    });

    await vi.waitFor(() => {
      expect(waitForReady).toHaveBeenCalledOnce();
    });

    expect(resolved).toBe(false);

    try {
      releaseReady();
      await startPromise;
    } finally {
      llamaServer.stop();
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  it("rejects start when the child exits before the readiness check completes", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "hachi-llama-server-"));
    const modelsDir = join(tempRoot, "models");
    const childProcess = new FakeChildProcess();
    const waitForReady = vi.fn(
      () => new Promise<void>(() => undefined)
    );
    await mkdir(modelsDir, { recursive: true });
    await writeFile(join(modelsDir, "Qwen3-14B-Q5_K_M.gguf"), "model", "utf8");
    const llamaServer = createManagedLlamaServer(
      {
        host: "127.0.0.1",
        model: {
          filename: "Qwen3-14B-Q5_K_M.gguf",
          name: "qwen3-14b-q5-k-m",
          url: "https://example.invalid/model.gguf"
        },
        modelsDir,
        port: 8080,
        serverBinary: "llama-server"
      },
      {
        spawn: vi.fn(() => childProcess as never),
        waitForReady
      }
    );

    try {
      const startPromise = llamaServer.start();
      await vi.waitFor(() => {
        expect(waitForReady).toHaveBeenCalledOnce();
      });
      childProcess.stderr.write("missing llama-server runtime");
      childProcess.emit("exit", 1, null);

      await expect(startPromise).rejects.toThrow(
        /llama-server.*missing llama-server runtime/i
      );
    } finally {
      llamaServer.stop();
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});
