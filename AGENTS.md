# Agent Instructions

- Always use Stitch and Figma MCP design tools when the user asks for UI design context, design tokens, screen metadata, selected frames, screenshots, variants, or implementation details from connected design sources. For this app's current Secret Santa Stitch source, use project `3072957204541081703` (`Process Explainer`, despite the generic title) after confirming with `list_projects`/`list_screens` when needed; do not call `list_design_systems` without a `projectId`. For Figma, use the connected Figma MCP/plugin automatically when available: start with exact-node design context, fetch a screenshot/reference for the selected frame, reuse this repo's existing components/tokens, and verify the implementation with browser or Playwright checks. If Figma tools are not exposed in the current Codex session, say that briefly and continue from screenshots, Stitch, `DESIGN.md`, and local code.

## Codex Skills

When the user asks to fix, improve, refactor, optimize, secure, clean up, remove duplicated code, or improve responsive design, use the `code-improvement` skill automatically whenever it is relevant. The user should not need to manually invoke it.

Follow the skill before editing source code.

When the user asks for frontend UI, visual polish, responsive layout fixes, app screen redesigns, or frontend readability improvements, use the repo `frontend-product-ui` skill automatically alongside `DESIGN.md`, Figma or Stitch when relevant and available, browser preview, and Playwright verification.

When the user asks about Codex setup, installing helper tools, CI/PR workflow, changelogs, Sentry triage, GitHub automation, or remembering agent methods, use the repo `codex-workflow-stack` skill. Prefer already installed, free, repo-safe tools; treat account-bound remote-action tools as opt-in.

Graphify is installed as a global Codex skill for large codebase-map and architecture-discovery tasks. Use it automatically when a task would benefit from repository maps, dependency neighborhoods, or persistent codebase graphs; otherwise prefer normal `rg`/file inspection for focused edits. Keep `.graphifyignore` in place, do not commit `graphify-out/`, and do not use Graphify URL fetch, Neo4j push, watch hooks, or broad semantic extraction over sensitive/unreviewed files unless explicitly needed.

Agent Orchestrator is installed globally as `ao.cmd` on Windows for parallel Codex/worktree workflows. Use it automatically when a task genuinely benefits from parallel agents, CI/PR session management, or branch-per-agent orchestration; do not start remote-write flows, PR creation, or external integrations unless the user task calls for them.

## Project Stack

- Next.js `16.2.3` App Router on Vercel.
- React `19.2.5`.
- TypeScript `5` in strict mode.
- Tailwind CSS `4.2.2`.
- Supabase auth/database with `@supabase/ssr` and `@supabase/supabase-js`.
- Vercel Cron jobs are configured in `vercel.json`.
- Lazada affiliate features include feed/catalog matching, promo-link priming, click tracking, postback handling, report access, and health/test endpoints.
- AI wishlist suggestions use configured provider keys, with deterministic local fallbacks where implemented.
- ESLint 9 uses security and no-secrets plugins. Husky prepare script is present.
- Deployment is from GitHub `main` to Vercel. The user usually commits and pushes manually unless explicitly asking the agent to do it.

## Senior Engineering Standards

Act as a senior full-stack engineer and software architect. Code this project with clean structure, maintainability, security, scalability, and reviewability in mind.

### Refactoring And Architecture Review

- When asked to review or refactor the codebase, first inspect the current project structure, identify architectural/code-organization problems, propose a refactor plan, and ask before making major structural changes.
- Proactively decide when to use Oracle (`@steipete/oracle`) as the default second-opinion tool for meaningful coding, refactor, security, performance, architecture, and non-trivial UI/design changes when practical; the user does not need to ask for it by name.
- Preserve existing behavior unless the user explicitly asks for a behavior change.
- Prefer clear module boundaries over large files, while avoiding unnecessary abstractions.
- Keep functions small and focused.
- Separate business logic, data access, UI/API/routes, utilities, configuration, and framework/controller code.
- Improve unclear naming when it makes the code easier to understand.
- Remove meaningful duplication where it reduces maintenance risk.
- Follow the existing Next.js App Router conventions and local project patterns.
- Add or update tests for meaningful refactors and user-facing flows.
- Run lint, typecheck, VS Code Problems-style checks, build, and relevant tests before the final response when available.
- Explain tradeoffs briefly after changes.
- Do not rewrite the whole project unnecessarily, add new dependencies without approval, or change public APIs without explaining why.

### 1. Code Quality

