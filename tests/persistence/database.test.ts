import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
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
    const threadSessionColumns = (db
      .prepare("pragma table_info(thread_sessions)")
      .all()
      .map((row) => (row as { name: string }).name)) as string[];

    expect(tables).toContain("codex_runs");
    expect(tables).toContain("thread_sessions");
    expect(threadSessionColumns).toContain("codex_session_id");
  });

  it("adds the codex session id column to existing thread session tables", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "hachi-db-"));
    const dbPath = join(tempDir, "hachi.sqlite");
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      create table thread_sessions (
        thread_id text primary key,
        channel_id text not null,
        guild_id text not null,
        last_activity_at text not null,
        summary text
      );

      create table codex_runs (
        run_id text primary key,
        thread_id text not null,
        status text not null,
        log_path text not null,
        started_at text not null,
        finished_at text
      );
    `);
    legacyDb.close();

    try {
      const db = createDatabase(dbPath);
      const threadSessionColumns = (db
        .prepare("pragma table_info(thread_sessions)")
        .all()
        .map((row) => (row as { name: string }).name)) as string[];

      expect(threadSessionColumns).toContain("codex_session_id");
      db.close();
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
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
