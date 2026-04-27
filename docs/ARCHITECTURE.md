# Architecture Notes

This app is a Next.js App Router application backed by Supabase and deployed on Vercel.

## Main Boundaries

- `app/`: route segments, pages, route handlers, loading states, and route-local components.
- `app/components/`: shared app UI primitives used across route groups.
- `lib/`: server-side business logic, Supabase helpers, affiliate logic, AI providers, security utilities, and validation.
- `utils/`: older shared utilities that are not route-specific.
- `tests/`: Playwright E2E, security, accessibility, smoke, and helper code.
- `scripts/`: local maintenance scripts and VS Code Problems-style checks.
- `supabase/migrations/`: database schema and RLS changes.

Keep framework/controller code in routes thin when practical. Put reusable business rules in `lib/`.

## Route Map

Public routes:

- `/`
- `/login`
- `/create-account`
- `/forgot-password`
- `/reset-password`
- `/privacy`
- `/invite/[token]`
- `/auth/callback`
- `/cool-app`

Protected app routes:

- `/dashboard`
- `/create-group`
- `/group/[id]`
- `/group/[id]/reveal`
- `/wishlist`
- `/secret-santa`
- `/secret-santa-chat`
- `/notifications`
- `/profile`
- `/dashboard/affiliate-report`

API and redirect routes:

- `/api/ai/wishlist-suggestions`
- `/api/notifications/process-reminders`
- `/api/affiliate/lazada/*`
- `/api/affiliate/report-access`
- `/go/suggestion`
- `/go/wishlist-link`

## Auth And Data Access

- Browser Supabase clients must use only browser-safe publishable values.
- Server Supabase helpers live under `lib/supabase/`.
- Admin/service-role access must stay server-only and scoped to routes that need it.
- `proxy.ts` protects authenticated routes and handles invite/OAuth verification-safe behavior.
- UI checks are not security boundaries. Server actions and route handlers must verify ownership.

## Affiliate Flow

The affiliate system separates user intent from provider-reported conversions:

1. The app reads approved Lazada feed/catalog data from local generated feed files.
2. `/api/affiliate/lazada/matches` returns authenticated, region-validated, rate-limited shopping matches.
3. `/go/suggestion` and `/go/wishlist-link` handle abuse-sensitive click tracking and redirects.
4. Lazada postbacks are validated strictly in production.
5. Reports distinguish `Opened in Lazada` from `Lazada reported product`.

Do not show an exact product for search-style links until a provider report maps the conversion.

## Notifications

The dashboard notification bell owns the quick popover experience with All/Unread filters.

`/notifications` remains as a direct inbox route. Reminder preferences live in `/profile`, not in the inbox.

Reminder processing runs through the Vercel Cron route and must keep secret validation strict.

## AI Wishlist Suggestions

AI provider integrations live under `lib/ai/`. Provider keys must stay server-side. Deterministic fallbacks are allowed only when they are explicit, safe, and do not hide security or persistence failures.

Validate external AI output before using it in UI, persistence, or affiliate matching.

## Performance Shape

The dashboard and group event pages use sanitized short-lived browser snapshots to render useful content quickly while fresh Supabase data loads.

Keep expensive authenticated panels deferred when possible, but do not defer security checks or ownership validation.

Use `npm.cmd run analyze:bundle` when adding heavy UI libraries or large client components.

## Architecture Guardrails

Use dependency-cruiser before and after larger refactors:

```powershell
npm.cmd run audit:architecture
```

Current enforced boundaries:

- imports must resolve
- shared `lib/` and `utils/` code must not import route/UI modules from `app/`
- production source and scripts must not import from `tests/`
- circular dependencies are reported as warnings

Keep this config focused on rules that catch real maintainability risk. Do not add noisy rules that developers learn to ignore.

## Adding New Features

1. Decide the route/API owner.
2. Keep data access server-side unless browser interactivity requires otherwise.
3. Add shared types or validation when data crosses route/API/provider boundaries.
4. Add loading, empty, and error states.
5. Add focused Playwright coverage for user-facing flows.
6. Run the required checks before handoff.
