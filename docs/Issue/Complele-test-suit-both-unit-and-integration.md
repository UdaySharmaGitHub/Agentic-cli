# Add Complete Test Suite — Unit & Integration

## Summary

The project currently has no tests (`"test": "echo \"No tests yet\" && exit 0"`). This issue tracks adding a full test suite covering every module with unit tests and the end-to-end agent loop with integration tests.

**All test files must live under a `tests/` folder at the root of the project**, mirroring the `src/` layout:

```
tests/
├── smoke.test.ts                        ← top-level sanity check
├── memory.test.ts                       ← file-based persistence (session-aware)
├── sessions.test.ts                     ← session lifecycle (create/delete/rename/…)
├── unit/
│   ├── safety.test.ts
│   ├── memory.test.ts                   ← in-memory state (pure, no I/O)
│   ├── config.test.ts
│   ├── runbook.test.ts
│   ├── replay.test.ts
│   ├── openai.test.ts
│   ├── prompts.test.ts
│   ├── tokens.test.ts
│   ├── tools/
│   │   ├── readFile.test.ts
│   │   ├── writeFile.test.ts
│   │   ├── appendFile.test.ts
│   │   ├── modifyFile.test.ts
│   │   ├── listDir.test.ts
│   │   ├── runCommand.test.ts
│   │   ├── searchFiles.test.ts
│   │   ├── webSearch.test.ts
│   │   ├── helpers.test.ts
│   │   └── registry.test.ts
│   └── tui/
│       ├── events.test.ts
│       └── hooks/
│           ├── useHistory.test.ts
│           └── useTerminalSize.test.ts
└── integration/
    ├── agent.test.ts
    ├── runbook-replay.test.ts
    └── tui/
        └── agentRunner.test.tsx
```

`ink-testing-library` is already in `devDependencies`, so TUI component testing is already anticipated.

---

## Proposed Test Framework

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner + coverage (ESM-native, fast, no config pain) |
| **ink-testing-library** | Render Ink components headlessly (already installed) |
| **@vitest/coverage-v8** | Coverage reports |

> **Why Vitest over Jest?** The project uses `"type": "module"` (pure ESM). Vitest handles ESM natively; Jest requires painful transform config.

---

## Unit Tests

### 1. `src/safety.ts`

`isCommandSafe` and `isPathSafe` are pure functions — easiest to test.

```
tests/unit/safety.test.ts
```

- [ ] `isCommandSafe` returns `safe: false` for every blocked pattern (`rm -rf /`, `mkfs`, `fork bomb`, `curl.*| bash`, etc.)
- [ ] `isCommandSafe` returns `safe: true` for harmless commands (`ls`, `echo hello`, `cat file.txt`)
- [ ] `isPathSafe` returns `safe: false` for every protected path (`/etc/passwd`, `/boot/`, `/dev/`, etc.)
- [ ] `isPathSafe` returns `safe: true` for normal user paths (`/home/user/project`, `./src`)
- [ ] Partial-match edge cases (e.g. `/etc/passw` — not the full path, should be safe)

---

### 2. `src/memory.ts` — in-memory state

Pure in-memory state — no I/O in hot path.

```
tests/unit/memory.test.ts
```

- [ ] `pushMessage` appends a message to the store
- [ ] `getMessages` returns the current message array
- [ ] `clearMessages` resets the array to empty
- [ ] `messageCount` returns correct count after pushes and clear
- [ ] Handles all three `ChatMessage` roles: `user`, `assistant` (with `tool_calls`), `tool`

### 2b. `src/memory.ts` — file-based persistence (session-aware)

The same `memory.ts` module also exposes `saveHistory(sessionPath)` and `loadHistory(sessionPath)` for persisting chat history per session. These need a separate test file that uses the real filesystem via `os.tmpdir()`.

```
tests/memory.test.ts
```

- [ ] `saveHistory` writes current messages as JSON to `<sessionPath>/chat_history.json`
- [ ] `loadHistory` reads messages back and populates the in-memory store
- [ ] `loadHistory` on a missing file starts with empty history (no crash)
- [ ] `save → load` round-trip preserves all messages exactly
- [ ] History is isolated between different session paths (session A does not bleed into session B)
- [ ] A reference held from `getMessages()` stays valid across `clearMessages` + `loadHistory` (in-place splice, not array replacement)

