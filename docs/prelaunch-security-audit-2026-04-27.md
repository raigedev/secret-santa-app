# Pre-Launch Privacy And Security Audit

Date: 2026-04-27

## Scope

- Reviewed public/auth pages, API routes, redirect routes, Supabase server/client usage, affiliate modules, audit logging, security headers, tests, and project instructions.
- Excluded private environment files, `node_modules`, `.next`, Playwright artifacts, generated Lazada feed JSON, and archived Codex transcripts.

## Standards Used

- [OWASP Top 10:2021](https://owasp.org/Top10/2021/) categories, especially broken access control, cryptographic failures, injection, insecure design, security misconfiguration, vulnerable dependencies, auth failures, logging/monitoring failures, and SSRF.
- [OWASP HTTP Security Response Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html).
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

## Findings And Actions

- Missing public privacy policy: added `/privacy` covering account/profile data, groups, wishlists, assignments, chat, affiliate clicks/conversions, AI suggestions, processors, security, and deletion/support basics.
- Privacy discoverability: added links from the landing footer and signup form.
- Auth proxy: added `/privacy` as a public verification-safe page so signed-out users can read it.
- Security headers: tightened the global CSP with `object-src 'none'`, `frame-src 'none'`, `manifest-src`, `media-src`, and `worker-src`; added COOP, CORP, and Origin-Agent-Cluster; tightened Referrer-Policy and Permissions-Policy.
- Sensitive logs: updated audit-detail sanitization to redact sensitive-looking keys and common token-shaped values before database logging.
- Overbroad profile reads: replaced profile `select("*")` and empty returning `select()` calls with an explicit field list.
- Tests: added public route coverage for `/privacy` and Playwright coverage for baseline security headers.

## Repo-Wide Checks Performed

- Environment/API key scan found expected server-side `process.env` use and expected public Supabase config. No provider spend keys were found in client components during this pass.
- Wildcard Supabase select scan found no remaining broad or empty returning selects in scanned source paths after the profile fix.
- Secret-shape scan found no real credential-shaped strings in scanned source paths after redacting a placeholder in continuity notes.
- Console scan found deliberate server-side error logging around affiliate postback/test routes, click tracking, and developer scripts. No raw secrets were observed in those inspected log calls.

## Remaining Launch Follow-Ups

- Replace the generic privacy support wording with the official support/contact email before public launch.
- Have the privacy policy reviewed for the exact launch countries, retention period, and processor list.
- Run a pre-launch cross-user Supabase RLS test using two seeded accounts.
- `npm audit --audit-level=high` reported no high-severity issues, but did show two moderate PostCSS advisories through the Next.js dependency path. Do not use the suggested forced fix because it proposes a breaking Next.js downgrade; monitor for the next safe upstream patch.
- Consider CSP nonce/hash hardening later to remove `'unsafe-inline'` once the current inline style/script patterns are refactored.
- Continue the planned Lazada postback hardening toward POST/header-only transport if Lazada supports it.
