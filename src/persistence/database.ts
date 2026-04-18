import Database from "better-sqlite3";

export function createDatabase(filename: string): Database.Database {
  const db = new Database(filename);

  db.exec(`
    create table if not exists thread_sessions (
      thread_id text primary key,
      channel_id text not null,
      guild_id text not null,
      last_activity_at text not null,
      summary text,
      codex_session_id text
    );

    create table if not exists codex_runs (
      run_id text primary key,
      thread_id text not null,
      status text not null,
      log_path text not null,
      started_at text not null,
      finished_at text
    );
  `);

  ensureColumn(db, "thread_sessions", "codex_session_id", "text");

  return db;
}

function ensureColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  columnDefinition: string
) {
  const existingColumn = db
    .prepare(`select 1 from pragma_table_info('${tableName}') where name = ?`)
    .get(columnName);

  if (!existingColumn) {
    db.exec(
      `alter table ${tableName} add column ${columnName} ${columnDefinition}`
    );
  }
}
