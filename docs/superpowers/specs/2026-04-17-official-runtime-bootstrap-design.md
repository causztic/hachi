# Official Runtime Bootstrap Design

## Goal

Let `npm run dev` bootstrap a missing local WSL llama runtime automatically from an official `ggml-org/llama.cpp` prebuilt source instead of failing on a missing `.hachi/bin/.../llama-server`.

## Source of Truth

Hachi should use an official prebuilt `llama.cpp` source only.

- Default runtime source: `ghcr.io/ggml-org/llama.cpp`
- Default pinned tag: `server-cuda-b8827`
- Platform target: `linux/amd64`

The pinned tag should live in committed config so future bumps are explicit and reviewable.

## Bootstrap Behavior

Before launching the managed local runtime, Hachi should verify that the expected binary exists at:

- `.hachi/bin/llama-server-cuda-linux/rootfs/app/llama-server`

If it is missing:

1. Download the pinned official GHCR image metadata and layers.
2. Resolve the manifest for `linux/amd64`.
3. Extract the image layers into `.hachi/bin/llama-server-cuda-linux/rootfs`.
4. Verify that `app/llama-server` exists and is executable enough for the WSL launcher path.

If the binary already exists, skip bootstrap entirely.

## Interaction With Existing Reuse Logic

Runtime bootstrap should only happen when Hachi decides it must start its own server. If a compatible server is already reachable on `127.0.0.1:8080`, keep reusing it and do not bootstrap anything.

## Failure Behavior

If bootstrap fails:

- fail startup loudly
- do not start Discord
- include a clear message naming the official source tag and the missing or failed artifact path

## Testing

Add focused tests for:

- existing runtime skips bootstrap
- missing runtime triggers bootstrap
- explicit bootstrap failure aborts startup
- existing server reuse path still skips bootstrap
