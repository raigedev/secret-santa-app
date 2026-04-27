# Known Issues And Watch List

## Parent Lockfile Warning

Next.js may warn that it inferred the workspace root from `C:\Users\kenda\package-lock.json` because another lockfile exists above this project.

This is currently a warning, not a build blocker. Keep watching it during builds.

## npm Audit Moderate PostCSS Advisory

`npm audit` currently reports a moderate PostCSS advisory through the Next.js dependency path.

Do not use the suggested `npm audit fix --force`; npm currently proposes a breaking and incorrect Next.js downgrade path. Monitor for a safe upstream Next.js patch instead.

## Local OAuth Redirects

Google OAuth can redirect back to the Vercel domain if local Supabase redirect URLs are not allow-listed.

For local development, keep these redirect URLs in Supabase Auth settings:

```text
http://localhost:3000/**
http://127.0.0.1:3000/**
```

## Knip Cleanup Baseline

`npm.cmd run audit:unused` is advisory. Current known cleanup findings include:

- `app/dashboard/SecretSantaCard.tsx` appears unused.
- Some exported helpers/types are currently not referenced by static imports.

Review each finding before deleting files or removing exports. Some exported symbols may be intentionally kept for tests, future provider support, or route-local conventions.

## Sentry Not Wired Yet

The Sentry skill is installed for future guidance, but the app is not wired to Sentry.

Do not add Sentry runtime code until the project has chosen DSN, sampling, replay, source-map upload, PII, and privacy-policy settings.

## Oracle Browser Sessions

Oracle browser mode can take a while and may detach. Reattach to the stored session instead of re-running the same prompt.

Never attach secrets, `.env` files, private logs, or screenshots with sensitive data to Oracle.

## Full Playwright Runtime

Full Playwright can take several minutes because it runs desktop and mobile browser projects. Prefer focused specs while developing, then run the full suite for broad validation.
