import type Database from "better-sqlite3";

export type ThreadSessionRecord = {
  channelId: string;
  codexSessionId?: string | null;
  guildId: string;
  lastActivityAt: string;
  summary: string | null;
  threadId: string;
};

export function createSessionStore(db: Database.Database) {
  const upsertSession = db.prepare(`
    insert into thread_sessions (
      thread_id,
      channel_id,
      guild_id,
      last_activity_at,
      summary,
      codex_session_id
    )
    values (
      @threadId,
      @channelId,
      @guildId,
      @lastActivityAt,
      @summary,
      @codexSessionId
    )
    on conflict(thread_id) do update set
      channel_id = excluded.channel_id,
      guild_id = excluded.guild_id,
      last_activity_at = excluded.last_activity_at,
      summary = excluded.summary,
      codex_session_id = coalesce(
        excluded.codex_session_id,
        thread_sessions.codex_session_id
      )
  `);
  const selectSession = db.prepare(`
    select
      thread_id as threadId,
      channel_id as channelId,
      guild_id as guildId,
      last_activity_at as lastActivityAt,
      summary,
      codex_session_id as codexSessionId
    from thread_sessions
    where thread_id = ?
  `);

  return {
    get(threadId: string): ThreadSessionRecord | null {
      return (selectSession.get(threadId) as ThreadSessionRecord | undefined) ?? null;
    },
    save(record: ThreadSessionRecord) {
      upsertSession.run({
        ...record,
        codexSessionId: record.codexSessionId ?? null
      });
    }
  };
}
