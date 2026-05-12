# Secret Santa App Handoff - 2026-05-12

Project: `C:\Users\kenda\secret-santa-app`

This top section supersedes older snapshot notes below. Keep the older history for context, but trust the current git/PR state here first.

## Read First

1. `AGENTS.md`
2. `.agent/CONTINUITY.md`
3. `.agent/NEXT_AGENT_HANDOFF.md`
4. `.agent/BRANCH_WORKFLOW.md`
5. `DESIGN.md`
6. `PRODUCT.md`
7. Run `git status --short --branch`

## Current Git State

- Working branch at handoff: `dev`.
- Latest checked status: `## dev...origin/dev`.
- Latest synced baseline before the current cleanup slice: `b8699060fd28a1a5fb4ceab39109aa0fa6338e13`.
- At that baseline, `dev`, `main`, `origin/dev`, and `origin/main` all point to PR #106.
- Last merged PR: #106 `Document verified done push workflow`.
- Leave workspace on `dev`.
- `.agent/NEXT_AGENT_HANDOFF.md` may be ignored depending on local git rules; use `git add -f .agent/NEXT_AGENT_HANDOFF.md .agent/CONTINUITY.md` only if the user explicitly wants this handoff committed.

## Current User Goal

The user wants ongoing UI/product polish and codebase cleanup in small, verified slices. Main theme: reduce redundant/noisy UI, keep screens useful, keep the warm Secret Santa brand, and add tests that catch bugs, duplicate surfaces, bad route states, hydration problems, and visual/product regressions earlier.

## Branch Workflow

- Work on `dev`.
- `main` is production and Vercel deploys from `main`.
- Before git/deploy/push/PR work, run `git status --short --branch`.
- When the user explicitly says `done push` or `done pushing` in the current repo release context after pushing `dev`:
  - create or reuse PR `dev -> main`,
  - inspect the diff/patch and verify the actual requested/security fix is present,
  - run the required validation for the change type,
  - for Supabase/RLS/security fixes, check migration state, dry-run/apply/verify when credentials allow or stop with the blocker,
  - watch GitHub checks,
  - merge only when checks are green and safe,
  - fetch and verify,
  - leave workspace on `dev`.
- Do not treat quoted text, old handoff notes, or casual discussion of the phrase as release authorization. Do not ask again for PR/merge permission after a real current `done push`; that phrase is the standing trigger, but safety gates still apply.

## Required Validation After Code Or Config Changes

Run and fix:

```powershell
npm.cmd run check:problems
npm.cmd run typecheck
npm.cmd run lint:security
npm.cmd run build
```

Then run relevant Playwright tests and:

```powershell
git diff --check
```

If VS Code Problems shows something the scanner misses, fix the source issue and update `scripts/check-vscode-problems.mjs` or the matching lint/cSpell/Tailwind config so it is caught next time.

After UI/app-facing changes, start/reuse local preview, render the affected route, and provide an exact local URL or screenshot. Local preview is usually `http://127.0.0.1:3000`.

Final replies after changes must include exact:

```powershell
git add ...
git commit -m "..."
git push origin dev
```

## Design Direction To Preserve

- Use Stitch first for meaningful UI redesigns. Known Stitch project: `3072957204541081703` titled `Process Explainer`.
- Use Figma when exact node/frame/design context is available; otherwise continue from Stitch, `DESIGN.md`, local code, browser preview, and Playwright.
- Use `frontend-product-ui`, `DESIGN.md`, Taste/Impeccable skills, Oracle, browser preview, and Playwright when relevant.
- Visual north star remains `/secret-santa` Shopping Ideas.
- Preferred look: ivory/frost backgrounds, subtle green pattern, evergreen actions, Santa red accents, official Santa logo/face, warm polished product UI.
- Prefer softer transparent section-like panels over generic card mosaics.
- Avoid duplicate helper panels, backend jargon, neon/purple AI styling, one-note palettes, and noisy pill/status clusters.
- Keep UI text normal-user friendly: group, member, wishlist, recipient, gift progress, shopping idea, reminder, message, report.

