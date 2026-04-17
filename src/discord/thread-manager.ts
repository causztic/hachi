export type ThreadDecisionInput = {
  existingThreadId: string | null;
  hasMention: boolean;
  isThread: boolean;
};

export type ThreadDecision =
  | { kind: "create-thread" }
  | { kind: "ignore" }
  | { kind: "use-current-thread" };

export function decideThreadAction(
  input: ThreadDecisionInput
): ThreadDecision {
  if (input.isThread && input.existingThreadId) {
    return { kind: "use-current-thread" };
  }

  if (!input.isThread && input.hasMention && !input.existingThreadId) {
    return { kind: "create-thread" };
  }

  return { kind: "ignore" };
}

export function buildThreadName(authorName: string): string {
  return `hachi-${authorName}`.toLowerCase().replace(/\s+/g, "-").slice(0, 90);
}
