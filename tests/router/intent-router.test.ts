import { describe, expect, it } from "vitest";
import { routeIntent } from "../../src/router/intent-router";

describe("routeIntent", () => {
  it("routes explicit /code messages to codex", () => {
    const result = routeIntent({
      content: "/code fix the parser",
      explicitPrefixes: ["/code", "!code"]
    });

    expect(result.target).toBe("codex");
    expect(result.reason).toBe("explicit-prefix");
  });

  it("routes coding keywords to codex when there is no explicit prefix", () => {
    const result = routeIntent({
      content: "please debug this failing test suite",
      explicitPrefixes: ["/code", "!code"]
    });

    expect(result.target).toBe("codex");
    expect(result.reason).toBe("keyword-classifier");
  });

  it("defaults non-coding messages to rp", () => {
    const result = routeIntent({
      content: "walk with me through the shrine at sunset",
      explicitPrefixes: ["/code", "!code"]
    });

    expect(result.target).toBe("rp");
    expect(result.reason).toBe("default-rp");
  });
});
