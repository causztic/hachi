import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { ensureDir } from "../util/fs";
import { buildCodexLogPath } from "../util/logging";

export function buildCodexCommand(input: { cwd: string; prompt: string }) {
  return {
    args: ["exec", input.prompt],
    command: "codex",
    cwd: input.cwd
  };
}

export async function runCodex(input: {
  cwd: string;
  logsDir: string;
  onChunk?: (chunk: string) => void;
  prompt: string;
  runId: string;
}) {
  await ensureDir(input.logsDir);

  const command = buildCodexCommand({
    cwd: input.cwd,
    prompt: input.prompt
  });
  const logPath = buildCodexLogPath(
    { logsDir: input.logsDir },
    { runId: input.runId }
  );
  const logStream = createWriteStream(logPath, { flags: "a" });

  return await new Promise<{
    code: number | null;
    logPath: string;
  }>((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
      stdio: "pipe"
    });

    const handleChunk = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      logStream.write(text);
      input.onChunk?.(text);
    };

    child.stdout.on("data", handleChunk);
    child.stderr.on("data", handleChunk);
    child.on("error", (error) => {
      logStream.end();
      reject(error);
    });
    child.on("close", (code) => {
      logStream.end();
      resolve({
        code,
        logPath
      });
    });
  });
}