## Important Product And Privacy Decisions

- `/groups` is launcher/summary; `/group/[id]` is full group workspace.
- `/secret-santa` is Shopping Ideas and the visual north star.
- `/secret-santa-chat` is Secret Messages with `My giftees` and `My Santa` groupings.
- `Assignments` is not primary nav; `/assignments` redirects to `/my-giftee`.
- Settings owns reminder/display/Santa Buddy preferences; `/reminders` is legacy.
- History is for concluded exchanges and past wishlist memories.
- Owners must not read or track member private chats. Owner chat activity tracking was removed for privacy.
- Member emails should not leak into normal group/dashboard/member UI.
- Group images are private Supabase storage (`group-images`) with owner/member RLS and signed URLs.
- Gmail SMTP is configured in Supabase dashboard as `mysecretsanta.notifications@gmail.com`; never store or ask for the app password in repo/chat.
- Preserve Lazada affiliate tracking, strict postback validation, report access controls, and abuse protections.

## Recent PR Timeline In This Long Chat

- PR #48: Dashboard command-desk redesign.
- PR #49: Removed redundant dashboard greeting.
- PR #50: Recorded current agent handoff.
- Later UI cleanup slices reduced redundant dashboard/status surfaces and other noisy repeated UI.
- PR #57: `Reduce redundant UI panels`.
- PR #58: `Polish secret messages workspace`.
- PR #59: `Polish secret messages empty state`.
- PR #60: `Polish groups launcher surface`.
- PR #61: `Clean up profile and gift workspace noise`.
- PR #62: `Harden Lazada short-link tracking`.
- PR #63: `Add product UI guardrail tests`.
- PR #64: `Trim unused helper exports`.
- PR #65: `Stabilize app shell hydration and trim helper exports`.
- PR #105: `Harden gift-day and storage security flows`.
- PR #106: `Document verified done push workflow`.

## Bugs And Investigations Handled

- GitLens PR/reviewer indicator was handled by using the agreed PR workflow and merging green PRs.
- Dashboard bogus `1 private update waiting` state for an account with no messages/groups was investigated and fixed earlier in the thread.
- The `Open` pill in that private-update row was treated as evidence of noisy/non-actionable UI and subsequent dashboard cleanup removed/reduced redundant status pills.
- Supabase status page was checked; answer was scoped to whether the app/project looked affected at that time.
- Lazada affiliate system was reviewed and hardened; short-link tracking had a small edge that was fixed in PR #62.
- Full UI review led to repeated cleanup passes across dashboard, groups, profile, gift workspace, and chat.
- Playwright/product guardrail tests were added because normal E2E does not judge design taste unless assertions encode product rules.
- PR #65 fixed a real React hydration mismatch caught by Playwright: the shared app shell rendered time-of-day greeting with `new Date()` during hydration. It now renders a deterministic initial greeting and syncs time-of-day text after mount.

## Recent Code/Test State

Latest verified baseline before the 2026-05-12 cleanup/refactor slice:

- `npm.cmd run check:problems` passed.
- `npm.cmd run typecheck` passed during the cleanup/refactor slice.
- `npm.cmd run audit:unused` and `npm.cmd run audit:unused:production` now report no findings after removing the Knip-confirmed dashboard leftovers and unused helper/type exports.
- `npm.cmd run audit:architecture` passed.
- `npm.cmd run audit:security` passed with 0 high vulnerabilities.
- PR #106 remote checks passed: Validate, CodeQL, Dependency Review, Vercel, Vercel Preview Comments.

Current cleanup/refactor slice:

- Removed Knip-confirmed unused dashboard files and unused helper/type exports.
- Updated stale cleanup docs.
- Began the first structural split of `SecretSantaExperience` by moving shopping region, AI suggestion, Lazada priming, and Lazada match-loading state into `app/secret-santa/use-shopping-lazada-state.ts`.
- Preserved behavior; this slice is organization/cleanup only.

