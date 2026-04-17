# Standalone Discord Bot Design

## Summary

Replace the existing OpenACP-based Discord setup with a standalone Discord bot application that:

- responds to tagged messages in guild text channels and threads
- creates or reuses a dedicated Discord thread for each managed conversation
- replies in a fixed RP persona using a local `llama.cpp` runtime
- hands coding-specific requests to local `codex`
- captures and persists Codex stream logs

The implementation should proceed in small, distinct slices. Each slice should be tracked in `bd`/beads, verified independently, committed separately, and pushed separately when a git remote is available.

## Goals

- Remove OpenACP from the runtime path entirely.
- Run as a single standalone service in this repository.
- Use a local GPU-backed `llama.cpp` inference path under WSL by default.
- Support one shipped RP persona, with user customization through prompt/config files.
- Route coding work to local `codex`, with file edits and local command execution allowed by default.
- Persist Codex stdout/stderr stream logs for later inspection.
- Keep Discord usage narrow in v1: guild text channels and threads only.
- Make the first version operationally simple to run, debug, and extend.

## Non-Goals

- DMs in v1
- multiple built-in personas in v1
- distributed workers or a queueing system in v1
- live Discord integration tests in CI
- policy-heavy permission systems beyond the explicit Discord and local runtime boundaries

## User-Approved Product Decisions

- OpenACP will be replaced entirely by a standalone bot.
- Coding requests will hand off to local `codex` automatically or via explicit triggers.
- Explicit `/code` or `!code` overrides automatic routing.
- Codex runs should keep stream logs.
- The bot should maintain active thread-local context after the first mention.
- The bot should support guild text channels and threads only.
- The local inference runtime should be `llama.cpp`.
- The application should pull a recommended default model automatically.
- Codex may edit files and run local commands by default.
- The bot should create or reuse a dedicated Discord thread by default.
- The shipped persona is fixed, but users may customize prompts/settings later.
- Delivery should be step-by-step, with separate commits and pushes per distinct change set, using beads when possible.

## Architecture

The application will be one TypeScript service with explicit internal module boundaries:

1. `discord gateway`
   Handles Discord login, gateway events, mention detection, thread creation/reuse, and outbound message streaming.

2. `conversation router`
   Decides whether an inbound message should go to RP chat or Codex. Explicit `/code` or `!code` wins. Otherwise a lightweight classifier plus rules routes coding requests to Codex and everything else to the RP path.

3. `llm runtime manager`
   Ensures a recommended GGUF model exists locally, validates `llama.cpp` binaries/config, starts `llama-server`, monitors it, and exposes a chat interface to the router.

4. `codex runner`
   Launches local `codex` processes in the repository, streams progress, captures raw stdout/stderr, persists logs, and reports state transitions back to Discord.

5. `state and persistence`
   Stores Discord thread bindings, active-session state, routing metadata, recent summaries, Codex run records, and local runtime settings.

This remains a single deployable service for v1, but the boundaries are strong enough to split the inference runtime or Codex worker out later if scaling or isolation becomes necessary.

## Discord Interaction Model

### Entry points

- The bot listens only in configured guilds.
- v1 responds only in guild text channels and threads.
- A first mention in a normal text channel causes the bot to create or reuse a dedicated Discord thread.

### Managed thread behavior

- The created thread becomes the canonical location for the conversation.
- Once a thread is active, subsequent messages in that thread do not need to mention the bot again.
- The bot keeps thread-local context active until the conversation goes idle.
- If thread creation fails, the bot may fall back to an inline reply with a clear error note.

### Routing

- `/code` or `!code` forces Codex routing.
- Otherwise, the router uses a lightweight classifier/rule set tuned to detect coding-specific requests.
- Misroutes are acceptable in v1 as long as the explicit trigger always overrides them.

## RP Response Path

The RP path builds a prompt from:

- the fixed persona system prompt
- routing/context instructions
- recent managed thread history
- optional session summary data from persistence

That prompt is sent to the local `llama.cpp` server. The response is streamed or chunk-posted back into the Discord thread.

The default shipped persona is singular and fixed, but prompt files remain user-editable so operators can customize tone and behavior without changing code.

## Codex Handoff Path

When the router selects Codex:

1. The bot creates a run record with a durable run ID.
2. It launches local `codex` in the repository root.
3. File edits and local command execution are allowed by default.
4. Stdout/stderr are captured incrementally and written to durable log files.
5. The Discord thread receives compact status updates while the run is active.
6. Completion, failure, or interruption is persisted and reported explicitly.

The bot should not dump raw full logs into Discord. Discord gets concise progress and outcome updates; the raw stream lives on disk.

## Configuration and File Layout

