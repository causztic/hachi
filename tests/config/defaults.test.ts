import { describe, expect, it } from "vitest";
import { loadDefaultConfig } from "../../src/config/defaults";

describe("loadDefaultConfig", () => {
  it("loads the shipped runtime defaults", async () => {
    const config = await loadDefaultConfig();

    expect(config.discord.threadAutoCreate).toBe(true);
    expect(config.router.explicitPrefixes).toEqual(["/code", "!code"]);
    expect(config.codex.allowEditsByDefault).toBe(true);
  });
});
