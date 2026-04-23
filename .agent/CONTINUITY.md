# Continuity

## PLAN
- 2026-04-20T00:00:00+08:00 [USER] Keep this file as compact durable context for new Codex chats in this workspace.
- 2026-04-20T00:00:00+08:00 [USER] Next chats should read `AGENTS.md` first, then this file when present.

## DECISIONS
- 2026-04-20T00:00:00+08:00 [USER] User usually commits and pushes manually unless explicitly asking Codex to do it.
- 2026-04-20T00:00:00+08:00 [USER] Use Stitch MCP for UI design context, design tokens, screen metadata, and Stitch implementation details.
- 2026-04-20T00:00:00+08:00 [USER] Preserve Lazada affiliate backend/data wiring while polishing UI.
- 2026-04-20T00:00:00+08:00 [USER] Treat security, auth, postback, affiliate tracking, and public redirect routes as abuse-sensitive.

## PROGRESS
- 2026-04-20T00:00:00+08:00 [CODE] `AGENTS.md` now records project stack, security rules, launch guardrails, operating rules, and continuity rules.
- 2026-04-20T00:00:00+08:00 [CODE] Secret Santa Lazada UI was recently reshaped toward the Stitch Winter Atelier mockup while keeping affiliate flow intact.
- 2026-04-20T13:10:59+08:00 [CODE] `AGENTS.md` extended with CodeRabbit/AI PR review, 100 req/hour public-route baseline, CAPTCHA, HTTPS, secret-manager, dependency, RLS testing, input validation, and idempotency guardrails.
- 2026-04-20T13:25:00+08:00 [CODE] Secret Santa Lazada UI polish continued: visible gift-direction cards, lighter curated Lazada cards, softer assignment framing, and open backup shopping strip.
- 2026-04-20T13:30:10+08:00 [CODE] Secret Santa Lazada UI moved closer to Stitch mockup: top section tabs, single soft wishlist rail, compact image wishlist cards, working See more, and Lazada Picks heading.
- 2026-04-20T16:51:17+08:00 [CODE] Secret Santa Lazada UI fixed overflow-prone card text, reduced hero sizing, made section tabs stateful, and excluded stale direct Lazada product cards from display in favor of search-backed links.
- 2026-04-20T17:00:23+08:00 [CODE] Corrected Lazada card display to keep matched product image/title/price while rewriting direct catalog-product clicks to tracked search-backed Lazada routes.
- 2026-04-21T10:06:04+08:00 [CODE] Secret Santa Lazada top section now treats Gift direction as the control panel and Most wanted as the live preview beside it on desktop, with a smaller hero and Curated Shopping Ideas pushed below as secondary browsing.
- 2026-04-21T10:18:27+08:00 [CODE] Secret Santa Lazada right column now stacks a clickable Most wanted card with its primary Lazada CTA above Curated Shopping Ideas, while the Gift direction rail stays beside it on large screens and above it on smaller screens.
- 2026-04-21T10:26:05+08:00 [CODE] Secret Santa Lazada supporting cards now use wider auto-fit grids, non-breaking badge chips, non-truncating CTA labels, and safer backup-merchant grid layout to prevent vertical text collapse and cramped card failures.
- 2026-04-21T10:31:33+08:00 [CODE] Curated Shopping Ideas now fills up to 3 distinct alternatives after the featured hero by merging deduped matched and fallback Lazada products instead of simply slicing the hero list.
- 2026-04-21T11:14:26+08:00 [CODE] Used Stitch "Secret Santa Shopping Redesign" desktop/mobile screens to recompose the Lazada area: narrower wishlist rail, calmer featured hero, and curated product cards moved into a full-width image-led grid beneath the direction/hero row so the page reads as one shopping flow instead of squeezed stacked blocks.
- 2026-04-21T16:49:00+08:00 [CODE] The Most wanted hero now uses a smaller media column and `object-contain` image treatment so product photos stay visible instead of being cropped like edge-to-edge fashion posters.
- 2026-04-22T10:36:25+08:00 [CODE] Root request guard migrated from `middleware.ts` to `proxy.ts` for Next.js 16 while keeping the existing Supabase session, invite-page, OAuth-code, and email-verification redirect behavior unchanged.
- 2026-04-22T10:36:25+08:00 [CODE] Public affiliate redirect routes `/go/suggestion` and `/go/wishlist-link` now enforce the repo baseline of about 100 requests/hour per client IP and record click-tracking failures to the audit log instead of swallowing them silently.
- 2026-04-23T02:20:00+08:00 [CODE] Secret Santa Lazada cards now preserve true `catalog-product` routes again instead of downgrading all direct cards into search-backed links before render, so Most wanted and Curated Shopping Ideas can open the intended product path.
- 2026-04-23T02:20:00+08:00 [CODE] Lazada click logging now records the resolved product title/id returned by the affiliate target resolver when available, which keeps affiliate reporting closer to the actual landing product after direct/promotion-link resolution.
- 2026-04-23T02:20:00+08:00 [CODE] Removed the unused `@supabase/auth-helpers-nextjs` dependency from the app and corrected `AGENTS.md` so the repo no longer claims the deprecated helper is still installed.
- 2026-04-23T06:50:00+08:00 [USER] Security response progress tonight: rotated and verified internal cron/reminder/health secrets, Supabase moved to `sb_secret_...`/`sb_publishable_...` with legacy JWT keys disabled, Lazada postback secret rotated/tested, Lazada user token rotated, and OpenRouter/Gemini keys rotated with live AI responses verified.
- 2026-04-23T06:50:00+08:00 [USER] Vercel deploy history checked clean from CLI, team-wide Sensitive Environment Variable policy is enabled, Standard Deployment Protection was already enabled, `GEOAPIFY_API_KEY` was removed, and GitHub account review found no PATs plus no obvious security-log compromise signal after revoking some unused OAuth apps.
- 2026-04-23T07:10:00+08:00 [USER] Google account hardening completed with passkey plus authenticator app enabled and SMS removed; GitHub account review completed with no PATs present, expected app token churn in the security log, and no clear compromise signal. Main unresolved credential follow-up is Lazada `LAZADA_APP_SECRET` / LiteApp Secret rotation via support or deeper Open Platform access.
- 2026-04-23T08:10:00+08:00 [CODE] Started the first automated browser-testing pass with Playwright smoke coverage for public routes and fail-closed API behavior, using a production-style local `build + start` server so security-sensitive route expectations match real deployment behavior.
- 2026-04-23T08:45:00+08:00 [TOOL] Initial Playwright setup is working locally: `npm.cmd run typecheck`, `npm.cmd run lint:security`, `npm.cmd audit`, `npm.cmd run build`, and `npm.cmd run test:e2e` all passed. Smoke coverage currently checks landing/login rendering, `/dashboard` unauthenticated redirect, and `401 Unauthorized` responses for the reminder and Lazada health endpoints.

