---
name: codex-workflow-stack
description: Use this skill when the user asks about Codex setup, installing or choosing Codex skills/tools, CI fixes, GitHub PR workflows, changelogs, Sentry triage, workflow automation, multi-agent/worktree orchestration, token/usage tooling, or remembering agent methods in Markdown.
---

# Codex Workflow Stack

Use this skill to choose safe helper tools for this Secret Santa repo without chasing every popular Reddit recommendation.

## Default Stack

Prefer the tools already installed and trusted in this workspace:

- `gh-fix-ci` for failing GitHub Actions or CI logs.
- `gh-address-comments` for actionable PR review comments.
- GitHub plugin or `gh` CLI for repo, issue, PR, and workflow inspection.
- `sentry` for production error investigation when Sentry access is available.
- `playwright`, `playwright-interactive`, and `webapp-testing` for app and UI verification.
- `frontend-product-ui`, `PRODUCT.md`, `DESIGN.md`, Stitch first, then Figma and Taste skills for UI work.
- Oracle browser mode for second opinions after a dry run; this machine uses a persistent manual-login browser profile and skips ChatGPT's fragile model selector.
- `security-best-practices`, `security-threat-model`, and repo checks for security work.
- Repo-local `sqlmap` for authorized SQL injection checks on local/dev or app-owned preview endpoints, scoped with low-risk/read-only options by default.
- `graphify` automatically for large codebase maps, architecture discovery, dependency neighborhoods, or persistent graph queries when normal file inspection is too narrow.
- `ao.cmd` for Agent Orchestrator when parallel worktrees or agent-session management would materially help a task.
- GSD (`get-shit-done-cc`) local minimal Codex install for structured discuss/plan/execute/verify phase workflows on broad, ambiguous, or multi-step work.
- Matt Pocock `grill-me` / `grill-with-docs` style interrogation for ambiguous, high-impact, architectural, product/design, or edge-case-heavy plans.
- Git history plus the release-note rules below for changelogs.

## Decision Rules

1. Prefer official, installed, repo-local, or open-source tools with clear licensing.
2. Do not install desktop apps, global CLIs, or account-bound connectors just because a thread recommends them.
3. Do not use tools that can perform remote writes unless the user asks for that write path and the action has been dry-run or confirmed.
4. Treat Reddit posts as field reports, not authority. Verify against GitHub, official docs, package metadata, or local tool availability.
5. Keep helper tooling from changing app behavior unless the user asks for a product change.
6. If a third-party skill repo has no license, missing scripts, or unclear provenance, do not copy it into this repo. Recreate only the small workflow idea in our own words when useful.
7. Keep generated helper installs and scratch workflow state uncommitted unless the user explicitly asks to vendor them.

## Workflow Selection

- CI failing: use `gh-fix-ci`, inspect logs, fix the root cause, then run local matching checks.
- PR comments: use `gh-address-comments`, resolve only actionable feedback, and preserve unrelated user changes.
- Sentry alert: use `sentry` if configured; otherwise ask for the issue link or stack trace and map frames locally.
- Changelog/release notes: use `git log`, group changes by user impact, filter internal noise, and write normal user-facing copy.
- Frontend work: use `frontend-product-ui`, `PRODUCT.md`, `DESIGN.md`, Stitch first, Figma when relevant and available, Playwright/browser verification, and Taste/Impeccable skills.
- Performance/security/architecture work: use `code-improvement`; add Oracle dry-run for meaningful risk.
- SQL injection or parameterized-input testing: use PayloadsAllTheThings as a reference and the ignored repo-local `sqlmap` checkout for focused local/preview app-owned endpoints. Never target production, third-party, or user-supplied external URLs without explicit approval; do not dump data, use tamper/evasion, or store cookies/tokens in prompts, docs, logs, or commits.
- Large codebase map, architecture discovery, or persistent graph need: use `graphify` automatically after checking `.graphifyignore`; do not commit `graphify-out/`.
- Multi-agent or worktree orchestration: use `ao.cmd` automatically when the task truly benefits from branch-per-agent work, CI session tracking, or parallel coding sessions. Keep generated branches/worktrees reviewable and avoid remote-write flows unless the user task calls for them.
- Broad ambiguous implementation or product iteration: use GSD-style phases to keep discussion, plan, execution, and verification explicit. On Codex, do the work inline unless the user explicitly requested sub-agents; never let GSD skip repo checks or safety gates.
- Unclear or risky requirements: use the `grill-me` approach before planning or editing. Ask one focused question at a time with a recommended answer, but answer from the codebase first when local inspection can resolve it. Use `grill-with-docs` ideas for domain-language or ADR-worthy decisions, creating docs only when the repo task truly needs them.
- App connector work: use existing Codex app plugins first. Do not install Composio Connect or similar account-bound tools without a specific user request and setup confirmation.

