import { describe, expect, it } from "vitest";
import { decideThreadAction } from "../../src/discord/thread-manager";

describe("decideThreadAction", () => {
  it("creates a dedicated thread for a first mention in a text channel", () => {
    const action = decideThreadAction({
      existingThreadId: null,
      hasMention: true,
      isThread: false
    });

    expect(action.kind).toBe("create-thread");
  });

  it("reuses the current thread for ongoing managed conversations", () => {
    const action = decideThreadAction({
      existingThreadId: "123",
      hasMention: false,
      isThread: true
    });

    expect(action.kind).toBe("use-current-thread");
  });
});
