# Deployment Guide

This app deploys from GitHub `main` to Vercel. The usual workflow is that the user commits and pushes manually, then verifies the Vercel deployment.

## Pre-Push Checklist

Before pushing source changes:

```powershell
npm.cmd run check:problems
npm.cmd run typecheck
npm.cmd run lint:security
npm.cmd run build
```

Run focused Playwright tests for touched flows. Run the full suite before major releases when time allows:

```powershell
npm.cmd run test:e2e
```

For dependency changes, also run:

```powershell
npm.cmd audit
```

Do not run `npm audit fix --force` without reviewing the proposed dependency changes.

## Environment Variables

Manage secrets in Vercel, not in source code or committed docs.

High-level categories used by this app:

- Supabase public URL and publishable anon key for browser-safe client setup.
- Supabase service-role or secret keys only for server-side admin paths.
- Cron and reminder processor secrets.
- Lazada affiliate app, user-token, postback, and health-check secrets.
- AI provider keys for wishlist suggestions.
- Playwright seeded account values in local ignored `.env.local` only.

Never paste real values into screenshots, docs, test fixtures, logs, or final answers.

## Vercel Manual Smoke Test

After pushing and waiting for Vercel to show Ready:

1. Open the deployment URL.
2. Check `/`, `/login`, `/create-account`, `/forgot-password`, and `/privacy`.
3. Sign in with a safe account.
4. Check `/dashboard` loads without stale empty recipient flashes.
5. Open a group event page and confirm the visible shell appears quickly.
6. Open `/wishlist`, add or inspect an item, then refresh.
7. Open `/secret-santa` and verify recipient, wishlist, shopping options, and Lazada CTA layout.
8. Open the dashboard notification bell and confirm All/Unread filters work.
9. Open `/profile` and confirm reminder settings are in account settings.
10. If testing affiliate reporting, confirm owner-only access and do not mutate production postbacks manually.
11. Log out and confirm protected pages redirect to login.

Test desktop and mobile width for UI changes.

## Cron Jobs

Configured in `vercel.json`:

- `/api/affiliate/lazada/health-check` at `30 1 * * *`.
- `/api/notifications/process-reminders` at `0 1 * * *`.

Both must remain protected by their configured secrets in production.

## Rollback

Use the Vercel dashboard to promote a previous known-good deployment if a release breaks production.

After rollback:

1. Confirm auth, dashboard, group page, wishlist, Secret Santa, and notifications.
2. Check recent Vercel runtime logs for recurring errors.
3. Record the rollback reason and the suspected bad commit before starting a fix.

## Local Auth Notes

For local Supabase OAuth development, the Supabase Auth redirect allow-list should include:

```text
http://localhost:3000/**
http://127.0.0.1:3000/**
```

Production OAuth URLs must stay scoped to approved production/preview domains.