- Write clean, readable, maintainable code.
- Prefer simple solutions over over-engineering.
- Use clear names for variables, functions, files, and components.
- Avoid duplicated code; extract shared helpers only when they remove real repetition or complexity.
- Keep files focused on one responsibility.
- Keep components small and reusable.
- Add comments only when they explain why something exists, not obvious code.

### 2. Project Structure

- Follow the existing Next.js App Router structure.
- Separate UI components, server actions, utilities, types, hooks, and database logic.
- Do not put everything inside one large component.
- Use consistent folder naming that matches the surrounding code.
- Do not create random files without explaining why they are needed.

### 3. TypeScript

- Use TypeScript strictly.
- Avoid `any` unless there is a clear reason.
- Create shared types when reused across modules.
- Validate external data before trusting it, including API responses, route params, form input, webhook payloads, AI output, and affiliate data.

### 4. Next.js Best Practices

- Use Server Components by default.
- Use `"use client"` only when needed for state, effects, browser APIs, or interactivity.
- Keep client components small.
- Use `loading.tsx`, `error.tsx`, and `not-found.tsx` where helpful.
- Avoid unnecessary client-side data fetching when server-side fetching is better.

### 5. Supabase Best Practices

- Never expose service-role keys to the browser.
- Keep database logic secure and predictable.
- Respect Row Level Security and existing ownership boundaries.
- Avoid repeated Supabase calls; batch or reuse data where practical.
- Handle empty states, errors, and loading states properly.
- Keep auth logic safe, explicit, and easy to reason about.

### Supabase Migration Discipline

- GitHub and Vercel pushes deploy app code only; they do not apply Supabase migrations.
- Before database, schema, RLS, Supabase Advisor, or PostgREST fixes, check migration state with `npx.cmd supabase migration list` when credentials allow.
- Before applying Supabase migrations, run `npx.cmd supabase db push --dry-run` and review the exact migration list. Do not run `supabase db push` if the dry-run includes unrelated old migrations or shows migration-history drift.
- Treat production migration-history drift as a release blocker until it is understood. Repair history only after verifying the live schema matches the migration, using `supabase migration repair --status applied <version>` as appropriate.
- Prefer durable migration files for database changes. If a manual SQL Editor fix is needed as a surgical recovery, mirror the durable change back into `supabase/migrations/` and reconcile migration history before relying on future CLI pushes.
- Never ask the user to paste database passwords or secrets into chat. If the CLI needs a database password, tell the user to set `SUPABASE_DB_PASSWORD` locally or use the Supabase dashboard safely.

### Production Database Safety

- Future agents may execute safe, scoped Supabase Advisor or verification SQL from Codex/VS Code when the SQL is prepared in a local file, the linked project has been checked, and the action is limited to reviewed grants, policies, function settings, indexes, or read-only diagnostics.
- Never run destructive production database actions automatically. This includes `DROP DATABASE`, `DROP SCHEMA`, `DROP TABLE`, `TRUNCATE`, broad `DELETE` or `UPDATE`, `supabase db reset`, drifted `supabase db push`, data-loss `ALTER TABLE` changes such as dropping columns or constraints, or migrations that rewrite/delete production data unless the exact SQL or command, target project, expected impact, and rollback notes have been shown to the user and the user explicitly confirms.
- Prefer idempotent and reversible SQL: `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` followed by reviewed replacement policies, explicit `REVOKE`/`GRANT`, explicit function signatures, and tight `WHERE` clauses for any data-touching fix. Use transactions for policy/grant/function changes when supported; avoid forcing unsafe workarounds when Supabase wraps execution.
- Before any production DB write, inspect the relevant schema/advisor output, prepare the smallest SQL file needed, avoid secrets and private data, and verify the command targets the intended linked Supabase project.
- After any production DB write, run verification/advisor checks, mirror the durable change into `supabase/migrations/` when it affects schema/security/performance, update `.agent/CONTINUITY.md`, and keep local scratch SQL/schema dumps in `.agent/` uncommitted unless the user explicitly asks.

### 6. Security

- Never hardcode secrets.
- Never log sensitive data.
- Validate user input on the server.
- Handle authorization checks before allowing data changes.
- Check that users can only access their own groups, wishlists, invites, assignments, and affiliate reports.

### 7. UX And Accessibility

- Make UI text easy for normal users to understand.
- Use clear button labels.
- Add helpful empty states and error messages.
- Use semantic HTML where possible.
- Keep forms accessible with labels and validation messages.
- Make the app responsive for mobile, tablet, and desktop.

### User-Facing Copy Rules

