# Issue: Prepare Agentic-cli for Open-Source Contribution

## Summary

Agentic-cli v4.2 is a fully working agentic CLI powered by Google Gemini. The codebase is ready for contributors, but several community and legal files are missing that GitHub requires before a project shows a green "Community Standards" health score and before external contributors can safely submit pull requests.

This issue tracks every file that needs to be created so that a first-time contributor can go from zero to a merged PR without asking any questions.

---

## Background

Agentic-cli is a terminal-based agentic CLI that:
- Reads/writes files, runs shell commands, and searches the web via a ReAct agent loop
- Uses Google Gemini (`@google/generative-ai`) with native streaming and function calling
- Is written in TypeScript (Node.js ≥ 18), built with `tsup`, and run via `tsx` in development
- Requires a `GEMINI_API_KEY` and optionally `BRAVE_API_KEY` / `TAVILY_API_KEY`
- Exposes a modular tool system where new tools are added in two steps (create module + register)

The repository currently has: `README.md`, `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `LICENSE`, and the full `src/` source tree.

---

## What Is Missing

The following files do not yet exist and must be created:

| # | File | Status |
|---|------|--------|
| 1 | `CONTRIBUTING.md` | Missing |
| 2 | `CODE_OF_CONDUCT.md` | Missing |
| 3 | `SECURITY.md` | Missing |
| 4 | `.github/ISSUE_TEMPLATE/bug_report.md` | Missing |
| 5 | `.github/ISSUE_TEMPLATE/feature_request.md` | Missing |
| 6 | `.github/pull_request_template.md` | Missing |
| 7 | `CHANGELOG.md` | Missing |
| 8 | `.github/workflows/ci.yml` | Missing |

The following existing files need updates:

| # | File | What needs to change |
|---|------|----------------------|
| 9 | `README.md` | Add badges, fix `<repo-url>` placeholder, add Contributing section, fix license section |
| 10 | `.gitignore` | Audit for secrets, build artifacts, IDE files |
| 11 | `package.json` | Add `repository`, `bugs`, `homepage` fields; add `test` script |

---

## Acceptance Criteria

A PR resolving this issue must:

- [ ] Create `CONTRIBUTING.md` with the sections listed below
- [ ] Create `CODE_OF_CONDUCT.md` based on Contributor Covenant v2.1
- [ ] Create `SECURITY.md` with a supported-versions table and private reporting instructions
- [ ] Create `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] Create `.github/ISSUE_TEMPLATE/feature_request.md`
- [ ] Create `.github/pull_request_template.md`
- [ ] Create `CHANGELOG.md` with an `[Unreleased]` section and a `[4.2.0]` entry
- [ ] Create `.github/workflows/ci.yml` that runs typecheck + build on every push and PR to `main`
- [ ] Update `README.md` — add badges, fix `<repo-url>` placeholder, add Contributing section, tighten license reference
- [ ] Audit `.gitignore` — confirm secrets, build artifacts, and IDE files are excluded
- [ ] Update `package.json` — add `repository`, `bugs`, `homepage` fields and a `test` script
- [ ] Pass `pnpm build` without errors after the changes
- [ ] GitHub Community Standards profile shows all green checkmarks

---

## Detailed Requirements per File

### 1. `CONTRIBUTING.md`

Must include these sections in order:

