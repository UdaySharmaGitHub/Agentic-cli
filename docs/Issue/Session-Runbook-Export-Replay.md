# Feature: Session Runbook Export & Replay

## The Problem It Solves

When an AI agent completes a task, the work is ephemeral — it lives only in the terminal session. There's no record of what was done, why each step was taken, or any way to repeat the same work on another machine. This feature fixes all three.

---

## What Was Built

### 1. Session Recorder

The agent now silently records every tool call it makes — what tool it used, what arguments it passed, what the result was, and what reasoning the LLM gave before calling it. This happens automatically across your entire session, even if you ask 5 or 6 different questions in one run. Every question and its steps are captured together.

### 2. `/export` Command — Three Formats

After any session, type `/export` and get a file in your current directory.

| Format | Description |
|--------|-------------|
| `/export html` (default) | A self-contained HTML page with a dark theme, gradient header, collapsible steps, colour-coded tool badges, syntax-highlighted arguments, and copy buttons on every code block. No server needed — opens in any browser. Designed to be screenshotted and shared. |
| `/export md` | A clean Markdown runbook grouped by question. Each step shows the LLM's reasoning, the tool arguments, and the result. Ready to drop into a GitHub wiki, Notion, or README. |
| `/export sh` | An executable shell script containing only the shell commands the agent ran, with the original reasoning as comments above each command. Marked `chmod 755` automatically so it runs directly. |
| `/export both` | Exports all three formats at once. |

The exported filename is auto-generated from your first question and the date, for example:

```
agentic-runbook-2026-10-26-set-up-eslint-in-my-project.html
```

### 3. Multi-turn Export

Previous behaviour reset the session on every new message, so `/export` after 5 questions only captured the last one. Now the session is initialised once when the CLI starts and accumulates steps across all messages. The HTML and Markdown exports group steps by question so the output stays readable.

### 4. `/replay` Command — Runbooks as Reusable Recipes

```
/replay path/to/runbook.sh
```

Feed a previously exported `.sh` runbook back into the CLI. The agent reads each command, displays the original reasoning that produced it, and asks for confirmation before running it. You can approve each step individually or skip ones you don't need.

This turns a one-off agent session into a repeatable recipe that anyone on the team can run on any machine.

---

## The Full Lifecycle

```
1. Run    — ask the agent to do a task
2. Export — /export html  →  shareable HTML page
            /export sh    →  re-runnable shell script
3. Replay — /replay runbook.sh  →  re-execute on any machine
```

---

## Files Added / Changed

| File | What it does |
|------|-------------|
| `src/runbook.ts` | Session recorder, export logic for MD / SH / HTML |
| `src/replay.ts` | Parses `.sh` runbooks back into executable steps |
| `src/index.ts` | Wires `/export` and `/replay` into the REPL |
| `src/ui.ts` | Print helpers for export and replay output |
