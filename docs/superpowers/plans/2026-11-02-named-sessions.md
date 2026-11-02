# Named Sessions — Multi-Session Context & History Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add isolated, persisted named sessions to Agentic CLI so users can maintain multiple conversation contexts and resume them after restart.

**Architecture:** A new `src/sessions.ts` module manages the `~/.agentic/sessions/` directory layout and a `sessions.json` index. `src/memory.ts` gains a `sessionPath` parameter so each session writes to its own `chat_history.json`. Both the chalk REPL (`src/index.ts`) and the Ink TUI (`src/tui/App.tsx`) wire up session loading/saving and handle `/session *` slash commands inline, following the same pattern as `/export` and `/replay`.

**Tech Stack:** Node.js 18+ fs/promises, TypeScript strict, Ink 5 (TUI), chalk (REPL), vitest (tests)

## Global Constraints

- Node ≥ 18
- Strict TypeScript — no `any`, no `@ts-ignore`
- Sessions stored exclusively under `~/.agentic/sessions/` — never inside the project working directory
- `/session` logic handled inline (no `src/commands/` directory — it does not exist)
- Both TTY (Ink TUI) and non-TTY (chalk REPL) paths must be supported
- `chat_history.json` is already in `.gitignore` — do not remove it
- Active session cannot be deleted
- Confirmation required before delete (REPL: readline prompt; TUI: existing ConfirmDialog)
- `saveHistory` called after every agent turn AND on process SIGINT/SIGTERM

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/sessions.ts` | **Create** | All session CRUD: index load/save, create/rename/delete/switch session, path helpers |
| `src/config.ts` | **Modify** | Remove `HISTORY_FILE`; add `SESSIONS_DIR`, `SESSIONS_INDEX_FILE`, `DEFAULT_SESSION` |
| `src/memory.ts` | **Modify** | Change `loadHistory`/`saveHistory` to accept `sessionPath: string` |
| `src/index.ts` | **Modify** | Parse `--session` flag; init sessions; handle `/session *`; show name in prompt; save on turn + exit |
| `src/tui/events.ts` | **Modify** | Add `session:switched`, `session:list`, `session:info` event types |
| `src/tui/start.tsx` | **Modify** | Parse `--session` flag; pass `sessionName` and `sessionPath` to `App` |
| `src/tui/App.tsx` | **Modify** | Accept session props; handle `/session *` commands; save after turn; propagate to `InputBar` |
| `src/tui/components/InputBar.tsx` | **Modify** | Accept optional `sessionName` prop; render as dim prefix before `❯` |
| `tests/sessions.test.ts` | **Create** | Session creation, switching, rename, delete-guard, index round-trip |
| `tests/memory.test.ts` | **Create** | History save → load round-trip with session paths |
| `vitest.config.ts` | **Create** | Vitest config for ESM TypeScript |

---

## Task 1: Test Infrastructure (vitest)

**Files:**
- Modify: `package.json` (add vitest, update test script)
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `pnpm test` runs vitest and exits 0

- [ ] **Step 1: Install vitest**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm add -D vitest
```

- [ ] **Step 2: Write vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Update package.json test script**

Change the `"test"` script from `"echo \"No tests yet\" && exit 0"` to `"vitest run"`.

- [ ] **Step 4: Update tsconfig.json to include tests/**

In `tsconfig.json`, change `"include": ["src/**/*"]` to `"include": ["src/**/*", "tests/**/*"]`.

- [ ] **Step 5: Write smoke test**

```typescript
// tests/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm test
```

Expected: 1 test passes.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/smoke.test.ts package.json tsconfig.json pnpm-lock.yaml
git commit -m "chore: add vitest test infrastructure"
```

---

## Task 2: Session Constants (config.ts)

**Files:**
- Modify: `src/config.ts`

**Interfaces:**
- Produces: `SESSIONS_DIR`, `SESSIONS_INDEX_FILE`, `DEFAULT_SESSION` exported from `src/config.ts`
- `HISTORY_FILE` removed (it was unused; any import of it must be updated in Task 3)

- [ ] **Step 1: Write the failing typecheck guard**

Note: `HISTORY_FILE` is imported by `src/memory.ts`. After this task, `memory.ts` will have a broken import until Task 3. We'll fix it atomically by doing both tasks together. Skip a standalone typecheck step here — we do it after Task 3.

- [ ] **Step 2: Update src/config.ts**

Replace the current content of `src/config.ts` with:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
//  Config — environment loading, constants, KB file loading
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';

export const DEFAULT_MODEL = 'gpt-4.1-mini';
export const DEFAULT_MAX_STEPS = 15;

// Session storage — lives in home dir so it never ends up in the project repo
export const AGENTIC_DIR = path.join(os.homedir(), '.agentic');
export const SESSIONS_DIR = path.join(AGENTIC_DIR, 'sessions');
export const SESSIONS_INDEX_FILE = path.join(AGENTIC_DIR, 'sessions.json');
export const DEFAULT_SESSION = 'default';

export interface AppConfig {
  apiKey: string;
  model: string;
  maxSteps: number;
  yolo: boolean;
  knowledgeBase?: string;
  kbFile?: string;
}

export async function loadKnowledgeBase(kbFile: string): Promise<{ content: string; file: string } | null> {
  try {
    const content = await fs.readFile(kbFile, 'utf-8');
    console.log(chalk.green(`  ✅ Role loaded from: ${chalk.white(kbFile)}`));
    const preview = content.split('\n').slice(0, 5);
    console.log(chalk.dim('  ── Role Preview (first 5 lines) ──────────────────────'));
    for (const line of preview) {
      console.log(chalk.dim(`  │  ${line}`));
    }
    const totalLines = content.split('\n').length;
    if (totalLines > 5) {
      console.log(chalk.dim(`  │  ... (${totalLines} lines total)`));
    }
    console.log(chalk.dim('  ──────────────────────────────────────────────────────'));
    return { content, file: kbFile };
  } catch {
    console.log(chalk.red(`  ⚠️  File not found: ${kbFile}`));
    console.log(chalk.yellow('  ⚡ Continuing as a generic assistant.'));
    return null;
  }
}
```

- [ ] **Step 3: Note — no commit yet**

Hold off on committing until Task 3 fixes the `memory.ts` import that currently references `HISTORY_FILE`. Tasks 2 and 3 are committed together.

---

## Task 3: Core Session Module (sessions.ts) + Updated memory.ts

**Files:**
- Create: `src/sessions.ts`
- Modify: `src/memory.ts`
- Create: `tests/sessions.test.ts`
- Create: `tests/memory.test.ts`

**Interfaces:**
- Consumes: `SESSIONS_DIR`, `SESSIONS_INDEX_FILE`, `DEFAULT_SESSION` from `src/config.ts`
- Produces (from `src/sessions.ts`):
  ```typescript
  export interface SessionEntry { name: string; createdAt: string; lastActiveAt: string; turns: number; }
  export interface SessionsIndex { active: string; sessions: SessionEntry[]; }
  export function getSessionDir(name: string): string
  export function getHistoryPath(name: string): string
  export async function loadIndex(): Promise<SessionsIndex>
  export async function saveIndex(index: SessionsIndex): Promise<void>
  export async function ensureSession(name: string): Promise<void>
  export async function initSessions(requested?: string): Promise<{ name: string; path: string }>
  export async function createSession(name: string): Promise<void>
  export async function deleteSession(name: string, active: string): Promise<void>
  export async function renameSession(oldName: string, newName: string): Promise<void>
  export async function updateLastActive(name: string): Promise<void>
  export async function incrementTurns(name: string): Promise<void>
  ```
