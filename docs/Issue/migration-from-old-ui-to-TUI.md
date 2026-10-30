# Migration: Chalk UI → Ink React TUI

**Type:** Enhancement / Refactor  
**Priority:** High  
**Area:** `src/ui.ts`, `src/index.ts`, `src/agent.ts`, `src/openai.ts`  
**Status:** Open — Ink TUI implementation pending

---

## Summary

Migrate the existing chalk + readline UI to **[Ink](https://github.com/vadimdemedes/ink)** — the React-for-CLI framework — to gain in-place rendering, live token streaming, keyboard-driven interactions, and terminal-resize responsiveness.

The current chalk UI is fully functional and defines the visual design. The Ink migration is a **reimplementation of the same design** using React components — not a redesign.

---

## ⚠️ Design Constraint — Do NOT Change the UI

The existing chalk UI in `src/ui.ts` defines the look and feel of the CLI. Every Ink component must replicate the current visual output exactly:

| Element | Current chalk output | Ink must match |
|---|---|---|
| Banner | 6-line orange→red gradient ASCII art | Same gradient, same font, same spacing |
| Tool header | `┌─ Tool: name` cyan box with `│ description` | Same box-drawing chars, same cyan color |
| Step counter | `┌─ Step N / Max ─────┐` cyan bold | Same format |
| Agent response | `🤖 Agent:` cyan bold header, white body text | Same icons, same colors |
| Spinner | `ora` dots spinner, `  Thinking...` | Same text, same indent |
| Tool result | Dim `── Result: name ──` + dimmed output (max 20 lines) | Same truncation, same dimming |
| Success | Green `✅ msg` | Same |
| Error | Red `❌ msg` | Same |
| Blocked | Red bold `🚫 BLOCKED: reason` | Same |
| Rejected | Yellow `✖ Action rejected by user.` | Same |
| Confirm prompt | `▶ message [y/N]` yellow arrow, dim brackets | Same |
| Separator | Dim `────────────────────` | Same |

**No new colors, no new layouts, no new icons** unless separately agreed. The goal is a 1:1 visual port with the added benefit of Ink's rendering model.

---

## Prerequisites Completed

| Item | Status | PR |
|---|---|---|
| Migrate Gemini SDK → OpenAI-compatible API | ✅ Done | PR #4 |
| Session runbook export (`/export`) | ✅ Done | PR #6 |
| Session replay (`/replay`) | ✅ Done | PR #6 |

---

## Problems with the Current Chalk UI

| Issue | Current Behavior |
|---|---|
| No in-place rendering | Tokens scroll the terminal; previous lines cannot update |
| No resize handling | Layout breaks if the terminal is resized mid-session |
| Raw `readline` input | No styled prompt, no placeholder, no history hints |
| `ora` + `readline` conflict | `ora` must use `discardStdin: false` workaround to avoid stealing stdin from confirm prompts |
| No keyboard shortcuts | No Esc to cancel a tool call mid-flight |
| Confirm UX | Plain `y/n` readline question with no visual styling |

---

## Migration Plan

### Phase 1 — Setup & Scaffolding

- [ ] Add Ink and component libraries to `package.json`
- [ ] Configure `tsconfig.json` for JSX (`"jsx": "react"`, `"jsxImportSource": "react"`)
- [ ] Create `src/tui/` directory
- [ ] Add `src/tui/index.tsx` as the `render(<App />)` entry point
- [ ] Keep `src/ui.ts` intact as the design reference until all components are verified

**Dependencies to add:**
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
```json
{
  "@types/react": "^18.3.0",
  "ink-testing-library": "^3.0.0"
}
```

---

### Phase 2 — Component Tree

Each component below maps 1:1 to an existing function in `src/ui.ts`.

```
src/tui/
├── index.tsx                  ← render(<App />) entry
├── App.tsx                    ← root: status bar + chat pane + input bar
├── components/
│   ├── Banner.tsx             ← replaces printBanner() — gradient ASCII art
│   ├── StatusBar.tsx          ← replaces printStatus()
│   ├── ChatHistory.tsx        ← scrollable message list
│   ├── MessageBubble.tsx      ← replaces printAgentResponse()
│   ├── StreamingMessage.tsx   ← live token stream (replaces process.stdout.write)
│   ├── ToolCall.tsx           ← replaces printToolHeader/Success/Error/Result
│   ├── ToolConfirmDialog.tsx  ← replaces formatConfirmPrompt + readline y/n
│   ├── InputBar.tsx           ← replaces readline prompt
│   ├── StepIndicator.tsx      ← replaces printAgentStep/Complete/MaxSteps
│   └── HelpPanel.tsx          ← replaces printHelp()
└── hooks/
    ├── useStream.ts           ← EventEmitter → React state for token streaming
    ├── useHistory.ts          ← ↑↓ input history navigation
    ├── useConfirm.ts          ← promise-based keyboard y/n resolver
    └── useTerminalSize.ts     ← listens for resize, returns { columns, rows }
```

---

### Phase 3 — Responsiveness Requirement

After the Ink migration is complete, the TUI **must respond correctly to terminal resize**. This is a hard requirement — not optional.

#### What must happen on resize

| Element | Expected behavior |
|---|---|
| Banner | Stays centered or left-aligned; does not overflow or truncate awkwardly |
| Tool header box (`┌─ Tool: …`) | Width scales to terminal width, capped at a sensible max (e.g. 80 cols) |
| Step counter box | Same — scales width |
| Chat history | Rewraps text to new column width |
| Input bar | Stretches to full terminal width |
| Status bar | Truncates gracefully if the terminal is too narrow |
| Separator line | Matches current terminal width |

#### How to implement

Use the `useTerminalSize` hook (`src/tui/hooks/useTerminalSize.ts`) in components that need width-aware layout:

```ts
import { useStdout } from 'ink';
import { useState, useEffect } from 'react';

export function useTerminalSize() {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24,
  });

  useEffect(() => {
    const handler = () =>
      setSize({ columns: stdout.columns, rows: stdout.rows });
    stdout.on('resize', handler);
    return () => { stdout.off('resize', handler); };
  }, [stdout]);

  return size;
}
```

Components use `columns` to calculate dynamic widths:

```tsx
const { columns } = useTerminalSize();
const boxWidth = Math.min(columns - 4, 80); // 4 = indent + border
```

#### Minimum terminal width

The TUI must remain usable at **40 columns**. Below that, display a single-line fallback:
```
⚠  Terminal too narrow — resize to 40+ cols
```

#### Testing resize

After implementation, manually verify:
1. Start a session and resize the terminal narrower and wider while a response is streaming
2. Resize during a tool call confirm prompt
3. Resize to below 40 columns — fallback message appears
4. Resize back to normal — full UI restores

---

### Phase 4 — Agent Integration

1. `ConfirmFn` resolves via `useConfirm` hook instead of `readline.question`
2. Streaming tokens emitted via `EventEmitter` → consumed by `useStream` → rendered by `StreamingMessage`
3. Tool calls emitted as structured events → rendered by `ToolCall` component
4. `/export` and `/replay` slash commands carried over to the Ink input handler in `InputBar.tsx`

---

### Phase 5 — Cutover & Cleanup

- [ ] Verify every `src/ui.ts` function has a matching Ink component (visual diff check)
- [ ] Verify resize behavior at multiple terminal widths (40, 80, 120, 200 columns)
- [ ] Remove `ora` (replaced by `ink-spinner` inside `StreamingMessage`)
- [ ] Remove `readline` from `src/index.ts` (replaced by `InputBar`)
- [ ] Remove `@clack/prompts` if used
- [ ] Delete `src/ui.ts`
- [ ] Update `tsup` build config: `--jsx react`

---

## Files Affected

| File | Change |
|---|---|
| `src/ui.ts` | Delete after all components verified |
| `src/index.ts` | Replace `readline` REPL with `render(<App />)` |
| `src/agent.ts` | Emit structured events instead of calling `ui.*` directly |
| `src/openai.ts` | Wire streaming tokens to `EventEmitter` for `useStream` |
| `src/runbook.ts` | Keep as-is; called from `App.tsx` for `/export` |
| `src/replay.ts` | Keep as-is; called from `App.tsx` for `/replay` |
| `tsconfig.json` | Add `"jsx": "react"`, `"jsxImportSource": "react"` |
| `package.json` | Add Ink packages; remove `ora`, `@clack/prompts` |

---

## Open Questions

1. **Full-screen vs scroll-through** — Ink full-screen takeover (like Claude Code) or passthrough mode? Full-screen gives better resize control but changes how output pipes behave.
2. **Non-TTY / CI mode** — When stdout is not a TTY, fall back to the current chalk path. Detect with `ink`'s `isRawModeSupported`.
3. **Minimum width fallback** — 40 columns chosen as minimum. Is this right for the target users?

---

## References

- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [@inkjs/ui](https://github.com/vadimdemedes/ink/tree/main/packages/ui)
- [OpenCode TUI](https://github.com/sst/opencode) — UX reference
- [Claude Code](https://github.com/anthropics/claude-code) — Ink implementation reference
- [ink-text-input](https://github.com/vadimdemedes/ink-text-input)
- [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library)
