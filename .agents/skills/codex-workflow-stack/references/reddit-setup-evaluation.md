# Reddit Setup Evaluation

Reviewed on 2026-04-29 from the Reddit thread `With this setup CODEX is far better than Claude Code`.

## Adopt Automatically

- Use installed GitHub workflow skills for CI and PR review work.
- Use installed Playwright/webapp testing skills for browser validation.
- Use installed Sentry skill for Sentry issue triage when access is available.
- Use repo `frontend-product-ui` and `DESIGN.md` for frontend quality.
- Use git history directly for changelogs and release notes.

## Already Covered

- `gh-fix-ci`: installed.
- `gh-address-comments`: installed.
- `webapp-testing`: installed.
- `playwright` and `playwright-interactive`: installed.
- `sentry`: installed as the repo-safe Sentry workflow.
- `create-plan`: available, but only use when the user asks for a plan.

## Do Not Install By Default

- `ComposioHQ/awesome-codex-skills`: useful list, but the repository reports no license through GitHub metadata. Do not copy its skill text into the repo. Recreate small workflow ideas only when needed.
- `connect` / Composio Connect: account-bound and can perform remote writes across apps. Use only after a specific user request, authentication setup, and write-action confirmation.
- `sentry-triage` from Composio: depends on Composio CLI and linked Sentry account. Prefer the installed `sentry` skill unless the user explicitly wants Composio.
- `agent-orchestrator`: MIT and interesting for parallel worktrees, but not needed for normal repo work. Use only after explicit user request for multi-worktree orchestration.
- `ccusage`: aimed at Claude Code usage analysis and has no GitHub license metadata in the checked repo. Not useful for this Codex app workflow.
- `caveman`: MIT but changes communication style to reduce tokens. Do not use because the user prefers direct practical engineering communication, not deliberately reduced prose.
- `graphify`: MIT but appears oriented around external code-knowledge tooling. Do not install until a concrete codebase-map task needs it and the setup cost is justified.
- `cc-switch`: MIT desktop model switcher. Not relevant inside this Codex workspace.

## Safety Checks For Future Tool Recommendations

- Check license metadata.
- Check whether the tool is an instruction-only skill, a global CLI, a desktop app, or an account connector.
- Check whether it can write to remote systems.
- Check whether it duplicates an installed skill.
- Check whether it helps this repo's actual workflows: Next.js, Supabase, GitHub, Vercel, Playwright, Sentry, security, and UI polish.
- Prefer documenting an optional tool over installing it when the value is speculative.