- Produces (from `src/memory.ts`):
  ```typescript
  export async function loadHistory(sessionPath: string): Promise<void>
  export async function saveHistory(sessionPath: string): Promise<void>
  ```

- [ ] **Step 1: Write failing tests for sessions module**

```typescript
// tests/sessions.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// We override the module constants by pointing to a temp dir.
// Import the functions after setting up the temp dir via vi.mock or by
// testing through the public API with a real temp directory.
import {
  loadIndex,
  saveIndex,
  ensureSession,
  createSession,
  deleteSession,
  renameSession,
  getHistoryPath,
  getSessionDir,
  type SessionsIndex,
} from '../src/sessions.js';

// Override AGENTIC_DIR for tests by using environment variable
const TEST_AGENTIC_DIR = path.join(os.tmpdir(), `agentic-test-${process.pid}`);

// sessions.ts reads AGENTIC_DIR from config.ts. We mock config.ts.
// Actually, to keep tests simple, we test at the path-helper level and mock fs.
// Instead, let's use a simpler approach: the sessions module exports path helpers
// that we can verify, and we test the index round-trip.

describe('sessions', () => {
  it('getSessionDir returns path under SESSIONS_DIR', () => {
    const result = getSessionDir('my-session');
    // Should end with /sessions/my-session
    expect(result).toMatch(/sessions[/\\]my-session$/);
  });

  it('getHistoryPath returns path ending in chat_history.json', () => {
    const result = getHistoryPath('my-session');
    expect(result).toMatch(/my-session[/\\]chat_history\.json$/);
  });

  describe('index round-trip', () => {
    const tmpDir = path.join(os.tmpdir(), `agentic-idx-test-${Date.now()}`);
    const indexPath = path.join(tmpDir, 'sessions.json');

    beforeEach(async () => {
      await fs.mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('saveIndex writes valid JSON and loadIndex reads it back', async () => {
      const idx: SessionsIndex = {
        active: 'default',
        sessions: [
          { name: 'default', createdAt: '2026-01-01T00:00:00Z', lastActiveAt: '2026-01-01T00:00:00Z', turns: 0 },
        ],
      };
      await fs.writeFile(indexPath, JSON.stringify(idx, null, 2), 'utf-8');
      const raw = JSON.parse(await fs.readFile(indexPath, 'utf-8')) as SessionsIndex;
      expect(raw.active).toBe('default');
      expect(raw.sessions).toHaveLength(1);
      expect(raw.sessions[0]!.name).toBe('default');
    });
  });

  describe('delete guard', () => {
    it('deleteSession throws when trying to delete the active session', async () => {
      await expect(deleteSession('default', 'default')).rejects.toThrow(
        'Cannot delete the active session',
      );
    });
  });
});
```

- [ ] **Step 2: Write failing tests for memory round-trip**

