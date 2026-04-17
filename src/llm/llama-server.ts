import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { connect } from "node:net";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { ensureDir } from "../util/fs";
import {
  buildLlamaServerCommand,
  type DefaultModel
} from "./model-registry";
import {
  ensureOfficialLlamaRuntime,
  type OfficialLlamaRuntimeConfig
} from "./runtime-bootstrap";

export type ManagedLlamaServerConfig = {
  host: string;
  model: DefaultModel;
  modelsDir: string;
  port: number;
  runtime?: OfficialLlamaRuntimeConfig;
  serverBinary: string;
};

type ManagedLlamaServerDependencies = {
  ensureDir?: typeof ensureDir;
  ensureRuntime?: () => Promise<void>;
  fetchImpl?: typeof fetch;
  sleep?: typeof sleep;
  spawn?: typeof spawn;
  stat?: typeof stat;
  waitForReady?: (input: {
    host: string;
    port: number;
    process: ChildProcessWithoutNullStreams;
  }) => Promise<void>;
};

type ExistingServerProbeResult =
  | { kind: "mismatch"; modelIds: string[] }
  | { kind: "reuse" }
  | { kind: "spawn" };

async function waitForServerReady(input: {
  host: string;
  port: number;
  sleepImpl: typeof sleep;
}): Promise<void> {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const isListening = await new Promise<boolean>((resolve) => {
      const socket = connect({
        host: input.host,
        port: input.port
      });

      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => {
        resolve(false);
      });
    });

    if (isListening) {
      return;
    }

    await input.sleepImpl(100);
  }

  throw new Error(
    `timed out waiting for llama-server on ${input.host}:${input.port}`
  );
}

async function probeExistingServer(input: {
  baseUrl: string;
  fetchImpl: typeof fetch;
  modelName: string;
}): Promise<ExistingServerProbeResult> {
  try {
    const response = await input.fetchImpl(`${input.baseUrl}/v1/models`);

    if (!response.ok) {
      return {
        kind: "reuse"
      };
    }

    const payload = (await response.json()) as {
      data?: Array<{
        id?: unknown;
      }>;
    };
    const modelIds = Array.isArray(payload.data)
      ? payload.data
          .map((entry) => (typeof entry?.id === "string" ? entry.id : null))
          .filter((entry): entry is string => entry !== null)
      : [];

    if (modelIds.includes(input.modelName)) {
      return {
        kind: "reuse"
      };
    }

    if (modelIds.length > 0) {
      return {
        kind: "mismatch",
        modelIds
      };
    }

    return {
      kind: "reuse"
    };
  } catch {
    return {
      kind: "spawn"
    };
  }
}

function watchForStartupFailure(input: {
  process: ChildProcessWithoutNullStreams;
  readOutput: () => string;
}) {
  let settled = false;
  let cleanup = () => undefined;

  const promise = new Promise<never>((_resolve, reject) => {
    const rejectWithMessage = (message: string) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const onError = (error: Error) => {
      rejectWithMessage(`llama-server failed to start: ${error.message}`);
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      const output = input.readOutput().trim();
      const reason =
        output.length > 0
          ? output
          : code !== null
            ? `exit code ${code}`
            : signal !== null
              ? `signal ${signal}`
              : "unknown reason";

      rejectWithMessage(
        `llama-server exited before becoming ready: ${reason}`
      );
    };

    cleanup = () => {
      input.process.off("error", onError);
      input.process.off("exit", onExit);
    };

    input.process.once("error", onError);
    input.process.once("exit", onExit);
  });

  return {
    dispose() {
      settled = true;
      cleanup();
    },
    promise
  };
}

export function createManagedLlamaServer(
  config: ManagedLlamaServerConfig,
  dependencies: ManagedLlamaServerDependencies = {}
) {
  let processRef: ChildProcessWithoutNullStreams | null = null;
  let ownsProcess = false;
  const statImpl = dependencies.stat ?? stat;
  const ensureDirImpl = dependencies.ensureDir ?? ensureDir;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const spawnImpl = dependencies.spawn ?? spawn;
  const sleepImpl = dependencies.sleep ?? sleep;
  const ensureRuntime =
    dependencies.ensureRuntime ??
    (config.runtime
      ? () => ensureOfficialLlamaRuntime(config.runtime as OfficialLlamaRuntimeConfig)
      : async () => undefined);

  const modelPath = join(config.modelsDir, config.model.filename);

  return {
    async ensureModel() {
      try {
        await statImpl(modelPath);
        return modelPath;
      } catch {
        await ensureDirImpl(config.modelsDir);
        const response = await fetchImpl(config.model.url);
        const responseBody = response.body;

        if (!response.ok || !responseBody) {
          throw new Error(`model download failed: ${response.status}`);
        }

        await new Promise<void>((resolve, reject) => {
          const file = createWriteStream(modelPath);
          responseBody.pipeTo(
            new WritableStream({
              abort(reason) {
                reject(reason);
              },
              close() {
                resolve();
              },
              write(chunk) {
                file.write(Buffer.from(chunk));
              }
            })
          ).catch(reject);
        });

        return modelPath;
      }
    },
    async start() {
      const existingServer = await probeExistingServer({
        baseUrl: `http://${config.host}:${config.port}`,
        fetchImpl,
        modelName: config.model.name
      });

      if (existingServer.kind === "reuse") {
        ownsProcess = false;
        processRef = null;
        return;
      }

      if (existingServer.kind === "mismatch") {
        throw new Error(
          `existing llama-server model mismatch: expected ${config.model.name}, found ${existingServer.modelIds.join(", ")}`
        );
      }

      await ensureRuntime();
      const resolvedModelPath = await this.ensureModel();
      const command = buildLlamaServerCommand({
        host: config.host,
        modelPath: resolvedModelPath,
        port: config.port,
        serverBinary: config.serverBinary
      });

      processRef = spawnImpl(command.command, command.args, {
        stdio: "pipe"
      });
      ownsProcess = true;

      let startupOutput = "";
      const appendOutput = (chunk: Buffer) => {
        startupOutput = `${startupOutput}${chunk.toString("utf8")}`.slice(-4000);
      };

      processRef.stdout.on("data", appendOutput);
      processRef.stderr.on("data", appendOutput);

      const startupFailure = watchForStartupFailure({
        process: processRef,
        readOutput: () => startupOutput
      });

      try {
        await Promise.race([
          startupFailure.promise,
          (
            dependencies.waitForReady ??
            ((input) =>
              waitForServerReady({
                host: input.host,
                port: input.port,
                sleepImpl
              }))
          )({
            host: config.host,
            port: config.port,
            process: processRef
          })
        ]);
      } catch (error) {
        processRef.kill("SIGTERM");
        processRef = null;
        ownsProcess = false;
        throw error;
      } finally {
        startupFailure.dispose();
      }
    },
    stop() {
      if (ownsProcess) {
        processRef?.kill("SIGTERM");
      }
      processRef = null;
      ownsProcess = false;
    }
  };
}
