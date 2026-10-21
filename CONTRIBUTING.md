# Contributing to Agentic-cli

Thank you for your interest in contributing! This guide covers everything you need to go from zero to a merged pull request.

---

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork and add the upstream remote:

```bash
git clone https://github.com/<your-username>/Agentic-cli.git agentic-cli
cd agentic-cli
git remote add upstream https://github.com/UdaySharmaGitHub/Agentic-cli.git
```

3. Keep your fork in sync:

```bash
git fetch upstream
git merge upstream/main
```

---

## Development Setup

**Prerequisites**

- Node.js ≥ 18
- pnpm (`npm install -g pnpm`)
- A Google Gemini API key (for running the CLI)

**Install dependencies and configure environment**

```bash
pnpm install --allow-build=esbuild
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY (and optionally BRAVE_API_KEY / TAVILY_API_KEY)
```

**Build and run**

```bash
pnpm build   # Compile TypeScript → dist/
pnpm dev     # Run directly via tsx (no build step)
```

---

## Reporting Bugs

1. Search [existing issues](https://github.com/UdaySharmaGitHub/Agentic-cli/issues) to avoid duplicates.
2. If none exists, open one using the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template.
3. Include your Node version (`node --version`), OS, Agentic-cli version (`pnpm dev -- --version`), and the full terminal output from `pnpm dev`.

---

## Suggesting Features

Open an issue using the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template. Describe the problem, your proposed solution, and any alternatives you considered.

---

## Branch Naming Convention

All branches must follow the pattern `<type>/<short-descriptive-name-in-kebab-case>`.

| Type | When to use | Example |
|------|-------------|---------|
| `feature/` | Adding new functionality | `feature/add-web-search-tool` |
| `fix/` or `bug/` | Bug fixes | `fix/terminal-hang-on-exit` |
| `migration/` | Architecture or provider migrations | `migration/multi-terminal-parallel-processing-architecture` |
| `testing/` | Adding or updating test files only | `testing/updating-testcases-files` |
| `infra/` | Build, CI, config, or tooling changes | `infra/add-github-actions-ci` |
| `documentation/` | Documentation-only changes | `documentation/update-contributing-guide` |

**Real branch names from this project for reference:**

- `feature/add-no-history-privacy-flag-for-ephemeral-sessions`
- `feature/context-window-guard-auto-compaction`
- `feature/export-conversation`
- `feature/named-sessions-multi-session-context-history-management`
- `feature/workspace-file-watching-ambient-file-change-awareness`
- `feature/zod-tool-input-validation`
- `migration/multi-terminal-parallel-processing-architecture`
- `testing/updating-testcases-files`
- `documentation/open-source-contribution`

---

## Pull Request Process

1. Create a branch following the naming convention above.
2. Make your changes.
3. Run `pnpm build` — it must pass with no errors.
4. Push your branch and open a pull request against `main`.
5. Fill in the [PR template](.github/pull_request_template.md) completely.
6. Respond promptly to review feedback.

---

## Coding Standards

- **TypeScript strict mode** — `strict: true` in `tsconfig.json`; no `any`
- **ESM modules** — use `.js` extensions in all relative imports (e.g., `import x from "./foo.js"`)
- **Types** — use `ConfirmFn` and `ToolResult` from `src/tools/types.ts`
- No commented-out code; no `console.log` left in production paths

---

## Adding a New Tool

**Step 1 — Create the module** in `src/tools/`:

```typescript
// src/tools/myTool.ts
import type { ToolDefinition } from "./types.js";

export const myTool: ToolDefinition = {
  name: "my_tool",
  description: "What my tool does.",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "The input." },
    },
    required: ["input"],
  },
  async execute(args, confirm) {
    const input = String(args["input"]);
    // Confirm destructive actions with the user:
    // const ok = await confirm(`Do something with ${input}?`);
    // if (!ok) return { success: false, output: "Cancelled." };
    return { success: true, output: `Received: ${input}` };
  },
};
```

**Step 2 — Register it** in `src/tools/index.ts`:

```typescript
export { myTool } from "./myTool.js";
```

Then add `myTool` to the `TOOLS` array in `src/index.ts`.

---

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add pdf_read tool
fix: handle empty input in modify_file
docs: update CONTRIBUTING with branch naming
refactor: extract confirm helper to ui.ts
```

Valid types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`
