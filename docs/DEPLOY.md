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

## Bot Check (Cloudflare Turnstile)

Sign-up, login, and password reset can require a Cloudflare Turnstile check that Supabase verifies. The code stays off until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, and only then adds `https://challenges.cloudflare.com` to the page security policy. Turn it on in this order, or logins will fail while the app is not yet sending tokens:

1. In the Cloudflare dashboard, open Turnstile and add a widget for the production domain (managed mode). Copy the site key and secret key.
2. In Vercel, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for Production and Preview, then redeploy and confirm the login page shows the check.
3. In Supabase, open Authentication, then Attack Protection, enable CAPTCHA protection, choose Turnstile, and paste the secret key.

For local testing, Cloudflare's always-pass test site key `1x00000000000000000000AA` and test secret `1x0000000000000000000000000000000AA` work on localhost.

## Security Alert Digest

The daily `/api/affiliate/lazada/health-check` cron also emails a summary of the last 24 hours of security failures and rate-limited requests from `security_audit_logs`. It sends only event names and counts, at most once per 20 hours, and only when both are configured:

- `SECURITY_ALERT_EMAIL`: the maintainer address that receives the summary.
- The existing `SMTP_*` settings used for welcome emails.

The cron response reports `securityDigest` as `sent`, `nothing_to_report`, `already_sent`, `not_configured`, or `failed`.

## Vercel Manual Smoke Test

After pushing and waiting for Vercel to show Ready:

1. Open the deployment URL.
2. Check `/`, `/login`, `/create-account`, `/forgot-password`, `/privacy`, and `/support`.
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

## Function Region

`vercel.json` pins Vercel Functions to `sin1` (Singapore) so server rendering, server actions, API routes, and cron jobs run next to the Supabase project in `ap-southeast-1`. Vercel's default is `iad1` (Washington, D.C.), which made every server-side Supabase call cross the Pacific twice. If the Supabase project ever moves, move this region with it. A response header like `X-Vercel-Id: sin1::sin1::...` confirms both the edge and the function run in Singapore.

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
