# Branch Workflow

This repo intentionally has two long-lived branches:

- `dev` is for local development, app preview checks, and work that is not ready for production.
- `main` is production and is the branch Vercel deploys as the live app.

## Default Rule

Before any commit, push, merge, deploy discussion, or confused Git moment, run:

```cmd
git status
```

If it shows:

```text
## dev...origin/dev
```

the workspace is on the development branch.

If it shows:

```text
## main...origin/main
```

the workspace is on the production branch. Slow down before pushing.

## Daily Development

Work and test on `dev`:

```cmd
git switch dev
npm.cmd run dev
```

Use local preview at:

```text
http://localhost:3000
```

After changes pass local checks, push only `dev`:

```cmd
git add <files>
git commit -m "Describe the change"
git push
```

After the user explicitly says `done push` or `done pushing` in the current repo release context, and only after confirming the user has just pushed `dev`, Codex must handle the PR workflow without waiting for another reminder:

```cmd
gh pr create --base main --head dev
```

Do not treat quoted text, old handoff notes, casual discussion of the phrase, or unrelated browser/UI copy as release authorization.

Then Codex should:

- Inspect the PR files and status checks.
- Inspect the actual diff/patch and verify the reported issue or requested change is present on `dev`.
- Run the required local validation for the change type before merge.
- For Supabase, RLS, schema, or security fixes, check migration state, dry-run remote migrations when credentials allow, apply reviewed migrations when appropriate, and verify the live policy/state or clearly stop with the blocker.
- Wait for CI, CodeQL, Dependency Review, and Vercel checks.
- Rerun obviously flaky failed jobs when appropriate.
- Merge the PR only when checks are green, the diff is safe, and no required operational step remains unresolved.
- Sync local `main` and `dev`, then leave the workspace on `dev`.
- Stop and explain before merging if checks fail for a real code issue, the diff contains risky production/database/security changes, required validation is missing, required migration/live-state work is unresolved, the branch is not clean, or the release intent is ambiguous.

## Releasing To Production

For manual releases, only merge `dev` into `main` when the user says the change is ready for the live Vercel app:

```cmd
git switch main
git pull
git merge dev
git push
```

That final push to `main` is the production deploy trigger.

## Agent Reminder

Future agents should help the user avoid accidental production pushes:

- Check `git status` before branch-sensitive work.
- Treat only an explicit current `done push` / `done pushing` release message as the trigger to create the `dev -> main` PR, watch checks, and merge after the safety gates above pass.
- Keep new work on `dev` unless the user explicitly asks for a production release.
- After every UI or app-facing fix/create task, render/open the affected route and show the preview or screenshot before finalizing.
- Explain that Vercel production follows `main`.
- Include exact commit and push commands in final responses after changes.
