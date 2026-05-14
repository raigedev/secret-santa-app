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
npm.cmd run audit:security
```

Do not run `npm audit fix --force` without reviewing the proposed dependency changes.

Before larger refactors, run:

```powershell
npm.cmd run audit:architecture
npm.cmd run audit:unused:production
```

## GitHub Workflows

The repository has three GitHub workflow guardrails:

- `CI`: installs with `npm ci`, runs project diagnostics, architecture checks, dependency/security audit, build, and Chromium public smoke tests.
- `CodeQL`: runs JavaScript/TypeScript semantic security analysis and uploads findings to GitHub code scanning.
- `Dependency Review`: checks pull-request dependency changes and blocks high-severity vulnerable additions.

The CI workflow uses dummy non-secret Supabase values only so the app can compile. Real secrets stay in Vercel and local ignored `.env.local`.

## Environment Variables

Manage secrets in Vercel, not in source code or committed docs.

High-level categories used by this app:

- Supabase public URL and publishable anon key for browser-safe client setup.
- Supabase service-role or secret keys only for server-side admin paths.
- Cron and reminder processor secrets.
- Affiliate settings, including Lazada app/user-token/postback/health-check secrets and partner search templates such as `AMAZON_AFFILIATE_SEARCH_TEMPLATE`.
- AI provider keys for wishlist suggestions.
- Playwright seeded account values in local ignored `.env.local` only.

Amazon search links use a server-side template. Keep the real tracking tag in Vercel/local environment variables, not source:

```text
AMAZON_AFFILIATE_SEARCH_TEMPLATE=https://www.amazon.com/s?k={query}&tag=yourtag-20
```

Shopee affiliate links are generated inside Shopee's affiliate portal/app. If you only have one generated short link, set it as a fixed server-side link:

```text
SHOPEE_AFFILIATE_LINK_TEMPLATE=https://shope.ee/your-generated-link
```

If Shopee later gives you API access or a query-preserving link template, prefer:

```text
SHOPEE_AFFILIATE_SEARCH_TEMPLATE=<affiliate-generated-template-that-preserves-{query}>
```

Do not use a plain Shopee search URL here and expect commission; the value must come from Shopee's affiliate link tooling or API.

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
