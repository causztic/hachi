import { describe, expect, it } from "vitest";
import { loadEnvConfig } from "../../src/config/env";

describe("loadEnvConfig", () => {
  it("leaves the llama server binary unset when no override is provided", () => {
    const config = loadEnvConfig({
      HACHI_ALLOWED_GUILD_IDS: "guild-1,guild-2",
      HACHI_DISCORD_BOT_TOKEN: "token",
      HACHI_REPO_ROOT: "/repo"
    });

    expect(config.allowedGuildIds).toEqual(["guild-1", "guild-2"]);
    expect(config.discordBotToken).toBe("token");
    expect(config.llamaServerBin).toBeNull();
    expect(config.repoRoot).toBe("/repo");
  });

  it("keeps an explicit llama server binary override", () => {
    const config = loadEnvConfig({
      HACHI_ALLOWED_GUILD_IDS: "",
      HACHI_LLAMA_SERVER_BIN: "/custom/llama-server"
    });

    expect(config.llamaServerBin).toBe("/custom/llama-server");
  });
});