---

### 3. `src/config.ts`

```
tests/unit/config.test.ts
```

- [ ] `DEFAULT_MODEL` is `'gpt-4.1-mini'`
- [ ] `DEFAULT_MAX_STEPS` resolves to the expected numeric value
- [ ] `AGENTIC_DIR` is a non-empty string nested under the user home directory
- [ ] `SESSIONS_DIR` is nested inside `AGENTIC_DIR`
- [ ] `SESSIONS_INDEX_FILE` is inside `AGENTIC_DIR`
- [ ] `DEFAULT_SESSION` is `'default'`
- [ ] `loadKnowledgeBase(path)` returns `{ content, file }` when the file exists
- [ ] `loadKnowledgeBase(path)` returns `null` when the file does not exist

---

### 4. `src/runbook.ts`

```
tests/unit/runbook.test.ts
```

- [ ] `initSession` creates a new session with correct `model` and `startedAt`
- [ ] `recordStep` appends steps in order and auto-increments `stepNumber`
- [ ] `hasSteps` returns `false` before any step is recorded, `true` after
- [ ] `getSession` returns `null` before init, the session object after
- [ ] `setCurrentTask` sets the `task` field on subsequently recorded steps
- [ ] File export (`exportMarkdown` / `exportShell` / `exportHtml`) writes correct content to a temp directory

---

### 5. `src/replay.ts`

```
tests/unit/replay.test.ts
```

- [ ] `parseShellRunbook` parses a valid shell runbook string into `ParsedRunbook`
- [ ] Correctly extracts `task`, `model`, and each `ReplayStep` (command + reasoning)
- [ ] Handles missing header fields gracefully (empty string, not a crash)
- [ ] Throws a descriptive error on malformed input

---

### 6. `src/sessions.ts`

Session management — creates, persists, and switches named sessions. Each session gets its own subdirectory under `~/.agentic/sessions/` and an entry in the `sessions.json` index.

```
tests/sessions.test.ts
```

Use `vi.hoisted` + `vi.mock('../src/config.js', ...)` to redirect `AGENTIC_DIR`, `SESSIONS_DIR`, and `SESSIONS_INDEX_FILE` to a unique `os.tmpdir()` path so tests never touch the real home directory.

- [ ] `getSessionDir(name)` returns a path nested under `SESSIONS_DIR`
- [ ] `getHistoryPath(name)` returns a path ending in `<name>/chat_history.json`
- [ ] `saveIndex` / `loadIndex` round-trip: write an index, read it back, assert equality
- [ ] `loadIndex` on a corrupt JSON file throws a descriptive `"Corrupt sessions index"` error
- [ ] `initSessions()` with no argument creates a `default` session, sets it active, and creates its directory
- [ ] `initSessions("foo")` creates and activates a named session
- [ ] Re-running `initSessions("foo")` when `foo` already exists does not duplicate the index entry
- [ ] `createSession("bar")` adds it to the index and creates its directory
- [ ] `createSession` with a duplicate name throws `'Session "bar" already exists'`
- [ ] `createSession("../evil")` throws `'Invalid session name'` (path-traversal guard)
- [ ] `deleteSession` throws `'Cannot delete the active session'` when asked to delete the active one
- [ ] `deleteSession` removes a non-active session from the index and deletes its directory
- [ ] `deleteSession` on an unknown name throws `'Session "ghost" not found'`
- [ ] `renameSession` renames the directory and updates the index entry
- [ ] `renameSession` updates `index.active` when the active session is renamed
- [ ] `renameSession` on an unknown `oldName` throws
- [ ] `renameSession` to an already-existing `newName` throws
- [ ] `updateLastActive` updates `lastActiveAt` for an existing session
- [ ] `updateLastActive` is a no-op (no crash) for an unknown session name
- [ ] `incrementTurns` increases the `turns` counter by 1
- [ ] `incrementTurns` is a no-op (no crash) for an unknown session name
- [ ] `index.active` pointer is correct after creating multiple sessions and manually switching

---

### 7. `src/tokens.ts`

Pure accumulator — no I/O, no side effects outside module state.

```
tests/unit/tokens.test.ts
```

- [ ] `recordUsage` accumulates `promptTokens` and `completionTokens` across multiple calls
- [ ] `getLastTurn` returns the most recently recorded `TurnUsage` object
- [ ] `getLastTurn` returns `null` before any usage is recorded
- [ ] `getSession` returns the summed totals across all recorded turns
- [ ] `resetTokens` clears all accumulated state; `getSession` returns zeros and `getLastTurn` returns `null`

---

### 8. `src/openai.ts`

Wrapper around the OpenAI SDK — mock the `openai` module entirely so no real API calls are made.

```
tests/unit/openai.test.ts
```

- [ ] `createClient` returns an `OpenAI` instance (constructor called once)
- [ ] `streamMessage` returns `{ text, toolCalls, usage }` on a normal text response
- [ ] `streamMessage` correctly parses tool-call chunks and returns populated `toolCalls`
- [ ] `streamMessage` records token usage via `recordUsage` when the API returns a `usage` object
- [ ] `streamMessage` propagates API errors (rejects with the original error)

---

### 9. `src/prompts.ts`

```
tests/unit/prompts.test.ts
```

- [ ] The system prompt string is non-empty
- [ ] `buildSystemPrompt` (or equivalent export) includes expected sections (tool descriptions, safety rules, etc.)
- [ ] Injecting a knowledge-base string appends it to the prompt

---

### 10. `src/tools/` — individual tool modules

Each tool module exports a `definition` (schema) and an `execute` function.

#### `readFile`
```
tests/unit/tools/readFile.test.ts
```
- [ ] Reads an existing temp file and returns its content
- [ ] Returns `isError: true` when the file does not exist

#### `writeFile`
```
tests/unit/tools/writeFile.test.ts
```
- [ ] Creates a new file with given content
- [ ] Overwrites an existing file
- [ ] Returns `isError: true` when the parent directory doesn't exist

#### `appendFile`
```
tests/unit/tools/appendFile.test.ts
```
- [ ] Appends content to an existing file
- [ ] Creates the file if it does not exist

#### `modifyFile`
```
tests/unit/tools/modifyFile.test.ts
```
- [ ] Replaces a specific substring in a file
- [ ] Returns `isError: true` when the target string is not found

#### `listDir`
```
tests/unit/tools/listDir.test.ts
```
- [ ] Lists entries in a real temp directory
- [ ] Returns `isError: true` for a non-existent path

#### `searchFiles`
```
tests/unit/tools/searchFiles.test.ts
```
- [ ] Returns matching file paths given a glob pattern and a temp directory
- [ ] Returns an empty result set (not an error) when no files match

#### `runCommand`
```
tests/unit/tools/runCommand.test.ts
```
- [ ] Executes `echo hello` and captures stdout
- [ ] Calls `confirm` before executing and aborts when confirm returns `false`
- [ ] Returns `isError: true` on non-zero exit code
- [ ] Blocked commands (`rm -rf /`) are rejected before execution

#### `webSearch`
```
tests/unit/tools/webSearch.test.ts
```
- [ ] Mock the HTTP layer; assert correct query is sent
- [ ] Parses a mocked response into the expected `ToolResult` format
- [ ] Returns `isError: true` on network failure

#### Tool helpers (`src/tools/helpers.ts`)
```
tests/unit/tools/helpers.test.ts
```
- [ ] Helper utilities (e.g. argument coercion, output formatting) produce the expected output for known inputs
- [ ] Edge cases (empty input, null values) do not throw

#### Tool registry (`src/tools/index.ts`)
```
tests/unit/tools/registry.test.ts
```
- [ ] `getToolDefinitions` returns definitions for all 8 tools
- [ ] `executeTool` dispatches to the correct module by name
- [ ] `executeTool` returns `isError: true` for an unknown tool name

---

### 11. TUI — `src/tui/hooks/` and `src/tui/events.ts`

```
tests/unit/tui/hooks/useHistory.test.ts
tests/unit/tui/hooks/useTerminalSize.test.ts
tests/unit/tui/events.test.ts
```

