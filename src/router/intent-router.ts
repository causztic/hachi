const CODE_KEYWORD_PATTERN =
  /\b(bash|bug|code|coding|debug|failing test|fix|git|parser|python|refactor|shell|terminal|typescript)\b/i;

export type IntentRoute =
  | { reason: "default-rp"; target: "rp" }
  | { reason: "explicit-prefix"; target: "codex" }
  | { reason: "keyword-classifier"; target: "codex" };

export function routeIntent(input: {
  content: string;
  explicitPrefixes: string[];
}): IntentRoute {
  const content = input.content.trim();
  const lowered = content.toLowerCase();

  if (input.explicitPrefixes.some((prefix) => lowered.startsWith(prefix))) {
    return {
      reason: "explicit-prefix",
      target: "codex"
    };
  }

  if (CODE_KEYWORD_PATTERN.test(content)) {
    return {
      reason: "keyword-classifier",
      target: "codex"
    };
  }

  return {
    reason: "default-rp",
    target: "rp"
  };
}
