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

async function createTempModelDir() {
  const tempRoot = await mkdtemp(join(tmpdir(), "hachi-llama-server-"));
  const modelsDir = join(tempRoot, "models");

  await mkdir(modelsDir, { recursive: true });
  await writeFile(join(modelsDir, "Qwen3-14B-Q5_K_M.gguf"), "model", "utf8");

  return {
    modelsDir,
    tempRoot
  };
}

describe("createManagedLlamaServer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses an existing compatible server instead of spawning a managed process", async () => {
    const { modelsDir, tempRoot } = await createTempModelDir();
    const spawnImpl = vi.fn();
    const waitForReady = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "qwen3-14b-q5-k-m"
            }
          ]
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      )
    );
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
        fetchImpl,
        spawn: spawnImpl,
        waitForReady
      }
    );

    try {
      await llamaServer.start();

      expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:8080/v1/models");
      expect(spawnImpl).not.toHaveBeenCalled();
      expect(waitForReady).not.toHaveBeenCalled();

      llamaServer.stop();
      expect(spawnImpl).not.toHaveBeenCalled();
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  it("rejects startup when an existing server explicitly reports a different model", async () => {
    const { modelsDir, tempRoot } = await createTempModelDir();
    const spawnImpl = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "other-model"
            }
          ]
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      )
    );
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
        fetchImpl,
        spawn: spawnImpl
      }
    );

    try {
      await expect(llamaServer.start()).rejects.toThrow(
        /existing llama-server model mismatch/i
      );
      expect(spawnImpl).not.toHaveBeenCalled();
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  it("reuses an existing server when metadata is inconclusive", async () => {
    const { modelsDir, tempRoot } = await createTempModelDir();
    const spawnImpl = vi.fn();
    const waitForReady = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("not found", {
        status: 404
      })
    );
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
        fetchImpl,
        spawn: spawnImpl,
        waitForReady
      }
    );

    try {
      await llamaServer.start();

      expect(spawnImpl).not.toHaveBeenCalled();
      expect(waitForReady).not.toHaveBeenCalled();
    } finally {
      llamaServer.stop();
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  it("waits for the readiness check before resolving start", async () => {
    const { modelsDir, tempRoot } = await createTempModelDir();
    const childProcess = new FakeChildProcess();
    let releaseReady!: () => void;
    const waitForReady = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseReady = resolve;
        })
    );
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
        fetchImpl: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
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
    const { modelsDir, tempRoot } = await createTempModelDir();
    const childProcess = new FakeChildProcess();
    const waitForReady = vi.fn(
      () => new Promise<void>(() => undefined)
    );
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
        fetchImpl: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
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

  it("stops only the managed server process it started itself", async () => {
    const { modelsDir, tempRoot } = await createTempModelDir();
    const childProcess = new FakeChildProcess();
    let releaseReady!: () => void;
    const waitForReady = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseReady = resolve;
        })
    );
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
        fetchImpl: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
        spawn: vi.fn(() => childProcess as never),
        waitForReady
      }
    );

    try {
      const startPromise = llamaServer.start();
      await vi.waitFor(() => {
        expect(waitForReady).toHaveBeenCalledOnce();
      });
      releaseReady();
      await startPromise;

      llamaServer.stop();

      expect(childProcess.kill).toHaveBeenCalledWith("SIGTERM");
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});
