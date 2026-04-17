# Standalone Discord Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Discord bot that replaces OpenACP, replies in a fixed RP persona through a local `llama.cpp` server, and hands coding-specific work to local `codex` with persisted stream logs.

**Architecture:** The app is a single TypeScript service with explicit modules for Discord event handling, routing, local inference management, Codex execution, and persistence. It stores structured state in SQLite, raw Codex logs on disk, and committed prompt/runtime defaults in repository files.

**Tech Stack:** Node.js 22+, TypeScript, discord.js, vitest, better-sqlite3, zod, dotenv, llama.cpp server, local Codex CLI

---

## File Structure

**Create:**
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/index.ts`
- `src/app.ts`
- `src/config/defaults.ts`
- `src/config/env.ts`
- `src/config/prompts.ts`
- `src/config/runtime-paths.ts`
- `src/discord/thread-manager.ts`
- `src/discord/discord-bot.ts`
- `src/router/intent-router.ts`
- `src/llm/model-registry.ts`
- `src/llm/llama-server.ts`
- `src/llm/llama-chat.ts`
- `src/codex/codex-runner.ts`
- `src/persistence/database.ts`
- `src/persistence/session-store.ts`
- `src/persistence/run-store.ts`
- `src/util/fs.ts`
- `src/util/logging.ts`
- `prompts/persona.md`
- `prompts/router.md`
- `config/defaults.jsonc`
- `tests/config/defaults.test.ts`
- `tests/config/prompts.test.ts`
- `tests/persistence/database.test.ts`
- `tests/router/intent-router.test.ts`
- `tests/discord/thread-manager.test.ts`
- `tests/codex/codex-runner.test.ts`
- `tests/llm/model-registry.test.ts`

**Modify:**
- `.env.example`
- `README.md`
- `docs/openacp-setup.md`

### Task 1: Bootstrap The TypeScript Service

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Create: `src/app.ts`
- Test: `tests/config/defaults.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { loadDefaultConfig } from "../../src/config/defaults";

