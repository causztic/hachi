import type Database from "better-sqlite3";

export type ThreadSessionRecord = {
  channelId: string;
  guildId: string;
  lastActivityAt: string;
  summary: string | null;
  threadId: string;
};

export function createSessionStore(db: Database.Database) {
  const upsertSession = db.prepare(`
    insert into thread_sessions (thread_id, channel_id, guild_id, last_activity_at, summary)
    values (@threadId, @channelId, @guildId, @lastActivityAt, @summary)
    on conflict(thread_id) do update set
      channel_id = excluded.channel_id,
      guild_id = excluded.guild_id,
      last_activity_at = excluded.last_activity_at,
      summary = excluded.summary
  `);

  return {
    save(record: ThreadSessionRecord) {
      upsertSession.run(record);
    }
  };
}