- Treat all user-facing text as production content unless the screen is explicitly for developers or maintainers.
- Keep backend, database, source, provider, AI, fallback, postback, RLS, Supabase, deterministic, taxonomy, and other implementation terms out of customer-facing UI copy.
- Use normal product language instead: gift ideas, wishlist, shopping option, reminder, report, private message, recipient, group, and gift progress.
- Prefer short factual sentences over explanatory "X so Y" scaffolding when the explanation would expose internal reasoning.
- Keep data-source, normalization, and matching logic in utilities, services, server actions, or API routes. React UI components should receive display-ready labels and actions instead of assembling backend concepts for the user.

### Frontend UI Workflow

- Before front-end UI work, read root `DESIGN.md` when present and preserve its design tokens, component rules, accessibility constraints, and anti-patterns.
- For front-end UI work, use the repo `frontend-product-ui` skill first so OpenAI frontend guidance, Reddit field reports, and this app's design system are applied consistently.
- For front-end UI work, use available UI/design skills and tools alongside the repo's existing design patterns. The user's preferred UI skills are `impeccable` and the Taste Skill family, especially `design-taste-frontend`, `stitch-design-taste`, `high-end-visual-design`, and `redesign-existing-projects` when installed or available in the active Codex session.
- Use Google Stitch as the starting point for UI design context, base screen direction, design tokens, screen metadata, or implementation details when the user asks for design help or Stitch context. Start from `list_projects`, then call project-scoped tools such as `list_design_systems` or `list_screens`; the known Secret Santa Stitch source is project `3072957204541081703`, currently titled `Process Explainer`.
- Use Figma MCP as a first-class design source when the user provides or references Figma files, selected frames, design nodes, design screenshots, component mappings, or Code Connect/design-system context. Follow the Codex/Figma workflow: fetch exact design context for the node, fetch a screenshot or visual reference, narrow large/truncated files to the relevant nodes, translate the design into existing app components and Tailwind tokens, then compare with Playwright/browser screenshots. Combine Figma with Stitch, `DESIGN.md`, `frontend-product-ui`, Impeccable/Taste skills, Oracle dry-runs, and Playwright when the task benefits from multiple design signals.
- If the UI direction is unclear, create or compare a few variants for inspiration before settling on the simplest polished direction.
- When a screen needs a more distinctive component treatment, review 21st.dev as an inspiration source for React/Tailwind components, screens, and themes. Use 21st.dev or its Magic MCP only when available and compatible with this Next.js/Tailwind stack; otherwise manually adapt ideas while preserving project style, accessibility, performance, and security.
- For visual UI iteration, use the Codex App Browser interaction flow when available: start the local dev server, open the built-in Browser to localhost, let the user point at UI elements with screenshots/annotations, and treat those annotations as high-signal visual context for the next patch.
- After finishing UI or app-facing changes, start or reuse the local dev server and open the relevant route in the Codex Web Preview on the right so the user can immediately test it. If the Web Preview/browser runtime is unavailable, say so and provide the exact local URL instead.
- If the built-in Browser runtime is unavailable or broken, use Playwright screenshots/tests as the fallback and clearly say that Browser interaction could not run.
- Do not copy third-party components blindly. Check licensing, dependencies, accessibility, responsiveness, bundle cost, and visual fit before adapting any external UI pattern.

### 8. Testing

- Add or update tests when changing important logic or user-facing flows.
- Use Playwright for major user flows and UI regressions when useful.
- Test auth, dashboard, group creation, invites, wishlist, assignments, gift confirmation, and affiliate shopping flows when touched.
- Run build and lint after source changes, following the required project checks below.
- After coding or config changes, run `npm.cmd run check:problems` to check the diagnostics that feed the VS Code Problems panel, including TypeScript, ESLint/security lint, cSpell, and the project Tailwind warning-pattern scan. Resolve those problems before marking the task done.

### 9. Change Discipline

- Before editing, inspect existing files and understand current patterns.
- Make small, safe, reviewable changes.
- Do not rewrite the whole app unless explicitly asked.
- Do not remove features unless explicitly asked.
- Do not change database schema unless necessary and explained.
- After changes, summarize what changed, why, and what files were touched.
- After updating project instructions, review the current project structure and recommend improvements before making unrelated code changes.

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
- Use CodeRabbit or an equivalent AI code reviewer on every pull request when available. Treat it as an additional security/reliability gate for SQL injection, exposed credentials, broken auth, unsafe redirects, race conditions, and other common regressions; it is not a replacement for tests, typecheck, linting, build, or human review.

