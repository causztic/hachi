import type Database from "better-sqlite3";

export type CodexRunRecord = {
  finishedAt: string | null;
  logPath: string;
  runId: string;
  startedAt: string;
  status: string;
  threadId: string;
};

export function createRunStore(db: Database.Database) {
  const upsertRun = db.prepare(`
    insert into codex_runs (run_id, thread_id, status, log_path, started_at, finished_at)
    values (@runId, @threadId, @status, @logPath, @startedAt, @finishedAt)
    on conflict(run_id) do update set
      status = excluded.status,
      log_path = excluded.log_path,
      finished_at = excluded.finished_at
  `);

  return {
    save(record: CodexRunRecord) {
      upsertRun.run(record);
    }
  };
}
