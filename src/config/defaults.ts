import { readFile } from "node:fs/promises";

export type DefaultConfig = {
  codex: {
    allowEditsByDefault: boolean;
    streamingUpdateIntervalMs: number;
  };
  discord: {
    codexHandoffAllowedRoleIds: string[];
    codexHandoffAllowedUserIds: string[];
    threadAutoCreate: boolean;
    threadIdleMinutes: number;
  };
  llm: {
    defaultModel: {
      filename: string;
      name: string;
      url: string;
    };
    serverBinary: string;
  };
  router: {
    explicitPrefixes: string[];
  };
};

export async function loadDefaultConfig(): Promise<DefaultConfig> {
  const rawConfig = await readFile(
    new URL("../../config/defaults.jsonc", import.meta.url),
    "utf8"
  );

  return JSON.parse(rawConfig) as DefaultConfig;
}