### Security Playbook

- Authentication sessions must have expiration limits. JWT/session lifetimes should not exceed 7 days without refresh-token rotation or an equivalent managed-session control.
- Never invent or hand-roll app authentication. Use the existing Supabase auth stack unless the user explicitly approves a reviewed migration to Clerk, Auth0, or another managed provider.
- Keep API keys strictly server-side in environment variables. Never expose provider keys to client components or browser-readable bundles.
- Prefer managed secret storage such as Vercel environment variables for this app, or Google Secret Manager/AWS Secrets Manager when using those platforms. Keys do not belong in source code, public files, or committed docs.
- Rotate production secrets at least every 90 days when operationally possible, especially provider, webhook, affiliate, and service-role credentials.
- Before installing packages, verify that suggested packages are reputable, maintained, and appropriate for the current stack. Prefer newer secure versions that do not break compatibility, and keep dependencies updated to avoid known vulnerabilities.
- Run `npm audit` after dependency changes and before security-sensitive releases. Use `npm audit fix` only when the proposed changes are safe and reviewed; do not use `--force` without explicit approval.
- Sanitize and validate all inputs on the backend, even when the frontend already validates for UX. Include forms, URL query params, route params, uploads, webhook/postback payloads, AI prompts, and affiliate redirect params. Use parameterized Supabase queries or structured APIs instead of string-built queries.
- Enable and preserve Row-Level Security for Supabase tables that contain user data.
- AI may help draft RLS policies, but every policy must be reviewed and tested by attempting cross-user access before it is trusted.
- Remove or avoid `console.log` statements before production deployment, especially logs involving auth, user data, affiliate data, payloads, tokens, or secrets.
- Restrict CORS and allowed origins to approved production and development domains. Do not allow wildcard production origins.
- Validate redirect URLs against an allow-list. Do not redirect to arbitrary user-controlled URLs.
- Add auth, authorization, and rate limiting to endpoints by default. Any public endpoint must have an explicit reason and abuse controls.
- Start strict for public endpoints: use about `100` requests/hour per IP as the default ceiling unless a route has a documented reason for a different limit. Loosen later only if real users are blocked.
- Cap AI API usage and costs in code and provider dashboards where supported.
- Use Vercel/edge protections or equivalent controls for DDoS and abuse-sensitive routes.
- Lock down storage access so users can only access their own files and approved shared assets.
- Validate file uploads by content signature, size, and server-side rules, not only by extension.
- Verify webhook signatures or shared secrets before processing payment, affiliate, postback, or other external event data.
- For payments, postbacks, affiliate events, email sends, reminders, and any future wallet/credit flows, check idempotency and race-condition behavior so duplicate requests cannot double-charge, double-credit, double-count, or double-send.
- Review permissions server-side. UI-only checks are not security boundaries.
- Log critical actions such as deletions, role changes, payment/affiliate exports, postback processing, and admin/report access without logging secrets or private payloads.
- Build real account deletion flows when account deletion is implemented. Do not rely on manual database cleanup.
- Automate backups and periodically test restore procedures. Untested backups should not be treated as reliable.
- Keep test, preview, and production environments separated, including secrets, webhooks, data, and external side effects.
- Never let test webhooks mutate real production systems.
- Keep dependencies updated through reviewed Dependabot or manual PRs. Check changelogs, security advisories, and lockfile changes before merging dependency updates.

### Launch, Backend, and Growth Guardrails

