# My Secret Santa

My Secret Santa is a private gift-exchange web app for families, friends, and small teams. It helps people create Secret Santa groups, collect wishlists, reveal recipients, track gift progress, send private messages, and find gift ideas while keeping exchange details organized and confidential.

The app is built as a polished holiday planning tool: warm and friendly for participants, practical for group owners, and careful with authentication, ownership boundaries, reminders, affiliate links, and private user data.

## Core Features

- Create and manage Secret Santa exchange groups.
- Invite members and track participation.
- Collect participant wishlists and gift preferences.
- Reveal assigned recipients when the group is ready.
- Track gift progress before and after the exchange.
- Send private Secret Santa messages with role-aware context.
- View notifications, reminders, and event updates.
- Browse gift ideas with affiliate shopping support.
- Review past exchanges through the history experience.
- Provide owner-only affiliate reporting and operational views.

## Technology Stack

- Next.js 16 App Router
- React 19
- TypeScript in strict mode
- Tailwind CSS 4
- Supabase Auth and Postgres
- Vercel deployment and cron jobs
- Playwright end-to-end tests
- ESLint security checks, CodeQL, dependency review, and architecture audits

## Repository Structure

```text
app/                  Next.js routes, pages, route handlers, and app UI
app/components/       Shared UI components used across routes
lib/                  Server logic, Supabase helpers, affiliate logic, AI helpers, validation, and security utilities
utils/                Shared utilities that are not route-specific
scripts/              Local maintenance scripts and project diagnostics
tests/                Playwright, smoke, accessibility, and security-oriented tests
supabase/migrations/  Database schema, RLS, and performance migration files
docs/                 Architecture, deployment, testing, launch, and operational notes
.agent/               Agent handoff notes that future Codex sessions should read
```

## Branch Workflow

This repository uses two long-lived branches:

- `dev` is for local development, review, and preview work.
- `main` is production and is the branch Vercel deploys as the live app.

Before committing, pushing, merging, or discussing a deploy, check the active branch:

```cmd
git status
```

Daily development should happen on `dev`:

```cmd
git switch dev
```

Only merge to `main` when the change is ready for production. See [.agent/BRANCH_WORKFLOW.md](.agent/BRANCH_WORKFLOW.md) for the full workflow.

## Local Development

Install dependencies:

```cmd
npm.cmd install
```

Start the development server:

```cmd
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

For local Google OAuth testing, Supabase Auth redirect URLs should include:

```text
http://localhost:3000/**
http://127.0.0.1:3000/**
```

Keep real environment values in ignored local files or managed secret stores. Do not commit `.env` files.

## Quality Checks

Run the project diagnostics before handing off meaningful code or configuration changes:

```cmd
npm.cmd run check:problems
npm.cmd run typecheck
npm.cmd run lint:security
npm.cmd run build
```

Run focused Playwright tests for touched user flows:

```cmd
npm.cmd run test:e2e
```

Useful audits:

```cmd
npm.cmd run audit:security
npm.cmd run audit:architecture
npm.cmd run audit:unused
npm.cmd run audit:unused:production
npm.cmd run analyze:bundle
```

GitHub Actions run CI, CodeQL, and dependency review for pull requests. Pushes to `main` also run the production-branch checks.

## Deployment

Production deploys are handled by Vercel from the `main` branch.

High-level release flow:

1. Work locally on `dev`.
2. Run the required checks.
3. Push `dev`.
4. Open a pull request from `dev` to `main`.
5. Wait for GitHub and Vercel checks to pass.
6. Merge to `main` when the release is ready.
7. Verify the Vercel deployment.

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full deployment checklist, manual smoke test, cron notes, and rollback guidance.

## Security Notes

Never commit secrets, `.env` files, provider keys, Supabase service-role keys, Lazada credentials, webhook secrets, private logs, screenshots with sensitive data, or exported user data.

Security-sensitive areas include:

- Authentication and OAuth callback handling
- Supabase ownership and RLS boundaries
- Invites, assignments, wishlists, and private messages
- Affiliate redirects and Lazada postbacks
- Cron and reminder processing
- AI wishlist suggestions and external provider responses
- Owner-only reporting and operational views

Server-side checks are required for authorization-sensitive actions. UI-only checks are not security boundaries.

## Project Documentation

- [Architecture Notes](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOY.md)
- [Testing Guide](docs/TESTING.md)
- [Known Issues](docs/KNOWN_ISSUES.md)
- [Design System](DESIGN.md)
- [CSS Style Guide](styles/STYLEGUIDE.md)
- [Product Context](PRODUCT.md)
- [Agent Instructions](AGENTS.md)
- [Branch Workflow](.agent/BRANCH_WORKFLOW.md)
- [Tooling History](.agent/TOOLING_HISTORY.md)

## Project Status

This project is under active development. Product, UI, security, and database changes should stay small, reviewed, and verified through the documented checks before release.
