# Reddit Setup Evaluation

Reviewed on 2026-04-29 from the Reddit thread `With this setup CODEX is far better than Claude Code`.

## Adopt Automatically

- Use installed GitHub workflow skills for CI and PR review work.
- Use installed Playwright/webapp testing skills for browser validation.
- Use installed Sentry skill for Sentry issue triage when access is available.
- Use repo `frontend-product-ui` and `DESIGN.md` for frontend quality.
- Use installed `graphify` for large codebase maps, architecture discovery, dependency neighborhoods, and persistent graph queries when the task is broad enough to justify it.
- Use git history directly for changelogs and release notes.

## Already Covered

- `gh-fix-ci`: installed.
- `gh-address-comments`: installed.
- `webapp-testing`: installed.
- `playwright` and `playwright-interactive`: installed.
- `sentry`: installed as the repo-safe Sentry workflow.
- `create-plan`: available, but only use when the user asks for a plan.
- `graphify`: installed via `uv tool install graphifyy`; Codex skill installed at `C:\Users\kenda\.agents\skills\graphify\SKILL.md`.

## Do Not Install By Default

- `ComposioHQ/awesome-codex-skills`: useful list, but the repository reports no license through GitHub metadata. Do not copy its skill text into the repo. Recreate small workflow ideas only when needed.
- `connect` / Composio Connect: account-bound and can perform remote writes across apps. Use only after a specific user request, authentication setup, and write-action confirmation.
- `sentry-triage` from Composio: depends on Composio CLI and linked Sentry account. Prefer the installed `sentry` skill unless the user explicitly wants Composio.
- `agent-orchestrator`: MIT and interesting for parallel worktrees, but not needed for normal repo work. Use only after explicit user request for multi-worktree orchestration.
- `ccusage`: aimed at Claude Code usage analysis and has no GitHub license metadata in the checked repo. Not useful for this Codex app workflow.
- `caveman`: MIT but changes communication style to reduce tokens. Do not use because the user prefers direct practical engineering communication, not deliberately reduced prose.
- `cc-switch`: MIT desktop model switcher. Not relevant inside this Codex workspace.

## Graphify Guardrails

- Keep `.graphifyignore` present before graphing the repo.
- Do not commit `graphify-out/`.
- Prefer normal `rg` and direct file inspection for narrow fixes.
- Use Graphify when the user asks for broad architecture understanding, repo maps, relationship graphs, or long-lived codebase context.
- Do not run `graphify add <url>`, `--neo4j-push`, `hook install`, or `--watch` unless the user explicitly asks.
- Remember that docs, images, papers, and other semantic inputs can be sent to the configured model provider during extraction. Code AST extraction is local according to Graphify's README, but still avoid secrets and private dumps.

## Safety Checks For Future Tool Recommendations

- Check license metadata.
- Check whether the tool is an instruction-only skill, a global CLI, a desktop app, or an account connector.
- Check whether it can write to remote systems.
- Check whether it duplicates an installed skill.
- Check whether it helps this repo's actual workflows: Next.js, Supabase, GitHub, Vercel, Playwright, Sentry, security, and UI polish.
- Prefer documenting an optional tool over installing it when the value is speculative.
