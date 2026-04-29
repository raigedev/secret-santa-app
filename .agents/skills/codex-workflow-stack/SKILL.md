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
- `frontend-product-ui`, `DESIGN.md`, Stitch, and Taste skills for UI work.
- Oracle browser mode for second opinions after a dry run; this machine uses a persistent manual-login browser profile and skips ChatGPT's fragile model selector.
- `security-best-practices`, `security-threat-model`, and repo checks for security work.
- `graphify` automatically for large codebase maps, architecture discovery, dependency neighborhoods, or persistent graph queries when normal file inspection is too narrow.
- `ao.cmd` for Agent Orchestrator when parallel worktrees or agent-session management would materially help a task.
- Git history plus the release-note rules below for changelogs.

## Decision Rules

1. Prefer official, installed, repo-local, or open-source tools with clear licensing.
2. Do not install desktop apps, global CLIs, or account-bound connectors just because a thread recommends them.
3. Do not use tools that can perform remote writes unless the user asks for that write path and the action has been dry-run or confirmed.
4. Treat Reddit posts as field reports, not authority. Verify against GitHub, official docs, package metadata, or local tool availability.
5. Keep helper tooling from changing app behavior unless the user asks for a product change.
6. If a third-party skill repo has no license, missing scripts, or unclear provenance, do not copy it into this repo. Recreate only the small workflow idea in our own words when useful.

## Workflow Selection

- CI failing: use `gh-fix-ci`, inspect logs, fix the root cause, then run local matching checks.
- PR comments: use `gh-address-comments`, resolve only actionable feedback, and preserve unrelated user changes.
- Sentry alert: use `sentry` if configured; otherwise ask for the issue link or stack trace and map frames locally.
- Changelog/release notes: use `git log`, group changes by user impact, filter internal noise, and write normal user-facing copy.
- Frontend work: use `frontend-product-ui`, Stitch when relevant, Playwright/browser verification, and `DESIGN.md`.
- Performance/security/architecture work: use `code-improvement`; add Oracle dry-run for meaningful risk.
- Large codebase map, architecture discovery, or persistent graph need: use `graphify` automatically after checking `.graphifyignore`; do not commit `graphify-out/`.
- Multi-agent or worktree orchestration: use `ao.cmd` automatically when the task truly benefits from branch-per-agent work, CI session tracking, or parallel coding sessions. Keep generated branches/worktrees reviewable and avoid remote-write flows unless the user task calls for them.
- App connector work: use existing Codex app plugins first. Do not install Composio Connect or similar account-bound tools without a specific user request and setup confirmation.

## Oracle And Stitch Notes

- Oracle `0.9.0` browser mode is configured locally at `%USERPROFILE%\.oracle\config.json` with `engine: "browser"`, `browser.manualLogin: true`, `browser.keepBrowser: true`, and `browser.modelStrategy: "ignore"`. Use `npx -y @steipete/oracle@0.9.0` for the tested path, dry-run first, then browser mode; do not switch to API mode without explicit approval.
- If Oracle reports that the ChatGPT model selector is missing, keep `modelStrategy: "ignore"` and prefer manual login. Avoid cookie extraction or inline cookie files unless the user specifically chooses that secret-handling path; never paste cookies into prompts, docs, logs, or committed files.
- For Stitch, do not call `list_design_systems` with an empty request. First call `list_projects`, then use project-scoped calls. The current Secret Santa design source is project `3072957204541081703` (`Process Explainer`, despite the generic title; its screens include Secret Santa shopping/chat/auth designs).

## Installed Orchestrator

Use `ao.cmd` on Windows, not `ao`, because PowerShell can block the generated `ao.ps1` shim.

Known status:

- `@aoagents/ao` version `0.3.0` is installed globally.
- `ao.cmd --version` and `ao.cmd --help` work.
- `ao.cmd doctor` currently fails because package version `0.3.0` looks for a missing `ao-doctor.sh`; do not treat that doctor failure as a repo problem.

## Release Notes Rules

When asked for a changelog:

1. Inspect `git tag`, `git log`, and relevant diffs for the requested range.
2. Separate user-visible changes from internal maintenance.
3. Group by `Added`, `Improved`, `Fixed`, `Security`, and `Internal` only when those categories are useful.
4. Avoid raw commit wording, backend jargon, and secret-sensitive details.
5. Mention migrations, environment changes, or manual verification steps only when they affect release safety.

## Reference

Read `references/reddit-setup-evaluation.md` when deciding whether to install or adopt a newly recommended Codex helper tool.
