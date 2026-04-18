import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

import { buildCodexCommand, runCodex } from "../../src/codex/codex-runner";

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

describe("buildCodexCommand", () => {
  it("builds a local codex run that targets the repo root", () => {
    const command = buildCodexCommand({
      cwd: "/repo",
      prompt: "fix the failing tests"
    });

    expect(command.command).toBe("codex");
    expect(command.args).toEqual(["exec", "--json", "fix the failing tests"]);
    expect(command.cwd).toBe("/repo");
  });

  it("builds a resume command when a prior codex session exists", () => {
    const command = buildCodexCommand({
      cwd: "/repo",
      prompt: "continue fixing the failing tests",
      resumeSessionId: "codex-thread-1"
    });

    expect(command.command).toBe("codex");
    expect(command.args).toEqual([
      "exec",
      "--json",
      "resume",
      "codex-thread-1",
      "continue fixing the failing tests"
    ]);
    expect(command.cwd).toBe("/repo");
  });
});

describe("runCodex", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("spawns codex in json mode, ignores stdin, and captures the codex session id", async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);
    const onThreadStarted = vi.fn();

    const runPromise = runCodex({
      cwd: "/repo",
      logsDir: "/tmp/hachi-test-codex-logs",
      onThreadStarted,
      prompt: "is mempalace setup for this project?",
      runId: "run-123"
    });

    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    child.stdout.emit(
      "data",
      Buffer.from('{"type":"thread.started","thread_id":"codex-thread-1"}\n')
    );
    child.emit("close", 0);

    const result = await runPromise;

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      ["exec", "--json", "is mempalace setup for this project?"],
      {
        cwd: "/repo",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    expect(onThreadStarted).toHaveBeenCalledWith("codex-thread-1");
    expect(result).toEqual({
      code: 0,
      logPath: "/tmp/hachi-test-codex-logs/run-123.log",
      sessionId: "codex-thread-1"
    });
  });
});
