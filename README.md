# hachi

This repo now runs a standalone Discord bot instead of OpenACP.

The bot:

- listens in guild text channels and threads
- creates or reuses a dedicated thread for managed conversations
- answers in a fixed RP persona through a local `llama.cpp` server
- hands coding-specific messages to local `codex`
- stores runtime state under `.hachi/`

## Committed files

- `.gitignore`
- `.env.example`
- `config/defaults.jsonc`
- `prompts/`
- `docs/openacp-setup.md`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Make sure the local runtimes are available on `PATH`:

```bash
codex --version
llama-server --version
```

3. Set the required environment values:

```bash
export HACHI_DISCORD_BOT_TOKEN=...
export HACHI_ALLOWED_GUILD_IDS=...
export HACHI_REPO_ROOT=/path/to/hachi
export HACHI_LLAMA_SERVER_BIN=llama-server
```

4. Start the bot:

```bash
npm run dev
```

## Notes

- The first `llama.cpp` startup downloads the default GGUF into `.hachi/models/`.
- Codex run logs are written under `.hachi/logs/codex/`.
- Structured runtime state is stored in `.hachi/db/hachi.sqlite`.
- Discord setup still requires enabling Message Content Intent and inviting the bot with `bot` and `applications.commands` scopes.
- `/code` and `!code` force Codex handoff. Other messages use the RP model unless the lightweight router identifies clear coding intent.
