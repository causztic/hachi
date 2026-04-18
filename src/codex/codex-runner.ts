import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { ensureDir } from "../util/fs";
import { buildCodexLogPath } from "../util/logging";

export function buildCodexCommand(input: {
  cwd: string;
  prompt: string;
  resumeSessionId?: string | null;
}) {
  const args = ["exec", "--json"];

  if (input.resumeSessionId) {
    args.push("resume", input.resumeSessionId, input.prompt);
  } else {
    args.push(input.prompt);
  }

  return {
    args,
    command: "codex",
    cwd: input.cwd
  };
}

export async function runCodex(input: {
  cwd: string;
  logsDir: string;
  onChunk?: (chunk: string) => void;
  onThreadStarted?: (threadId: string) => void;
  prompt: string;
  resumeSessionId?: string | null;
  runId: string;
}) {
  await ensureDir(input.logsDir);

  const command = buildCodexCommand({
    cwd: input.cwd,
    prompt: input.prompt,
    resumeSessionId: input.resumeSessionId
  });
  const logPath = buildCodexLogPath(
    { logsDir: input.logsDir },
    { runId: input.runId }
  );
  const logStream = createWriteStream(logPath, { flags: "a" });

  return await new Promise<{
    code: number | null;
    logPath: string;
    sessionId: string | null;
  }>((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let sessionId = input.resumeSessionId ?? null;
    let stdoutBuffer = "";

    const handleStdoutChunk = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      logStream.write(text);
      input.onChunk?.(text);
      stdoutBuffer += text;

      let newlineIndex = stdoutBuffer.indexOf("\n");

      while (newlineIndex !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

        if (line.length > 0) {
          const parsedEvent = parseCodexEvent(line);

          if (parsedEvent?.type === "thread.started") {
            sessionId = parsedEvent.thread_id;
            input.onThreadStarted?.(parsedEvent.thread_id);
          }
        }

        newlineIndex = stdoutBuffer.indexOf("\n");
      }
    };
    const handleStderrChunk = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      logStream.write(text);
      input.onChunk?.(text);
    };

    child.stdout.on("data", handleStdoutChunk);
    child.stderr.on("data", handleStderrChunk);
    child.on("error", (error) => {
      logStream.end();
      reject(error);
    });
    child.on("close", (code) => {
      const trailingLine = stdoutBuffer.trim();

      if (trailingLine.length > 0) {
        const parsedEvent = parseCodexEvent(trailingLine);

        if (parsedEvent?.type === "thread.started") {
          sessionId = parsedEvent.thread_id;
          input.onThreadStarted?.(parsedEvent.thread_id);
        }
      }

      logStream.end();
      resolve({
        code,
        logPath,
        sessionId
      });
    });
  });
}

function parseCodexEvent(line: string):
  | {
      thread_id: string;
      type: "thread.started";
    }
  | null {
  try {
    const parsed = JSON.parse(line) as { thread_id?: string; type?: string };

    if (
      parsed.type === "thread.started" &&
      typeof parsed.thread_id === "string"
    ) {
      return {
        thread_id: parsed.thread_id,
        type: "thread.started"
      };
    }
  } catch {
    return null;
  }

  return null;
}
