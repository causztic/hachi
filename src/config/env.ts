export type EnvConfig = {
  allowedGuildIds: string[];
  discordBotToken: string | null;
  llamaServerBin: string | null;
  repoRoot: string;
};

export function loadEnvConfig(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  const llamaServerBin = env.HACHI_LLAMA_SERVER_BIN?.trim() ?? "";

  return {
    allowedGuildIds: (env.HACHI_ALLOWED_GUILD_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    discordBotToken: env.HACHI_DISCORD_BOT_TOKEN ?? null,
    llamaServerBin: llamaServerBin === "" ? null : llamaServerBin,
    repoRoot: env.HACHI_REPO_ROOT ?? process.cwd()
  };
}
