# Testing Guide

Use this guide for local checks, Vercel preview checks, and future Playwright work.

## Testing Strategy

Use a layered approach. Automated checks catch repeat regressions, while manual and exploratory testing catches layout, wording, flow, and product-logic issues that scripts can miss.

- Prefer durable Playwright specs for business-critical flows, auth boundaries, affiliate redirects, security headers, responsive behavior, accessibility smoke checks, and previous bugs.
- Use the in-app Browser preview and Playwright CLI-style exploration for visual inspection, selector discovery, screenshots, traces, and quick debugging.
- Add permanent tests only when they protect behavior we want to keep. Do not turn every manual observation into brittle automation.
- Test user-visible behavior first. Prefer roles, labels, text, and stable `data-testid` contracts over CSS selectors or DOM structure.
- Keep tests isolated. Control seeded data, local storage, cookies, and sessions so one test does not depend on another.
- Do not test third-party sites directly. For Lazada, OAuth, email, AI providers, and future payment providers, test our routing, validation, fallback UI, and recorded contract shape; mock or use provider test environments for external behavior.

## Manual And Exploratory Passes

Use manual passes when changing screens, layouts, copy, loading states, or flows that depend on real user judgment.

- Start from the user's most common path, then test the uncomfortable paths: empty states, long names, missing data, slow requests, invalid input, double clicks, refresh, back/forward, and session expiry.
- Capture screenshots or short notes for bugs that need reproduction.
- Verify error messages are readable and actionable, not raw JSON or provider internals.
- When a bug is fixed, retest the exact reproduction first, then run a nearby regression path.

## Cross-Browser And Device Coverage

Run the focused Chromium test first for speed, then expand coverage when a change touches layout, navigation, browser APIs, auth, forms, or sticky/scroll behavior.

- Desktop projects: `chromium`, `firefox`, and `webkit`.
- Mobile projects: `mobile-chrome` and `mobile-safari`.
- Always check at least one narrow viewport for UI work.
- Real-device or cloud-device testing is a launch/backlog item for high-risk mobile flows; Playwright device profiles are useful, but they are not a complete substitute for actual hardware.

## Performance And Slow-Network Checks

Performance testing should focus on what normal users feel: first useful content, route transition time, button response time, and loading-state quality.

- Use production builds for meaningful performance checks.
- Keep screenshots or timing notes when a screen feels slow.
- Simulate slow or flaky requests for loading and error-state behavior where practical.
- Watch for repeated Supabase calls, unbounded lists, heavy client components, large images, and expensive effects.
- Treat console errors and repeated warnings as regressions unless proven harmless.

## Security, Accessibility, And Data Safety

Every meaningful flow should be tested with the app's trust boundaries in mind.

- Check unauthenticated, wrong-user, member-vs-owner, expired-token, invalid-route, and rate-limited paths when those areas are touched.
- Verify forms with malformed input and confirm server-side validation still rejects unsafe data.
- Run accessibility checks for public/auth pages and add focused checks for changed interactive UI.
- Never use production secrets, live payment flows, real webhook side effects, or private user data in tests.
- Keep test, preview, and production data separate. Any future sandbox mode should use explicit environment/provider separation or safe adapters so test actions cannot send real emails, payments, webhooks, affiliate exports, or notifications.

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

Security dependency audit:

```powershell
npm.cmd run audit:security
```

Architecture boundary audit:

```powershell
npm.cmd run audit:architecture
```

Dead-code audit:

```powershell
npm.cmd run audit:unused
npm.cmd run audit:unused:production
```

This uses Knip in advisory mode. It intentionally does not fail the command yet because the repo has a small baseline of cleanup findings.

Bundle analysis:

```powershell
npm.cmd run analyze:bundle
```

This uses the Next.js Turbopack analyzer and writes output under `.next/diagnostics/analyze`.

## GitHub Checks

The GitHub CI workflow runs:

- `npm ci`
- `npm run check:problems`
- `npm run audit:architecture`
- `npm run audit:unused:production`
- `npm run audit:security`
- `npm run build`
- Chromium public smoke tests

CodeQL and Dependency Review run separately as security-focused workflows.
