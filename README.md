# hachi

This repo stores the project-level OpenACP setup for running this workspace through Discord with Codex as the default agent.

Local runtime state and secrets live under `.openacp/` and are intentionally not committed.

## Committed files

- `.gitignore`
- `.env.example`
- `docs/openacp-setup.md`

## Local setup

1. Install the OpenACP CLI:

```bash
npm install -g @openacp/cli
```

2. Install the Discord adapter into the local workspace:

```bash
npm install @openacp/discord-adapter --prefix .openacp/plugins --save --ignore-scripts
```

3. Set the required Discord values:

```bash
export OPENACP_DISCORD_BOT_TOKEN=...
export OPENACP_DISCORD_GUILD_ID=...
```

4. Start OpenACP for this workspace:

```bash
openacp --dir /path/to/hachi --foreground
```

## Notes

- `.openacp/` contains secrets, logs, and local runtime state.
- The default agent for this workspace is `codex`.
- Discord setup still requires enabling Message Content Intent and inviting the bot with `bot` and `applications.commands` scopes.