1. **Code of Conduct** — Link to `CODE_OF_CONDUCT.md`
2. **Getting Started** — Fork → clone → add upstream remote, copy-pasteable commands
3. **Development Setup** — Prerequisites (Node ≥ 18, pnpm), install steps, `.env` config
4. **Reporting Bugs** — Search existing issues first; use the Bug Report template; include Node version, OS, `pnpm dev` output
5. **Suggesting Features** — Use the Feature Request template
6. **Branch Naming Convention** — All branches must follow the pattern `<type>/<short-descriptive-name-in-kebab-case>`. Required types and when to use each:

   | Type | When to use | Example |
   |------|-------------|---------|
   | `feature/` | Adding new functionality | `feature/add-web-search-tool` |
   | `fix/` or `bug/` | Bug fixes | `fix/terminal-hang-on-exit` |
   | `migration/` | Architecture or provider migrations | `migration/multi-terminal-parallel-processing-architecture` |
   | `testing/` | Adding or updating test files only | `testing/updating-testcases-files` |
   | `infra/` | Build, CI, config, or tooling changes | `infra/add-github-actions-ci` |
   | `documentation/` | Documentation-only changes | `documentation/update-contributing-guide` |

   Real branch names from this project for reference:
   ```
   feature/add-no-history-privacy-flag-for-ephemeral-sessions
   feature/context-window-guard-auto-compaction
   feature/export-conversation
   feature/named-sessions-multi-session-context-history-management
   feature/workspace-file-watching-ambient-file-change-awareness
   feature/zod-tool-input-validation
   migration/multi-terminal-parallel-processing-architecture
   testing/updating-testcases-files
   documentation/open-source-contribution
   ```
7. **Pull Request Process** — Create branch → change → `pnpm build` → push → fill PR template → respond to review
8. **Coding Standards** — TypeScript strict mode, ESM modules (`.js` imports), no `any`, `ConfirmFn`/`ToolResult` types from `tools/types.ts`
9. **Adding a New Tool** — Two-step process (already documented in README; mirror it here with the exact file paths)
10. **Commit Message Format** — Conventional Commits:
    ```
    feat: add pdf_read tool
    fix: handle empty input in modify_file
    docs: update CONTRIBUTING with branch naming
    refactor: extract confirm helper to ui.ts
    ```

### 2. `CODE_OF_CONDUCT.md`

- Adopt Contributor Covenant v2.1 verbatim
- Include the four enforcement tiers: Correction → Warning → Temporary Ban → Permanent Ban
- Provide a contact method for reporting violations

### 3. `SECURITY.md`

Must include:
- **Supported Versions** table (v4.2.x = supported; older = not supported)
- **Reporting a Vulnerability** — Direct researchers to GitHub's private security advisory form; explicitly say do NOT open a public issue
- **What to include** — Affected version, description, reproduction steps, suggested fix
- **Response SLA** — Acknowledgement within 5 business days; fix target within 30 days for critical issues
- **Security Notes for Contributors** — Never commit API keys; `GEMINI_API_KEY`, `BRAVE_API_KEY`, `TAVILY_API_KEY` must stay in `.env` only; treat `run_command` input, file paths, and web search results as untrusted data

### 4. `.github/ISSUE_TEMPLATE/bug_report.md`

Frontmatter: `name: Bug Report`, `about: Report a reproducible bug`, `title: "[BUG] "`, `labels: bug`

Sections:
- **Description** — Clear description of the bug
- **Steps to Reproduce** — Numbered steps
- **Expected Behaviour**
- **Actual Behaviour**
- **Environment** — Node version, OS, Agentic-cli version (`pnpm dev -- --version`), model used
- **Logs / Error Output** — Code block for terminal output
- **Additional Context**

### 5. `.github/ISSUE_TEMPLATE/feature_request.md`

Frontmatter: `name: Feature Request`, `about: Suggest a new tool or improvement`, `title: "[FEATURE] "`, `labels: enhancement`

Sections:
- **Problem** — What problem does this solve?
- **Proposed Solution** — What should Agentic-cli do?
- **Alternatives Considered**
- **Tool Addition?** — If this is a new tool, name it and describe its `definition` schema
- **Additional Context**

### 6. `.github/pull_request_template.md`

Sections:
- **Summary** — What does this PR do?
- **Related Issue** — `Closes #`
- **Type of Change** — Checklist: bug fix / new feature / new tool / docs / refactor / ci
- **Validation** — Checklist: `pnpm build` passes, `pnpm typecheck` passes (if script exists), manually tested in REPL
- **Contributor Checklist** — Focused change, no secrets committed, safety boundaries respected (blocked commands / protected paths untouched unless intentional), KB files unaffected
- **Breaking Changes** — Yes/No; if yes, describe
- **Additional Notes**