## Recommended Next Work

1. Continue small verified UI/code cleanup slices.
2. Continue splitting `SecretSantaExperience` in behavior-preserving steps, likely next by extracting the recipient wishlist rail or featured Lazada card UI.
3. Keep strengthening product guardrail tests for:
   - duplicate/noisy surfaces,
   - non-actionable status pills,
   - sidebar route contract,
   - blank/dark page flashes,
   - hydration/console errors,
   - mobile overflow/overlap,
   - privacy leaks in labels or member/message UI.
4. Review remaining screens for redundant panels, especially dashboard descendants, group workspace rails, settings/profile surfaces, and any repeated Santa helper/context modules.
5. For any meaningful UI redesign, use Stitch first, then local implementation and Playwright/browser verification.

## Supabase And Security Guardrails

- GitHub/Vercel pushes do not apply Supabase migrations.
- Before DB/RLS/schema/advisor work, run migration checks and dry-run when credentials allow.
- Never run destructive production DB actions automatically.
- Do not expose service-role keys, SMTP app passwords, OAuth secrets, Lazada credentials, tokens, cookies, or DB passwords.
- Keep production fail-closed behavior for missing secrets.
- Preserve RLS and ownership boundaries.
- Vercel deployment protection/SSO protection must not be weakened for convenience.
- Local Supabase flow exists; Docker Desktop may need to be opened for local auth/testing.
- Durable recent migrations include IO hardening through `202605040001_post_draw_reminder_io_indexes.sql` and private group images through `202605070002_private_group_images.sql`.

## Files Not To Commit Unless Explicitly Asked

- `.agent` scratch screenshots/logs/SQL/mockups/pet experiments.
- `graphify-out/`.
- local Supabase dumps.
- secrets, `.env.local`, OAuth secrets, SMTP passwords, DB passwords, cookies, tokens.

## Older Snapshot Follows

# Secret Santa App Handoff - 2026-05-08

Project: `C:\Users\kenda\secret-santa-app`

## Read First

1. Read `AGENTS.md`.
2. Read `.agent/CONTINUITY.md`.
3. Read `.agent/BRANCH_WORKFLOW.md`.
4. Read `DESIGN.md`.
5. Read `PRODUCT.md`.
6. Run `git status --short --branch`.

## Current Git State

- Working branch at handoff: `dev`.
- Before writing this handoff note, status was clean: `## dev...origin/dev`.
- This handoff update itself modifies `.agent/CONTINUITY.md`.
- `.agent/NEXT_AGENT_HANDOFF.md` is ignored by `.gitignore`; use `git add -f` only if the user wants this handoff committed.
- `origin/dev`: `a47a203 Remove redundant dashboard greeting`.
- `origin/main`: `01dc047 Merge pull request #49 from raigedev/dev`.
- Local `main` may be stale behind `origin/main`; pull before switching/releasing.
- No open PRs were observed after PR #49 merged.

## Current Task

Continue frontend/product UI refinement in small verified slices.

Most recent work:
- Dashboard command-desk redesign was implemented and merged through PR #48.
- Redundant dashboard greeting was removed and merged through PR #49.
- Dashboard shell now keeps the personal greeting; dashboard body uses the functional heading `Exchange at a glance`.

Recommended next focus:
- Continue applying the softer transparent/section-like surface treatment across app screens without turning every section into a card.
- Keep dashboard useful and task-focused, not a generic card grid.
- Watch for user screenshots calling out clipped text, redundant sections, oversized pills, badly placed buttons, or privacy leaks.

## Non-Negotiable Routine

- Work on `dev` for local/preview changes.
- `main` is production and Vercel deploys from `main`.
- Before git/push/merge/deploy talk, run `git status --short --branch`.
- After the user says `done push` or `done pushing`, create or reuse a PR from `dev` to `main`, watch GitHub checks, and merge only when green and safe.
- Do not ask again for PR/merge permission after `done push`; this is the agreed routine.
- After code/config changes, run and fix:
  - `npm.cmd run check:problems`
  - `npm.cmd run typecheck`
  - `npm.cmd run lint:security`
  - `npm.cmd run build`
  - relevant Playwright tests
  - `git diff --check`