## DISCOVERIES
- 2026-04-20T00:00:00+08:00 [TOOL] Current recurring build warnings: parent lockfile workspace-root inference and Next.js middleware-to-proxy deprecation.
- 2026-04-22T10:05:52+08:00 [TOOL] Official Vercel April 2026 bulletin says customer env vars not marked "sensitive" should be treated as potentially exposed and rotated; for this app the highest-priority secret classes visible in repo config are `SUPABASE_SERVICE_ROLE_KEY`, Lazada app/user/postback secrets, OpenRouter/Gemini API keys, and cron/health/reminder shared secrets. `NEXT_PUBLIC_*` values are public by design and are not the priority rotation set.
- 2026-04-22T10:36:25+08:00 [TOOL] Supersedes the middleware-deprecation portion of the 2026-04-20 build-warning note: `next build` now reports `Proxy` instead of the old middleware deprecation warning; the remaining recurring build warning is the parent lockfile workspace-root inference from `C:\Users\kenda\package-lock.json`.
- 2026-04-23T02:20:00+08:00 [TOOL] `next build` no longer emits the deprecated `@supabase/auth-helpers-nextjs` install warning after removing that package. The remaining recurring build warning is still the parent lockfile workspace-root inference. The separate `node-domexception@1.0.0` npm deprecation warning comes from the repo-local `supabase` CLI dependency tree, not from the Next.js app runtime.

## OUTCOMES
- 2026-04-20T00:00:00+08:00 [CODE] New chats can recover durable project rules from `AGENTS.md` and compact state from this file.
- 2026-04-22T10:36:25+08:00 [TOOL] After the proxy migration and affiliate-redirect hardening, `npm.cmd run typecheck`, `npm.cmd run lint:security`, and `npm.cmd run build` all passed locally.
- 2026-04-23T02:20:00+08:00 [TOOL] After the direct-product route restore and Supabase package cleanup, `npm.cmd run typecheck`, `npm.cmd run lint:security`, `npm.cmd run build`, and `git diff --check` passed locally.