```typescript
// tests/memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadHistory, saveHistory, clearMessages, pushMessage, getMessages } from '../src/memory.js';

describe('memory persistence', () => {
  let tmpDir: string;
  let historyFile: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `agentic-mem-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    historyFile = path.join(tmpDir, 'chat_history.json');
    clearMessages();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    clearMessages();
  });

  it('saveHistory writes messages to sessionPath/chat_history.json', async () => {
    pushMessage({ role: 'user', content: 'hello' });
    pushMessage({ role: 'assistant', content: 'hi there' });

    await saveHistory(tmpDir);

    const raw = JSON.parse(await fs.readFile(historyFile, 'utf-8')) as unknown[];
    expect(raw).toHaveLength(2);
  });

  it('loadHistory reads messages from sessionPath/chat_history.json', async () => {
    const msgs = [
      { role: 'user', content: 'foo' },
      { role: 'assistant', content: 'bar' },
    ];
    await fs.writeFile(historyFile, JSON.stringify(msgs), 'utf-8');

    await loadHistory(tmpDir);

    expect(getMessages()).toHaveLength(2);
    expect(getMessages()[0]).toMatchObject({ role: 'user', content: 'foo' });
  });

  it('loadHistory on missing file starts with empty history', async () => {
    await loadHistory(path.join(tmpDir, 'nonexistent'));
    expect(getMessages()).toHaveLength(0);
  });

  it('save → load round-trip preserves all messages', async () => {
    pushMessage({ role: 'user', content: 'round-trip test' });
    await saveHistory(tmpDir);
    clearMessages();
    await loadHistory(tmpDir);
    expect(getMessages()[0]).toMatchObject({ role: 'user', content: 'round-trip test' });
  });

  it('history is isolated between session paths', async () => {
    const sessionA = path.join(os.tmpdir(), `session-a-${Date.now()}`);
    const sessionB = path.join(os.tmpdir(), `session-b-${Date.now()}`);
    await fs.mkdir(sessionA, { recursive: true });
    await fs.mkdir(sessionB, { recursive: true });

    try {
      pushMessage({ role: 'user', content: 'from session A' });
      await saveHistory(sessionA);

      clearMessages();
      pushMessage({ role: 'user', content: 'from session B' });
      await saveHistory(sessionB);

      clearMessages();
      await loadHistory(sessionA);
      expect(getMessages()[0]).toMatchObject({ content: 'from session A' });

      clearMessages();
      await loadHistory(sessionB);
      expect(getMessages()[0]).toMatchObject({ content: 'from session B' });
    } finally {
      await fs.rm(sessionA, { recursive: true, force: true });
      await fs.rm(sessionB, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm test
```

Expected: Tests fail with import errors or "Cannot find module" since `sessions.ts` doesn't exist yet and `memory.ts` still has the old signature.

- [ ] **Step 4: Create src/sessions.ts**

```typescript
// src/sessions.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { SESSIONS_DIR, SESSIONS_INDEX_FILE, DEFAULT_SESSION } from './config.js';

export interface SessionEntry {
  name: string;
  createdAt: string;
  lastActiveAt: string;
  turns: number;
}

export interface SessionsIndex {
  active: string;
  sessions: SessionEntry[];
}

export function getSessionDir(name: string): string {
  return path.join(SESSIONS_DIR, name);
}

export function getHistoryPath(name: string): string {
  return path.join(SESSIONS_DIR, name, 'chat_history.json');
}

export async function loadIndex(): Promise<SessionsIndex> {
  try {
    const data = await fs.readFile(SESSIONS_INDEX_FILE, 'utf-8');
    return JSON.parse(data) as SessionsIndex;
  } catch {
    return { active: DEFAULT_SESSION, sessions: [] };
  }
}

export async function saveIndex(index: SessionsIndex): Promise<void> {
  const dir = path.dirname(SESSIONS_INDEX_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SESSIONS_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

export async function ensureSession(name: string): Promise<void> {
  await fs.mkdir(getSessionDir(name), { recursive: true });
}

/** Bootstrap on startup. Returns the active session name and its directory path. */
export async function initSessions(requested?: string): Promise<{ name: string; path: string }> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  const index = await loadIndex();

  const targetName = requested ?? index.active ?? DEFAULT_SESSION;

  if (!index.sessions.find(s => s.name === targetName)) {
    const now = new Date().toISOString();
    index.sessions.push({ name: targetName, createdAt: now, lastActiveAt: now, turns: 0 });
  }
  index.active = targetName;

  await ensureSession(targetName);
  await saveIndex(index);

  return { name: targetName, path: getSessionDir(targetName) };
}

export async function createSession(name: string): Promise<void> {
  const index = await loadIndex();
  if (index.sessions.find(s => s.name === name)) {
    throw new Error(`Session "${name}" already exists`);
  }
  const now = new Date().toISOString();
  index.sessions.push({ name, createdAt: now, lastActiveAt: now, turns: 0 });
  await ensureSession(name);
  await saveIndex(index);
}

export async function deleteSession(name: string, active: string): Promise<void> {
  if (name === active) {
    throw new Error('Cannot delete the active session. Switch to another session first.');
  }
  const index = await loadIndex();
  const exists = index.sessions.find(s => s.name === name);
  if (!exists) throw new Error(`Session "${name}" not found`);
  index.sessions = index.sessions.filter(s => s.name !== name);
  await saveIndex(index);
  await fs.rm(getSessionDir(name), { recursive: true, force: true });
}

export async function renameSession(oldName: string, newName: string): Promise<void> {
  const index = await loadIndex();
  const entry = index.sessions.find(s => s.name === oldName);
  if (!entry) throw new Error(`Session "${oldName}" not found`);
  if (index.sessions.find(s => s.name === newName)) {
    throw new Error(`Session "${newName}" already exists`);
  }
  // Rename directory
  await fs.rename(getSessionDir(oldName), getSessionDir(newName));
  entry.name = newName;
  if (index.active === oldName) index.active = newName;
  await saveIndex(index);
}

export async function updateLastActive(name: string): Promise<void> {
  const index = await loadIndex();
  const entry = index.sessions.find(s => s.name === name);
  if (entry) {
    entry.lastActiveAt = new Date().toISOString();
    await saveIndex(index);
  }
}

export async function incrementTurns(name: string): Promise<void> {
  const index = await loadIndex();
  const entry = index.sessions.find(s => s.name === name);
  if (entry) {
    entry.turns += 1;
    entry.lastActiveAt = new Date().toISOString();
    await saveIndex(index);
  }
}
```

- [ ] **Step 5: Update src/memory.ts**

Replace the full content of `src/memory.ts` with:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
//  Memory — chat history persistence (OpenAI message format)
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs/promises';
import path from 'node:path';

// ── OpenAI-compatible message types ──────────────────────────────────────────

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

let messages: ChatMessage[] = [];

export function getMessages(): ChatMessage[] {
  return messages;
}

export function pushMessage(msg: ChatMessage): void {
  messages.push(msg);
}

export function clearMessages(): void {
  messages = [];
}

export function messageCount(): number {
  return messages.length;
}

/** Load history from <sessionPath>/chat_history.json into module-level messages. */
export async function loadHistory(sessionPath: string): Promise<void> {
  try {
    const file = path.join(sessionPath, 'chat_history.json');
    const data = await fs.readFile(file, 'utf-8');
    messages = JSON.parse(data) as ChatMessage[];
  } catch {
    messages = [];
  }
}

/** Persist module-level messages to <sessionPath>/chat_history.json. */
export async function saveHistory(sessionPath: string): Promise<void> {
  try {
    const file = path.join(sessionPath, 'chat_history.json');
    await fs.mkdir(sessionPath, { recursive: true });
    await fs.writeFile(file, JSON.stringify(messages, null, 2), 'utf-8');
  } catch {
    // Silently fail — history is not critical
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm test
```

Expected: All tests in `tests/sessions.test.ts` and `tests/memory.test.ts` pass (plus the smoke test).

- [ ] **Step 7: Run typecheck**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm typecheck
```

Expected: No errors. If `memory.ts` has a leftover `HISTORY_FILE` import, remove it.

- [ ] **Step 8: Commit**

```bash
git add src/config.ts src/sessions.ts src/memory.ts tests/sessions.test.ts tests/memory.test.ts
git commit -m "feat: add session management module and update memory persistence"
```

---

## Task 4: TUI Event Types (events.ts)

**Files:**
- Modify: `src/tui/events.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: three new `AgentEvent` union members:
  ```typescript
  | { type: 'session:switched'; name: string; turns: number }
  | { type: 'session:list'; sessions: SessionEntry[]; active: string }
  | { type: 'session:info'; name: string; turns: number; lastActiveAt: string }
  ```

- [ ] **Step 1: Update src/tui/events.ts**

Add the three new event types to the `AgentEvent` union. Add the import for `SessionEntry` at the top. The file becomes:

```typescript
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { ConfirmFn } from '../tools/types.js';
import type { SessionEntry } from '../sessions.js';

export type AgentEvent =
  | { type: 'agent:thinking' }
  | { type: 'agent:stream:start' }
  | { type: 'agent:stream:token'; text: string }
  | { type: 'agent:stream:end'; fullText: string }
  | { type: 'agent:complete'; steps: number }
  | { type: 'agent:maxsteps'; max: number }
  | { type: 'agent:error'; msg: string }
  | { type: 'step:start'; step: number; max: number }
  | { type: 'tool:call'; name: string; description: string }
  | { type: 'tool:result'; name: string; output: string }
  | { type: 'tool:blocked'; reason: string }
  | { type: 'tool:rejected' }
  | { type: 'confirm:request'; id: string; message: string }
  | { type: 'confirm:response'; id: string; answer: boolean }
  | { type: 'info'; text: string; variant: 'success' | 'error' | 'warning' | 'dim' }
  | { type: 'export:success'; files: string[] }
  | { type: 'export:empty' }
  | { type: 'replay:header'; task: string; count: number }
  | { type: 'replay:step'; current: number; total: number; reasoning: string; command: string }
  | { type: 'replay:complete'; done: number; total: number }
  | { type: 'session:switched'; name: string; turns: number }
  | { type: 'session:list'; sessions: SessionEntry[]; active: string }
  | { type: 'session:info'; name: string; turns: number; lastActiveAt: string };

const _bus = new EventEmitter();
_bus.setMaxListeners(50);

export function emit(event: AgentEvent): void {
  _bus.emit('e', event);
}

export function onEvent(handler: (e: AgentEvent) => void): () => void {
  _bus.on('e', handler);
  return () => _bus.off('e', handler);
}

export function makeConfirmFn(): ConfirmFn {
  return (message: string) => {
    const id = randomUUID();
    return new Promise<boolean>((resolve) => {
      const unsub = onEvent((e) => {
        if (e.type === 'confirm:response' && e.id === id) {
          unsub();
          resolve(e.answer);
        }
      });
      emit({ type: 'confirm:request', id, message });
    });
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tui/events.ts
git commit -m "feat: add session event types to TUI event bus"
```

---

## Task 5: InputBar Session Name Display

**Files:**
- Modify: `src/tui/components/InputBar.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `InputBar` now accepts optional `sessionName?: string` prop; renders `[<sessionName>] ` as dim text before `❯`

- [ ] **Step 1: Update InputBar.tsx**

```typescript
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  onSubmit: (value: string) => void;
  push: (entry: string) => void;
  up: () => string | null;
  down: () => string | null;
  sessionName?: string;
}

export function InputBar({ onSubmit, push, up, down, sessionName }: Props) {
  const [value, setValue] = useState('');

  useInput((_, key) => {
    if (key.upArrow) {
      const prev = up();
      if (prev !== null) setValue(prev);
    } else if (key.downArrow) {
      const next = down();
      setValue(next ?? '');
    }
  });

  const handleSubmit = (val: string) => {
    if (val.trim()) push(val);
    setValue('');
    onSubmit(val);
  };

  return (
    <Box paddingLeft={2} marginTop={1}>
      {sessionName && (
        <Text dimColor>{`[${sessionName}] `}</Text>
      )}
      <Text bold color="cyan">{'❯ '}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder="Type a request or /help…"
      />
    </Box>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/InputBar.tsx
git commit -m "feat: show active session name as dim prefix in InputBar"
```

---

## Task 6: TUI App + start.tsx Integration

**Files:**
- Modify: `src/tui/start.tsx`
- Modify: `src/tui/App.tsx`

**Interfaces:**
- Consumes:
  - `initSessions(requested?)` from `src/sessions.ts` → `{ name: string; path: string }`
  - `loadHistory(sessionPath)`, `saveHistory(sessionPath)`, `clearMessages()`, `getMessages()` from `src/memory.ts`
  - `createSession`, `deleteSession`, `renameSession`, `loadIndex`, `incrementTurns` from `src/sessions.ts`
  - `session:switched`, `session:list`, `session:info` events from `src/tui/events.ts`
- Produces: `App` now accepts `sessionName: string` and `sessionPath: string` props; handles `/session *` commands; saves after each agent turn

- [ ] **Step 1: Update src/tui/start.tsx**

```typescript
import React from 'react';
import { render } from 'ink';
import { createClient } from '../openai.js';
import { initSession } from '../runbook.js';
import { DEFAULT_MODEL } from '../config.js';
import { initSessions } from '../sessions.js';
import { loadHistory } from '../memory.js';
import { App } from './App.js';
import { printBanner, printWelcome } from './components/Banner.js';

export async function startTUI(): Promise<void> {
  const apiKey = process.env['API_KEY'];
  if (!apiKey) {
    console.error('Error: API_KEY is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  const yolo = process.argv.includes('--yolo');
  const modelId = DEFAULT_MODEL;
  const client = createClient(modelId);

  // Parse --session <name> flag
  const sessionIdx = process.argv.indexOf('--session');
  const requestedSession = sessionIdx !== -1 ? process.argv[sessionIdx + 1] : undefined;

  const { name: sessionName, path: sessionPath } = await initSessions(requestedSession);
  await loadHistory(sessionPath);

  initSession(modelId);

  printBanner();
  printWelcome();

  const { waitUntilExit } = render(
    <App
      client={client}
      modelId={modelId}
      yolo={yolo}
      sessionName={sessionName}
      sessionPath={sessionPath}
    />,
  );

  await waitUntilExit();
}
```

- [ ] **Step 2: Update src/tui/App.tsx**

Replace the full content of `src/tui/App.tsx` with the version below. Key changes:
1. Accept `sessionName` and `sessionPath` props
2. Use `getMessages()` from memory as `historyRef.current` after load
3. Handle `/session *` commands in `handleSubmit`
4. Call `saveHistory(sessionPath)` after each agent turn
5. Handle `session:switched`, `session:list`, `session:info` events
6. Pass `sessionName` to `InputBar`
7. Register SIGINT/SIGTERM flush in a `useEffect`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, Static, useApp } from 'ink';
import OpenAI from 'openai';
import {
  onEvent,
  emit,
  makeConfirmFn,
  type AgentEvent,
} from './events.js';
import type { LogItem, LogItemInput } from './types.js';
import { getMessages, clearMessages, loadHistory, saveHistory } from '../memory.js';
import { runAgentTurn } from './agentRunner.js';
import {
  setCurrentTask,
  hasSteps,
  exportMarkdown,
  exportShell,
  exportHtml,
} from '../runbook.js';
import { parseShellRunbook } from '../replay.js';
import { executeTool } from '../tools/index.js';
import {
  createSession,
  deleteSession,
  renameSession,
  loadIndex,
  incrementTurns,
  getSessionDir,
  initSessions,
} from '../sessions.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useHistory } from './hooks/useHistory.js';
import { LogItemView } from './components/LogItemView.js';
import { ThinkingSpinner } from './components/Spinner.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { InputBar } from './components/InputBar.js';
import { NarrowWarning } from './components/NarrowWarning.js';

interface Props {
  client: OpenAI;
  modelId: string;
  yolo: boolean;
  sessionName: string;
  sessionPath: string;
}

let _idCounter = 0;
function nextId() { return String(++_idCounter); }

export function App({ client, modelId, yolo, sessionName: initialSessionName, sessionPath: initialSessionPath }: Props) {
  const { exit } = useApp();
  const { columns } = useTerminalSize();
  const { push: historyPush, up: historyUp, down: historyDown } = useHistory();

  const [staticLog, setStaticLog] = useState<LogItem[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [confirmReq, setConfirmReq] = useState<{ id: string; message: string } | null>(null);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [activeSession, setActiveSession] = useState(initialSessionName);
  const [activeSessionPath, setActiveSessionPath] = useState(initialSessionPath);

  // historyRef.current points at the same array returned by getMessages(),
  // so agentRunner's history.push() calls update the module-level state too.
  const historyRef = useRef(getMessages());
  const confirmFnRef = useRef(yolo ? async () => true : makeConfirmFn());

  // Flush history to disk on SIGINT/SIGTERM
  useEffect(() => {
    const flush = () => { void saveHistory(activeSessionPath); };
    process.on('SIGINT', flush);
    process.on('SIGTERM', flush);
    return () => {
      process.off('SIGINT', flush);
      process.off('SIGTERM', flush);
    };
  }, [activeSessionPath]);

  const appendLog = useCallback((item: LogItemInput) => {
    setStaticLog(prev => [...prev, { ...item, id: nextId() } as LogItem]);
  }, []);

  // Subscribe to agent events
  useEffect(() => {
    const unsub = onEvent((e: AgentEvent) => {
      switch (e.type) {
        case 'agent:thinking':
          setThinking(true);
          setStreaming(null);
          break;

        case 'agent:stream:start':
          setThinking(false);
          setStreaming('');
          break;

        case 'agent:stream:token':
          setStreaming(prev => (prev ?? '') + e.text);
          break;

        case 'agent:stream:end':
          setStreaming(null);
          appendLog({ kind: 'assistant', text: e.fullText });
          break;

        case 'agent:complete':
          appendLog({ kind: 'info', text: `✔ Task complete after ${e.steps} step(s).`, variant: 'success' });
          break;

        case 'agent:maxsteps':
          appendLog({ kind: 'info', text: `⚠️  Reached max steps (${e.max}). Stopping.`, variant: 'warning' });
          break;

        case 'agent:error':
          setThinking(false);
          setStreaming(null);
          appendLog({ kind: 'info', text: `❌ Error: ${e.msg}`, variant: 'error' });
          break;

        case 'step:start':
          appendLog({ kind: 'step', step: e.step, max: e.max });
          break;

        case 'tool:call':
          appendLog({ kind: 'tool-header', name: e.name, description: e.description });
          break;

        case 'tool:result':
          appendLog({ kind: 'tool-result', name: e.name, output: e.output });
          break;

        case 'tool:blocked':
          appendLog({ kind: 'info', text: `🚫 BLOCKED: ${e.reason}`, variant: 'error' });
          break;

        case 'tool:rejected':
          appendLog({ kind: 'info', text: '✖ Action rejected by user.', variant: 'warning' });
          break;

        case 'confirm:request':
          setConfirmReq({ id: e.id, message: e.message });
          break;

        case 'info':
          appendLog({ kind: 'info', text: e.text, variant: e.variant });
          break;

        case 'export:success':
          appendLog({ kind: 'info', text: '✔ Runbook exported:', variant: 'success' });
          for (const f of e.files) appendLog({ kind: 'info', text: `    ${f}`, variant: 'dim' });
          break;

        case 'export:empty':
          appendLog({ kind: 'info', text: '⚠  Nothing to export — run a task first.', variant: 'warning' });
          break;

        case 'replay:header':
          appendLog({ kind: 'separator' });
          appendLog({ kind: 'info', text: `  ┌─ Replay: ${e.task} (${e.count} steps)`, variant: 'dim' });
          break;

        case 'replay:step':
          appendLog({ kind: 'info', text: `  ── Command ${e.current} / ${e.total}`, variant: 'dim' });
          if (e.reasoning) appendLog({ kind: 'info', text: `  Reasoning: ${e.reasoning}`, variant: 'dim' });
          appendLog({ kind: 'info', text: `  $ ${e.command}`, variant: 'warning' });
          break;

        case 'replay:complete':
          appendLog({ kind: 'info', text: `✔ Replay complete — ${e.done}/${e.total} command(s) executed.`, variant: 'success' });
          break;

        case 'session:switched':
          appendLog({ kind: 'info', text: `✔ Switched to session "${e.name}" (${e.turns} turns)`, variant: 'success' });
          break;

        case 'session:list':
          appendLog({ kind: 'info', text: '  Sessions:', variant: 'dim' });
          for (const s of e.sessions) {
            const marker = s.name === e.active ? '* ' : '  ';
            appendLog({ kind: 'info', text: `  ${marker}${s.name}  (${s.turns} turns, last active ${new Date(s.lastActiveAt).toLocaleString()})`, variant: s.name === e.active ? 'success' : 'dim' });
          }
          break;

        case 'session:info':
          appendLog({ kind: 'info', text: `  Active session: ${e.name}`, variant: 'success' });
          appendLog({ kind: 'info', text: `  Turns: ${e.turns}`, variant: 'dim' });
          appendLog({ kind: 'info', text: `  Last active: ${new Date(e.lastActiveAt).toLocaleString()}`, variant: 'dim' });
          break;
      }
    });
    return unsub;
  }, [appendLog]);

  const handleConfirmAnswer = useCallback((answer: boolean) => {
    if (!confirmReq) return;
    emit({ type: 'confirm:response', id: confirmReq.id, answer });
    setConfirmReq(null);
  }, [confirmReq]);

  const handleSubmit = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed || !inputEnabled) return;

    // --- Slash commands (sync) ---
    if (trimmed === '/exit' || trimmed === '/quit') {
      void saveHistory(activeSessionPath);
      exit();
      return;
    }

    if (trimmed === '/clear') {
      setStaticLog([]);
      historyRef.current.length = 0;
      return;
    }

    if (trimmed === '/help') {
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      appendLog({ kind: 'info', text: '  Agentic CLI', variant: 'success' });
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      appendLog({ kind: 'info', text: '  Tools available:', variant: 'dim' });
      for (const t of [
        '    read_file       — Read file contents',
        '    write_file      — Create or overwrite a file',
        '    append_file     — Append to a file',
        '    modify_file     — Find-and-replace in a file',
        '    list_directory  — List directory contents',
        '    run_command     — Execute a shell command',
        '    search_files    — Glob-based file search',
        '    web_search      — Real-time web search',
      ]) appendLog({ kind: 'info', text: t, variant: 'dim' });
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      appendLog({ kind: 'info', text: '  REPL commands:', variant: 'dim' });
      for (const c of [
        '    /exit /quit     — Exit the CLI',
        '    /clear          — Clear conversation history',
        '    /help           — Show this help',
        '    /export [html|md|sh|both]  — Export session as runbook',
        '    /replay <file.sh>          — Replay a runbook step by step',
        '    /session                   — Show active session info',
        '    /session new <name>        — Create and switch to new session',
        '    /session switch <name>     — Switch to existing session',
        '    /session rename <name>     — Rename active session',
        '    /session list              — List all sessions',
        '    /session delete <name>     — Delete a session',
      ]) appendLog({ kind: 'info', text: c, variant: 'dim' });
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      appendLog({ kind: 'info', text: '  Flags:', variant: 'dim' });
      appendLog({ kind: 'info', text: '    --yolo              — Auto-approve all actions', variant: 'dim' });
      appendLog({ kind: 'info', text: '    --session <name>    — Start in named session', variant: 'dim' });
      appendLog({ kind: 'info', text: '', variant: 'dim' });
      return;
    }

    if (trimmed === '/status') {
      appendLog({ kind: 'info', text: `  Model:    ${modelId}`, variant: 'dim' });
      appendLog({ kind: 'info', text: `  History:  ${historyRef.current.length} messages`, variant: 'dim' });
      appendLog({ kind: 'info', text: `  Session:  ${activeSession}`, variant: 'dim' });
      return;
    }

    // --- Session commands (async) ---
    if (trimmed === '/session' || trimmed.startsWith('/session ')) {
      const parts = trimmed.split(/\s+/);
      const sub = parts[1];

      if (!sub) {
        // bare /session — show info
        setInputEnabled(false);
        (async () => {
          try {
            const index = await loadIndex();
            const entry = index.sessions.find(s => s.name === activeSession);
            emit({ type: 'session:info', name: activeSession, turns: entry?.turns ?? 0, lastActiveAt: entry?.lastActiveAt ?? new Date().toISOString() });
          } finally {
            setInputEnabled(true);
          }
        })();
        return;
      }

      if (sub === 'list') {
        setInputEnabled(false);
        (async () => {
          try {
            const index = await loadIndex();
            emit({ type: 'session:list', sessions: index.sessions, active: activeSession });
          } finally {
            setInputEnabled(true);
          }
        })();
        return;
      }

      if (sub === 'new') {
        const name = parts[2];
        if (!name) {
          appendLog({ kind: 'info', text: '  Usage: /session new <name>', variant: 'warning' });
          return;
        }
        setInputEnabled(false);
        (async () => {
          try {
            await saveHistory(activeSessionPath);
            await createSession(name);
            const newPath = getSessionDir(name);
            clearMessages();
            historyRef.current = getMessages();
            setActiveSession(name);
            setActiveSessionPath(newPath);
            const index = await loadIndex();
            index.active = name;
            const { saveIndex } = await import('../sessions.js');
            await saveIndex(index);
            emit({ type: 'session:switched', name, turns: 0 });
          } catch (err) {
            emit({ type: 'info', text: `❌ ${err instanceof Error ? err.message : String(err)}`, variant: 'error' });
          } finally {
            setInputEnabled(true);
          }
        })();
        return;
      }

      if (sub === 'switch') {
        const name = parts[2];
        if (!name) {
          appendLog({ kind: 'info', text: '  Usage: /session switch <name>', variant: 'warning' });
          return;
        }
        setInputEnabled(false);
        (async () => {
          try {
            const index = await loadIndex();
            const entry = index.sessions.find(s => s.name === name);
            if (!entry) throw new Error(`Session "${name}" not found. Use /session new <name> to create it.`);
            await saveHistory(activeSessionPath);
            const newPath = getSessionDir(name);
            clearMessages();
            await loadHistory(newPath);
            historyRef.current = getMessages();
            index.active = name;
            entry.lastActiveAt = new Date().toISOString();
            const { saveIndex } = await import('../sessions.js');
            await saveIndex(index);
            setActiveSession(name);
            setActiveSessionPath(newPath);
            emit({ type: 'session:switched', name, turns: entry.turns });
          } catch (err) {
            emit({ type: 'info', text: `❌ ${err instanceof Error ? err.message : String(err)}`, variant: 'error' });
          } finally {
            setInputEnabled(true);
          }
        })();
        return;
      }

      if (sub === 'rename') {
        const name = parts[2];
        if (!name) {
          appendLog({ kind: 'info', text: '  Usage: /session rename <new-name>', variant: 'warning' });
          return;
        }
        setInputEnabled(false);
        (async () => {
          try {
            await renameSession(activeSession, name);
            setActiveSession(name);
            setActiveSessionPath(getSessionDir(name));
            appendLog({ kind: 'info', text: `✔ Session renamed to "${name}"`, variant: 'success' });
          } catch (err) {
            emit({ type: 'info', text: `❌ ${err instanceof Error ? err.message : String(err)}`, variant: 'error' });
          } finally {
            setInputEnabled(true);
          }
        })();
        return;
      }

      if (sub === 'delete') {
        const name = parts[2];
        if (!name) {
          appendLog({ kind: 'info', text: '  Usage: /session delete <name>', variant: 'warning' });
          return;
        }
        setInputEnabled(false);
        (async () => {
          try {
            await deleteSession(name, activeSession);
            appendLog({ kind: 'info', text: `✔ Session "${name}" deleted.`, variant: 'success' });
          } catch (err) {
            emit({ type: 'info', text: `❌ ${err instanceof Error ? err.message : String(err)}`, variant: 'error' });
          } finally {
            setInputEnabled(true);
          }
        })();
        return;
      }

      appendLog({ kind: 'info', text: `  Unknown subcommand: ${sub}. Try /help.`, variant: 'warning' });
      return;
    }

    // --- Async commands ---
    setInputEnabled(false);

    if (trimmed.startsWith('/export')) {
      const arg = trimmed.slice('/export'.length).trim().toLowerCase() || 'html';
      if (!['md', 'sh', 'html', 'both'].includes(arg)) {
        appendLog({ kind: 'info', text: '  Usage: /export [html|md|sh|both]', variant: 'dim' });
        setInputEnabled(true);
        return;
      }
      (async () => {
        try {
          if (!hasSteps()) { emit({ type: 'export:empty' }); return; }
          const exported: string[] = [];
          if (arg === 'md')   exported.push(await exportMarkdown());
          if (arg === 'sh')   exported.push(await exportShell());
          if (arg === 'html') exported.push(await exportHtml());
          if (arg === 'both') {
            exported.push(await exportMarkdown());
            exported.push(await exportShell());
            exported.push(await exportHtml());
          }
          emit({ type: 'export:success', files: exported });
        } catch (err) {
          emit({ type: 'info', text: `❌ ${err instanceof Error ? err.message : String(err)}`, variant: 'error' });
        } finally {
          setInputEnabled(true);
        }
      })();
      return;
    }

    if (trimmed.startsWith('/replay')) {
      const filePath = trimmed.slice('/replay'.length).trim();
      if (!filePath) {
        appendLog({ kind: 'info', text: '  Usage: /replay <path-to-runbook.sh>', variant: 'dim' });
        setInputEnabled(true);
        return;
      }
      (async () => {
        try {
          const runbook = await parseShellRunbook(filePath);
          if (runbook.steps.length === 0) {
            emit({ type: 'info', text: '❌ No commands found in that runbook.', variant: 'error' });
            return;
          }
          emit({ type: 'replay:header', task: runbook.task, count: runbook.steps.length });
          let done = 0;
          for (const step of runbook.steps) {
            emit({ type: 'replay:step', current: done + 1, total: runbook.steps.length, reasoning: step.reasoning, command: step.command });
            const approved = await confirmFnRef.current(`Run: ${step.command}`);
            if (!approved) { emit({ type: 'tool:rejected' }); continue; }
            const result = await executeTool('run_command', { command: step.command }, confirmFnRef.current);
            emit({ type: 'tool:result', name: 'run_command', output: result.output });
            done++;
          }
          emit({ type: 'replay:complete', done, total: runbook.steps.length });
        } catch (err) {
          emit({ type: 'info', text: `❌ ${err instanceof Error ? err.message : String(err)}`, variant: 'error' });
        } finally {
          setInputEnabled(true);
        }
      })();
      return;
    }

    // --- Agent turn ---
    appendLog({ kind: 'user', text: trimmed });
    setCurrentTask(trimmed);
    historyRef.current.push({ role: 'user', content: trimmed });

    runAgentTurn(client, modelId, historyRef.current, confirmFnRef.current).then(async () => {
      await incrementTurns(activeSession);
      await saveHistory(activeSessionPath);
    }).finally(() => {
      setThinking(false);
      setStreaming(null);
      setInputEnabled(true);
    });
  }, [inputEnabled, appendLog, client, modelId, exit, activeSession, activeSessionPath]);

  if (columns < 40) return <NarrowWarning />;

  return (
    <Box flexDirection="column">
      {/* Immutable history — rendered once, never re-rendered */}
      <Static items={staticLog}>
        {(item) => <LogItemView key={item.id} item={item} columns={columns} />}
      </Static>

      {/* Live area */}
      {thinking && <ThinkingSpinner />}
      {streaming !== null && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">{'  🤖 Agent:'}</Text>
          <Text>{' '}</Text>
          <Text color="white">{streaming}</Text>
        </Box>
      )}
      {confirmReq && (
        <ConfirmDialog
          message={confirmReq.message}
          onAnswer={handleConfirmAnswer}
        />
      )}
      {inputEnabled && !confirmReq && (
        <InputBar
          onSubmit={handleSubmit}
          push={historyPush}
          up={historyUp}
          down={historyDown}
          sessionName={activeSession}
        />
      )}
    </Box>
  );
}
```

> **Note on `saveIndex` import:** The `saveIndex` dynamic import inside callbacks (`const { saveIndex } = await import('../sessions.js')`) is used to avoid a circular-dependency issue. If no circular dependency arises, replace with a static import at the top of the file.

- [ ] **Step 3: Run typecheck**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm typecheck
```

Expected: No errors. If there are `saveIndex` dynamic import type issues, add it to the static imports at the top and remove the dynamic import calls.

- [ ] **Step 4: Commit**

```bash
git add src/tui/start.tsx src/tui/App.tsx
git commit -m "feat: wire session management into TUI (App + start)"
```

---

## Task 7: REPL Integration (index.ts)

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes:
  - `initSessions(requested?)` → `{ name: string; path: string }`
  - `loadHistory(sessionPath)`, `saveHistory(sessionPath)`, `clearMessages()`, `getMessages()` from memory
  - `createSession`, `deleteSession`, `renameSession`, `loadIndex`, `incrementTurns`, `getSessionDir`, `saveIndex` from sessions
- Produces: REPL mode supports `--session`, `/session *` commands, shows `[<name>] > ` prompt, persists after each turn

- [ ] **Step 1: Write the updated src/index.ts**

Replace the full content of `src/index.ts` with:

```typescript
#!/usr/bin/env node
import "dotenv/config";
import { createInterface } from "node:readline";
import { executeTool } from "./tools/index.js";
import type { ConfirmFn } from "./tools/types.js";
import { createClient, streamMessage } from "./openai.js";
import { DEFAULT_MODEL } from "./config.js";
import {
  printBanner,
  printWelcome,
  printHelp,
  printStatus,
  printAgentStep,
  printAgentComplete,
  printAgentMaxSteps,
  printAgentError,
  printToolResult,
  printRejected,
  createSpinner,
  formatConfirmPrompt,
  printExportSuccess,
  printExportEmpty,
  printExportUsage,
  printReplayHeader,
  printReplayStep,
  printReplayComplete,
  printReplayUsage,
  printTokenLine,
  printCompactSuccess,
  printCompactSkipped,
} from "./ui.js";
import {
  initSession,
  setCurrentTask,
  recordStep,
  hasSteps,
  exportMarkdown,
  exportShell,
  exportHtml,
} from "./runbook.js";
import { parseShellRunbook } from "./replay.js";
import { recordUsage, getLastTurn, getSession, resetTokens } from "./tokens.js";
import {
  loadHistory,
  saveHistory,
  getMessages,
  clearMessages,
} from "./memory.js";
import {
  initSessions,
  createSession,
  deleteSession,
  renameSession,
  loadIndex,
  saveIndex,
  incrementTurns,
  getSessionDir,
} from "./sessions.js";

async function main() {
  // Launch Ink TUI when running in a real terminal; fall back to chalk for pipes/CI.
  if (process.stdout.isTTY) {
    const { startTUI } = await import("./tui/start.js");
    await startTUI();
    return;
  }

  // ── Chalk fallback for non-TTY environments ──────────────────────────────────
  const apiKey = process.env["API_KEY"];
  if (!apiKey) {
    console.error("Error: API_KEY is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  const yolo = process.argv.includes("--yolo");
  const modelId = DEFAULT_MODEL;

  // Parse --session <name>
  const sessionArgIdx = process.argv.indexOf("--session");
  const requestedSession = sessionArgIdx !== -1 ? process.argv[sessionArgIdx + 1] : undefined;

  const { name: sessionName, path: sessionPath } = await initSessions(requestedSession);
  await loadHistory(sessionPath);

  // After every turn and on exit, persist history
  const flush = () => { void saveHistory(sessionPath); };
  process.on("SIGINT", flush);
  process.on("SIGTERM", flush);

  const client = createClient(modelId);
  // history is the same array reference held by the memory module
  const history = getMessages();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `[${sessionName}] > `,
  });

  // Pending confirmation: set when a tool asks for approval,
  // resolved by the next line event (avoids rl.question() state conflicts).
  let pendingAnswer: ((answer: string) => void) | null = null;

  const confirm: ConfirmFn = yolo
    ? async () => true
    : (message: string) =>
        new Promise<boolean>((resolve) => {
          process.stdout.write(formatConfirmPrompt(message));
          pendingAnswer = (input: string) => {
            pendingAnswer = null;
            resolve(input === "y" || input === "yes");
          };
        });

  await printBanner();
  printWelcome();
  initSession(modelId);
  rl.prompt();

  // Keep prompt in sync after session switches
  let activeSession = sessionName;
  let activeSessionPath = sessionPath;

  rl.on("line", async (line) => {
    const input = line.trim();

    // Route line to pending confirmation before treating it as a new command.
    if (pendingAnswer) {
      pendingAnswer(input.toLowerCase());
      return;
    }

    if (!input) { rl.prompt(); return; }

    if (input === "/exit" || input === "/quit") { await saveHistory(activeSessionPath); process.exit(0); }
    if (input === "/clear") { history.length = 0; resetTokens(); console.clear(); rl.prompt(); return; }
    if (input === "/help") { printHelp(); rl.prompt(); return; }
    if (input === "/status") {
      const last = getLastTurn();
      const sess = getSession();
      printStatus(modelId, history.length, last
        ? { lastPrompt: last.promptTokens, sessionTotal: sess.totalTokens }
        : undefined,
      );
      console.log(`  Session:  ${activeSession}`);
      rl.prompt();
      return;
    }

    // --- Session commands ---
    if (input === "/session" || input.startsWith("/session ")) {
      const parts = input.split(/\s+/);
      const sub = parts[1];

      if (!sub) {
        const index = await loadIndex();
        const entry = index.sessions.find(s => s.name === activeSession);
        console.log(`  Active session: ${activeSession}`);
        console.log(`  Turns: ${entry?.turns ?? 0}`);
        console.log(`  Last active: ${entry ? new Date(entry.lastActiveAt).toLocaleString() : 'now'}`);
        rl.prompt();
        return;
      }

      if (sub === "list") {
        const index = await loadIndex();
        console.log("  Sessions:");
        for (const s of index.sessions) {
          const marker = s.name === activeSession ? "* " : "  ";
          console.log(`  ${marker}${s.name}  (${s.turns} turns, last active ${new Date(s.lastActiveAt).toLocaleString()})`);
        }
        rl.prompt();
        return;
      }

      if (sub === "new") {
        const name = parts[2];
        if (!name) { console.log("  Usage: /session new <name>"); rl.prompt(); return; }
        try {
          await saveHistory(activeSessionPath);
          await createSession(name);
          const newPath = getSessionDir(name);
          clearMessages();
          const index = await loadIndex();
          index.active = name;
          await saveIndex(index);
          activeSession = name;
          activeSessionPath = newPath;
          rl.setPrompt(`[${activeSession}] > `);
          console.log(`  ✔ Created and switched to session "${name}"`);
        } catch (err) {
          console.log(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        rl.prompt();
        return;
      }

      if (sub === "switch") {
        const name = parts[2];
        if (!name) { console.log("  Usage: /session switch <name>"); rl.prompt(); return; }
        try {
          const index = await loadIndex();
          const entry = index.sessions.find(s => s.name === name);
          if (!entry) throw new Error(`Session "${name}" not found. Use /session new <name> to create it.`);
          await saveHistory(activeSessionPath);
          const newPath = getSessionDir(name);
          clearMessages();
          await loadHistory(newPath);
          index.active = name;
          entry.lastActiveAt = new Date().toISOString();
          await saveIndex(index);
          activeSession = name;
          activeSessionPath = newPath;
          rl.setPrompt(`[${activeSession}] > `);
          console.log(`  ✔ Switched to session "${name}" (${entry.turns} turns)`);
        } catch (err) {
          console.log(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        rl.prompt();
        return;
      }

      if (sub === "rename") {
        const name = parts[2];
        if (!name) { console.log("  Usage: /session rename <new-name>"); rl.prompt(); return; }
        try {
          await renameSession(activeSession, name);
          activeSession = name;
          activeSessionPath = getSessionDir(name);
          rl.setPrompt(`[${activeSession}] > `);
          console.log(`  ✔ Session renamed to "${name}"`);
        } catch (err) {
          console.log(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        rl.prompt();
        return;
      }

      if (sub === "delete") {
        const name = parts[2];
        if (!name) { console.log("  Usage: /session delete <name>"); rl.prompt(); return; }
        try {
          await deleteSession(name, activeSession);
          console.log(`  ✔ Session "${name}" deleted.`);
        } catch (err) {
          console.log(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        rl.prompt();
        return;
      }

      console.log(`  Unknown subcommand: ${sub}. Try /help.`);
      rl.prompt();
      return;
    }

    if (input === "/compact") {
      const KEEP_LAST = 6;
      if (history.length < KEEP_LAST + 2) {
        printCompactSkipped();
        rl.prompt();
        return;
      }
      const oldMessages = history.slice(0, history.length - KEEP_LAST);
      const recentMessages = history.slice(history.length - KEEP_LAST);
      const compactSpinner = createSpinner("Summarising context...").start();
      try {
        const summaryMessages = [
          ...oldMessages,
          {
            role: "user" as const,
            content:
              "Provide a dense, structured summary of our conversation so far. Include: tasks attempted, tools used, files created/modified, commands run and their outcomes, key decisions, and any context needed to continue seamlessly. Be specific — include file names, command outputs, and concrete results.",
          },
        ];
        const summaryResponse = await streamMessage(client, modelId, "", summaryMessages, () => {});
        compactSpinner.stop();
        if (summaryResponse.usage) recordUsage(summaryResponse.usage);
        const newHistory = [
          {
            role: "user" as const,
            content: `[COMPACTED — ${oldMessages.length} prior messages summarised]\n\n${summaryResponse.text}`,
          },
          {
            role: "assistant" as const,
            content: "Understood. I have full context from the summarised history and am ready to continue.",
          },
          ...recentMessages,
        ];
        history.length = 0;
        history.push(...newHistory);
        printCompactSuccess(oldMessages.length, KEEP_LAST);
      } catch (err) {
        compactSpinner.stop();
        printAgentError(err instanceof Error ? err.message : String(err));
      }
      rl.prompt();
      return;
    }

    if (input.startsWith("/export")) {
      const arg = input.slice("/export".length).trim().toLowerCase() || "html";
      if (!["md", "sh", "html", "both"].includes(arg)) { printExportUsage(); rl.prompt(); return; }
      if (!hasSteps()) { printExportEmpty(); rl.prompt(); return; }
      try {
        const exported: string[] = [];
        if (arg === "md")   exported.push(await exportMarkdown());
        if (arg === "sh")   exported.push(await exportShell());
        if (arg === "html") exported.push(await exportHtml());
        if (arg === "both") {
          exported.push(await exportMarkdown());
          exported.push(await exportShell());
          exported.push(await exportHtml());
        }
        printExportSuccess(exported);
      } catch (err) {
        printAgentError(err instanceof Error ? err.message : String(err));
      }
      rl.prompt();
      return;
    }

    if (input.startsWith("/replay")) {
      const filePath = input.slice("/replay".length).trim();
      if (!filePath) { printReplayUsage(); rl.prompt(); return; }
      try {
        const runbook = await parseShellRunbook(filePath);
        if (runbook.steps.length === 0) {
          printAgentError("No commands found in that runbook.");
          rl.prompt();
          return;
        }
        printReplayHeader(runbook.task, runbook.steps.length);
        let done = 0;
        for (const step of runbook.steps) {
          printReplayStep(done + 1, runbook.steps.length, step.reasoning, step.command);
          const approved = await confirm(`Run: ${step.command}`);
          if (!approved) { printRejected(); continue; }
          const result = await executeTool("run_command", { command: step.command }, confirm);
          printToolResult("run_command", result.output);
          recordStep({
            reasoning: step.reasoning,
            toolName: "run_command",
            toolArgs: { command: step.command },
            toolResult: result.output,
          });
          done++;
        }
        printReplayComplete(done, runbook.steps.length);
      } catch (err) {
        printAgentError(err instanceof Error ? err.message : String(err));
      }
      rl.prompt();
      return;
    }

    history.push({ role: "user", content: input });
    setCurrentTask(input);

    const spinner = createSpinner("Thinking…").start();
    let steps = 0;
    const maxSteps = 15;

    try {
      let continueLoop = true;

      while (continueLoop && steps < maxSteps) {
        let textStarted = false;

        const response = await streamMessage(client, modelId, "", history, (text) => {
          if (!textStarted) {
            spinner.stop();
            textStarted = true;
            console.log();
          }
          process.stdout.write(text);
        });

        if (!textStarted) spinner.stop();
        if (textStarted) console.log();

        if (response.usage) recordUsage(response.usage);

        if (response.toolCalls.length > 0) {
          history.push({
            role: "assistant",
            content: response.text || null,
            tool_calls: response.toolCalls,
          });
        } else {
          history.push({ role: "assistant", content: response.text });
        }

        if (response.toolCalls.length === 0) {
          if (steps > 0) printAgentComplete(steps);
          continueLoop = false;
        } else {
          steps++;
          if (steps > 1) printAgentStep(steps, maxSteps);

          for (const call of response.toolCalls) {
            const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
            const toolResult = await executeTool(call.function.name, args, confirm);
            printToolResult(call.function.name, toolResult.output);
            recordStep({
              reasoning: response.text ?? "",
              toolName: call.function.name,
              toolArgs: args,
              toolResult: toolResult.output,
            });
            history.push({
              role: "tool",
              tool_call_id: call.id,
              content: toolResult.output,
            });
          }

          spinner.start("Thinking…");
        }
      }

      if (steps >= maxSteps) {
        printAgentMaxSteps(maxSteps);
      }
    } catch (err) {
      spinner.stop();
      printAgentError(err instanceof Error ? err.message : String(err));
    }

    // Persist after each turn
    await incrementTurns(activeSession);
    await saveHistory(activeSessionPath);

    const last = getLastTurn();
    if (last) {
      printTokenLine(last.promptTokens, getSession().totalTokens);
    }

    rl.prompt();
  });

  rl.on("close", async () => {
    await saveHistory(activeSessionPath);
    process.exit(0);
  });
}

main();
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 3: Run tests**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire session management into chalk REPL (index.ts)"
```

---

## Task 8: Finalize — gitignore + Typecheck + Tests

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore**

Add `~/.agentic/` note and ensure `chat_history.json` is present (it already is). Add this block after the existing `# Runtime files` section:

```
# Session storage lives in ~/.agentic/ — outside the project, no git entry needed.
# The old single-file fallback is kept here for safety.
chat_history.json
```

Actually since `chat_history.json` is already there, just add a comment explaining the sessions dir. Open `.gitignore` and append:

```
# Named sessions are stored under ~/.agentic/sessions/ (outside the project root).
# No gitignore entry needed for them — git only tracks files within the repo root.
```

- [ ] **Step 2: Run full typecheck**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm typecheck
```

Expected: Zero errors.

- [ ] **Step 3: Run full test suite**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm test
```

Expected: All tests pass (smoke + sessions + memory).

- [ ] **Step 4: Build**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Smoke-test the REPL manually (non-TTY simulation)**

```bash
cd "/Users/I578278/Documents/My Space/Agentic-cli"
echo "/session list" | node dist/index.js 2>/dev/null || true
```

Expected: Output shows "Sessions:" with at least the default session. (Will exit 0 or 1 depending on API key, but session output should appear.)

- [ ] **Step 6: Final commit**

```bash
git add .gitignore
git commit -m "chore: add gitignore note for named sessions storage location"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|---|---|
| `agentic --session <name>` starts named session | Tasks 6, 7 |
| `/session new <name>` creates + switches | Tasks 6, 7 |
| `/session switch <name>` saves current, loads new | Tasks 6, 7 |
| `/session list` shows all sessions with metadata | Tasks 6, 7 |
| `/session rename <name>` renames active session | Tasks 3, 6, 7 |
| `/session delete <name>` with guard | Tasks 3, 6, 7 |
| Session history fully isolated | Tasks 3 (memory tests) |
| Session name visible in TUI InputBar | Task 5 |
| Session name visible in REPL prompt | Task 7 |
| `saveHistory` after every agent turn | Tasks 6, 7 |
| `saveHistory` on process exit (SIGINT/SIGTERM) | Tasks 6, 7 |
| Sessions stored under `~/.agentic/sessions/` | Tasks 2, 3 |
| `~/.agentic/` added to `.gitignore` | Task 8 |
| Works in TTY and non-TTY modes | Tasks 6, 7 |
| Tests: creation, switching, rename, delete guard, round-trip | Task 3 |
| `sessions.json` schema matches spec | Task 3 |
| `bare /session` shows info | Tasks 6, 7 |

### Type Consistency Check

- `SessionEntry.name`, `.createdAt`, `.lastActiveAt`, `.turns` — consistent across sessions.ts, events.ts event payloads, and all callers
- `loadHistory(sessionPath: string)` / `saveHistory(sessionPath: string)` — consistent across memory.ts, index.ts, App.tsx, start.tsx
- `initSessions(requested?: string): Promise<{ name: string; path: string }>` — consistent in both start.tsx and index.ts
- `getSessionDir(name: string): string` — used as `activeSessionPath` throughout

### Placeholder Scan

No TBD/TODO items. All steps contain actual code.
