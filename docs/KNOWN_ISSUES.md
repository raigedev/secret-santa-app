# Known Issues And Watch List

## Parent Lockfile Warning

Next.js may warn that it inferred the workspace root from a parent `package-lock.json` because another lockfile exists above this project.

This is currently a warning, not a build blocker. Keep watching it during builds.

## npm Audit Moderate PostCSS Advisory

`npm audit` currently reports a moderate PostCSS advisory through the Next.js dependency path.

Do not use the suggested `npm audit fix --force`; npm currently proposes a breaking and incorrect Next.js downgrade path. Monitor for a safe upstream Next.js patch instead.

## Supabase Free Plan Leaked Password Protection Advisor

Supabase Security Advisor may report `Leaked Password Protection Disabled` while the project is on the Free plan.

This specific HaveIBeenPwned leaked-password check is a Supabase Pro-plan feature, so code changes cannot clear that hosted advisor item on Free. Until the project upgrades, keep the app password policy and hosted Supabase Auth password settings strict: at least 12 characters with uppercase and lowercase letters, a number, and a symbol.

## Local OAuth Redirects

Google OAuth can redirect back to the Vercel domain if local Supabase redirect URLs are not allow-listed.

For local development, keep these redirect URLs in Supabase Auth settings:

```text
http://localhost:3000/**
http://127.0.0.1:3000/**
```

## Knip Cleanup Baseline

`npm.cmd run audit:unused` and `npm.cmd run audit:unused:production` are advisory. Current
cleanup findings should be reviewed before deleting files or removing exports because some
symbols may be intentionally kept for tests, future provider support, or route-local conventions.

Last reviewed cleanup: removed the Knip-confirmed dashboard leftovers and unused helper/type
exports from the May 2026 cleanup pass.

## Sentry Not Wired Yet

The Sentry skill is installed for future guidance, but the app is not wired to Sentry.

Sentry is an error-monitoring and performance-observability service. It can capture frontend/backend errors, stack traces, slow transactions, and optional session replay so production bugs are easier to diagnose.

Do not add Sentry runtime code until the project has chosen DSN, sampling, replay, source-map upload, PII, and privacy-policy settings. If it is added later, update `/privacy` to describe the monitoring provider and data handling.

## GitHub Security Workflows

`CI`, `CodeQL`, and `Dependency Review` workflows are present. They improve pull-request and push checks but do not replace local checks, Vercel preview testing, or manual security review.

## Oracle Browser Sessions

Oracle browser mode can take a while and may detach. Reattach to the stored session instead of re-running the same prompt.

Never attach secrets, `.env` files, private logs, or screenshots with sensitive data to Oracle.

## Full Playwright Runtime

Full Playwright can take several minutes because it runs desktop and mobile browser projects. Prefer focused specs while developing, then run the full suite for broad validation.
