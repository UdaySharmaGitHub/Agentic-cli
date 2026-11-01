# [Infra] CI Pipeline Optimization & Additional Workflows for Open Source Scale

**Labels:** `infrastructure`, `ci`, `enhancement`, `good first issue`
**Priority:** Medium
**Branch:** `infra/ci-pipeline-optimization`

---

## Context

Agentic CLI currently has a minimal CI pipeline (`.github/workflows/ci.yml`) that only runs `pnpm build`. As the project grows in open source contributions, the current setup needs to scale to handle:

- First-time contributors who need guidance
- PRs from forks (external contributors)
- Security vulnerabilities — especially relevant given `run_command` executes arbitrary shell commands
- Consistent code quality across contributors
- Automated dependency updates
- Automated release management
- Stale issues/PRs piling up unattended

This issue tracks all optimizations and new workflows needed to make Agentic CLI's infrastructure contributor-friendly and production-grade.

---

## Current State

| File | Status |
|---|---|
| `.github/workflows/ci.yml` | ⚠️ Partial — runs `pnpm build` only; no typecheck, no tests, single Node 20 only |
| `.github/dependabot.yml` | ❌ Missing |
| `.github/CODEOWNERS` | ❌ Missing |
| `.github/labeler.yml` | ❌ Missing |
| `CONTRIBUTING.md` | ✅ Done |
| `.github/ISSUE_TEMPLATE/bug_report.md` | ✅ Done |
| `.github/ISSUE_TEMPLATE/feature_request.md` | ✅ Done |
| `.github/pull_request_template.md` | ✅ Done |

---

## Proposed Improvements

---

### 1. Fix & Expand the Core CI Pipeline — `ci.yml`

**Priority: High**

The current `ci.yml` only builds. It must also typecheck and run the full test suite, and do so across the supported Node range.

**Proposed `ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4

      - name: Enable pnpm via corepack
        run: corepack enable

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile --allow-build=esbuild

      - name: Typecheck
        run: pnpm typecheck

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

      - name: Coverage
        run: pnpm test:coverage
        if: matrix.node-version == 20
```

