# Llama Server Reuse Design

## Goal

Allow `npm run dev` to attach to an already running local llama-compatible server on `127.0.0.1:8080` when possible, while still starting the managed local runtime when nothing is listening.

## Startup Behavior

Hachi should probe `http://127.0.0.1:8080/v1/models` before spawning a managed `llama-server`.

- If the endpoint responds and includes the configured model ID, reuse the existing server.
- If the endpoint responds and explicitly lists different model IDs without the configured model, fail startup with a clear model mismatch error.
- If the endpoint is reachable but metadata is missing, malformed, or inconclusive, reuse the existing server anyway.
- If the endpoint is unreachable, start the managed local `llama-server` and wait for readiness before Discord login continues.

## Ownership

The managed server wrapper must track whether Hachi spawned the process itself.

- Reused external server: `stop()` must not send a signal.
- Managed server started by Hachi: `stop()` should continue to terminate it on shutdown.

## Testing

Add focused tests covering:

- reuse of an existing compatible server
- failure on explicit model mismatch
- preservation of existing start/wait behavior when no server is present
- `stop()` only terminating owned processes
