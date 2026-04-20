# Agent Instructions

- Always use the Stitch MCP server when the user asks for UI design context, design tokens, screen metadata, or implementation details from the user's Stitch project.

## Security Rules

- Before marking code changes done, run `npm.cmd run typecheck`, `npm.cmd run lint:security`, and `npm.cmd run build` unless the change is documentation-only or there is a clear blocker.
- Never commit secrets, API keys, access tokens, Supabase service-role keys, webhook secrets, Lazada/Open API credentials, postback secrets, or private user data.
- Do not paste secrets into docs, screenshots, logs, comments, fixtures, or example output.
- Preserve production fail-closed behavior when required secrets are missing. Do not change production paths to silently allow missing secrets.
- Keep Lazada postback validation strict in production. Do not weaken token/secret checks for `/api/affiliate/lazada/postback` or related test/health endpoints.
- Keep `/api/affiliate/lazada/matches` authenticated, region-validated, and rate-limited.
- Treat `/go/suggestion` and other public redirect/click-tracking routes as abuse-sensitive. Do not expand them without considering spam, analytics pollution, rate limiting, or signed tracking tokens.
- Preserve existing Supabase auth, RLS, and ownership boundaries unless the user explicitly asks for a security-reviewed change.
- Do not log sensitive request headers, cookies, sessions, access tokens, postback tokens, webhook payload secrets, user private data, wishlist private notes beyond what is already user-visible, or affiliate tracking secrets.
- When touching affiliate tracking, keep click attribution, token matching, postback sale mapping, and owner-only affiliate reporting intact.
- When touching Vercel Cron or reminder processing, keep secret validation strict in production and avoid creating unauthenticated production cron execution paths.
- Keep CSP/security headers in `next.config.ts` restrictive. Only add external sources when required by the implemented feature and scoped as tightly as practical.
- Keep `eslint-plugin-security` and `eslint-plugin-no-secrets` checks passing; do not suppress security warnings without a specific reason documented in the change.
