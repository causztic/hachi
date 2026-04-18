import { describe, expect, it } from "vitest";
import { loadDefaultConfig } from "../../src/config/defaults";

describe("loadDefaultConfig", () => {
  it("loads the shipped runtime defaults", async () => {
    const config = await loadDefaultConfig();

    expect(config.discord.threadAutoCreate).toBe(true);
    expect(config.discord.codexHandoffAllowedUserIds).toEqual([
      "163565244810133504"
    ]);
    expect(config.discord.codexHandoffAllowedRoleIds).toEqual([]);
    expect(config.router.explicitPrefixes).toEqual(["/code", "!code"]);
    expect(config.codex.allowEditsByDefault).toBe(true);
    expect(config.llm.defaultModel.filename).toBe("Qwen3-14B-Q5_K_M.gguf");
    expect(config.llm.defaultModel.name).toBe("qwen3-14b-q5-k-m");
    expect(config.llm.defaultModel.url).toContain("Qwen/Qwen3-14B-GGUF");
    expect(config.llm.runtimeSource.registry).toBe("https://ghcr.io");
    expect(config.llm.runtimeSource.repository).toBe("ggml-org/llama.cpp");
    expect(config.llm.runtimeSource.tag).toBe("server-cuda-b7212");
    expect(config.llm.runtimeSource.platform.architecture).toBe("amd64");
    expect(config.llm.runtimeSource.platform.os).toBe("linux");
    expect(config.llm.serverBinary).toBe("scripts/llama-server-wsl");
  });
});