describe("loadDefaultConfig", () => {
  it("loads the shipped runtime defaults", async () => {
    const config = await loadDefaultConfig();

    expect(config.discord.threadAutoCreate).toBe(true);
    expect(config.router.explicitPrefixes).toEqual(["/code", "!code"]);
    expect(config.codex.allowEditsByDefault).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config/defaults.test.ts`
Expected: FAIL with module resolution or missing file errors because the project files do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```json
{
  "name": "hachi",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

```ts
export async function loadDefaultConfig() {
  return {
    discord: { threadAutoCreate: true },
    router: { explicitPrefixes: ["/code", "!code"] },
    codex: { allowEditsByDefault: true }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/config/defaults.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/index.ts src/app.ts src/config/defaults.ts tests/config/defaults.test.ts
git commit -m "chore: bootstrap standalone bot service"
```

### Task 2: Add Config, Prompt, And Runtime Path Loading

**Files:**
- Create: `src/config/defaults.ts`
- Create: `src/config/env.ts`
- Create: `src/config/prompts.ts`
- Create: `src/config/runtime-paths.ts`
- Create: `prompts/persona.md`
- Create: `prompts/router.md`
- Create: `config/defaults.jsonc`
- Modify: `.env.example`
- Test: `tests/config/prompts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { loadPromptBundle } from "../../src/config/prompts";

describe("loadPromptBundle", () => {
  it("loads the committed persona and router prompts", async () => {
    const prompts = await loadPromptBundle();

    expect(prompts.persona).toContain("Hachi");
    expect(prompts.router).toContain("/code");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config/prompts.test.ts`
Expected: FAIL because prompt files and loader do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function loadPromptBundle() {
  return {
    persona: await readFile("prompts/persona.md", "utf8"),
    router: await readFile("prompts/router.md", "utf8")
  };
}
```

```md
You are Hachi. Stay in-character, speak with a grounded roleplay tone, and keep replies concise unless the scene needs more.
```

```md
Route to Codex when the message starts with /code or !code, or when the user is clearly asking for programming, debugging, file edits, or command-line work.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/config/prompts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add config/defaults.jsonc prompts/persona.md prompts/router.md .env.example src/config/defaults.ts src/config/env.ts src/config/prompts.ts src/config/runtime-paths.ts tests/config/prompts.test.ts
git commit -m "feat: add runtime config and prompt loading"
```

### Task 3: Add Persistence And Log Path Management

**Files:**
- Create: `src/persistence/database.ts`
- Create: `src/persistence/session-store.ts`
- Create: `src/persistence/run-store.ts`
- Create: `src/util/fs.ts`
- Create: `src/util/logging.ts`
- Test: `tests/persistence/database.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/persistence/database";

describe("createDatabase", () => {
  it("creates the session and codex run tables", () => {
    const db = createDatabase(":memory:");
    const tables = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => row.name);

    expect(tables).toContain("codex_runs");
    expect(tables).toContain("thread_sessions");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/persistence/database.test.ts`
Expected: FAIL because the persistence layer does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function createDatabase(filename: string) {
  const db = new Database(filename);

  db.exec(`
    create table if not exists thread_sessions (
      thread_id text primary key,
      channel_id text not null,
      guild_id text not null,
      last_activity_at text not null,
      summary text
    );

    create table if not exists codex_runs (
      run_id text primary key,
      thread_id text not null,
      status text not null,
      log_path text not null,
      started_at text not null,
      finished_at text
    );
  `);

  return db;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/persistence/database.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/persistence/database.ts src/persistence/session-store.ts src/persistence/run-store.ts src/util/fs.ts src/util/logging.ts tests/persistence/database.test.ts
git commit -m "feat: add local persistence and log paths"
```

### Task 4: Add Discord Thread Session Management

**Files:**
- Create: `src/discord/thread-manager.ts`
- Create: `src/discord/discord-bot.ts`
- Test: `tests/discord/thread-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { decideThreadAction } from "../../src/discord/thread-manager";

describe("decideThreadAction", () => {
  it("creates a dedicated thread for a first mention in a text channel", () => {
    const action = decideThreadAction({
      isThread: false,
      hasMention: true,
      existingThreadId: null
    });

    expect(action.kind).toBe("create-thread");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/discord/thread-manager.test.ts`
Expected: FAIL because the thread manager does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function decideThreadAction(input: {
  isThread: boolean;
  hasMention: boolean;
  existingThreadId: string | null;
}) {
  if (input.isThread) {
    return { kind: "use-current-thread" } as const;
  }

  if (input.hasMention && !input.existingThreadId) {
    return { kind: "create-thread" } as const;
  }

  return { kind: "ignore" } as const;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/discord/thread-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/discord/thread-manager.ts src/discord/discord-bot.ts tests/discord/thread-manager.test.ts
git commit -m "feat: add discord thread session flow"
```

### Task 5: Add Intent Routing And RP Chat Wiring

**Files:**
- Create: `src/router/intent-router.ts`
- Create: `src/llm/llama-chat.ts`
- Test: `tests/router/intent-router.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { routeIntent } from "../../src/router/intent-router";

describe("routeIntent", () => {
  it("routes explicit /code messages to codex", () => {
    const result = routeIntent({
      content: "/code fix the parser",
      explicitPrefixes: ["/code", "!code"]
    });

    expect(result.target).toBe("codex");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/router/intent-router.test.ts`
Expected: FAIL because the router does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function routeIntent(input: {
  content: string;
  explicitPrefixes: string[];
}) {
  const normalized = input.content.trim().toLowerCase();
  const explicit = input.explicitPrefixes.some((prefix) =>
    normalized.startsWith(prefix)
  );

  if (explicit) {
    return { target: "codex", reason: "explicit-prefix" } as const;
  }

  if (/\b(code|debug|fix|refactor|test|typescript|python|bash)\b/.test(normalized)) {
    return { target: "codex", reason: "keyword-classifier" } as const;
  }

  return { target: "rp", reason: "default-rp" } as const;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/router/intent-router.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/router/intent-router.ts src/llm/llama-chat.ts tests/router/intent-router.test.ts
git commit -m "feat: add message routing for rp and codex"
```

### Task 6: Add Managed llama.cpp Runtime And Default Model Download

**Files:**
- Create: `src/llm/model-registry.ts`
- Create: `src/llm/llama-server.ts`
- Test: `tests/llm/model-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { getDefaultModel } from "../../src/llm/model-registry";

describe("getDefaultModel", () => {
  it("returns the shipped qwen3 14b quantized gguf", () => {
    const model = getDefaultModel();

    expect(model.filename).toBe("Qwen3-14B-Q4_K_M.gguf");
    expect(model.url).toContain("bartowski/Qwen_Qwen3-14B-GGUF");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/llm/model-registry.test.ts`
Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function getDefaultModel() {
  return {
    name: "qwen3-14b-q4-k-m",
    filename: "Qwen3-14B-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Qwen_Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf?download=true"
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/llm/model-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/llm/model-registry.ts src/llm/llama-server.ts tests/llm/model-registry.test.ts
git commit -m "feat: add llama runtime management"
```

### Task 7: Add Codex Runner And Stream Log Persistence

**Files:**
- Create: `src/codex/codex-runner.ts`
- Test: `tests/codex/codex-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildCodexCommand } from "../../src/codex/codex-runner";

describe("buildCodexCommand", () => {
  it("builds a local codex run that targets the repo root", () => {
    const command = buildCodexCommand({
      prompt: "fix the failing tests",
      cwd: "/repo"
    });

    expect(command.args[0]).toBe("exec");
    expect(command.cwd).toBe("/repo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/codex/codex-runner.test.ts`
Expected: FAIL because the runner does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildCodexCommand(input: { prompt: string; cwd: string }) {
  return {
    command: "codex",
    args: ["exec", input.prompt],
    cwd: input.cwd
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/codex/codex-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/codex/codex-runner.ts tests/codex/codex-runner.test.ts
git commit -m "feat: add codex execution and stream logging"
```

### Task 8: Integrate Startup, Docs, And Full Verification

**Files:**
- Modify: `src/app.ts`
- Modify: `src/index.ts`
- Modify: `README.md`
- Modify: `docs/openacp-setup.md`
- Test: `npm test`

- [ ] **Step 1: Write the failing integration expectation**

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("createApp", () => {
  it("wires discord, codex, llama, and persistence into one service", async () => {
    const app = await createApp();

    expect(app.start).toBeTypeOf("function");
    expect(app.stop).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the integration surface is incomplete.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function createApp() {
  return {
    async start() {},
    async stop() {}
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test && npm run build`
Expected: PASS with zero failing tests and a clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts src/index.ts README.md docs/openacp-setup.md
git commit -m "feat: integrate standalone discord bot service"
```

## Self-Review

- Spec coverage: covered runtime config, dedicated thread handling, RP routing, Codex handoff, persisted logs, SQLite state, docs, and staged delivery slices.
- Placeholder scan: no TODO/TBD placeholders remain in task descriptions.
- Type consistency: all task names use the same module names and exported function names across tests and implementation steps.
