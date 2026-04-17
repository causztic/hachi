import { describe, expect, it } from "vitest";
import {
  buildLlamaServerCommand,
  getDefaultModel,
  resolveServerBinary
} from "../../src/llm/model-registry";

describe("getDefaultModel", () => {
  it("returns the shipped qwen3 14b quantized gguf", () => {
    const model = getDefaultModel();

    expect(model.filename).toBe("Qwen3-14B-Q5_K_M.gguf");
    expect(model.name).toBe("qwen3-14b-q5-k-m");
    expect(model.url).toContain("Qwen/Qwen3-14B-GGUF");
  });
});

describe("buildLlamaServerCommand", () => {
  it("builds a llama-server command for the configured model path", () => {
    const command = buildLlamaServerCommand({
      host: "127.0.0.1",
      modelPath: "/repo/.hachi/models/Qwen3-14B-Q5_K_M.gguf",
      port: 8080,
      serverBinary: "llama-server"
    });

    expect(command.command).toBe("llama-server");
    expect(command.args).toEqual([
      "--host",
      "127.0.0.1",
      "--port",
      "8080",
      "--model",
      "/repo/.hachi/models/Qwen3-14B-Q5_K_M.gguf"
    ]);
  });
});

describe("resolveServerBinary", () => {
  it("resolves repo-relative launcher paths from the repo root", () => {
    expect(resolveServerBinary("scripts/llama-server-wsl", "/repo")).toBe(
      "/repo/scripts/llama-server-wsl"
    );
  });

  it("leaves bare command names unchanged", () => {
    expect(resolveServerBinary("llama-server", "/repo")).toBe("llama-server");
  });
});
