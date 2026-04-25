# Continuity

## Operating Rules
- 2026-04-20T00:00:00+08:00 [USER] New Codex chats should read `AGENTS.md` first, then this file.
- 2026-04-20T00:00:00+08:00 [USER] User usually commits and pushes manually unless explicitly asking Codex to do it.
- 2026-04-23T16:42:26+08:00 [USER] After meaningful changes, include what changed, detailed Vercel manual test steps, and exact commit/push commands.
- 2026-04-23T16:42:26+08:00 [USER] User verifies mainly on Vercel preview/production after push, not local browser.
- 2026-04-24T00:00:00+08:00 [USER] Use the necessary installed skills/tools for each coding task and run Playwright/webapp tests after coding where possible.

## Security And Product Decisions
- 2026-04-20T00:00:00+08:00 [USER] Use Stitch MCP for UI design context, design tokens, screen metadata, and Stitch implementation details.
- 2026-04-20T00:00:00+08:00 [USER] Preserve Lazada affiliate backend/data wiring while polishing UI.
- 2026-04-20T00:00:00+08:00 [USER] Treat security, auth, postback, affiliate tracking, public redirects, cron, and reminder routes as abuse-sensitive.
- 2026-04-23T06:50:00+08:00 [USER] Security response milestones: cron/reminder/health secrets rotated, Supabase moved to `sb_secret_...`/`sb_publishable_...`, old JWT keys disabled, Lazada postback/user token rotated, OpenRouter/Gemini rotated, Vercel Sensitive Env policy enabled, Standard Deployment Protection enabled, `GEOAPIFY_API_KEY` removed, GitHub/Google accounts reviewed and hardened.
- 2026-04-23T07:10:00+08:00 [USER] Main unresolved credential follow-up remains Lazada `LAZADA_APP_SECRET` / LiteApp Secret rotation via support or deeper Open Platform access.
- 2026-04-24T22:08:51+08:00 [TOOL] Lazada scraping/compliance review found no repo crawler deps, local `.xlsx` feed import, generated feed read from disk, user-click redirects, Lazada host allow-listing, signed Open API getlink calls, strict postback validation, and Lazada-as-source-of-truth reporting. Remaining follow-ups: approved-domain confirmation and eventual POST/header-only postback hardening.

## Durable App State
- 2026-04-22T10:36:25+08:00 [CODE] Root request guard uses `proxy.ts` for Next.js 16 with existing Supabase session, invite-page, OAuth-code, and email-verification redirect behavior preserved.
- 2026-04-23T09:14:46+08:00 [CODE] Audit remediation fixed resend-invite abuse, 7-day invite links, Lazada prime-link rate limiting, authenticated assignment-backed affiliate redirects, stripped Lazada postback payload secrets before persistence, and safer draw race handling.
- 2026-04-24T17:35:42+08:00 [CODE] `/secret-santa` uses compact shopping layout, sticky Stitch-like wishlist rail with product thumbnails, `Shopping Picks` nav, gold `Most Wanted` lead label, white media wells, and plain shopper-facing fallback labels.
- 2026-04-25T21:54:18+08:00 [CODE] `/secret-santa` shopping-option chips no longer show a visible `Selected` mini-pill; the active option now mirrors the gift-guide tab highlight with red text and underline while keeping accessible selected state.
- 2026-04-25T23:29:06+08:00 [CODE] `/secret-santa` curated shopping cards keep role/price chips in a separate header above the product image so budget labels do not overlap product photos.
- 2026-04-25T23:40:36+08:00 [CODE] `/secret-santa` curated shopping card headers now show the group `Budget target` consistently; exact Lazada product prices remain visible as a separate body line when available.
- 2026-04-25T23:53:00+08:00 [CODE] `/secret-santa` shopping-option buttons removed `Try this`, use a filled green selected state, and allow labels to wrap without truncation.
- 2026-04-25T00:55:00+08:00 [CODE] Affiliate report separates `Opened in Lazada` from `Lazada reported product`; search-link clicks show exact products only after a mapped Lazada conversion report supplies them.
- 2026-04-23T23:47:58+08:00 [CODE] `/secret-santa-chat` keeps the recognizable dark festive layout with clearer privacy/identity panels, dashboard control, thread labels, and Winter Atelier palette alignment.
- 2026-04-25T20:35:00+08:00 [CODE] Broad UX-writing pass rewrote public/auth/dashboard/group/wishlist/Secret Santa/chat/notification/profile/affiliate-report text toward simple terms: group, member, wishlist, recipient, gift progress, shopping option, affiliate link. Tests were updated only where assertions intentionally tracked old copy.

## Testing Notes
- 2026-04-23T15:08:24+08:00 [TOOL] Playwright coverage includes public smoke, public/protected navigation, API auth guards, auth-form validation, responsive checks, axe accessibility, OAuth back-navigation, public auth edge cases, and seeded authenticated-screen scaffolding.
- 2026-04-24T15:34:56+08:00 [TOOL] Ignored `.env.local` has seeded `PLAYWRIGHT_E2E_EMAIL`, `PLAYWRIGHT_E2E_PASSWORD`, and `PLAYWRIGHT_E2E_GROUP_ID`; owner-only affiliate-report tests still skip unless the seeded email is allowlisted.
- 2026-04-25T20:35:00+08:00 [TOOL] UX-writing pass checks passed: `git diff --check`, `npm.cmd run typecheck`, `npm.cmd run lint:security`, `npm.cmd run build`, focused public-route Playwright, public smoke/forms/a11y Playwright, and authenticated-screen Playwright. Full `npm.cmd run test:e2e` and full Chromium `tests/e2e` attempts timed out before producing reports; focused suites passed.
- 2026-04-26T00:11:46+08:00 [TOOL] Added permanent authenticated Playwright coverage for `/secret-santa` shopping-option readability, removed `Try this`, filled selected state, curated card budget targets, and header/image separation.
- 2026-04-20T00:00:00+08:00 [TOOL] Recurring build warning remains the parent lockfile workspace-root inference from `C:\Users\kenda\package-lock.json`.

## Tooling
- 2026-04-23T17:02:38+08:00 [TOOL] Installed skills/tools include `webapp-testing`, `create-plan`, `security-threat-model`, `jscpd@4.0.9`, and AuraKit `aura`, `aura-compact`, `aura-guard`.
- 2026-04-23T17:02:38+08:00 [TOOL] Prior `jscpd` scan found 47 clone pairs and about 3.41% duplicated lines; best refactor targets are guarded affiliate redirects, auth layout duplication, group error UIs, AI provider wrappers, and repeated server-action patterns.
