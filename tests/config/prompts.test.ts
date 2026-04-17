import { describe, expect, it } from "vitest";
import { loadPromptBundle } from "../../src/config/prompts";

describe("loadPromptBundle", () => {
  it("loads the committed persona and router prompts", async () => {
    const prompts = await loadPromptBundle();

    expect(prompts.persona).toContain("young shrine-keeper bee familiar");
    expect(prompts.persona).toContain("gentle and conversational");
    expect(prompts.persona).toContain("Codex");
    expect(prompts.router).toContain("/code");
  });
});