## Oracle, Stitch, And Figma Notes

- Oracle `0.9.0` browser mode is configured locally at `%USERPROFILE%\.oracle\config.json` with `engine: "browser"`, `browser.manualLogin: true`, `browser.keepBrowser: true`, and `browser.modelStrategy: "ignore"`. Use `npx -y @steipete/oracle@0.9.0` for the tested path, dry-run first, then browser mode; do not switch to API mode without explicit approval.
- If Oracle reports that the ChatGPT model selector is missing, keep `modelStrategy: "ignore"` and prefer manual login. Avoid cookie extraction or inline cookie files unless the user specifically chooses that secret-handling path; never paste cookies into prompts, docs, logs, or committed files.
- For Stitch, treat project `3072957204541081703` as the primary Secret Santa design source. For any meaningful screen, flow, or component design/redesign, ask Stitch to create or refresh the design direction before implementation, then use the rest of the tool stack to refine and verify. Do not call `list_design_systems` with an empty request. First call `list_projects`, then use project-scoped calls. The current Secret Santa design source is project `3072957204541081703` (`Process Explainer`, despite the generic title; its screens include Secret Santa shopping/chat/auth designs).
- For Figma, use the connected Figma MCP/plugin automatically when a task references a Figma file, node, frame, selection, component mapping, screenshot, design exploration, mockup, or design-system sync. Preferred flow: get exact design context for the selected node, fetch a screenshot/reference, narrow large files to relevant nodes, reuse repo components/tokens, and verify with Playwright/browser screenshots. Use Figma write/design tools when an editable file or frame is available; if the current seat is view-only, use Figma as the reference source and continue from screenshots, Stitch, `PRODUCT.md`, `DESIGN.md`, and local code.

## Installed Orchestrator

Use `ao.cmd` on Windows, not `ao`, because PowerShell can block the generated `ao.ps1` shim.

Known status:

- `@aoagents/ao` version `0.3.0` is installed globally.
- `ao.cmd --version` and `ao.cmd --help` work.
- `ao.cmd doctor` currently fails because package version `0.3.0` looks for a missing `ao-doctor.sh`; do not treat that doctor failure as a repo problem.

## GSD Notes

Local minimal Codex install was performed with `npx.cmd --yes get-shit-done-cc@latest --codex --local --minimal`. It installs core phase skills under `.codex/skills/gsd-*` and a vendored workflow tree under `.codex/get-shit-done/`; these are local agent tooling artifacts, not app source. Use the same explicit `--codex --local --minimal` flags for updates. Do not run plain non-interactive installs, because the CLI can default to another runtime/global location. The package is useful for process structure, but this repo's `AGENTS.md`, `.agent/CONTINUITY.md`, security rules, Oracle/Figma/Stitch workflow, VS Code Problems checks, and manual commit/push preference remain higher priority.

## Grill-Me Notes

Use the method from `mattpocock/skills` rather than vendoring the skill by default. It is MIT-licensed and useful for alignment before work begins: interrogate the plan or design, resolve decision-tree branches one at a time, and provide a recommended answer with each question. For this repo, keep it lightweight and codebase-aware: do local inspection before asking, do not create docs unless useful, and do not let the interview replace implementation when the next safe step is already clear.

## Release Notes Rules

When asked for a changelog:

1. Inspect `git tag`, `git log`, and relevant diffs for the requested range.
2. Separate user-visible changes from internal maintenance.
3. Group by `Added`, `Improved`, `Fixed`, `Security`, and `Internal` only when those categories are useful.
4. Avoid raw commit wording, backend jargon, and secret-sensitive details.
5. Mention migrations, environment changes, or manual verification steps only when they affect release safety.

## Reference

Read `references/reddit-setup-evaluation.md` when deciding whether to install or adopt a newly recommended Codex helper tool.
