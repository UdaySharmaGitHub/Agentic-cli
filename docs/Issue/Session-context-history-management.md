# Feature: Named Sessions — Multi-Session Context & History Management

## Summary

Add a Named Sessions system to Agentic CLI that lets users create, switch between, rename, and delete isolated sessions — each with its own persisted conversation history. This mirrors the session management experience found in Claude Code, Cursor, and other agentic tools.

---

## Motivation

Currently Agentic CLI holds conversation history **in memory only** — `memory.ts` is a plain in-memory `ChatMessage[]` array with no persistence to disk. When the process exits, all history is lost. When context grows stale mid-session, the only option is `/clear`, which permanently destroys it. There is no way to:

- Maintain multiple parallel workstreams (e.g. "debugging prod" vs. "writing tests")
- Resume a previous conversation after restarting the CLI
- Organize contexts by project or task

Named Sessions solves all of this by adding persistence to `memory.ts` and a per-session directory layout.

---

## Current State

| Concern | Current behaviour |
|---|---|
| History persistence | In-memory only (`ChatMessage[]` in `memory.ts`); lost on exit |
| `HISTORY_FILE` constant | Exists in `config.ts` but is never read from or written to |
| Multiple contexts | Not supported; only one flat history per process |
| Reset | `/clear` wipes in-memory history; irreversible |

---

## Proposed UX

### Slash Commands

Both the **Ink TUI** (TTY mode) and the **chalk REPL** (non-TTY/pipe mode) must support these commands.

| Command | Description |
|---|---|
| `/session new [name]` | Create and switch to a new named session |
| `/session switch <name>` | Switch to an existing session by name |
| `/session rename <name>` | Rename the active session |
| `/session list` | List all saved sessions with metadata (turns, last active) |
| `/session delete <name>` | Delete a session and its history (cannot delete the active session) |
| `/session` (bare) | Show active session name and quick stats |

### CLI Flag

```bash
agentic --session "my-session"   # Start in a named session (creates if not found)
```

### Session Indicator

- **TUI mode**: Display active session name in the `InputBar` placeholder or as a dim prefix above the input (e.g. `[debug-prod] ❯`)
- **REPL mode**: Show session name in the readline prompt string (e.g. `[debug-prod] > `)

---

## Technical Design

### Storage Layout

Replace the unused single flat `chat_history.json` with a per-session directory structure under `~/.agentic/sessions/`:

```text
~/.agentic/
  sessions/
    default/
      chat_history.json
    debug-prod/
      chat_history.json
    write-tests/
      chat_history.json
  sessions.json    # index: { active, sessions: [{ name, createdAt, lastActiveAt, turns }] }
```

Using `~/.agentic/` keeps sessions out of the project working directory and avoids accidental commits.

### Core Changes

| File | Change |
|---|---|
| `src/config.ts` | Add `SESSIONS_DIR` (`~/.agentic/sessions`), `SESSIONS_INDEX_FILE`, `DEFAULT_SESSION = 'default'` constants; remove or repurpose the unused `HISTORY_FILE` |
| `src/memory.ts` | Add `loadHistory(sessionPath)` and `saveHistory(sessionPath)` — currently the module has no disk I/O at all; persistence must be added here |
| `src/index.ts` | Load active session on startup (chalk REPL path); pass session name into prompt string; handle `/session *` commands in the `rl.on('line')` handler |
| `src/tui/App.tsx` | Handle `/session *` slash commands in `handleSubmit`; pass active session name as a prop or context to `InputBar` for display |
| `src/tui/events.ts` | Add session-related `AgentEvent` variants: `session:switched`, `session:list`, `session:info` so the TUI can render session output through the existing event bus |
| `src/tui/components/InputBar.tsx` | Accept an optional `sessionName` prop; render it as a dim prefix before the `❯` prompt |

> **Note:** There is no `src/commands/` directory in Agentic CLI. `/session` logic should be handled inline — in `handleSubmit` in `App.tsx` for the TUI, and in the `rl.on('line')` handler in `index.ts` for the REPL — following the same pattern used by `/export` and `/replay` today.

### `sessions.json` Schema

```json
{
  "active": "debug-prod",
  "sessions": [
    {
      "name": "default",
      "createdAt": "2026-08-01T10:00:00Z",
      "lastActiveAt": "2026-08-05T14:30:00Z",
      "turns": 12
    },
    {
      "name": "debug-prod",
      "createdAt": "2026-08-07T09:00:00Z",
      "lastActiveAt": "2026-08-07T09:45:00Z",
      "turns": 5
    }
  ]
}
```

### Switching Behaviour

When `/session switch <name>` is called:

1. Call `saveHistory(currentSessionPath)` — flush in-memory `ChatMessage[]` to the current session's `chat_history.json`
2. Call `clearMessages()` — wipe in-memory state
3. Call `loadHistory(targetSessionPath)` — populate memory with the target session's messages
4. Update `sessions.json` active pointer and `lastActiveAt`
5. Emit `session:switched` event (TUI) or print a confirmation box (REPL) showing the new session name and turn count

### Persistence Contract

`memory.ts` currently has no disk I/O. Adding it should follow the existing module pattern:

```typescript
// New additions to src/memory.ts
export async function loadHistory(sessionPath: string): Promise<void>
export async function saveHistory(sessionPath: string): Promise<void>
```

`saveHistory` should be called:
- After every agent turn completes (so a crash doesn't lose the last message)
- On `/session switch` before clearing memory
- On process `SIGINT` / `SIGTERM` as a flush

---

## Acceptance Criteria

- [ ] `agentic --session <name>` starts in the named session, creating it if it doesn't exist
- [ ] `/session new <name>` creates a session and switches to it immediately
- [ ] `/session switch <name>` saves the current session to disk and loads the target one; in-memory `ChatMessage[]` is fully replaced
- [ ] `/session list` shows all sessions with name, turn count, and last active timestamp
- [ ] `/session rename <name>` renames the active session (directory rename + index update)
- [ ] `/session delete <name>` prompts for confirmation before deleting; cannot delete the currently active session
- [ ] Each session's `chat_history.json` is fully isolated — switching sessions never leaks messages between them
- [ ] Active session name is visible in both TUI (`InputBar` prefix) and chalk REPL (prompt string)
- [ ] `saveHistory` is called after every agent turn and on process exit — history survives a restart
- [ ] Sessions are stored under `~/.agentic/sessions/` — not inside the project working directory
- [ ] `~/.agentic/` is added to `.gitignore`
- [ ] Works correctly in both TTY (Ink TUI) and non-TTY (chalk REPL) modes
- [ ] Tests cover: session creation, switching (state isolation), rename, delete guard on active session, history round-trip (save → load)

---

## Out of Scope (v1)

- Session export / sharing (the existing `/export` runbook feature is separate)
- Cloud sync
- Per-session model or system prompt overrides
- Session branching
- Token usage tracking per session

---

## Labels

`enhancement` · `good first issue` · `storage` · `tui`
