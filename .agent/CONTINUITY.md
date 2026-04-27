# Continuity

## Operating Rules
- 2026-04-20T00:00:00+08:00 [USER] New Codex chats should read `AGENTS.md` first, then this file.
- 2026-04-20T00:00:00+08:00 [USER] User usually commits and pushes manually unless explicitly asking Codex to do it.
- 2026-04-23T16:42:26+08:00 [USER] After meaningful changes, include what changed, detailed Vercel manual test steps, and exact commit/push commands.
- 2026-04-23T16:42:26+08:00 [USER] User verifies mainly on Vercel preview/production after push, not local browser.
- 2026-04-24T00:00:00+08:00 [USER] Use the necessary installed skills/tools for each coding task and run Playwright/webapp tests after coding where possible.
- 2026-04-26T00:37:47+08:00 [USER] `AGENTS.md` now carries senior full-stack engineering standards for code quality, structure, TypeScript, Next.js, Supabase, security, UX/a11y, testing, and change discipline.
- 2026-04-26T10:36:19+08:00 [USER] After coding or config changes, check VS Code Problems-style diagnostics via repo CLI equivalents such as typecheck, security lint, cSpell, and relevant tests; resolve problems before finalizing.
- 2026-04-26T10:58:27+08:00 [CODE] `npm.cmd run check:problems` now runs typecheck, security lint, cSpell, and a Tailwind VS Code Problems pattern scan for recurring canonical-class warnings.
- 2026-04-26T11:04:16+08:00 [CODE] `AGENTS.md` now requires inspect-first refactor reviews, behavior preservation, clear module boundaries, separated business/data/UI concerns, approval before major structural changes, and validation after refactors.
- 2026-04-27T04:18:00+08:00 [USER] Frontend UI work should use Stitch plus available UI skills; prefer `impeccable`/`tasteskill` when installed, explore variants when direction is unclear, and use 21st.dev/its MCP as inspiration when available and compatible.
- 2026-04-27T04:37:00+08:00 [TOOL] Installed `impeccable` and Taste Skill family skills globally for Codex under `.agents/skills` and mirrored them into `.codex/skills`: `design-taste-frontend`, `stitch-design-taste`, `high-end-visual-design`, `redesign-existing-projects`, `minimalist-ui`, `industrial-brutalist-ui`, `gpt-taste`, `image-to-code`, `full-output-enforcement`.
- 2026-04-27T05:22:00+08:00 [USER] For UI work, prefer Codex App Browser interaction flow when available: local dev server, built-in Browser on localhost, user screenshots/annotations on specific UI elements, then code patch plus Playwright verification.
- 2026-04-27T21:45:06+08:00 [CODE] Root `DESIGN.md` is now the Stitch-style design source of truth; future UI work should read it before changing app screens.
- 2026-04-27T22:22:34+08:00 [TOOL] Installed Oracle skill in `.codex/skills/oracle` and `.agents/skills/oracle`; use `@steipete/oracle` as a second-opinion reviewer for meaningful/risky work with dry-run, minimal files, and no secrets.