**What changes:**
- Adds `pnpm typecheck` step (catches type errors before build)
- Adds `pnpm test` and `pnpm test:coverage` steps (depends on [#test-suite issue](./Complele-test-suit-both-unit-and-integration.md) being done first)
- Runs across Node 18, 20, 22 (matches `engines: { node: ">=18" }` in `package.json`)
- Adds `concurrency` to cancel outdated runs on force-push
- Coverage report only on Node 20 to avoid duplication

> **Note:** The `pnpm test` and `pnpm test:coverage` steps can be added once the test suite is in place. Until then, the matrix + typecheck improvements should be merged first.

---

### 2. Dependabot for Automated Dependency Updates — `dependabot.yml`

**Priority: High**

No automated dependency updates are configured. Add Dependabot with weekly npm checks and grouped updates to keep the PR noise low:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: "06:00"
    groups:
      production-deps:
        dependency-type: production
      dev-deps:
        dependency-type: development
    ignore:
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]
```

---

### 3. CodeQL Security Scanning — `codeql.yml`

**Priority: High**

Agentic CLI's `run_command` tool executes arbitrary shell commands and `web_search` makes outbound HTTP calls — making static security analysis especially important for an open source project accepting external PRs.

CodeQL scans for:
- Command injection (critical for `run_command` and `execa` usage)
- Path traversal (relevant for `read_file`, `write_file`, `modify_file`)
- Insecure use of `eval`, `exec`, `child_process`
- Prototype pollution in tool argument parsing

```yaml
# .github/workflows/codeql.yml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 3 * * 1'   # Weekly Monday 3am

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
```

Findings appear in the repository's **Security → Code scanning** tab and as PR check failures for high/critical severity issues.

---

### 4. PR Auto-Labeler — `pr-labeler.yml`

**Priority: Medium**

Automatically labels PRs based on which files changed. Makes triage fast at scale.

```yaml
# .github/workflows/pr-labeler.yml
name: PR Labeler

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  label:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/labeler@v5
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```

Requires a companion `.github/labeler.yml` config matching Agentic CLI's actual structure:

```yaml
# .github/labeler.yml
infrastructure:
  - '.github/**'

tools:
  - 'src/tools/**'

tui:
  - 'src/tui/**'

core:
  - 'src/agent.ts'
  - 'src/openai.ts'
  - 'src/memory.ts'
  - 'src/config.ts'
  - 'src/prompts.ts'

safety:
  - 'src/safety.ts'

runbook:
  - 'src/runbook.ts'
  - 'src/replay.ts'

tests:
  - 'tests/**'

documentation:
  - 'docs/**'
  - '*.md'

dependencies:
  - 'package.json'
  - 'pnpm-lock.yaml'
```

---

### 5. Stale Issue & PR Management — `stale.yml`

**Priority: Medium**

With growing contributors, issues and PRs will pile up. Stale management automatically:
- Warns issues/PRs inactive for 30 days
- Closes them after a further 7 days of no activity
- Skips items with `pinned`, `security`, or `in-progress` labels

```yaml
# .github/workflows/stale.yml
name: Stale

on:
  schedule:
    - cron: '0 9 * * 1'   # Every Monday 9am

jobs:
  stale:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
    steps:
      - uses: actions/stale@v9
        with:
          stale-issue-message: >
            This issue has been inactive for 30 days. It will be closed in 7 days
            unless there is new activity. Comment to keep it open.
          stale-pr-message: >
            This PR has been inactive for 30 days. It will be closed in 7 days
            unless there is new activity. Push a commit or comment to keep it open.
          close-issue-message: 'Closing due to inactivity. Reopen if still relevant.'
          close-pr-message: 'Closing due to inactivity. Reopen and push a new commit to resume.'
          days-before-stale: 30
          days-before-close: 7
          exempt-issue-labels: 'pinned,security,in-progress'
          exempt-pr-labels: 'pinned,security,in-progress'
```

---

### 6. Welcome First-Time Contributors — `welcome.yml`

**Priority: Medium**

A friendly automated welcome message on a contributor's first PR or issue significantly improves open source contributor experience.

```yaml
# .github/workflows/welcome.yml
name: Welcome

on:
  pull_request_target:
    types: [opened]
  issues:
    types: [opened]

jobs:
  welcome:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
    steps:
      - uses: actions/first-interaction@v1
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          issue-message: |
            👋 Thanks for opening your first issue on Agentic CLI!
            Please make sure you've read [CONTRIBUTING.md](./CONTRIBUTING.md) and filled out all relevant sections.
            We'll get back to you as soon as possible.
          pr-message: |
            👋 Thanks for your first contribution to Agentic CLI!
            Your PR will be reviewed shortly. Make sure all CI checks pass before requesting a review.
            See [CONTRIBUTING.md](./CONTRIBUTING.md) for our contribution guidelines.
```

---

### 7. Automated npm Release — `release.yml`

**Priority: Low (add when ready to publish)**

Agentic CLI already has a `bin` field and is at v4.2.0. When ready to publish to npm, an automated release workflow triggered by version tags:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Enable pnpm via corepack
        run: corepack enable

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile --allow-build=esbuild
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
      - run: pnpm publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Requires `NPM_TOKEN` secret in the repository settings.

---

### 8. Dependabot Auto-Merge for Patch & Minor Bumps — `dependabot-auto-merge.yml`

**Priority: Low (add after test coverage reaches ≥ 80%)**

Once CI coverage is high enough, auto-merge Dependabot patch and minor bumps to reduce manual review load. The two update types are handled differently:

| Update type | Behaviour | Rationale |
|---|---|---|
| `semver-patch` (e.g. `4.2.0 → 4.2.1`) | Auto-merge immediately | Bug fixes only; no API surface change |
| `semver-minor` (e.g. `4.2.0 → 4.3.0`) | Auto-merge **only after all CI checks pass** | New features; safe if tests are green |
| `semver-major` (e.g. `4.2.0 → 5.0.0`) | ❌ Never auto-merged | Breaking changes always need human review |

```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-merge

on: pull_request

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    permissions:
      pull-requests: write
      contents: write
    steps:
      - name: Fetch Dependabot metadata
        uses: dependabot/fetch-metadata@v2
        id: metadata

      # Patch bumps — merge immediately without waiting for CI
      - name: Auto-merge patch bump
        if: steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Minor bumps — register for auto-merge so it merges once CI is green
      - name: Auto-merge minor bump (after CI passes)
        if: steps.metadata.outputs.update-type == 'version-update:semver-minor'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **How `--auto` works:** `gh pr merge --auto` does not merge immediately — it registers the PR for auto-merge. GitHub will only execute the merge once all required status checks (the CI matrix jobs) pass. If any check fails the PR stays open for manual review. This makes minor bump auto-merge safe without adding a separate wait step.

> **Major bumps:** Intentionally excluded. Dependabot is configured in `dependabot.yml` (Section 2) to ignore major version updates (`update-types: ["version-update:semver-major"]`), so they will never appear as auto-mergeable PRs.

---

## Companion Files Needed

| File | Status | Purpose |
|---|---|---|
| `.github/dependabot.yml` | ❌ Missing | Automated dependency updates |
| `.github/labeler.yml` | ❌ Missing | Label rules for `pr-labeler.yml` |
| `.github/CODEOWNERS` | ❌ Missing | Auto-assign reviewers by file path |
| `CONTRIBUTING.md` | ✅ Exists | Contribution guide |
| `.github/ISSUE_TEMPLATE/bug_report.md` | ✅ Exists | Structured bug report template |
| `.github/ISSUE_TEMPLATE/feature_request.md` | ✅ Exists | Structured feature request template |
| `.github/pull_request_template.md` | ✅ Exists | PR description template |

---

## Workflow Classification

#### Pre-built — drop-in, configuration only

These use an existing GitHub or community action. You write config, not logic.

| Workflow | Action used | Effort |
|---|---|---|
| `codeql.yml` | `github/codeql-action@v3` | Low — no logic to write |
| `stale.yml` | `actions/stale@v9` | Low — just configure messages and timings |
| `pr-labeler.yml` | `actions/labeler@v5` | Low — write `labeler.yml` path rules |
| `welcome.yml` | `actions/first-interaction@v1` | Low — write welcome messages |
| `dependabot-auto-merge.yml` | `dependabot/fetch-metadata@v2` | Low — copy and adjust |

#### Custom — authored by us

| Workflow | What makes it custom |
|---|---|
| `ci.yml` *(extend existing)* | Node matrix, step order, typecheck + test + coverage wiring |
| `release.yml` | Build → typecheck → test → publish sequence, tag trigger, npm auth |

---

## Implementation Order

| Priority | Item | Reason |
|---|---|---|
| 1 | Fix `ci.yml` — add typecheck + Node matrix | Correctness gate; caught on every PR |
| 2 | Add `dependabot.yml` | Keeps dependencies up to date from day one |
| 3 | `codeql.yml` | Security — critical given `run_command` executes shell |
| 4 | `pr-labeler.yml` + `labeler.yml` | Triage at scale |
| 5 | `stale.yml` | Issue hygiene as contributor count grows |
| 6 | `welcome.yml` | Contributor experience |
| 7 | Add `pnpm test` to `ci.yml` | After test suite issue is merged |
| 8 | `release.yml` | Only when npm publish is planned |
| 9 | `dependabot-auto-merge.yml` | Only after test coverage ≥ 80%; merges patch immediately, minor after CI passes |

---

## Acceptance Criteria

- [ ] `ci.yml` runs `typecheck`, `build`, and `test` on Node 18, 20, and 22
- [ ] `dependabot.yml` is present and weekly updates are enabled
- [ ] CodeQL scanning is enabled and visible in the Security tab
- [ ] PRs are automatically labelled by file path
- [ ] Stale issues/PRs are managed automatically
- [ ] First-time contributors receive a welcome message
- [ ] All new workflows pass on first run
- [ ] `release.yml` is ready (but gated behind `NPM_TOKEN` secret)
