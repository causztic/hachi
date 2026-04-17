import { describe, expect, it } from "vitest";
import { loadPromptBundle } from "../../src/config/prompts";

describe("loadPromptBundle", () => {
  it("loads the committed persona and router prompts", async () => {
    const prompts = await loadPromptBundle();

    expect(prompts.persona).toContain("Hachi");
    expect(prompts.router).toContain("/code");
  });
});
