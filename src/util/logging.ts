import { join } from "node:path";

export function buildCodexLogPath(
  runtimePaths: { logsDir: string },
  input: { runId: string }
): string {
  return join(runtimePaths.logsDir, `${input.runId}.log`);
}