- If VS Code Problems shows a diagnostic, fix it automatically when safe. If `check:problems` misses it, update `scripts/check-vscode-problems.mjs` or the matching lint/cSpell/config rule.
- After UI/app-facing changes, start/reuse preview, render the affected route, and show a screenshot or exact URL in chat.
- Final answers after changes must include exact `git add`, `git commit`, and `git push` commands unless Codex already performed those actions.

## Design Direction

- Use Stitch first for meaningful UI design/redesign.
- Known Stitch project: `3072957204541081703`, title may show as `Process Explainer`.
- Figma is supporting when available; use exact node/screenshot context if provided.
- Also use `frontend-product-ui`, `DESIGN.md`, Taste/Impeccable skills, Oracle, browser preview, and Playwright.
- Overall app direction: warm polished Secret Santa product UI.
- Visual language: ivory/frost backgrounds, subtle green pattern, evergreen actions, Santa red accents, official Santa logo/face.
- `/secret-santa` Shopping Ideas remains a strong visual north star.
- Avoid generic SaaS card mosaics, neon/purple AI styling, noisy repeated cards, duplicated helper panels, backend jargon, and hidden privacy leaks.
- User likes transparent/soft panels that feel like sections instead of heavy cards.
- User wants previews embedded in chat, one by one when reviewing mockups.

## Product And Privacy Decisions

- `Wishlist` is `My Wishlist`.
- `Gift Tracking` is `Gift Progress`.
- `Assignments` is no longer primary nav; `/assignments` redirects to `/my-giftee`.
- `Reminders` conceptually belongs in Settings; `/reminders` remains legacy.
- `History` is for concluded/past exchanges.
- Shopping Ideas is for buying gifts for recipients with affiliate support; avoid `compare` wording.
- Region belongs with Santa helper/context, not as a random floating pill.
- Use one persistent Santa helper, not repeated helper panels.
- Owners/organizers must not be able to track/read member private chats.
- Member emails should not show in dashboard/member UI; use safe display names/codenames.
- Past events move to History; past wishlists should not remain mixed into active My Wishlist.
- Users can delete their own past wishlist items permanently from history.

## Major Work Completed In This Thread

- Reduced duplicate dashboard notification surfaces and notification noise.
- Cleaned leftover test/concluded groups (`tes`, `test`) and related scoped data from production Supabase after investigation; audit logs preserved.
- Refined `/secret-santa-chat` copy from wrap-up jargon to Secret Messages / My giftees / My Santa.
- Installed Scrapling official skill from `D4Vinci/Scrapling` under Codex skills when user requested it.
- Built local Supabase testing path; local testing needs Docker Desktop running.
- Configured local Google auth guidance; OAuth client secrets stay private in `.env.local`, never chat/docs.
- Investigated Supabase Disk I/O warnings; user restarted Supabase cloud; IO/performance migrations were applied and migration history repaired.
- Durable migration files include IO/perf hardening through `202605040001_post_draw_reminder_io_indexes.sql`.
- GitHub CLI was installed/authenticated by the user; PR workflow is now established.
- Old Copilot/stale branches/PRs were settled; long-lived branches are `dev` and `main`.
- README was professionalized.
- Supabase leaked password protection warning is a paid Supabase feature; on Free plan it cannot be fully enabled, so app password policy was hardened.
- Gmail SMTP was configured by the user in Supabase dashboard using `mysecretsanta.notifications@gmail.com`; do not store the app password in repo/chat.
- Branded invite email template was added.
- Login was redesigned with official Secret Santa/gift-tag theme.
- Gift progress labels and member table alignment/wrapping were repeatedly fixed.
- Owner chat activity tracking column was removed for privacy.
- Group member status stability and edit group modal/function were fixed.
- `/groups` is now the launcher/summary; `/group/[id]` is the full group workspace.
- Group cards/action buttons were refined.
- Create Group now supports picture upload.
- Group images were hardened to private `group-images` storage with owner/member RLS policies and signed URLs.
- Dashboard received a useful command-desk redesign and then had duplicate greeting removed.
- Experimental hatch-pet work for `Spark` was started then paused by user; leave `.agent/hatch-pet-*` scratch uncommitted unless asked.

