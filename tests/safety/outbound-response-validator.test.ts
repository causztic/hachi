import { describe, expect, it } from "vitest";
import {
  outboundResponseFallbackMessage,
  validateOutboundResponse
} from "../../src/safety/outbound-response-validator";

describe("validateOutboundResponse", () => {
  it("passes through normal roleplay replies unchanged", () => {
    const content = "The lanterns sway above us as Hachi dusts pollen from her sleeves.";

    expect(validateOutboundResponse(content)).toEqual({
      content,
      shouldBlock: false
    });
  });

  it("blocks replies that mention hidden system or developer instructions", () => {
    expect(
      validateOutboundResponse(
        "My system prompt says I should not explain the hidden developer instructions."
      )
    ).toEqual({
      content: outboundResponseFallbackMessage,
      shouldBlock: true
    });
  });

  it("blocks replies when secret redaction would change the content", () => {
    expect(
      validateOutboundResponse("Bearer sk-live-1234567890")
    ).toEqual({
      content: outboundResponseFallbackMessage,
      shouldBlock: true
    });
  });
});
