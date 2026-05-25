# Security Policy

## Reporting Security Issues

Please report suspected security or privacy issues by emailing:

```text
mysecretsanta.notifications@gmail.com
```

Do not include secrets, passwords, private invite tokens, session cookies, or other people's personal data in the report. A short description, the affected page or route, and safe reproduction steps are enough.

## Safe Testing Rules

- Use accounts and groups that you own or created for testing.
- Do not attempt destructive testing, data extraction, social engineering, spam, denial-of-service, or attacks against third-party services.
- Do not modify, delete, or view another user's data.
- Stop testing and report the issue if you can cross an authorization boundary.

## Security Baseline

This app is built on Vercel and Supabase. The current baseline includes managed authentication, email verification gates, server-side authorization checks, Supabase Row Level Security, rate limiting, restrictive security headers, upload validation, dependency/security CI checks, and private server-side environment variables.

Before broad public launch, confirm the production domain uses HTTPS, Supabase backups are enabled and restore-tested, Vercel and GitHub alerts are monitored, and affiliate, email, AI, cron, and Supabase secrets are stored only in managed environment variables.
