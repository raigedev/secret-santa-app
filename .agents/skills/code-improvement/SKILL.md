---
name: code-improvement
description: Use this skill when the user asks to fix code, improve code quality, refactor duplicated code, optimize performance, review security, improve responsive design, clean architecture, or make changes safer and more maintainable. Do not use for unrelated writing tasks.
---

# Code Improvement Skill

Use this skill to improve the codebase like a careful senior developer.

The goal is not to rewrite everything. The goal is to make the smallest safe changes that improve correctness, maintainability, performance, security, and responsiveness.

## Core Rules

1. Inspect the project before changing code.
2. Understand the framework, routing, styling system, database layer, auth system, and build tools.
3. Preserve existing features and business logic.
4. Prefer small, reviewable changes.
5. Do not remove code unless it is clearly unused, duplicated, unsafe, or broken.
6. Do not add new dependencies unless there is a strong reason.
7. Do not expose secrets, service keys, tokens, or private environment variables.
8. Do not make destructive database changes unless the user explicitly asks.
9. After changes, run available validation commands.
10. Explain clearly what changed and why.

## First Steps Before Editing

Before making changes:

1. Read AGENTS.md if available.
2. Inspect package.json, framework config, route structure, components, utilities, hooks, API routes, and styling files.
3. Identify whether the project uses:
   - Next.js
   - React
   - Vite
   - Tailwind CSS
   - plain CSS or SCSS
   - Supabase
   - Firebase
   - Node/Express
   - React Native
   - Flutter
   - another stack
4. Find the user's exact target:
   - bug fix
   - duplicate code cleanup
   - UI improvement
   - responsive design
   - performance optimization
   - security hardening
   - architecture cleanup
   - build/lint/type error fix

If the user's request is broad, make the best safe improvement without asking unnecessary questions.

## Duplicate Code Rules

Remove duplicated code when it improves maintainability, consistency, or performance.

Good candidates for reusable code:

- Buttons
- Cards
- Modals
- Inputs
- Select fields
- Loading states
- Empty states
- Error messages
- Layout wrappers
- Dashboard layouts
- Auth checks
- Supabase helpers
- API request helpers
- Form validation
- Date formatting
- Currency formatting
- User permission checks
- Realtime subscription logic
- Database query logic

Do not over-engineer. If abstraction makes the code harder to understand, keep the code simple.

## Why Duplicate Code Matters

Duplicated UI code usually does not make the app slower by itself. It mainly makes the app harder to maintain.

Duplicated logic can make the app slower or buggy if it causes:

- repeated API calls
- repeated Supabase queries
- repeated auth checks
- repeated realtime subscriptions
- repeated expensive calculations
- inconsistent behavior between screens
- larger JavaScript bundles
- more unnecessary re-renders

When duplicate logic causes repeated work, refactor it into:

- shared components
- custom hooks
- utility functions
- service functions
- shared validation schemas
- shared query helpers

## Bug Fix Rules

When fixing bugs:

1. Reproduce or reason about the bug first.
2. Identify the root cause.
3. Prefer a focused fix instead of a broad rewrite.
4. Check nearby code for similar bugs.
5. Add or update tests if the project already has a test setup.
6. Avoid hiding errors with empty catch blocks or temporary hacks.

Never fix a symptom while leaving the root cause obvious and unresolved.

## Performance Improvement Rules

Look for:

- repeated database/API requests
- unnecessary useEffect calls
- unnecessary client components
- components doing too much work
- unnecessary re-renders
- expensive calculations inside render
- large lists without pagination or virtualization
- unoptimized images
- duplicated realtime channels
- large imports that can be split
- state stored too high in the component tree
- props changing unnecessarily
- repeated formatting or filtering on every render

Prefer:

- memoization only when useful
- moving repeated logic into hooks/utilities
- reducing unnecessary data fetching
- consolidating duplicated queries
- server-side fetching when appropriate
- optimized image usage
- pagination or lazy loading for large lists
- smaller components with clear responsibilities

Do not add premature optimization. Fix real risks or obvious inefficiencies.

## Security Improvement Rules

Review carefully for:

- exposed secrets
- service role keys in browser/client code
- missing auth checks
- broken access control
- insecure API routes
- insecure Supabase queries
- unsafe assumptions about Row Level Security
- user input not validated
- SQL injection
- XSS risk
- CSRF risk where applicable
- unsafe redirects
- insecure file uploads
- missing file type/size checks
- admin actions available to normal users
- invite links or tokens that are too permissive
- unsafe environment variable usage
- sensitive data shown in logs
- dependency or config risks

Never expose private environment variables to client-side code.

For Supabase projects:

- Do not use service role keys in the browser.
- Check that user-specific queries are scoped by user ID or permissions.
- Do not assume frontend checks are enough.
- Mention when RLS policy review is needed.
- Keep admin-only logic server-side.

## Responsive Design Rules

When improving UI, make screens work on:

- 320px mobile
- 375px mobile
- 414px mobile
- 768px tablet
- 1024px tablet/laptop
- 1280px desktop
- 1440px+ large desktop

Check for:

- horizontal overflow
- clipped content
- fixed widths that break mobile
- fixed heights that cut content
- overlapping text
- unreadable tables
- buttons too small for touch
- modals that overflow mobile screens
- navbars that do not collapse
- sidebars that block content
- images that do not scale
- cards that do not wrap
- forms that are too cramped
- text that does not wrap

Prefer:

- mobile-first layout
- responsive breakpoints
- flexible containers
- flexbox or grid
- min/max/clamp where useful
- wrapping text
- responsive spacing
- scrollable tables on small screens
- stacked layouts on mobile
- accessible touch targets

Preserve the visual design unless the existing design is causing the issue.

## Accessibility Improvement Rules

When touching UI, improve accessibility where practical:

- Use semantic HTML.
- Keep buttons as buttons and links as links.
- Add labels for inputs.
- Preserve keyboard navigation.
- Use alt text for meaningful images.
- Make focus states visible.
- Avoid color-only meaning.
- Check that disabled and loading states are understandable.

## Architecture Rules

Prefer clear architecture:

- components for UI
- hooks for reusable stateful logic
- utilities for pure functions
- services/helpers for API or database logic
- schemas/validators for validation
- constants for repeated config values

Avoid:

- huge components with unrelated responsibilities
- business logic copied into many components
- API/database logic scattered everywhere
- deeply nested conditionals when simple helpers would clarify
- magic strings repeated across the project

## Testing and Validation

After code changes, run available commands.

Check package.json first, then run relevant commands such as:

- npm run lint
- npm run build
- npm run test
- npm run typecheck
- pnpm lint
- pnpm build
- pnpm test
- pnpm typecheck

Use the package manager already used by the project.

If a command does not exist, say that clearly.

If a command fails, explain:

1. The command that failed.
2. The error summary.
3. Whether the failure was caused by your changes or appears pre-existing.
4. What still needs to be fixed.

## Change Strategy

Use this order:

1. Understand the code.
2. Identify the highest-value problem.
3. Make the smallest safe fix.
4. Remove harmful duplication if present.
5. Improve readability.
6. Check performance risks.
7. Check security risks.
8. Check responsive behavior if UI changed.
9. Run validation.
10. Summarize clearly.

## Final Response Format

After making code changes, respond with:

1. Summary of improvements.
2. Files changed.
3. Bugs fixed.
4. Duplicate code removed or improved.
5. Performance improvements or risks found.
6. Security improvements or risks found.
7. Responsive improvements or remaining UI risks.
8. Commands run and results.
9. Anything that still needs manual review.

Do not claim tests passed unless they were actually run.

If you could not run a command, say why.
