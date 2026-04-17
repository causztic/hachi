import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/persistence/database";
import { buildCodexLogPath } from "../../src/util/logging";

describe("createDatabase", () => {
  it("creates the session and codex run tables", () => {
    const db = createDatabase(":memory:");
    const tables = (db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => (row as { name: string }).name)) as string[];

    expect(tables).toContain("codex_runs");
    expect(tables).toContain("thread_sessions");
  });
});

describe("buildCodexLogPath", () => {
  it("builds log files under the repo-local codex log directory", () => {
    const logPath = buildCodexLogPath(
      {
        logsDir: "/repo/.hachi/logs/codex"
      },
      {
        runId: "run-123"
      }
    );

    expect(logPath).toBe("/repo/.hachi/logs/codex/run-123.log");
  });
});
