# Open-Source Readiness Checklist

Use this checklist to prepare any repository for open-source collaboration. Work through it top to bottom, check off items as they are completed, and link the relevant Pull Request next to each item.

---

## 1. Core Documentation (`README.md`)

- [ ] **Badges** — Add build/CI status, license, and Node/runtime version badges at the top.
- [ ] **Project hook** — A compelling title and a one-paragraph elevator pitch explaining what problem the project solves and who it is for.
- [ ] **Getting Started** — Step-by-step installation (prerequisites, clone, install, configure) with copy-pasteable commands.
- [ ] **Usage & Examples** — At least one working quickstart snippet or command so a new user can see the tool in action immediately.
- [ ] **Contributing pointer** — A short "Contributing" section linking to `CONTRIBUTING.md`, the issue templates, and `SECURITY.md`.
- [ ] **Roadmap / FAQ** — Outline upcoming features or address common troubleshooting questions (optional but recommended).
- [ ] **License section** — Reference the `LICENSE` file explicitly (e.g. `MIT — see LICENSE`).
- [ ] **No placeholder URLs** — Replace all `<repo-url>` or `TODO` placeholders with real links before publishing.

---

## 2. Legal (`LICENSE`)

- [ ] Choose a license appropriate for your goals:
  - **MIT** — maximum permissiveness, minimal restrictions.
  - **Apache 2.0** — permissive with explicit patent protection.
  - **GPL v3** — copyleft; derivative works must stay open.
- [ ] Place the license file at the repository root as `LICENSE` (no extension).
- [ ] Reference the license in `README.md` and `package.json` (or equivalent manifest).

---

## 3. Repository Hygiene (`.gitignore`)

- [ ] Exclude secret/config files: `.env`, `*.key`, `*.pem`, credentials.
- [ ] Exclude build artifacts: `dist/`, `build/`, `out/`, `*.tsbuildinfo`.
- [ ] Exclude dependency caches: `node_modules/`, `.venv/`, `__pycache__/`.
- [ ] Exclude generated runtime files: logs, session data, token graphs, coverage reports.
- [ ] Exclude IDE and OS metadata: `.vscode/*` (keep `settings.json` if useful), `.idea/`, `.DS_Store`, `Thumbs.db`.

---

## 4. Package Manifest (`package.json` / `pyproject.toml` / etc.)

- [ ] **`repository`** — Git URL so npm/pip/crates.io links back to the source.
- [ ] **`bugs`** — Issue tracker URL.
- [ ] **`homepage`** — README or project homepage URL.
- [ ] **`engines` / `python_requires`** — Minimum supported runtime version.
- [ ] **`scripts`** — At minimum: `dev`, `build`, `test`, `typecheck` (or language equivalent).

---

## 5. Contribution Guidelines (`CONTRIBUTING.md`)

- [ ] **Code of Conduct pointer** — Link to `CODE_OF_CONDUCT.md` at the top.
- [ ] **Getting Started** — Fork → clone → add upstream remote (with copy-pasteable commands).
- [ ] **Development Setup** — Prerequisites, install steps, environment configuration.
- [ ] **Reporting Bugs** — Search existing issues first; use the Bug Report template; list required environment info.
- [ ] **Suggesting Features** — Use the Feature Request template; describe problem, solution, alternatives.
- [ ] **Branch Naming Convention** — Define allowed prefixes and pattern. Example:
  ```
  feature/<kebab-case-description>
  fix/<kebab-case-description>
  migration/<kebab-case-description>
  testing/<kebab-case-description>
  infra/<kebab-case-description>
  docs/<kebab-case-description>
  ```
  Include real branch name examples from your own repo.
- [ ] **Pull Request Process** — Step-by-step: create branch → make changes → run tests → push → fill PR template → respond to review.
- [ ] **Coding Standards** — Language, formatting, type discipline, comment policy, dependency policy.
- [ ] **Running Tests** — All test commands listed with a one-line description of each.
- [ ] **Adding a New Feature Unit** — E.g. how to add a new tool, plugin, command, or module.
- [ ] **Commit Message Format** — Conventional Commits or project-specific prefix table with an example.

---

## 6. Community Standards (`CODE_OF_CONDUCT.md`)

- [ ] Adopt a recognised standard such as the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct.html).
- [ ] Define the four enforcement tiers: Correction → Warning → Temporary Ban → Permanent Ban.
- [ ] Provide a private contact method (email or GitHub profile) for reporting violations.
- [ ] Attribute the source document.

---

## 7. Security Policy (`SECURITY.md`)

- [ ] **Supported versions table** — Which versions receive security fixes.
- [ ] **Private reporting instructions** — Explicitly tell researchers NOT to open a public issue. Point to GitHub's private advisory form or a contact email.
- [ ] **What to include in a report** — Description, affected version, reproduction steps, suggested fix.
- [ ] **Response SLA** — Acknowledgement within N days, fix target timeline.
- [ ] **Security guidance for contributors** — Never commit secrets; treat shell execution, file I/O, external APIs, and user-controlled input as security boundaries.

---

## 8. GitHub Templates (`.github/`)

### Issue Templates

- [ ] **`ISSUE_TEMPLATE/bug_report.md`** — Frontmatter (`name`, `about`, `title`, `labels`), Description, Reproduction steps, Environment, Logs section.
- [ ] **`ISSUE_TEMPLATE/feature_request.md`** — Frontmatter, Problem, Proposed solution, Alternatives, Additional context.

### Pull Request Template

- [ ] **`pull_request_template.md`** — Summary, Related issue (`Closes #`), Validation checklist (typecheck + build + test), Contributor checklist (focused change, docs updated, no secrets, safety considered), Breaking changes, Additional notes.

### CI Workflow (Recommended)

- [ ] **`workflows/ci.yml`** — Run on every push and PR to `main`: install → typecheck → build → test. Failing CI blocks merge.

---

## 9. Changelog (`CHANGELOG.md`) — Optional but Recommended

- [ ] Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
- [ ] Include an `[Unreleased]` section at the top for work in progress.
- [ ] Add one entry per release with `Added`, `Changed`, `Fixed`, `Removed` sub-sections.
- [ ] Add version comparison links at the bottom.

---

## Expected Outcome

When all items above are checked:

- GitHub's **Community Standards** profile shows all green checkmarks.
- The **license badge** and **CI badge** are visible on the repository homepage.
- A contributor can go from zero to a running local instance by following the README alone.
- A new contributor knows exactly how to name their branch, format their commits, and structure their PR without asking.
- Security researchers have a clear, private path to report issues.
- The project is indexed correctly on npm / PyPI / crates.io with proper source and issue links.
