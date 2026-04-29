# Code Improvement Checklist

Use this checklist when improving the codebase.

## Maintainability

- Is the code easy to understand?
- Are names clear?
- Are components too large?
- Is logic repeated?
- Is business logic mixed into UI unnecessarily?
- Can repeated patterns become reusable components, hooks, utilities, or services?

## Duplicate Code

Refactor repeated:

- UI components
- layout wrappers
- form fields
- validation logic
- auth checks
- API calls
- Supabase queries
- permission checks
- realtime subscriptions
- date/currency formatting

Avoid abstraction when it makes the code harder to read.

## Performance

Check for:

- repeated data fetching
- repeated subscriptions
- unnecessary re-renders
- expensive render calculations
- large lists
- unoptimized images
- unnecessary client-side code
- duplicated imports
- oversized components

## Security

Check for:

- exposed secrets
- service role key leaks
- missing auth checks
- weak permission checks
- unsafe API routes
- unsafe redirects
- unsafe file uploads
- XSS
- SQL injection
- CSRF
- missing input validation
- sensitive logs
- Supabase RLS assumptions

## Responsive UI

Check at:

- 320px
- 375px
- 414px
- 768px
- 1024px
- 1280px
- 1440px+

Look for:

- horizontal overflow
- clipped content
- overlapping elements
- unreadable text
- cramped forms
- broken modals
- broken navbars
- fixed widths/heights
- images that overflow
- tables that do not fit

## Final Review

Before finishing:

- Run lint if available.
- Run build if available.
- Run tests if available.
- Run typecheck if available.
- Summarize changed files.
- Explain remaining risks honestly.
