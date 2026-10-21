## [Infra] CI Pipeline Optimization & Additional Workflows for Open Source Scale

**Labels:** `infrastructure`, `ci`, `enhancement`, `good first issue`
**Priority:** Medium
**Branch:** `infra/ci-pipeline-optimization`

---

### Prerequisites

This issue must be worked on **after** the following issues are closed:

1. **Documentation / Open Source Contribution issue** — creates `.github/workflows/ci.yml` (typecheck + build) and `dependabot.yml`
2. **Test Cases issue** — adds the test framework and `pnpm test` script

Both must be merged before this branch is created.

---

### Context

Agentic-cli is a terminal-based agentic CLI powered by Google Gemini. After the prerequisite issues close, Agentic-cli will have a foundational CI pipeline and Dependabot configured. As the project grows in open source contributions and contributors, the setup needs to scale to handle:

- First-time contributors who need guidance
- PRs from forks (external contributors)
- Security vulnerabilities in code contributions
- Consistent code quality across contributors
- Automated release management
- Stale issues/PRs piling up unattended

This issue tracks all optimizations and new workflows needed to make Agentic-cli's infrastructure contributor-friendly and production-grade.

---

### Current State (after prerequisites close)

| File | Status |
|---|---|
| `.github/workflows/ci.yml` | ✅ Done (via Documentation issue) — typecheck + build on Node 20 |
| `.github/dependabot.yml` | ✅ Done (via Documentation issue) — weekly npm dependency updates |

---

### Proposed Improvements

---

#### 1. CodeQL Security Scanning — `codeql.yml`

**Priority: High**

As an open source project accepting external PRs, static security analysis is critical. GitHub's CodeQL scans for:
- SQL injection, XSS, path traversal
- Command injection (especially relevant for Agentic-cli's `run_command` tool)
- Insecure use of `eval`, `exec`, `child_process`

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

#### 2. Stale Issue & PR Management — `stale.yml`

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

#### 3. PR Auto-Labeler — `pr-labeler.yml`

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

Requires a companion `.github/labeler.yml` config matching Agentic-cli's actual project structure:

```yaml
# .github/labeler.yml
infrastructure:
  - '.github/**'

tools:
  - 'src/tools/**'

core:
  - 'src/agent.ts'
  - 'src/gemini.ts'
  - 'src/memory.ts'
  - 'src/config.ts'
  - 'src/safety.ts'
  - 'src/ui.ts'
  - 'src/prompts.ts'
  - 'src/index.ts'

roles:
  - 'roles based Workflow/**'

tests:
  - 'test/**'

documentation:
  - 'docs/**'
  - '*.md'

dependencies:
  - 'package.json'
  - 'pnpm-lock.yaml'
```

---

#### 4. Welcome First-Time Contributors — `welcome.yml`

**Priority: Medium**

For open source projects, a friendly automated welcome message on first PR/issue significantly improves contributor experience.

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
            👋 Thanks for opening your first issue on Agentic-cli!
            Please make sure you've read [CONTRIBUTING.md](./CONTRIBUTING.md) and filled out all relevant sections.
            We'll get back to you as soon as possible.
          pr-message: |
            👋 Thanks for your first contribution to Agentic-cli!
            Your PR will be reviewed shortly. Make sure all CI checks pass before requesting a review.
            See [CONTRIBUTING.md](./CONTRIBUTING.md) for our contribution guidelines.
```

---

#### 5. Automated npm Release — `release.yml`

**Priority: Low (add when ready to publish)**

When Agentic-cli is ready for npm, an automated release workflow triggered by version tags:

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
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
      - run: pnpm publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Requires `NPM_TOKEN` secret in the repository settings.

---

#### 6. Dependabot Auto-Merge for Patch Bumps — `dependabot-auto-merge.yml`

**Priority: Low**

Once CI coverage is high enough, auto-merge Dependabot patch bumps to reduce manual review load:

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
      - uses: dependabot/fetch-metadata@v2
        id: metadata
      - if: steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### Companion Files Needed

In addition to the workflows above, the following non-workflow files should be added in the same or a follow-up PR:

| File | Purpose |
|---|---|
| `.github/CODEOWNERS` | Auto-assign reviewers by file path |
| `.github/labeler.yml` | Label rules for `pr-labeler.yml` (see section 3 above) |

> `CONTRIBUTING.md` and issue templates are handled by the Documentation issue prerequisite.

---

### Workflow Classification

Not all workflows require writing custom logic — some are fully pre-built by GitHub or the community and only need configuration. Understanding this helps estimate effort correctly.

#### Pre-built — drop-in, configuration only

These use an existing GitHub or community action. You write config, not logic. Near-zero maintenance.

| Workflow | Action used | What it provides |
|---|---|---|
| `codeql.yml` | `github/codeql-action@v3` | Entire security scanning engine — no logic to write |
| `stale.yml` | `actions/stale@v9` | All stale detection, warning, and close logic |
| `pr-labeler.yml` | `actions/labeler@v5` | All label matching logic — just provide `labeler.yml` rules |
| `welcome.yml` | `actions/first-interaction@v1` | First-time contributor detection + message posting |
| `dependabot-auto-merge.yml` | `dependabot/fetch-metadata@v2` | Reads update type; `gh pr merge` handles the merge |

**Effort:** Low — copy config, adjust messages, done.

#### Custom — authored by us

These use standard setup actions (`checkout`, `setup-node`, `pnpm`) but the **pipeline structure, steps, and decisions are ours**.

| Workflow | What makes it custom |
|---|---|
| `ci.yml` *(from Documentation issue)* | Step order, Node version, timeout, concurrency |
| `release.yml` | Build → test → publish sequence, tag trigger, npm auth wiring |

**Effort:** Medium — requires understanding of Agentic-cli's build pipeline.

---

### Implementation Order

| Priority | Workflow | Reason |
|---|---|---|
| 1 | `codeql.yml` | Security — critical for open source |
| 2 | `pr-labeler.yml` + `labeler.yml` | Triage at scale |
| 3 | `stale.yml` | Issue hygiene as contributor count grows |
| 4 | `welcome.yml` | Contributor experience |
| 5 | `release.yml` | Only when npm publish is planned |
| 6 | `dependabot-auto-merge.yml` | Only when test coverage is high |

---

### Acceptance Criteria

- [ ] CodeQL scanning enabled and visible in Security tab
- [ ] PRs are automatically labelled by file path using `labeler.yml` rules matching Agentic-cli's project structure
- [ ] Stale issues/PRs are managed automatically
- [ ] First-time contributors receive a welcome message
- [ ] `.github/CODEOWNERS` exists to auto-assign reviewers
- [ ] All new workflows pass on first run
