import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("scripts/llama-server-wsl", () => {
  it("does not inject the container system library directory into LD_LIBRARY_PATH", async () => {
    const launcher = await readFile(
      new URL("../../scripts/llama-server-wsl", import.meta.url),
      "utf8"
    );

    expect(launcher).not.toContain("SYSTEM_LIB_DIR=");
    expect(launcher).not.toContain("usr/lib/x86_64-linux-gnu");
  });
});
