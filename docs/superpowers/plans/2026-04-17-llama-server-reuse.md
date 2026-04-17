# Llama Server Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse an already running local llama-compatible server on `127.0.0.1:8080` when it is compatible, and only start the managed runtime when nothing is available.

**Architecture:** Keep the behavior inside `createManagedLlamaServer()` so app bootstrap stays simple. Probe `/v1/models` first, decide reuse vs mismatch vs spawn, and track whether the process is owned so shutdown only kills managed processes.

**Tech Stack:** TypeScript, Node fetch, Vitest

---

### Task 1: Extend startup tests

**Files:**
- Modify: `tests/llm/llama-server.test.ts`
- Test: `tests/llm/llama-server.test.ts`

- [ ] **Step 1: Write the failing reuse and ownership tests**

Add focused tests that prove:
- `start()` does not spawn when `/v1/models` advertises the configured model
- `start()` rejects when `/v1/models` explicitly lists different models
- `stop()` does not kill a reused external server

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/llm/llama-server.test.ts`
Expected: FAIL on missing reuse and mismatch behavior

- [ ] **Step 3: Commit**

```bash
git add tests/llm/llama-server.test.ts
git commit -m "test: cover llama server reuse startup"
```

### Task 2: Implement reuse probing

**Files:**
- Modify: `src/llm/llama-server.ts`
- Test: `tests/llm/llama-server.test.ts`

- [ ] **Step 1: Write minimal implementation**

Add a probe step before spawn that:
- fetches `/v1/models`
- reuses the server when the configured model is present
- throws a clear mismatch error when the configured model is explicitly absent
- falls back to reuse when the server is reachable but metadata is inconclusive
- tracks owned vs reused server state for `stop()`

- [ ] **Step 2: Run focused tests to verify it passes**

Run: `npm test -- tests/llm/llama-server.test.ts`
Expected: PASS

- [ ] **Step 3: Run adjacent verification**

Run: `npm test -- tests/llm/llama-server.test.ts tests/llm/model-registry.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/llm/llama-server.ts tests/llm/llama-server.test.ts
git commit -m "feat: reuse compatible llama server on dev startup"
```

### Task 3: Full verification

**Files:**
- Modify: none
- Test: `tests/llm/llama-server.test.ts`

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS
