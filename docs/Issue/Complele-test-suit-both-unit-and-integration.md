# Add Complete Test Suite — Unit & Integration

## Summary

The project currently has no tests (`"test": "echo \"No tests yet\" && exit 0"`). This issue tracks adding a full test suite covering every module with unit tests and the end-to-end agent loop with integration tests.

**All test files must live under a `tests/` folder at the root of the project**, mirroring the `src/` layout:

```
tests/
├── unit/
│   ├── safety.test.ts
│   ├── memory.test.ts
│   ├── config.test.ts
│   ├── runbook.test.ts
│   ├── replay.test.ts
│   ├── tools/
│   │   ├── readFile.test.ts
│   │   ├── writeFile.test.ts
│   │   ├── appendFile.test.ts
│   │   ├── modifyFile.test.ts
│   │   ├── listDir.test.ts
│   │   ├── runCommand.test.ts
│   │   ├── searchFiles.test.ts
│   │   ├── webSearch.test.ts
│   │   └── registry.test.ts
│   └── tui/
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

### 2. `src/memory.ts`

Pure in-memory state — no I/O in hot path.

```
tests/unit/memory.test.ts
```

- [ ] `pushMessage` appends a message to the store
- [ ] `getMessages` returns the current message array
- [ ] `clearMessages` resets the array to empty
- [ ] `messageCount` returns correct count after pushes and clear
- [ ] Handles all three `ChatMessage` roles: `user`, `assistant` (with `tool_calls`), `tool`

---

### 3. `src/config.ts`

```
tests/unit/config.test.ts
```

- [ ] Exported constants (`HISTORY_FILE`, `DEFAULT_MODEL`, `DEFAULT_MAX_STEPS`) resolve to the expected values
- [ ] `DEFAULT_MODEL` falls back to `'gpt-4.1-mini'` when no env override is set
- [ ] `HISTORY_FILE` respects the `AGENT_HISTORY_FILE` env override

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

### 6. `src/tools/` — individual tool modules

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

#### Tool registry (`src/tools/index.ts`)
```
tests/unit/tools/registry.test.ts
```
- [ ] `getToolDefinitions` returns definitions for all 8 tools
- [ ] `executeTool` dispatches to the correct module by name
- [ ] `executeTool` returns `isError: true` for an unknown tool name

---

### 7. TUI Hooks — `src/tui/hooks/`

```
tests/unit/tui/hooks/useHistory.test.ts
tests/unit/tui/hooks/useTerminalSize.test.ts
```

- [ ] `useHistory` — `push(entry)` deduplicates and prepends; `up()` walks back through history; `down()` walks forward; returns `null` at the boundaries
- [ ] `useTerminalSize` — returns sensible defaults when `process.stdout` columns/rows are unavailable

---

## Integration Tests

### 8. Agent ReAct Loop — `src/agent.ts`

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

### 9. Runbook Export → Replay Round-trip

```
tests/integration/runbook-replay.test.ts
```

- [ ] Record several steps in a session, export to shell format, parse back with `parseShellRunbook`, and assert the round-trip is lossless
- [ ] Same for Markdown and HTML export formats (`exportMarkdown`, `exportHtml`)

---

### 10. TUI — `src/tui/` (ink-testing-library)

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
- [ ] `pnpm test:coverage` produces a coverage report
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
- Add `vitest.config.ts` at project root pointing `include` at `tests/**/*.test.{ts,tsx}`
- Use `import { tmpdir } from 'node:os'` + `mkdtemp` for filesystem tests — never write into the repo itself
- Mock `openai` module with `vi.mock` for agent integration tests

---

## Labels

`testing` · `good first issue` · `help wanted`

## Milestone

`v5.0.0`
