import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/persistence/database";
import { createSessionStore } from "../../src/persistence/session-store";

describe("createSessionStore", () => {
  it("preserves the saved codex session id when later activity updates omit it", () => {
    const db = createDatabase(":memory:");
    const store = createSessionStore(db);

    store.save({
      channelId: "c1",
      codexSessionId: "codex-thread-1",
      guildId: "g1",
      lastActivityAt: "2026-04-18T02:00:00.000Z",
      summary: null,
      threadId: "t1"
    });
    store.save({
      channelId: "c1",
      codexSessionId: null,
      guildId: "g1",
      lastActivityAt: "2026-04-18T02:05:00.000Z",
      summary: null,
      threadId: "t1"
    });

    expect(store.get("t1")).toEqual({
      channelId: "c1",
      codexSessionId: "codex-thread-1",
      guildId: "g1",
      lastActivityAt: "2026-04-18T02:05:00.000Z",
      summary: null,
      threadId: "t1"
    });
  });
});
