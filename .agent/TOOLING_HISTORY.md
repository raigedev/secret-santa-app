# Tooling History

These notes preserve older tooling details that were compressed out of `CONTINUITY.md` to keep that tactical handoff under its line limit.

## 2026-04-28 To 2026-04-29

- 2026-04-28T00:28:22+08:00 [CODE] GitHub/npm PostCSS warning was fixed by overriding Next's nested `postcss` to `8.5.10`; `npm audit --audit-level=moderate` reported 0 vulnerabilities at that time.
- 2026-04-28T02:03:50+08:00 [CODE] `docs/TESTING.md` records layered web testing guidance from reviewed Playwright/manual-QA/sandbox planning sources: automate critical flows, use manual exploratory UI passes, expand cross-browser/mobile when risk warrants it, test slow states/security/a11y, and keep external side effects isolated.
- 2026-04-28T02:31:22+08:00 [CODE] CodeQL remediation replaced regex sanitizers/slugifiers with shared char-loop helpers and renamed the `/secret-santa` shopping-region localStorage key; PR triage found five green Dependabot PRs plus two stale Copilot draft PRs.
- 2026-04-28T23:38:50+08:00 [CODE] Next `turbopack.root` is pinned to the app cwd to silence the parent-lockfile root warning; CodeQL job timeout was increased to 30 minutes after run `25059969549` hit the old 15-minute limit while the latest commit `5783ea4` passed CodeQL/CI.
- 2026-04-29T04:07:17+08:00 [TOOL] Installed official free OpenAI GitHub helper skills `gh-fix-ci` and `gh-address-comments`; `frontend-skill` was not installed because the current official skill tree/API did not expose that path, and paid/account-bound tools such as Connect/Codex Security still require explicit approval.

## How To Use This File

- Read `AGENTS.md` and `.agent/CONTINUITY.md` first.
- Use this file when older tooling context matters, especially CI, GitHub helper skills, CodeQL, PostCSS/Next tooling warnings, or testing-doc history.
- Do not let this file override current package versions, current CI results, or live project state; verify drift-prone facts before acting.
