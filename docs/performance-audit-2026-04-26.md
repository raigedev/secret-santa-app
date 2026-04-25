# Performance Audit - 2026-04-26

Status: audit complete. No app code was optimized yet.

## Test Setup

- Built with `npm.cmd run build` and tested against `npm.cmd run start:e2e` on `http://127.0.0.1:3000`.
- Browser timing used Chromium Playwright against the production build, not dev mode.
- Authenticated timings used the seeded Playwright account from local env keys. Secrets were not printed.
- Write flows were not submitted during the audit. Add-wishlist, invite-member, and confirm-gift screens were measured only to the visible interactive surface to avoid mutating seeded data without explicit confirmation.
- Local timings are useful for ranking bottlenecks, but Vercel preview/production should be used for final real-user confirmation.

## Route Inventory

| Route | Page size | Lines | Client page | `loading.tsx` |
| --- | ---: | ---: | --- | --- |
| `/(landing)` | 38 KB | 577 | Yes | No |
| `/create-account` | 15.2 KB | 369 | Yes | No |
| `/create-group` | 16.7 KB | 480 | Yes | Yes |
| `/dashboard` | 93 KB | 2455 | Yes | Yes |
| `/dashboard/affiliate-report` | 77.9 KB | 2153 | No | Yes |
| `/forgot-password` | 9.7 KB | 225 | Yes | No |
| `/group/[id]` | 113.5 KB | 2939 | Yes | Yes |
| `/group/[id]/reveal` | 43.4 KB | 1194 | Yes | Yes |
| `/invite/[token]` | 23.6 KB | 703 | No | No |
| `/login` | 15.4 KB | 395 | Yes | No |
| `/notifications` | 25 KB | 737 | Yes | Yes |
| `/profile` | 23 KB | 530 | Yes | Yes |
| `/reset-password` | 2.2 KB | 69 | Yes | No |
| `/secret-santa` | 139 KB | 3473 | Yes | Yes |
| `/secret-santa-chat` | 72.2 KB | 1825 | Yes | Yes |
| `/wishlist` | 41.3 KB | 940 | Yes | Yes |

Main route-level finding: nearly every screen is a full client page. The largest screens ship a lot of UI, state, effects, and Supabase code to the browser before users can fully interact.

## Timing Results

| Flow or screen | Mode | Ready | Settled | Notes |
| --- | --- | ---: | ---: | --- |
| Landing, first cold local request | Desktop | 3141 ms | 3362 ms | First request paid server warmup/cache cost. |
| Landing, warm request | Desktop | 310 ms | 630 ms | Good after warmup. |
| Landing to login click | Desktop | 94 ms | 94 ms | Good perceived transition. |
| Landing | Slow 4G | 1366 ms | 2352 ms | Asset weight is visible on slow network. |
| Login | Desktop | 252 ms | 784 ms | Fast. |
| Create account | Desktop | 209 ms | 747 ms | Fast after selector recheck. |
| Forgot password | Desktop | 203 ms | 723 ms | Fast after selector recheck. |
| Invalid invite | Desktop | 1853 ms | 2415 ms | Dynamic invite lookup is noticeably slower. |
| Login to dashboard | Desktop | 3806 ms | 3806 ms | Slowest major click flow. |
| Dashboard | Desktop | 1641 ms | 2364 ms | Client data loading dominates. |
| Dashboard | Mobile | 1131 ms | 1481 ms | Acceptable but still waits on client data. |
| Dashboard | Slow 4G | 2410 ms | 3336 ms | Needs better perceived loading. |
| Dashboard to group | Desktop | 2547 ms | 2547 ms | Slow route transition. |
| Group details | Desktop | 2243 ms | 2832 ms | Slow authenticated screen. |
| Invite member surface | Desktop | 3689 ms | 4044 ms | Surface appears late in the group page. |
| Wishlist | Desktop | 1121 ms | 1360 ms | Moderate. |
| Wishlist add-item surface | Desktop | 3689 ms | 4150 ms | The add-item surface is late relative to first paint. |
| Secret Santa | Desktop | 1128 ms | 1588 ms | Moderate; large page size is still a risk. |
| Secret Santa | Mobile | 1091 ms | 1609 ms | Similar to desktop. |
| Secret Santa chat | Desktop | 1117 ms | 1378 ms | Moderate. |
| Group reveal | Desktop | 1134 ms | 1517 ms | Moderate. |
| Notifications | Desktop | 853 ms | 1967 ms | Loads quickly, settles later. |
| Profile | Desktop | 670 ms | 1395 ms | Good. |
| Logout to login | Desktop | 390 ms | 390 ms | Good. |

## API And Database Signals

Browser-observed Supabase traffic during the Playwright pass:

| Target | Count | Avg | P95 | Max |
| --- | ---: | ---: | ---: | ---: |
| `GET supabase:rest/v1` | 80 | 285 ms | 952 ms | 1506 ms |
| `POST supabase:rest/v1` | 4 | 554 ms | 1012 ms | 1012 ms |
| `POST supabase:auth/v1` | 2 | 623 ms | 997 ms | 997 ms |
| `GET supabase:auth/v1` | 3 | 340 ms | 753 ms | 753 ms |
| `GET local:/api/affiliate/report-access` | 4 | 151 ms | 240 ms | 240 ms |

Suspected repeated-work hotspots:

| File | Size | Effects | State hooks | Supabase `.from()` | `Promise.all` |
| --- | ---: | ---: | ---: | ---: | ---: |
| `app/dashboard/page.tsx` | 93 KB | 6 | 10 | 10 | 4 |
| `app/group/[id]/page.tsx` | 113.5 KB | 2 | 36 | 3 | 2 |
| `app/secret-santa/page.tsx` | 139 KB | 12 | 2 | 8 | 4 |
| `app/wishlist/page.tsx` | 41.3 KB | 2 | 14 | 3 | 1 |
| `app/secret-santa-chat/page.tsx` | 72.2 KB | 5 | 3 | 9 | 1 |

The biggest delay is not raw HTML delivery. It is hydrated client pages waiting for Supabase calls, state updates, and late sub-sections before the screen feels complete.

## Bundle And Asset Signals

Largest generated static assets after build:

- JS chunks: 222 KB, 202.3 KB, 110 KB, 106.4 KB, 83 KB.
- CSS chunk: 117.6 KB.
- Fonts: several `woff2` files between 28 KB and 38 KB.

Largest public assets:

| Asset | Size | Dimensions | Current signal |
| --- | ---: | --- | --- |
| `public/snowflakes.png` | 2106 KB | 1024x1024 | Used as CSS background on auth/create screens. Not optimized by `next/image`. |
| `public/bells-holly.png` | 1531 KB | 1024x1024 | Used as a small decorative image on auth/create screens. |
| `public/google-logo.png` | 1339 KB | 1024x1024 | Used as a tiny login button logo. |
| `public/santa-hat.png` | 1534 KB | 1024x1024 | No current code reference found. |
| `public/gifts.png` | 1196 KB | 1024x1024 | No current code reference found. |

Asset finding: the easiest high-impact fix is image weight. The Google logo and background texture are far larger than their displayed size.

## Slow Screens And Suspected Causes

1. `/dashboard`
   - Slow login landing at 3.8 seconds.
   - Many browser-side Supabase calls, realtime setup, polling, profile setup, affiliate access check, notification count, group summaries, and peer-profile RPC work are all tied to a full client page.
   - The page shell paints quickly, but useful content appears after client data resolves.

2. `/group/[id]`
   - Direct group load is about 2.2 seconds, dashboard-to-group is about 2.5 seconds, and invite surface appears around 3.7 seconds.
   - The page is 113.5 KB and 2939 lines with 36 state hooks. Important sections appear late.

3. `/wishlist`
   - Main screen is moderate at about 1.1 seconds, but add-item surface readiness measured around 3.7 seconds.
   - The screen likely needs above-the-fold and form readiness split so users can act sooner.

4. `/secret-santa`
   - Currently around 1.1 seconds and acceptable locally, but it is the largest page at 139 KB and 3473 lines.
   - The page has many effects and product/shopping sections, so it is likely to degrade as data grows.

5. `/invite/[token]`
   - Invalid invite path takes about 1.85 seconds and has no `loading.tsx`.
   - This should get a lightweight route loading state because invite links are a first-touch flow.

6. Public auth/create pages
   - HTML and UI readiness are fast, but huge background and logo assets are wasteful and hurt slow-network perception.

## Priority Fix Plan

### P0 - Low-risk speed wins

1. Replace oversized PNG assets.
   - Convert `snowflakes.png` to a tiny repeatable texture or CSS-only effect.
   - Replace `google-logo.png` with a small SVG or tiny optimized image.
   - Resize/compress `bells-holly.png` to the displayed size.
   - Defer deleting unused `santa-hat.png` and `gifts.png` until the user approves file removal.

2. Add missing route loading states.
   - Add `loading.tsx` for `/(landing)`, `/login`, `/create-account`, `/forgot-password`, `/reset-password`, and `/invite/[token]` where useful.
   - Use skeletons that match the actual page shape, not full-page spinners.

3. Add a Playwright performance regression spec.
   - Measure the major navigation flows with timing logs first.
   - Start with soft reporting instead of strict thresholds, then add budgets after a stable baseline on Vercel preview.

### P1 - Authenticated screen architecture

4. Split large client pages into server pages plus focused client islands.
   - Start with `/dashboard`, `/group/[id]`, `/wishlist`, and `/secret-santa`.
   - Fetch initial read-only data server-side where RLS and auth boundaries stay intact.
   - Keep only forms, menus, realtime controls, and interactive sections as client components.

5. Reduce repeated Supabase work.
   - Consolidate dashboard and group queries where possible.
   - Avoid per-group peer-profile RPC calls when a single scoped request can provide the same data.
   - Keep affiliate report access, notifications, and profile setup checks from blocking the main dashboard content.

6. Improve perceived readiness.
   - Render above-the-fold group/dashboard/wishlist shells immediately.
   - Put late sections behind `Suspense` or section skeletons.
   - Make add-wishlist and invite-member surfaces visible earlier than lower-priority summary panels.

### P2 - Bundle and interaction polish

7. Dynamically import non-critical heavy sections.
   - Candidates: profile setup modal, share results card, affiliate report detail panels, secret-santa shopping/product sections, and chat thread details.

8. Run a bundle analyzer.
   - Next 16/Turbopack output gives chunk sizes, but a route-level analyzer would make ownership clearer.

9. Profile re-renders after the architecture pass.
   - Use React Profiler or focused render counters on dashboard/group/wishlist only after data loading is simplified.

## Recommended First Implementation Batch

Make the first code batch small and reviewable:

1. Optimize or replace the oversized public images used by login/create-account/forgot-password/create-group.
2. Add missing loading states for public auth and invite flows.
3. Add one Playwright performance audit spec that logs landing, login-to-dashboard, dashboard, group, wishlist, and secret-santa timings without mutating data.

This should improve slow-network perception immediately and create a stable measurement harness before deeper server/client refactors.
