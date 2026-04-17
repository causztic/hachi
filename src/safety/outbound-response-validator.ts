import { redactSecretsInText } from "./secret-redaction";

const outboundInstructionLeakPatterns = [
  /\b(my|the|your)\s+(system\s+prompt|hidden\s+prompt|developer\s+message|developer\s+instructions?|hidden\s+instructions?)\b/i,
  /\b(system\s+prompt|hidden\s+prompt|developer\s+message|developer\s+instructions?|hidden\s+instructions?)\b(?:.{0,60})\b(says?|said|tells?|told|requires?|required|forbids?|forbidden|mentions?)\b/i,
  /\b(according\s+to|per)\b(?:.{0,20})\b(system\s+prompt|hidden\s+prompt|developer\s+message|developer\s+instructions?|hidden\s+instructions?)\b/i
];

export const outboundResponseFallbackMessage =
  "Hachi can't share that safely. Ask something gentle instead.";

export function validateOutboundResponse(content: string): {
  content: string;
  shouldBlock: boolean;
} {
  const normalizedContent = content.trim();

  if (redactSecretsInText(content) !== content) {
    return {
      content: outboundResponseFallbackMessage,
      shouldBlock: true
    };
  }

  if (
    outboundInstructionLeakPatterns.some((pattern) =>
      pattern.test(normalizedContent)
    )
  ) {
    return {
      content: outboundResponseFallbackMessage,
      shouldBlock: true
    };
  }

  return {
    content,
    shouldBlock: false
  };
}
