const promptInjectionPatterns = [
  /\b(ignore|disregard|override|bypass)\b(?:.{0,40})\b(all\s+)?(previous|above)\s+instructions?\b/i,
  /\b(reveal|show|print|dump|expose|repeat)\b(?:.{0,40})\b(your\s+)?(system\s+prompt|hidden\s+prompt|developer\s+message|instructions?)\b/i,
  /\b(what\s+are|tell\s+me\s+your|show\s+me\s+your|reveal\s+your)\b(?:.{0,20})\b(system\s+prompt|instructions?)\b/i
];

export const inboundPromptRefusalMessage =
  "Hachi won't repeat hidden instructions. Ask something gentle instead.";

export function shouldRefuseInboundPrompt(content: string): boolean {
  const normalizedContent = content.trim();

  return promptInjectionPatterns.some((pattern) => pattern.test(normalizedContent));
}
