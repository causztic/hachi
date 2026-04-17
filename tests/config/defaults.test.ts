import { describe, expect, it } from "vitest";
import { loadDefaultConfig } from "../../src/config/defaults";

describe("loadDefaultConfig", () => {
  it("loads the shipped runtime defaults", async () => {
    const config = await loadDefaultConfig();

    expect(config.discord.threadAutoCreate).toBe(true);
    expect(config.router.explicitPrefixes).toEqual(["/code", "!code"]);
    expect(config.codex.allowEditsByDefault).toBe(true);
    expect(config.llm.defaultModel.filename).toBe("Qwen3-14B-Q5_K_M.gguf");
    expect(config.llm.defaultModel.name).toBe("qwen3-14b-q5-k-m");
    expect(config.llm.defaultModel.url).toContain("Qwen/Qwen3-14B-GGUF");
  });
});
