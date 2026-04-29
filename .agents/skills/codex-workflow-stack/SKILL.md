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
- `security-best-practices`, `security-threat-model`, and repo checks for security work.
- `graphify` for large codebase maps, architecture discovery, dependency neighborhoods, or persistent graph queries when normal file inspection is too narrow.
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
- Large codebase map or persistent graph request: use `graphify` after checking `.graphifyignore`; do not commit `graphify-out/`.
- Multi-agent or worktree orchestration: use local subagents only when the user explicitly asks for parallel agent work. Do not install external orchestrators by default.
- App connector work: use existing Codex app plugins first. Do not install Composio Connect or similar account-bound tools without a specific user request and setup confirmation.

## Release Notes Rules

When asked for a changelog:

1. Inspect `git tag`, `git log`, and relevant diffs for the requested range.
2. Separate user-visible changes from internal maintenance.
3. Group by `Added`, `Improved`, `Fixed`, `Security`, and `Internal` only when those categories are useful.
4. Avoid raw commit wording, backend jargon, and secret-sensitive details.
5. Mention migrations, environment changes, or manual verification steps only when they affect release safety.

## Reference

Read `references/reddit-setup-evaluation.md` when deciding whether to install or adopt a newly recommended Codex helper tool.
