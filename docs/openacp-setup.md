# OpenACP Setup

This project uses a local OpenACP workspace in `.openacp/` and does not commit that directory.

## Requirements

- Node.js 20+
- `codex` available on `PATH`
- `@openacp/cli` installed
- a Discord bot token
- a Discord guild ID

## Install

```bash
npm install -g @openacp/cli
npm install @openacp/discord-adapter --prefix .openacp/plugins --save --ignore-scripts
```

## Environment

Set these before starting OpenACP:

```bash
export OPENACP_DISCORD_BOT_TOKEN=...
export OPENACP_DISCORD_GUILD_ID=...
```

You can also place equivalent values into the local OpenACP Discord settings file under `.openacp/plugins/data/@openacp/discord-adapter/settings.json`, but that file should stay uncommitted.

## Run

```bash
openacp --dir /path/to/hachi --foreground
```

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

## Repository policy

Commit:

- `.gitignore`
- `README.md`
- `.env.example`
- docs describing setup

Do not commit:

- `.openacp/`
- bot tokens
- generated logs
- machine-local state