### Committed, user-editable files

- `prompts/persona.md`
  Fixed RP persona prompt.
- `prompts/router.md`
  Classification/routing instructions for RP vs Codex.
- `config/defaults.jsonc`
  Default Discord behavior, runtime defaults, Codex streaming limits, idle timeout, thread policy, and model metadata.
- setup and operator docs under `docs/`

### Local, uncommitted runtime state

Use a repo-local `.hachi/` directory:

- `.hachi/db/hachi.sqlite`
  Conversation state, thread bindings, run metadata, summaries.
- `.hachi/logs/codex/`
  Raw Codex stdout/stderr logs keyed by run ID.
- `.hachi/models/`
  Downloaded GGUF model files.
- `.hachi/tmp/`
  Scratch files, PID files, transient runtime state.

This keeps committed configuration distinct from machine-local state and secrets.

## Local Inference Runtime

v1 targets `llama.cpp` and treats it as a managed subprocess boundary.

### Runtime expectations

- The app validates configured paths for `llama-server` and related binaries at startup.
- If no model is present locally, it downloads a recommended default GGUF into `.hachi/models/`.
- The app owns the `llama-server` lifecycle once the service starts.
- The model path and runtime settings remain configurable so operators can replace the default model later.

### Default model guidance

The default should favor a fast instruct/RP model in the 12B-14B class rather than a very large model. The target environment is WSL with GPU access on a high-end consumer NVIDIA card, so the priority is low-latency Discord interaction, not maximum benchmark quality.

The exact model choice is an implementation detail, but the system must make that recommendation explicit in config and docs rather than burying it in code.

## Persistence

SQLite is the default structured store because it is simple, local, transactional, and adequate for a single-service deployment.

Persist at least:

- guild and thread bindings
- active/inactive conversation state
- idle timeout bookkeeping
- recent history window metadata
- conversation summaries
- Codex run IDs, statuses, start/end timestamps, log paths, and final outcome
- local runtime configuration snapshots if needed for debugging

Large raw logs should stay on disk, with SQLite storing references to them.

## Error Handling and Recovery

### `llama.cpp` failures

- If runtime validation fails at startup, fail loudly and refuse partial startup.
- If `llama-server` dies during operation, report a short runtime failure in Discord and preserve the thread context.

### Codex failures

- If Codex exits non-zero, the bot reports failure status and includes the saved log location in the persisted metadata.
- If the bot restarts while a Codex run is active, the thread should reflect that the prior run was interrupted or left in an unknown state.

### Discord failures

- If thread creation fails, surface that explicitly.
- Outbound Discord update failures should not lose Codex logs or persistence records.

The system should always prefer explicit degraded-state reporting over silent failure.

## Safety and Operational Boundaries

This bot is intentionally powerful. The v1 safety model is operational and scope-based:

- only operate in configured guilds
- only trigger from mention or active managed thread context
- always show when Codex work starts, is running, completes, or fails
- always persist run metadata and raw logs

No extra approval layer is required for Codex file edits or local command execution because the user explicitly approved default local edit/command access.

## Testing Strategy

### Unit tests

- routing decisions
- trigger precedence (`/code`, `!code`)
- thread binding and reuse rules
- config loading and validation
- prompt rendering
- Codex command construction
- log path generation

### Integration-style tests with mocks

- Discord mention in channel creates/reuses thread
- active thread messages continue without re-mention
- RP path calls the local runtime manager correctly
- Codex path creates run metadata, streams state, and persists logs
- restart/interruption state restoration

### Manual verification

- startup with default config
- first-run model download
- `llama.cpp` managed startup
- real Discord thread creation
- real Codex streaming flow

No live Discord or live model execution belongs in automated CI for v1.

## Delivery Plan Constraints

Implementation should proceed as small, separately reviewable slices tracked in `bd`:

1. repository bootstrap and app skeleton
2. configuration and prompt loading
3. Discord connection plus thread lifecycle
4. routing and RP path wiring
5. `llama.cpp` runtime management and model download
6. Codex runner and streamed log persistence
7. SQLite persistence and recovery
8. docs, verification, and operator setup

Each slice should follow the same workflow:

- create/claim a bead
- write failing tests first where behavior is changing
- implement the minimum code to pass
- run verification for that slice
- commit only that slice
- push that commit if a remote exists
- close the bead

## Open Questions Deferred To Implementation

These are intentionally left as implementation choices, not product questions:

- exact TypeScript runtime stack details
- the specific SQLite access library
- the exact recommended default GGUF model
- the exact Discord library helper abstractions
- whether response streaming is token-level or chunk-level in Discord

Those choices should be made conservatively based on the codebase state and verification results during implementation.