### 7. `CHANGELOG.md`

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Include:

```
## [Unreleased]

## [4.2.0] - 2024-xx-xx
### Added
- TypeScript rewrite of the original Bash v4.1 script
- Native Gemini function calling via @google/generative-ai SDK
- Streaming responses with ora spinner
- Modular tool system (readFile, writeFile, appendFile, modifyFile, listDir, runCommand, searchFiles, webSearch)
- Interactive setup wizard via @clack/prompts
- Knowledge Base / role file support with auto-discovery from roles based Workflow/
- REPL commands: /exit, /quit, /clear, /history, /status, /help, /raw
- --yolo flag for auto-approving all actions
- Safety layer: blocked command patterns + protected paths
- Chat history persistence (chat_history.json)

[Unreleased]: https://github.com/UdaySharmaGitHub/Agentic-cli/compare/v4.2.0...HEAD
[4.2.0]: https://github.com/UdaySharmaGitHub/Agentic-cli/releases/tag/v4.2.0
```

The version comparison links at the bottom are required by Keep a Changelog format. Replace `<owner>` with the actual GitHub username/org.

### 8. `.github/workflows/ci.yml`

Trigger: `push` and `pull_request` to `main`

Steps:
1. Checkout
2. Setup Node.js 20 (LTS)
3. Install pnpm via `corepack enable`
4. `pnpm install --frozen-lockfile`
5. `pnpm build`

### 9. `README.md` updates

Four specific changes are required:

1. **Fix the `<repo-url>` placeholder** — The Getting Started section currently reads `git clone <repo-url> agentic-cli`. Replace with:
   ```
   git clone https://github.com/UdaySharmaGitHub/Agentic-cli.git agentic-cli
   ```

2. **Add badges** at the top of the file, below the ASCII banner:
   ```markdown
   ![CI](https://github.com/UdaySharmaGitHub/Agentic-cli/actions/workflows/ci.yml/badge.svg)
   ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
   ![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
   ```

3. **Add a Contributing section** before the License section:
   ```markdown
   ## Contributing
   Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming,
   commit format, and PR guidelines. Report bugs via the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)
   template and report security issues privately via [SECURITY.md](SECURITY.md).
   ```

4. **Fix the license reference** — The current text is just `MIT`. Change it to:
   ```markdown
   ## License
   MIT — see [LICENSE](LICENSE).
   ```

### 10. `.gitignore` audit

Verify (and add if missing) entries for:
- Secrets: `.env`, `*.key`, `*.pem`
- Build output: `dist/`, `*.tsbuildinfo`
- Runtime files: `chat_history.json`, `*.log`
- IDE/OS metadata: `.vscode/`, `.idea/`, `.DS_Store`, `Thumbs.db`
- Dependency cache: `node_modules/`

### 11. `package.json` additions

Add these top-level fields (replace `<owner>` with the actual GitHub username/org):

```json
"repository": {
  "type": "git",
  "url": "https://github.com/UdaySharmaGitHub/Agentic-cli.git"
},
"bugs": {
  "url": "https://github.com/UdaySharmaGitHub/Agentic-cli/issues"
},
"homepage": "https://github.com/UdaySharmaGitHub/Agentic-cli#readme"
```

Also add a `test` script to the `scripts` block. Since no test suite exists yet, use a placeholder that exits cleanly:

```json
"test": "echo \"No tests yet\" && exit 0"
```

This satisfies npm's expectation of a `test` script and can be replaced when tests are added.

---

## Out of Scope for This Issue

- Adding a `typecheck` script to `package.json` (separate issue)
- Publishing to npm (separate issue)
- Adding real unit or integration tests (separate issue — the `test` script placeholder added here is intentionally minimal)
- Roadmap or FAQ section in README (optional; can be a follow-up)

---

## Labels

`good first issue` · `documentation` · `help wanted`

---

## Estimated Effort

Medium — all files are documentation/config. No source code changes required. A contributor comfortable with Markdown and GitHub Actions can complete this in 2–4 hours.
