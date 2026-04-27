# Testing Guide

Use this guide for local checks, Vercel preview checks, and future Playwright work.

## Required Checks After Source Changes

Run these before handing off meaningful code changes:

```powershell
npm.cmd run check:problems
npm.cmd run typecheck
npm.cmd run lint:security
npm.cmd run build
```

Run relevant Playwright tests for touched screens or flows. For broad confidence:

```powershell
npm.cmd run test:e2e
```

For focused work, prefer the smallest matching spec first:

```powershell
npx.cmd playwright test tests/e2e/auth/authenticated-screen-regressions.spec.ts --project=chromium
npx.cmd playwright test tests/e2e/navigation/public-routes.spec.ts --project=chromium
npx.cmd playwright test tests/e2e/security/security-headers.spec.ts --project=chromium
```

## Playwright Setup

Playwright defaults to `http://127.0.0.1:3000`.

If `PLAYWRIGHT_BASE_URL` is not set, the config builds the app and starts:

```powershell
npm.cmd run start:e2e
```

For Vercel preview or production checks:

```powershell
$env:PLAYWRIGHT_BASE_URL="https://your-preview-url.vercel.app"
npm.cmd run test:e2e
```

Authenticated tests use safe seeded values from ignored `.env.local` when present:

- `PLAYWRIGHT_E2E_EMAIL`
- `PLAYWRIGHT_E2E_PASSWORD`
- `PLAYWRIGHT_E2E_GROUP_ID`

Do not commit those values.

## What To Test By Change Type

- Auth, login, signup, reset: auth specs plus public route and form validation specs.
- Dashboard, notification bell, profile, groups: authenticated screen regression specs.
- Group event flows: owner/member group specs when available, plus manual Vercel checks.
- Wishlist and Secret Santa: authenticated screen regression specs and mobile coverage.
- Affiliate redirects/reporting: API auth guards, affiliate report access, and manual safe click-through checks.
- Security headers or CSP: `tests/e2e/security/security-headers.spec.ts`.
- UI-only changes: focused Playwright plus App Browser visual review when available.

## Skip Policy

Skipped tests should be temporary and explained in the test or final report.

Do not skip, loosen, or delete a test just to make a run green. If a test is wrong, update it with a clear reason and keep the user-facing behavior covered.

## Reports And Debugging

Open the last HTML report:

```powershell
npm.cmd run test:e2e:report
```

Useful debug modes:

```powershell
npm.cmd run test:e2e:ui
npm.cmd run test:e2e:headed
npm.cmd run test:e2e:debug
```

Failure artifacts are written to ignored `test-results/` and `playwright-report/`.

## Maintenance Audits

Dead-code audit:

```powershell
npm.cmd run audit:unused
```

This uses Knip in advisory mode. It intentionally does not fail the command yet because the repo has a small baseline of cleanup findings.

Bundle analysis:

```powershell
npm.cmd run analyze:bundle
```

This uses the Next.js Turbopack analyzer and writes output under `.next/diagnostics/analyze`.