- Before any production launch, run a privacy and security sanity review across the whole codebase. Confirm there is a public privacy policy, that it matches the app's actual data handling, and that user data collection, affiliate tracking, AI-provider use, retention, deletion, and support/contact paths are described plainly.
- Treat privacy compliance as part of engineering risk. Check GDPR/CCPA-style basics before launch: what data is collected, why it is collected, where it is stored, which processors receive it, how users can request deletion, and whether any optional marketing or analytics data requires consent.
- Review security posture against OWASP Top 10 and OWASP Cheat Sheet guidance before launch and after major feature work. Cover access control, injection, XSS, auth/session handling, security misconfiguration, vulnerable dependencies, logging/monitoring, SSRF/open redirects, and sensitive-data exposure.
- Check credential and data leakage explicitly: no secrets in frontend bundles, public files, logs, screenshots, API JSON responses, route params, query strings, fixtures, generated docs, or committed environment files.
- API keys belong server-side unless they are intentionally publishable keys with restricted permissions, such as Supabase anon/publishable keys protected by RLS. Any provider key that can spend money, read private data, mutate data, or access affiliate/API accounts must never appear in browser code or network calls.
- When adding third-party APIs, prefer server-side proxy routes with allow-listed inputs, rate limits, auth checks, and minimal responses. Never expose raw provider payloads to the browser unless every field has been reviewed.
- Keep strong security headers enabled and periodically re-check them: CSP, HSTS, `X-Content-Type-Options`, frame protections, `Referrer-Policy`, and restrictive `Permissions-Policy`.
- Prefer token-based authentication and managed session flows for long-term web/mobile stability. Avoid password/session schemes that are hard to rotate, revoke, or audit.
- Do not treat UI polish as a substitute for backend reliability. Before launch or major releases, verify login, database reads/writes, affiliate redirects, postbacks, cron jobs, and any payment flows that exist.
- If payments are added later, fully test the provider flow in the correct test environment before launch, including idempotency and race-condition/double-charge protection. Do not touch live cards, live payments, or production fulfillment from test flows.
- Production launches should use a real domain with SSL enabled.
- HTTPS is required for every endpoint in production. Redirect HTTP to HTTPS automatically and do not allow plaintext auth, tokens, sessions, webhook payloads, or API traffic.
- Keep development, preview, and production environments separate for data, secrets, webhooks, cron jobs, and third-party integrations.
- Never expose API keys, auth tokens, affiliate credentials, webhook secrets, or provider keys in public files, client bundles, repositories, screenshots, or logs.
- Back up the production database regularly and verify restores. Data loss is a launch-blocking risk once real users exist.
- Require email verification where account authenticity matters, especially before enabling sensitive actions.
- Add or preserve rate limiting, input validation, and basic bot/abuse protection on signup, login, invite, chat, affiliate redirect, postback, AI, and notification endpoints.
- Add invisible CAPTCHA or equivalent bot challenges where spam risk is high, especially registration, login, password reset, invite/contact-style forms, and other public submissions. Keep it low-friction for real users.
- Plan for real usage by paginating long lists and data-heavy pages instead of loading unbounded rows.
- Add database indexes for common filters, joins, and ordering paths before data volume grows.
- Move slow work to background jobs, cron jobs, queues, or deferred processing instead of blocking user-facing requests.
- Monitor application errors, failed cron runs, affiliate/postback failures, auth issues, and slow routes so problems can be fixed before users report them.

## Agent Operating Rules

- Prefer failing loudly with clear error logs over failing silently with hidden fallbacks.
- Work in autonomous proactive mode: use tools as needed to complete the task end-to-end, while still respecting safety rules, scope controls, and explicit user preferences.
- If a bug, console error, test failure, VS Code Problem, or clear regression is discovered before, during, or after testing, fix it immediately when it is safe, in scope, and does not require destructive or high-risk action. Mention the extra fix in the final summary instead of leaving it silently for later.
- Make the smallest safe change that solves the issue. Preserve existing style and conventions. Prefer patch-style edits and reviewable diffs over full-file rewrites.
- Only modify files directly required by the current task. If a change would touch files outside the stated scope, including cleanup or refactors, list the files and reason first and wait for approval.
- Never rename, move, or delete files without explicit instruction.
- For 1-2 changed files, state the approach in one sentence and proceed. For 3+ changed files, write a brief plan listing each file and change, then get approval. For architectural or cross-cutting work, write a sequenced plan with risks and rollback approach, then implement in stages.
- When in doubt, over-plan. A short plan is cheaper than a wasted refactor.
- New or substantially edited code files should stay under 300 lines. This repo already has larger legacy files; when touching one materially, prefer extracting focused helpers/components instead of making it larger.
- Do not install system packages on the host unless explicitly instructed. Use the existing repo toolchain first. If new system-level tooling is needed, prefer a container or repo-contained workflow.

### Error Handling

- Never add `try`/`catch` unless the catch block has explicit recovery logic, returns a deliberate user-facing error, or preserves a required fail-closed security path.
- Empty catch blocks and generic fallbacks such as `return null`, `return []`, or log-and-continue are banned unless the fallback is intentionally documented and safe.
- If the code does not know how to handle an error, let it propagate. The stack trace is more valuable than hidden graceful degradation.
- Do not add hidden fallback paths for authentication, affiliate tracking, postbacks, cron secrets, AI providers, or database writes.

### Test Failures

