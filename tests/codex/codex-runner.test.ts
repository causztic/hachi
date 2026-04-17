import { describe, expect, it } from "vitest";
import { buildCodexCommand } from "../../src/codex/codex-runner";

describe("buildCodexCommand", () => {
  it("builds a local codex run that targets the repo root", () => {
    const command = buildCodexCommand({
      cwd: "/repo",
      prompt: "fix the failing tests"
    });

    expect(command.command).toBe("codex");
    expect(command.args).toEqual(["exec", "fix the failing tests"]);
    expect(command.cwd).toBe("/repo");
  });
});
