# Migration: Chalk Static UI → Ink React TUI

**Type:** Enhancement / Refactor  
**Priority:** High  
**Area:** `src/ui.ts`, `src/index.ts`, `src/openai.ts`  
**Status:** Open

---

## Summary

Agentic-cli's current UI is built entirely with `chalk` (static `console.log` calls) and `readline` (raw node interface). This produces a static, non-interactive terminal experience with no real-time feedback, no cursor navigation, and no live updates. The goal is to migrate to **[Ink](https://github.com/vadimdemedes/ink)** — the React-for-CLI framework that powers Claude Code, GitHub Copilot CLI, and similar tools — to deliver an interactive, component-driven TUI that matches the quality of modern developer tools.

> **Note:** The codebase has already been migrated from the Gemini SDK to the OpenAI-compatible API (`src/openai.ts`, default model `gpt-4.1-mini`). This TUI migration builds on top of that updated client.

> **Why Ink over Bubble Tea?**  
> Bubble Tea is a Go TUI framework. Agentic-cli is TypeScript/Node.js. Ink is the idiomatic equivalent for the Node ecosystem: same reactive model, same component tree, runs natively in the existing build pipeline (`tsx`, `tsup`).

---

## Problem with the Current UI

| Issue | Current Behavior |
|---|---|
| Static rendering | All output is one-way `console.log`; nothing updates in-place |
| No live streaming | AI response text is printed line-by-line with no real-time token streaming UI |
| Busy spinner only | `ora` spinner blocks the display; no side-by-side status |
| Raw `readline` input | No styled prompt, no history navigation hints, no placeholder text |
| Blocked re-render | Once a banner is printed, it cannot be updated (e.g. to show token count) |
| No keyboard shortcuts | No Ctrl+C handling, no Esc to cancel a tool call mid-flight |
| No confirmation UX | Tool approval (`y/n`) is a plain readline question; no styled dialog |

---

## Proposed Libraries

### Core

| Package | Purpose | Used by |
|---|---|---|
| `ink` | React component renderer for the terminal | Claude Code, GitHub Copilot CLI |
| `react` + `react-reconciler` | Component model (Ink peer deps) | — |
| `@inkjs/ui` | Ready-made Ink component kit (TextInput, Spinner, Badge, etc.) | Ink ecosystem |

### Input & Selection

| Package | Purpose |
|---|---|
| `ink-text-input` | Styled text input with cursor, placeholder, history |
| `ink-select-input` | Arrow-key navigable select menu (replaces `@clack/prompts` select) |

### Feedback & Display

| Package | Purpose |
|---|---|
| `ink-spinner` | Named spinners (dots, line, arc) rendered inside a live component |
| `ink-table` | Tabular output for `/status`, history, tool results |
| `ink-syntax-highlight` | Code block highlighting inside chat responses |
| `ink-markdown` | Markdown rendering for AI response text |

### Dev

| Package | Purpose |
|---|---|
| `@types/react` | TypeScript types for JSX |
| `ink-testing-library` | Unit-test Ink components without a real terminal |

---

## Target Experience (Inspired by Claude Code & OpenCode)

```
╭─────────────────────────────────────────────────────────╮
│  Agentic-cli  v4.2  ·  gpt-4.1-mini  ·  10 msgs  ·  YOLO  │
╰─────────────────────────────────────────────────────────╯

  🤖  The recursive Fibonacci approach has O(2ⁿ) time…
      Here is an optimized version using memoization:

      ┌──────────────────────────────────────────────────┐
      │  function fib(n, memo = {}) {                    │
      │    if (n in memo) return memo[n];                │
      │    if (n <= 1) return n;                         │
      │    memo[n] = fib(n-1, memo) + fib(n-2, memo);   │
      │    return memo[n];                               │
      │  }                                               │
      └──────────────────────────────────────────────────┘

  ⚙  run_command  ·  node fib.js        [y/n] ▋

  > Ask a follow-up…
    ↑↓ history · Tab /commands · Esc cancel
```

Key improvements:
- **Persistent status bar** (model, session stats) always visible at top
- **Live streaming** — tokens render in place as they arrive, no line-jumping
- **Inline tool approval dialog** — styled `[y/n]` prompt with keyboard shortcut hints
- **Syntax-highlighted code blocks** inside AI responses
- **Markdown rendering** — bold, italic, lists, headings
- **History-aware input** with placeholder and Tab autocomplete
- **Cancellable operations** — Esc cancels pending tool calls

---

## Migration Plan

### Phase 1 — Setup & Scaffolding

- [ ] Add Ink and component libraries to `package.json`
- [ ] Configure `tsconfig.json` for JSX (`"jsx": "react"`)
- [ ] Create `src/tui/` directory for all Ink components
- [ ] Add `src/tui/index.tsx` as the Ink `render()` entry point
- [ ] Keep existing `src/ui.ts` intact during migration (run in parallel)

**New dependencies to add:**
```json
{
  "ink": "^5.1.0",
  "react": "^18.3.0",
  "@inkjs/ui": "^2.0.0",
  "ink-text-input": "^6.0.0",
  "ink-select-input": "^6.0.0",
  "ink-spinner": "^5.0.0",
  "ink-markdown": "^2.0.0",
  "ink-syntax-highlight": "^3.0.0"
}
```

**Dev dependencies:**
```json
{
  "@types/react": "^18.3.0",
  "ink-testing-library": "^3.0.0"
}
```

---

### Phase 2 — Component Tree