## Security And Product Decisions
- 2026-04-20T00:00:00+08:00 [USER] Use Stitch MCP for UI design context, design tokens, screen metadata, and Stitch implementation details.
- 2026-04-20T00:00:00+08:00 [USER] Preserve Lazada affiliate backend/data wiring while polishing UI.
- 2026-04-20T00:00:00+08:00 [USER] Treat security, auth, postback, affiliate tracking, public redirects, cron, and reminder routes as abuse-sensitive.
- 2026-04-23T06:50:00+08:00 [USER] Security response milestones: cron/reminder/health secrets rotated, Supabase moved to secret/publishable key formats, old JWT keys disabled, Lazada postback/user token rotated, OpenRouter/Gemini rotated, Vercel Sensitive Env policy enabled, Standard Deployment Protection enabled, `GEOAPIFY_API_KEY` removed, GitHub/Google accounts reviewed and hardened.
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
- 2026-04-26T00:32:58+08:00 [CODE] `/secret-santa` shopping-option panel is sticky while viewing Shopping Picks so selected-option changes remain visible near curated cards.
- 2026-04-26T00:45:44+08:00 [CODE] `/secret-santa` sticky shopping-option panel now uses an opaque surface and stronger elevation so card content does not show through while scrolling.
- 2026-04-26T00:56:41+08:00 [CODE] `/secret-santa` sticky shopping-option panel is flush to the viewport top when active and is bounded to the pre-curated picks block so it stops before `Curated Shopping Ideas`.
- 2026-04-26T10:21:35+08:00 [CODE] `/secret-santa` Lazada CTA uses a shared refined holiday-red pill with icon capsule instead of text arrows; authenticated Playwright now checks the CTA shape and arrow treatment.
- 2026-04-26T11:20:17+08:00 [CODE] Public auth pages now share `AuthPageShell` primitives for the login/create-account/forgot-password frame, hero panel, form field styling, and matching route skeletons.
- 2026-04-26T11:57:44+08:00 [CODE] Dashboard page support code was split into focused `dashboard-types`, `dashboard-snapshot`, `dashboard-formatters`, and `dashboard-visuals` modules; Supabase/auth/realtime behavior stayed in the page.
- 2026-04-26T17:59:21+08:00 [CODE] Dashboard inline UI extraction moved action cards, group cards, and dashboard icons into focused components while keeping routing/delete/data behavior in the page.
- 2026-04-26T20:39:36+08:00 [CODE] Dashboard chrome extraction moved the sticky header and profile menu portal into focused components while page state, refs, routing callbacks, and logout behavior stayed in `page.tsx`.
- 2026-04-26T21:38:18+08:00 [CODE] Dashboard UI body, sidebar, profile-menu hook, and route-prefetch hook were extracted into focused files; Supabase/auth/realtime/delete behavior still stays in `page.tsx`.
- 2026-04-27T03:05:57+08:00 [CODE] Dashboard refresh snapshot now keeps loaded recipient names, gift-progress summary, and activity previews so refresh no longer flashes `No Recipient Yet` before returning to `View Recipient`.
- 2026-04-27T04:03:00+08:00 [CODE] Pre-launch privacy/security baseline added public `/privacy`, stronger global headers, audit-detail redaction, narrower profile reads, checklist/audit docs, and Playwright coverage.
- 2026-04-27T05:05:00+08:00 [CODE] Added public `/cool-app` as an isolated interactive Gift Radar demo route; it uses only local state/assets and does not touch Supabase, auth data, affiliate, cron, or Secret Santa flows.
- 2026-04-27T17:11:40+08:00 [CODE] Local dev CSP now adds `'unsafe-eval'` only in development and allows `127.0.0.1` dev origin for Playwright; production CSP remains strict without `'unsafe-eval'`.
- 2026-04-27T17:48:46+08:00 [CODE] Reminder preferences moved out of `/notifications` inbox and into `/profile` account settings; profile save now persists reminder settings and reschedules pending reminder jobs.
- 2026-04-27T18:47:20+08:00 [CODE] Dashboard notification bell now opens an in-place notifications panel with All/Unread filters; `/notifications` remains available as a direct inbox page.
- 2026-04-26T21:54:26+08:00 [CODE] Group event page snapshot validation/storage, shared data types, and member display-name helper moved to `group-page-state.ts`; page keeps Supabase/realtime/action flow.
- 2026-04-26T22:07:23+08:00 [CODE] Group event page config, modal/skeleton primitives, and route prefetching moved to focused modules without changing group actions or Supabase/realtime flow.
- 2026-04-26T22:39:42+08:00 [CODE] Group event members section moved to `GroupMembersSection.tsx`; page still owns member state, remove-member modal, refresh callbacks, Supabase, and realtime behavior.
- 2026-04-26T23:13:39+08:00 [CODE] Group event owner insights panel moved to `GroupOwnerInsightsPanel.tsx`; page still owns owner-insight loading state and draw/reveal behavior.
- 2026-04-26T23:41:40+08:00 [CODE] Group event edit/delete/leave/remove modals and event summary blocks moved into focused components; page still owns all handlers, route pushes, Supabase, realtime, draw, and reveal state.
- 2026-04-25T00:55:00+08:00 [CODE] Affiliate report separates `Opened in Lazada` from `Lazada reported product`; search-link clicks show exact products only after a mapped Lazada conversion report supplies them.
- 2026-04-23T23:47:58+08:00 [CODE] `/secret-santa-chat` keeps the recognizable dark festive layout with clearer privacy/identity panels, dashboard control, thread labels, and Winter Atelier palette alignment.
- 2026-04-25T20:35:00+08:00 [CODE] Broad UX-writing pass rewrote public/auth/dashboard/group/wishlist/Secret Santa/chat/notification/profile/affiliate-report text toward simple terms: group, member, wishlist, recipient, gift progress, shopping option, affiliate link. Tests were updated only where assertions intentionally tracked old copy.

