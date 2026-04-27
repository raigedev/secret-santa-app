# Launch Backlog

Use this checklist before opening the app to real users. It is intentionally practical: each item should either reduce launch risk, protect user data, or make production issues easier to catch.

## Must Do Before Public Launch

- Confirm the public privacy policy matches the app's real data handling: accounts, groups, wishlists, assignments, messages, reminders, affiliate clicks, AI providers, retention, deletion requests, and support contact paths.
- Confirm production uses a real domain with HTTPS enabled, and that plain HTTP redirects to HTTPS.
- Confirm production, preview, and local environments use separate secrets, webhook URLs, cron settings, and test data.
- Confirm Vercel deployment protection is enabled for previews that should not be public.
- Enable or confirm Vercel Firewall protection for abuse-sensitive routes, especially login, create-account, password reset, invite, AI suggestion, affiliate redirect, affiliate match, postback, and reminder endpoints.
- Add or confirm bot protection for signup, login, password reset, invite acceptance, and other public submission paths if spam appears.
- Review route rate limits and keep stricter limits on public or money-adjacent paths such as affiliate redirects, Lazada matching, AI suggestions, auth forms, and invite flows.
- Run a credential leak check: no secrets in frontend bundles, public files, API JSON responses, logs, screenshots, docs, fixtures, or committed environment files.
- Verify Supabase Row Level Security with at least two different test accounts trying to access each other's groups, wishlists, invites, assignments, messages, and affiliate reports.
- Confirm the production database has backups enabled and test at least one restore path before relying on those backups.
- Confirm GitHub secret scanning and push protection are enabled for the repository.
- Run the release checks: `npm.cmd run check:problems`, `npm.cmd run typecheck`, `npm.cmd run lint:security`, `npm.cmd run audit:security`, `npm.cmd run audit:architecture`, `npm.cmd run build`, and relevant Playwright suites.

## Strongly Recommended Shortly After Launch

- Add production error monitoring through Sentry or Vercel Observability, with private data filtering configured before collecting events.
- Add alerting for failed cron runs, reminder processor failures, Lazada postback failures, affiliate health checks, auth errors, and unusually slow routes.
- Review GitHub CodeQL, Dependency Review, dependency audit, unused-code audit, and architecture audit results weekly while the app is changing quickly.
- Add automated cross-user authorization tests for the most sensitive Supabase paths if they are not already covered.
- Review long-list screens for pagination or capped queries before real data volume grows.

## Manual Production Smoke Test

- Open the production domain and confirm the landing page, login, create-account, forgot-password, privacy policy, and invite pages load correctly.
- Sign in with a safe test account and confirm dashboard, group event page, wishlist, Secret Santa, chat, profile, and notifications work.
- Confirm a second test account cannot open the first account's private group, wishlist, invite, assignment, messages, or affiliate report.
- Confirm affiliate links open only allowed destinations and do not reveal private tracking secrets.
- Confirm reminder and cron endpoints reject unauthenticated requests in production.
- Confirm error pages and empty states are understandable to normal users.

## Not Yet Verified Here

- Vercel Firewall custom rules are configured for every abuse-sensitive route.
- Bot protection is enabled on public auth and invite flows.
- Production monitoring is wired to Sentry or Vercel Observability.
- Database restore has been tested from a real backup.
