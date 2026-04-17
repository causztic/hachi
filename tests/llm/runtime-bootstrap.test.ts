import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ensureOfficialLlamaRuntime } from "../../src/llm/runtime-bootstrap";

function createJsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json"
    },
    status: 200
  });
}

describe("ensureOfficialLlamaRuntime", () => {
  it("skips bootstrap when the runtime binary already exists", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "hachi-runtime-bootstrap-"));
    const rootfsDir = join(tempRoot, "rootfs");
    const binaryPath = join(rootfsDir, "app", "llama-server");
    const fetchImpl = vi.fn();

    await mkdir(join(rootfsDir, "app"), { recursive: true });
    await writeFile(binaryPath, "binary", "utf8");

    try {
      await ensureOfficialLlamaRuntime(
        {
          rootfsDir,
          serverBinaryRelativePath: "app/llama-server",
          source: {
            platform: {
              architecture: "amd64",
              os: "linux"
            },
            registry: "https://ghcr.io",
            repository: "ggml-org/llama.cpp",
            tag: "server-cuda-b7212"
          },
          tmpDir: join(tempRoot, "tmp")
        },
        {
          fetchImpl
        }
      );

      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  it("downloads and extracts the official runtime layers when the binary is missing", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "hachi-runtime-bootstrap-"));
    const rootfsDir = join(tempRoot, "rootfs");
    const binaryPath = join(rootfsDir, "app", "llama-server");
    const tmpDir = join(tempRoot, "tmp");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          token: "token-123"
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          manifests: [
            {
              digest: "sha256:platform-manifest",
              platform: {
                architecture: "amd64",
                os: "linux"
              }
            }
          ],
          mediaType: "application/vnd.oci.image.index.v1+json"
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          layers: [
            {
              digest: "sha256:layer-1",
              mediaType: "application/vnd.oci.image.layer.v1.tar+gzip"
            },
            {
              digest: "sha256:layer-2",
              mediaType: "application/vnd.oci.image.layer.v1.tar+gzip"
            }
          ],
          mediaType: "application/vnd.oci.image.manifest.v1+json"
        })
      )
      .mockResolvedValueOnce(new Response("layer-1", { status: 200 }))
      .mockResolvedValueOnce(new Response("layer-2", { status: 200 }));
    const extractLayer = vi.fn(
      async (_archivePath: string, _mediaType: string, targetDir: string) => {
        await mkdir(join(targetDir, "app"), { recursive: true });
        await writeFile(binaryPath, "binary", "utf8");
      }
    );
    const log = vi.fn();

    try {
      await ensureOfficialLlamaRuntime(
        {
          rootfsDir,
          serverBinaryRelativePath: "app/llama-server",
          source: {
            platform: {
              architecture: "amd64",
              os: "linux"
            },
            registry: "https://ghcr.io",
            repository: "ggml-org/llama.cpp",
            tag: "server-cuda-b7212"
          },
          tmpDir
        },
        {
          extractLayer,
          fetchImpl,
          log
        }
      );

      expect(fetchImpl).toHaveBeenNthCalledWith(
        1,
        "https://ghcr.io/token?service=ghcr.io&scope=repository:ggml-org/llama.cpp:pull"
      );
      expect(fetchImpl).toHaveBeenNthCalledWith(
        2,
        "https://ghcr.io/v2/ggml-org/llama.cpp/manifests/server-cuda-b7212",
        expect.objectContaining({
          headers: expect.any(Object)
        })
      );
      expect(extractLayer).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining(
          "bootstrapping official llama runtime from https://ghcr.io/ggml-org/llama.cpp:server-cuda-b7212"
        )
      );
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("extracting runtime layer 1/2")
      );
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("official llama runtime ready")
      );
      await stat(binaryPath);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  it("fails when bootstrap completes without producing the runtime binary", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "hachi-runtime-bootstrap-"));
    const rootfsDir = join(tempRoot, "rootfs");
    const tmpDir = join(tempRoot, "tmp");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          token: "token-123"
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          layers: [
            {
              digest: "sha256:layer-1",
              mediaType: "application/vnd.oci.image.layer.v1.tar+gzip"
            }
          ],
          mediaType: "application/vnd.oci.image.manifest.v1+json"
        })
      )
      .mockResolvedValueOnce(new Response("layer-1", { status: 200 }));

    try {
      await expect(
        ensureOfficialLlamaRuntime(
          {
            rootfsDir,
            serverBinaryRelativePath: "app/llama-server",
            source: {
              platform: {
                architecture: "amd64",
                os: "linux"
              },
              registry: "https://ghcr.io",
              repository: "ggml-org/llama.cpp",
              tag: "server-cuda-b7212"
            },
            tmpDir
          },
          {
            extractLayer: vi.fn(),
            fetchImpl
          }
        )
      ).rejects.toThrow(/failed to bootstrap official llama runtime/i);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  it("surfaces a clear error when the configured official tag does not exist", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "hachi-runtime-bootstrap-"));
    const rootfsDir = join(tempRoot, "rootfs");
    const tmpDir = join(tempRoot, "tmp");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          token: "token-123"
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), {
          headers: {
            "content-type": "application/json"
          },
          status: 404
        })
      );

    try {
      await expect(
        ensureOfficialLlamaRuntime(
          {
            rootfsDir,
            serverBinaryRelativePath: "app/llama-server",
            source: {
              platform: {
                architecture: "amd64",
                os: "linux"
              },
              registry: "https://ghcr.io",
              repository: "ggml-org/llama.cpp",
              tag: "server-cuda-b9999"
            },
            tmpDir
          },
          {
            fetchImpl
          }
        )
      ).rejects.toThrow(/official llama runtime tag was not found/i);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});
