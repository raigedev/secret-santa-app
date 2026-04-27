# My Secret Santa

Next.js App Router app for Secret Santa groups, wishlists, assignments, notifications, and affiliate shopping suggestions.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript strict mode
- Tailwind CSS 4
- Supabase auth and database
- Vercel deployment and cron jobs
- Playwright E2E tests

## Local Development

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

For local Google OAuth, Supabase Auth redirect URLs should include:

```text
http://localhost:3000/**
http://127.0.0.1:3000/**
```

## Checks

```powershell
npm.cmd run check:problems
npm.cmd run typecheck
npm.cmd run lint:security
npm.cmd run build
npm.cmd run test:e2e
```

Useful audits:

```powershell
npm.cmd run audit:unused
npm.cmd run analyze:bundle
```

## Project Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOY.md)
- [Known Issues](docs/KNOWN_ISSUES.md)
- [Design System](DESIGN.md)
- [CSS Style Guide](styles/STYLEGUIDE.md)
- [Agent Instructions](AGENTS.md)

## Security

Do not commit secrets, `.env` files, provider keys, Supabase service-role keys, Lazada credentials, webhook secrets, private logs, or screenshots containing sensitive data.

Security-sensitive routes include affiliate redirects, Lazada postbacks, cron/reminder processing, auth, invites, assignments, wishlist data, and owner-only reports.
