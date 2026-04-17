# Standalone Bot Setup

OpenACP has been removed from the runtime path. This project now runs as a standalone Discord bot service from this repository.

## Requirements

- Node.js 22+
- `codex` available on `PATH`
- `llama-server` available on `PATH`
- a Discord bot token
- one or more Discord guild IDs

## Install

```bash
npm install
```

## Environment

Set these before starting the bot:

```bash
export HACHI_DISCORD_BOT_TOKEN=...
export HACHI_ALLOWED_GUILD_IDS=...
export HACHI_REPO_ROOT=/path/to/hachi
export HACHI_LLAMA_SERVER_BIN=llama-server
```

`HACHI_ALLOWED_GUILD_IDS` accepts a comma-separated list. The bot ignores guilds outside that allow-list.

## Run

```bash
npm run dev
```

On first start, the bot downloads the default GGUF model into `.hachi/models/` and then starts `llama-server` locally.

## Runtime layout

- `.hachi/db/hachi.sqlite` - thread/session state and Codex run metadata
- `.hachi/logs/codex/` - raw Codex stdout/stderr logs
- `.hachi/models/` - downloaded GGUF models
- `.hachi/tmp/` - transient runtime state

## Discord-side requirements

- Enable `Message Content Intent`
- Invite the bot with scopes:
  - `bot`
  - `applications.commands`
- Grant permissions:
  - `Manage Channels`
  - `Manage Threads`
  - `Send Messages`
  - `Send Messages in Threads`
  - `Read Message History`

## Behavior

- Mention the bot in a guild text channel to create or reuse a dedicated thread.
- Follow-up messages in that managed thread do not need another mention.
- `/code` or `!code` forces Codex handoff.
- Other messages stay in the RP path unless the message clearly looks like programming or repo work.

## Repository policy

Commit:

- `.gitignore`
- `README.md`
- `.env.example`
- `config/defaults.jsonc`
- `prompts/`
- docs describing setup

Do not commit:

- `.hachi/`
- bot tokens
- generated logs
- machine-local state
