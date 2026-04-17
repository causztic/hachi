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

2. Make sure `codex` is available on `PATH`:

```bash
codex --version
```

3. Set the required environment values:

```bash
export HACHI_DISCORD_BOT_TOKEN=...
export HACHI_ALLOWED_GUILD_IDS=...
```

4. Start the bot:

```bash
npm run dev
```

## Notes

- `scripts/llama-server-wsl` keeps the local model server inside WSL and loads the Linux CUDA runtime from `.hachi/bin/llama-server-cuda-linux/rootfs`.
- The first `llama.cpp` startup bootstraps the pinned official `ggml-org/llama.cpp:server-cuda-b7212` runtime into `.hachi/bin/llama-server-cuda-linux/rootfs`.
- The first `llama.cpp` startup also downloads the default GGUF into `.hachi/models/`.
- Set `HACHI_LLAMA_SERVER_BIN` only if you want to override the shipped WSL launcher.
- Set `HACHI_REPO_ROOT` only if you start the bot from outside the repo root.
- Codex run logs are written under `.hachi/logs/codex/`.
- Structured runtime state is stored in `.hachi/db/hachi.sqlite`.
- Discord setup still requires enabling Message Content Intent and inviting the bot with `bot` and `applications.commands` scopes.
- `/code` and `!code` force Codex handoff. Other messages use the RP model unless the lightweight router identifies clear coding intent.