- When a test or check fails, determine the root cause before changing code.
- Treat production code as wrong until proven otherwise.
- Never weaken an assertion, broaden a matcher, or add skip/xfail just to make a test pass.
- If a test is genuinely wrong, explain what it tested incorrectly and why the new assertion is more accurate.

### API and Remote Services

- External API and remote-service calls must be read-only unless the user explicitly requests a write operation.
- For remote write operations, dry-run first when supported and present the expected outcome before executing.
- Never execute destructive operations such as `DELETE`, `DROP`, overwrite, force-push, production data mutation, or live webhook/payment side effects without showing the exact command/action and getting confirmation.

### Oracle Second Opinion

- Use the installed `oracle` skill and `@steipete/oracle` CLI as a second-opinion reviewer for meaningful source changes, risky refactors, security-sensitive work, performance investigations, architecture decisions, and complex UI/design changes. Decide this automatically when the work meets those criteria; do not wait for the user to trigger Oracle explicitly.
- Skip Oracle for documentation-only edits, tiny copy/style tweaks, mechanical formatting, or emergency fixes where it would add delay without reducing risk.
- Always run a no-send preview first with `npx -y @steipete/oracle@0.9.0 --dry-run summary --files-report ...` and attach the smallest safe file set.
- Never attach `.env*`, secrets, tokens, cookies, private logs, database dumps, screenshots containing sensitive data, or user private data. Prefer manual login over cookie extraction; never paste cookies into prompts, docs, logs, or committed files.
- Prefer browser or render/copy mode for routine second opinions. API mode can spend money and requires explicit user approval before use. On this Windows machine, Oracle browser mode is configured in `%USERPROFILE%\.oracle\config.json` with a persistent manual-login profile and `browser.modelStrategy: "ignore"`; if the model selector error returns, check that config before falling back.
- Treat Oracle output as advisory. Verify suggestions against the repo, existing security rules, tests, and the user’s requested behavior before applying changes.
- If Oracle times out or detaches, reattach to the existing session instead of re-running the same prompt.

### Accuracy and Sourcing

- For requests depending on recency, first establish the current date/time with `Get-Date -Format o` or an equivalent command and state it explicitly.
- Prefer official or primary sources such as vendor docs, release notes, changelogs, repository docs, and API references.
- Before using a new API or library function, verify it exists in the version used by this project. If not verified, label it `UNCONFIRMED`.
- Use Context7 MCP for library/API docs when available. Pin the library and target version when known, and fetch only targeted docs.
- Use web search when it materially improves correctness or freshness, especially for recent APIs, advisories, release notes, and vendor guidance. Prefer official sources and record source dates when relevant.

### Reading Project Documents

- For PDFs, uploads, long text, spreadsheets, CSVs, and other project documents, read the full source before drafting conclusions.
- Before finalizing, re-check the original source for factual accuracy, missing details, and preserved wording/style unless the user asked for rewriting.
- If paraphrasing, label it as a paraphrase.

### Continuity State

- Maintain `.agent/CONTINUITY.md` as the canonical state file for this workspace.
- Read `.agent/CONTINUITY.md` at the start of a new task or new chat when present.
- Update it only when something materially changes: goals, decisions, progress, discoveries, outcomes, or next steps.
- Each entry should use an ISO timestamp and a provenance tag: `[USER]`, `[CODE]`, `[TOOL]`, or `[ASSUMPTION]`.
- Mark unverified facts as `UNCONFIRMED`.
- Supersede changed facts explicitly; never silently rewrite history.
- Keep `.agent/CONTINUITY.md` under 80 lines. Compress older entries into milestone bullets instead of storing raw logs or transcripts.

### Definition of Done

- The requested change is implemented or the question is answered.
- Build is attempted when source code changed.
- Linting is run when source code changed.
- Tests and typecheck pass where applicable.
- VS Code Problems-style diagnostics are checked after changes with `npm.cmd run check:problems`, plus relevant tests.
- Errors and warnings are fixed or clearly listed as out-of-scope.
- Documentation is updated when behavior, security, deployment, or workflow changes.
- Impact is explained: what changed, where, and why.
- Follow-ups are listed for anything intentionally left out.
- `.agent/CONTINUITY.md` is updated when the change affects goal, state, decisions, or durable project knowledge.

### Project-Specific References

- Code style and conventions: see `docs/STYLE.md` if present.
- CSS hygiene: see `styles/STYLEGUIDE.md` if present.
- Deployment procedures: see `docs/DEPLOY.md` if present.
- Known issues and workarounds: see `docs/KNOWN_ISSUES.md` if present.
