import { describe, expect, it } from "vitest";
import { redactSecretsInText } from "../../src/safety/secret-redaction";

describe("redactSecretsInText", () => {
  it("masks discord bot tokens, bearer tokens, and secret assignment values", () => {
    const input = [
      "discord bot token: 123456789012345678.ABCDEF.abcdefghijklmnopqrstuvwxyz123456",
      "DISCORD_BOT_TOKEN=abc.def.ghi",
      "Authorization: Bearer sk-live-1234567890",
      "password: hunter2",
      "api_key = key-123"
    ].join("\n");

    expect(redactSecretsInText(input)).toBe(
      [
        "discord bot token: [REDACTED]",
        "DISCORD_BOT_TOKEN=[REDACTED]",
        "Authorization: Bearer [REDACTED]",
        "password: [REDACTED]",
        "api_key = [REDACTED]"
      ].join("\n")
    );
  });

  it("keeps ordinary text unchanged", () => {
    expect(redactSecretsInText("please review this patch")).toBe(
      "please review this patch"
    );
  });
});