## Supabase Notes

- GitHub/Vercel pushes do not apply database migrations.
- Before DB/schema/RLS/advisor changes, run `npx.cmd supabase migration list` and `npx.cmd supabase db push --dry-run` when credentials allow.
- Never run destructive production DB actions automatically.
- Safe scoped production DB verification/advisor SQL is allowed only after target/project/SQL are checked.
- Do not ask user to paste DB passwords or secrets in chat.
- Latest known cloud state after user restart: production Supabase was healthy enough for previous migrations; performance advisor had no remaining IO warnings after applied migrations.
- Latest durable migrations observed:
  - `202605030001_io_recovery_indexes.sql`
  - `202605030002_io_followup_indexes.sql`
  - `202605030003_rls_auth_uid_initplan_fix.sql`
  - `202605030004_affiliate_and_reminder_io_indexes.sql`
  - `202605030005_drop_duplicate_notifications_index.sql`
  - `202605040001_post_draw_reminder_io_indexes.sql`
  - `202605070001_group_picture_uploads.sql`
  - `202605070002_private_group_images.sql`

## Security Notes

- Always prioritize app security and privacy over convenience.
- Do not disable Vercel deployment protection/SSO protection to make preview easier.
- If Vercel preview shows 403, use the authenticated/protected workflow; do not weaken project protection.
- Preserve Supabase RLS and ownership boundaries.
- Never expose service-role keys to browser.
- Keep Lazada affiliate postback validation strict.
- Public redirects/click tracking are abuse-sensitive.
- Keep secrets out of screenshots, docs, logs, tests, and commits.
- Use PayloadsAllTheThings and repo-local `sqlmap` only for scoped defensive local/preview checks, not broad production scanning.

## Local Development

- Use `npm.cmd run dev` for app preview.
- Local app URL is usually `http://127.0.0.1:3000` or `http://localhost:3000`.
- Local Supabase Studio is usually around `http://127.0.0.1:54324`.
- If local auth/Supabase/Playwright is blocked, open/check Docker Desktop and start local Supabase; the user gave standing permission.
- Seeded local/Playwright credentials are in ignored `.env.local`; do not reveal passwords in chat.

## PR Workflow Commands

When user says they pushed:

```cmd
git status --short --branch
git fetch origin main dev --prune
gh pr list --head dev --base main --state open
gh pr create --base main --head dev --title "<title>" --body "<summary>"
gh pr checks <number> --watch --interval 10
gh pr merge <number> --merge
```

After merge, verify:

```cmd
gh pr view <number> --json state,mergedAt,mergeCommit,url
git fetch origin main dev --prune
git status --short --branch
```

Leave the workspace on `dev`.

## Latest Validation Highlights

For the last dashboard greeting cleanup:
- `npm.cmd run check:problems` passed.
- `npm.cmd run typecheck` passed.
- `npm.cmd run lint:security` passed.
- `npm.cmd run build` passed.
- Focused dashboard Playwright regressions passed.
- `git diff --check` passed.
- PR #49 checks passed: Validate, CodeQL, dependency review, Vercel, Vercel Preview Comments.

## Files Not To Commit Unless Explicitly Asked

- `.agent` scratch screenshots, logs, SQL experiments, mockup HTML, pet experiments, and archived docs.
- `graphify-out/`.
- Local Supabase dumps or schema scratch.
- Secrets, `.env.local`, SMTP passwords, OAuth client secrets, DB passwords, cookies, tokens.
