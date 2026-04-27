# CSS And UI Style Guide

Root `DESIGN.md` is the design source of truth. This file covers day-to-day CSS and Tailwind hygiene.

## Tailwind Class Hygiene

- Prefer standard Tailwind scale classes when they express the same value as an arbitrary class.
- Use arbitrary values only when the exact value matters for layout, visual polish, or design tokens.
- Keep long arbitrary gradient classes rare and local to components that truly need them.
- Avoid Tailwind classes that VS Code suggests canonical replacements for, such as using `bg-size-[320px_320px]` instead of separate background-size arbitrary forms.
- Do not rely on truncation for important labels unless the full text is visible nearby or naturally available.

## Layout Rules

- Keep authenticated pages constrained around the app shell width unless a tool needs more room.
- Use CSS Grid for main page composition and Flexbox for local alignment.
- Avoid nested cards. Use dividers, tinted rows, or simple groups inside elevated panels.
- Sticky panels must have opaque backgrounds and a clear stop boundary.
- Product media wells need stable dimensions so labels, prices, and budget text never overlap images.

## Component Rules

- Buttons should be at least 44px tall for touch targets.
- Use icons for compact tool actions when a familiar icon exists.
- Use normal text labels for primary commands.
- Keep selected states visible through more than color when practical.
- Use semantic HTML for headings, forms, navigation, lists, and alerts.

## Motion

- Animate `transform` and `opacity`, not layout properties.
- Keep most transitions between 150ms and 250ms.
- Respect reduced-motion preferences for new motion.

## Checks

Run the VS Code Problems-style scanner after UI work:

```powershell
npm.cmd run check:problems
```

Use Playwright screenshots or the Codex App Browser to verify responsive UI changes.

