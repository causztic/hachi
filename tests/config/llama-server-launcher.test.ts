import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("scripts/llama-server-wsl", () => {
  it("does not inject the container system library directory into LD_LIBRARY_PATH", async () => {
    const launcher = await readFile(
      new URL("../../scripts/llama-server-wsl", import.meta.url),
      "utf8"
    );

    expect(launcher).not.toContain("SYSTEM_LIB_DIR=");
    expect(launcher).not.toContain(
      'LAUNCHER_LD_LIBRARY_PATH="${RUNTIME_ROOT}/usr/lib/x86_64-linux-gnu'
    );
  });

  it("detects the bundled CUDA library directory dynamically and exposes libgomp without importing container libc", async () => {
    const launcher = await readFile(
      new URL("../../scripts/llama-server-wsl", import.meta.url),
      "utf8"
    );

    expect(launcher).not.toContain("cuda-12.8/targets/x86_64-linux/lib");
    expect(launcher).toContain("libgomp.so.1");
    expect(launcher).toContain("find");
    expect(launcher).toContain("targets/x86_64-linux/lib");
  });
});
