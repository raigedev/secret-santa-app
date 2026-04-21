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

## DISCOVERIES
- 2026-04-20T00:00:00+08:00 [TOOL] Current recurring build warnings: parent lockfile workspace-root inference and Next.js middleware-to-proxy deprecation.

## OUTCOMES
- 2026-04-20T00:00:00+08:00 [CODE] New chats can recover durable project rules from `AGENTS.md` and compact state from this file.
