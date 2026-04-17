# Official Runtime Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the missing local WSL llama runtime automatically from an official pinned `ggml-org/llama.cpp` prebuilt source before Hachi starts its managed server.

**Architecture:** Add committed runtime source metadata to defaults, add a runtime bootstrap helper for fetching and extracting the official GHCR image layers into `.hachi/bin/.../rootfs`, and call it only when Hachi needs to own the local server process.

**Tech Stack:** TypeScript, Node fetch, Vitest, GNU tar in WSL

---

### Task 1: Add runtime source metadata

**Files:**
- Modify: `config/defaults.jsonc`
- Modify: `src/config/defaults.ts`
- Modify: `tests/config/defaults.test.ts`

- [ ] **Step 1: Write the failing config assertion**
- [ ] **Step 2: Run `npm test -- tests/config/defaults.test.ts` and confirm it fails**
- [ ] **Step 3: Add the pinned official runtime source fields**
- [ ] **Step 4: Re-run `npm test -- tests/config/defaults.test.ts` and confirm it passes**

### Task 2: Add runtime bootstrap tests

**Files:**
- Modify: `tests/llm/llama-server.test.ts`
- Create: `tests/llm/runtime-bootstrap.test.ts`

- [ ] **Step 1: Write failing tests for missing runtime bootstrap, existing runtime skip, and bootstrap failure**
- [ ] **Step 2: Run `npm test -- tests/llm/runtime-bootstrap.test.ts tests/llm/llama-server.test.ts` and confirm it fails**

### Task 3: Implement official runtime bootstrap

**Files:**
- Create: `src/llm/runtime-bootstrap.ts`
- Modify: `src/llm/llama-server.ts`
- Modify: `src/config/runtime-paths.ts`
- Modify: `tests/llm/runtime-bootstrap.test.ts`
- Modify: `tests/llm/llama-server.test.ts`

- [ ] **Step 1: Implement pinned GHCR manifest resolution and layer extraction into `.hachi/bin/llama-server-cuda-linux/rootfs`**
- [ ] **Step 2: Wire bootstrap into the managed llama startup path only when Hachi must spawn its own server**
- [ ] **Step 3: Run `npm test -- tests/llm/runtime-bootstrap.test.ts tests/llm/llama-server.test.ts` and confirm it passes**
- [ ] **Step 4: Run `npm test -- tests/llm/runtime-bootstrap.test.ts tests/llm/llama-server.test.ts tests/llm/model-registry.test.ts` and confirm it passes**

### Task 4: Update docs and verify

**Files:**
- Modify: `README.md`
- Modify: `docs/openacp-setup.md`

- [ ] **Step 1: Update setup docs to explain automatic official runtime bootstrap**
- [ ] **Step 2: Run `npm test` and confirm full suite passes**
- [ ] **Step 3: Run `npm run build` and confirm it passes**
