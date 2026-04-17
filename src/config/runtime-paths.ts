import { join } from "node:path";

export type RuntimePaths = {
  databaseFile: string;
  logsDir: string;
  modelsDir: string;
  rootDir: string;
  tmpDir: string;
};

export function createRuntimePaths(repoRoot: string): RuntimePaths {
  const rootDir = join(repoRoot, ".hachi");

  return {
    databaseFile: join(rootDir, "db", "hachi.sqlite"),
    logsDir: join(rootDir, "logs", "codex"),
    modelsDir: join(rootDir, "models"),
    rootDir,
    tmpDir: join(rootDir, "tmp")
  };
}