```
src/tui/
├── index.tsx           ← render(<App />) entry, replaces printBanner()
├── App.tsx             ← root: status bar + chat pane + input bar
├── components/
│   ├── StatusBar.tsx       ← model · session · mode badges (top bar)
│   ├── ChatHistory.tsx     ← scrollable message list
│   ├── MessageBubble.tsx   ← user / assistant message with markdown
│   ├── StreamingMessage.tsx← live token stream (useStream hook)
│   ├── ToolCall.tsx        ← tool name, args, output, inline y/n confirm
│   ├── ToolConfirmDialog.tsx← styled approval [y/N] with Esc-cancel
│   ├── InputBar.tsx        ← TextInput + hints footer
│   ├── SelectRole.tsx      ← replaces @clack select for KB role picker
│   ├── SetupWizard.tsx     ← replaces current intro/password/select flow
│   └── HelpPanel.tsx       ← replaces printHelp()
└── hooks/
    ├── useStream.ts        ← subscribes to OpenAI-compatible token stream (via EventEmitter), updates state
    ├── useHistory.ts       ← input history (↑↓ navigation)
    └── useConfirm.ts       ← promise-based keyboard y/n resolver
```

---

### Phase 3 — Component Implementation Details

#### `App.tsx`
Root component. Holds global state (messages, activeStream, pendingTool). Passes dispatch functions down via context.

#### `StatusBar.tsx`
Rendered with `ink`'s `Box` at fixed position. Shows:
- Model name (badge)
- Message count
- YOLO mode indicator (amber badge)
- KB role (green badge when active)
- Session uptime

#### `StreamingMessage.tsx`
Uses a custom `useStream` hook that listens on an `EventEmitter` the agent emits tokens to. Tokens come from the OpenAI-compatible streaming API (`streamMessage` in `src/openai.ts` via `openai` SDK). Renders partial text into a `Text` component that Ink reconciles in-place — this eliminates the current line-jumping behavior.

#### `ToolCall.tsx`
Renders a styled box (similar to current `printToolHeader`) but as a React component. When awaiting confirmation, renders `ToolConfirmDialog` inline with `[y/N]` driven by `useInput` from Ink — no readline required.

#### `InputBar.tsx`
Uses `ink-text-input` for the prompt. Footer shows:
```
↑↓ history  ·  Tab /commands  ·  Esc cancel  ·  Enter submit
```
Passes submitted value to the parent `App` via `onSubmit` callback.

---

### Phase 4 — Agent Integration

The agent (`src/agent.ts`) currently calls `ui.ts` functions directly and uses the OpenAI-compatible streaming API via `src/openai.ts`. After migration:

1. The `ConfirmFn` will resolve via `useConfirm` hook (keyboard input captured by Ink's `useInput`) instead of `readline.question`
2. Streaming tokens will be emitted via `EventEmitter` that `StreamingMessage` subscribes to — the underlying stream already comes from `streamMessage()` in `src/openai.ts`
3. Tool headers/results will be emitted as structured events, rendered by `ToolCall` component
4. `runAgentTurn` will return structured `AgentEvent` objects; the Ink `App` renders them

---

### Phase 5 — Cutover & Cleanup

- [ ] Remove `chalk` from `src/ui.ts` (keep only as utility in agent output if needed)
- [ ] Remove `ora` (replaced by `ink-spinner` inside components)
- [ ] Remove `readline` from `src/index.ts` (replaced by `InputBar`)
- [ ] Remove `@clack/prompts` (replaced by `SetupWizard.tsx` + `SelectRole.tsx`)
- [ ] Delete `src/ui.ts` once all exports are covered by TUI components
- [ ] Update `tsup` build config to handle JSX (add `--format esm --jsx react`)

---

## Files Affected

| File | Change |
|---|---|
| `src/ui.ts` | Delete (replaced by `src/tui/`) |
| `src/index.ts` | Replace `readline` REPL + `printBanner()` with `render(<App />)` |
| `src/agent.ts` | Emit `AgentEvent` objects instead of calling `ui.*` functions directly |
| `src/openai.ts` | Wire streaming tokens to `EventEmitter` consumed by `StreamingMessage` |
| `tsconfig.json` | Add `"jsx": "react"`, `"jsxImportSource": "react"` |
| `package.json` | Add Ink + component packages; remove `ora`, `@clack/prompts` |

---

## Open Questions

1. **Scrollback behavior** — Ink renders a fixed viewport. Need to decide: full-screen takeover (like Claude Code) or scrolling passthrough mode for piped output.
2. **Non-TTY / CI mode** — When `stdout` is not a TTY (piped, scripted), fall back to the current chalk-based output path. Ink's `isRawModeSupported` flag handles detection.
3. **`--yolo` flag** — Currently skips all confirms. In Ink, `ToolConfirmDialog` should auto-resolve when this flag is set, without rendering the dialog at all.
4. **Windows support** — Ink requires a VT100-compatible terminal. Windows Terminal works; CMD.exe does not. Document the requirement.

---

## References

- [Ink GitHub](https://github.com/vadimdemedes/ink) — React for CLIs
- [@inkjs/ui](https://github.com/vadimdemedes/ink/tree/main/packages/ui) — component library
- [OpenCode TUI](https://github.com/sst/opencode) — Go/Bubble Tea reference for UX patterns
- [Claude Code](https://github.com/anthropics/claude-code) — Ink-based CLI reference implementation
- [ink-text-input](https://github.com/vadimdemedes/ink-text-input)
- [ink-select-input](https://github.com/vadimdemedes/ink-select-input)
- [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library)
