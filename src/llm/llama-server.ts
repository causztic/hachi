import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { ensureDir } from "../util/fs";
import {
  buildLlamaServerCommand,
  type DefaultModel
} from "./model-registry";

export type ManagedLlamaServerConfig = {
  host: string;
  model: DefaultModel;
  modelsDir: string;
  port: number;
  serverBinary: string;
};

export function createManagedLlamaServer(config: ManagedLlamaServerConfig) {
  let processRef: ChildProcessWithoutNullStreams | null = null;

  const modelPath = join(config.modelsDir, config.model.filename);

  return {
    async ensureModel() {
      try {
        await stat(modelPath);
        return modelPath;
      } catch {
        await ensureDir(config.modelsDir);
        const response = await fetch(config.model.url);
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
      const resolvedModelPath = await this.ensureModel();
      const command = buildLlamaServerCommand({
        host: config.host,
        modelPath: resolvedModelPath,
        port: config.port,
        serverBinary: config.serverBinary
      });

      processRef = spawn(command.command, command.args, {
        stdio: "pipe"
      });
    },
    stop() {
      processRef?.kill("SIGTERM");
      processRef = null;
    }
  };
}
