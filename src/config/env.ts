export type EnvConfig = {
  allowedGuildIds: string[];
  discordBotToken: string | null;
  llamaServerBin: string;
  repoRoot: string;
};

export function loadEnvConfig(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  return {
    allowedGuildIds: (env.HACHI_ALLOWED_GUILD_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    discordBotToken: env.HACHI_DISCORD_BOT_TOKEN ?? null,
    llamaServerBin: env.HACHI_LLAMA_SERVER_BIN ?? "llama-server",
    repoRoot: env.HACHI_REPO_ROOT ?? process.cwd()
  };
}