- [ ] `useHistory` — `push(entry)` deduplicates and moves entry to front; `up()` walks back through history; `down()` walks forward; returns `null` at the boundaries; whitespace-only entries are ignored; `maxEntries` limit is respected
- [ ] `useTerminalSize` — returns sensible defaults when `process.stdout` columns/rows are unavailable
- [ ] `events.ts` — event emitter helpers fire callbacks correctly and clean up listeners on teardown

---

### 12. Smoke test

```
tests/smoke.test.ts
```

- [ ] A single top-level import of the project's public entry point does not throw at module load time

---

## Integration Tests

### 13. Agent ReAct Loop — `src/agent.ts`

```
tests/integration/agent.test.ts
```

Stub the OpenAI client (`streamMessage`) so no real API calls are made.

- [ ] Single-turn: LLM returns text only → loop exits after one step, no tool calls
- [ ] Tool call → result → final answer: LLM calls one tool, gets the result, then produces a final text response
- [ ] Multi-step: LLM chains two tool calls before giving a final answer
- [ ] `maxSteps` guard: loop aborts after `maxSteps` iterations even if LLM keeps calling tools
- [ ] Tool error propagation: a failing tool result is sent back to the LLM as a `role: tool` error message
- [ ] `confirm` callback is called for destructive tools and the step is skipped when it returns `false`

---

### 14. Runbook Export → Replay Round-trip

```
tests/integration/runbook-replay.test.ts
```

- [ ] Record several steps in a session, export to shell format, parse back with `parseShellRunbook`, and assert the round-trip is lossless
- [ ] Same for Markdown and HTML export formats (`exportMarkdown`, `exportHtml`)

---

### 15. TUI — `src/tui/` (ink-testing-library)

```
tests/integration/tui/agentRunner.test.tsx
```

- [ ] Renders without crashing on initial mount
- [ ] Displays a spinner while the agent is running
- [ ] Renders agent output messages after the run completes
- [ ] Keyboard input (e.g. `q` to quit) triggers the expected state transition

---

## Acceptance Criteria

- [ ] `pnpm test` runs the full suite and exits 0
- [ ] `pnpm test:coverage` produces a coverage report (requires `@vitest/coverage-v8` installed — run `pnpm add -D @vitest/coverage-v8` if missing)
- [ ] Line coverage ≥ 80 % across `src/`
- [ ] All tests pass in CI (`node >= 18`, same environment as `pnpm build`)
- [ ] No test uses real network I/O or touches the real filesystem outside of `tmp`/`os.tmpdir()`

---

## Implementation Notes

- All test files go in **`tests/`** at the project root — do not co-locate tests next to source files
- Add `vitest` and `@vitest/coverage-v8` to `devDependencies`
- Update `package.json` scripts:
  ```json
  "test":          "vitest run",
  "test:watch":    "vitest",
  "test:coverage": "vitest run --coverage"
  ```
- Add `vitest.config.ts` at project root pointing `include` at `tests/**/*.test.{ts,tsx}`; set `coverage.thresholds.lines: 80`
- Use `import { tmpdir } from 'node:os'` + `mkdtemp` for filesystem tests — never write into the repo itself
- Mock `openai` module with `vi.mock` for agent integration tests
- For `sessions.test.ts`: use `vi.hoisted` + `vi.mock('../src/config.js', ...)` to redirect all path constants to a temp directory — this avoids mutating the real `~/.agentic/` directory during tests
- Add `coverage/` to `.gitignore` — Vitest writes the coverage report there and it must not be committed

---

## Labels

`testing` · `good first issue` · `help wanted`

## Milestone

`v5.0.0`

---

## Resolution

Implemented in commits on branch `feature/test-coverage`. Final state:

| Metric | Result |
|--------|--------|
| Test files | 27 |
| Total tests | 258 |
| Pass rate | 100 % |
| Statement coverage | 99.7 % |
| Branch coverage | 98.48 % |
| Function coverage | 97.95 % |
| Line coverage | 100 % |

All acceptance criteria met. `@vitest/coverage-v8` added to `devDependencies` and `coverage/` added to `.gitignore`.
