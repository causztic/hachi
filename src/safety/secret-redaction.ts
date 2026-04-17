const discordBotTokenPattern =
  /\b\d{17,19}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g;

const bearerTokenPattern = /\bBearer\s+([A-Za-z0-9._~+/=-]{8,})\b/g;

const assignmentPattern =
  /\b(api[_-]?key|apikey|token|secret|password|passwd|pwd|discord[_-]?bot[_-]?token|discord[_-]?token|bot[_-]?token)\b(\s*[:=]\s*)(["']?)([^"'\s,;)}\]]+)\3/gi;

function redactDiscordBotTokens(text: string): string {
  return text.replace(discordBotTokenPattern, "[REDACTED]");
}

function redactBearerTokens(text: string): string {
  return text.replace(bearerTokenPattern, "Bearer [REDACTED]");
}

function redactAssignmentValues(text: string): string {
  return text.replace(
    assignmentPattern,
    (_match, key: string, separator: string) => `${key}${separator}[REDACTED]`
  );
}

export function redactSecretsInText(text: string): string {
  return redactDiscordBotTokens(redactBearerTokens(redactAssignmentValues(text)));
}