## Testing Notes
- 2026-04-26T01:38:17+08:00 [TOOL] Performance audit report created at `docs/performance-audit-2026-04-26.md`; biggest findings are large client pages, browser-side Supabase waits on authenticated screens, missing public/auth loading states, and 1.2-2.1 MB PNG assets in `public/`.
- 2026-04-26T01:49:58+08:00 [CODE] Low/medium-risk performance pass added SVG auth assets, public/auth/invite loading skeletons, dashboard profile-modal code splitting, and Playwright navigation timing smoke coverage; remaining perf work is larger authenticated screen/data-fetch refactoring.
- 2026-04-26T02:09:15+08:00 [CODE] Deeper perf pass deferred dashboard peer-profile avatars, loaded group secondary panels after the shell, kept wishlist refreshes visible, expanded route prefetches, and deferred Secret Santa snow; prod sample: login-to-dashboard 8.6s, group 0.56s, wishlist 1.02s, Secret Santa 0.52s, chat 1.02s.
- 2026-04-26T02:22:45+08:00 [CODE] Dashboard return/refresh now uses a 5-minute same-user sanitized session snapshot for stale-while-refresh rendering; Playwright prod sample: initial dashboard 4.57s, refresh visible content 0.25s, wishlist-to-dashboard 1.27s.
- 2026-04-26T02:36:05+08:00 [CODE] Group event pages now defer owner pairing-rule/insight/history work behind the visible shell and use a 5-minute same-user sanitized event snapshot; Playwright prod sample: first group open 1.04s, refresh 0.14s, dashboard-to-group 0.54s.
- 2026-04-23T15:08:24+08:00 [TOOL] Playwright coverage includes public smoke, public/protected navigation, API auth guards, auth-form validation, responsive checks, axe accessibility, OAuth back-navigation, public auth edge cases, and seeded authenticated-screen scaffolding.
- 2026-04-24T15:34:56+08:00 [TOOL] Ignored `.env.local` has seeded `PLAYWRIGHT_E2E_EMAIL`, `PLAYWRIGHT_E2E_PASSWORD`, and `PLAYWRIGHT_E2E_GROUP_ID`; owner-only affiliate-report tests still skip unless the seeded email is allowlisted.
- 2026-04-25T20:35:00+08:00 [TOOL] UX-writing pass checks passed: `git diff --check`, `npm.cmd run typecheck`, `npm.cmd run lint:security`, `npm.cmd run build`, focused public-route Playwright, public smoke/forms/a11y Playwright, and authenticated-screen Playwright. Full `npm.cmd run test:e2e` and full Chromium `tests/e2e` attempts timed out before producing reports; focused suites passed.
- 2026-04-26T00:11:46+08:00 [TOOL] Added permanent authenticated Playwright coverage for `/secret-santa` shopping-option readability, removed `Try this`, filled selected state, curated card budget targets, and header/image separation.
- 2026-04-20T00:00:00+08:00 [TOOL] Recurring build warning remains the parent lockfile workspace-root inference from `C:\Users\kenda\package-lock.json`.
- 2026-04-27T02:45:37+08:00 [CODE] Supersedes 2026-04-27T01:48:43 skipped-test note: authenticated Playwright now covers mobile wishlist-rail scroll behavior and owner/non-owner affiliate-report access; full Playwright passed 370/370 with 0 skipped.

## Tooling
- 2026-04-23T17:02:38+08:00 [TOOL] Installed skills/tools include `webapp-testing`, `create-plan`, `security-threat-model`, `jscpd@4.0.9`, and AuraKit `aura`, `aura-compact`, `aura-guard`.
- 2026-04-23T17:02:38+08:00 [TOOL] Prior `jscpd` scan found 47 clone pairs and about 3.41% duplicated lines; best refactor targets are guarded affiliate redirects, auth layout duplication, group error UIs, AI provider wrappers, and repeated server-action patterns.
- 2026-04-26T10:31:03+08:00 [CODE] Added root `cspell.json` so VS Code/cSpell accepts project vocabulary, ignores generated/private artifacts, and reports 0 workspace spell issues with `npx.cmd --yes cspell@8 --no-progress .`.
- 2026-04-27T00:16:13+08:00 [CODE] jscpd duplicate pass reduced scanned clones from 15 groups / 0.98% duplicated lines to 0 groups / 0% by extracting shared validation, AI draft parsing, affiliate redirect guards, action-prep helpers, profile normalization, and shared icons.
- 2026-04-27T01:48:43+08:00 [TOOL] Full Playwright E2E completed across all configured projects with 363 passed / 7 skipped after updating stale mobile assertions and fixing the Secret Santa wishlist rail wheel-scroll coverage.
