# Frontend Product UI Checklist

Use this checklist for non-trivial UI changes.

## Before Editing

- Read `DESIGN.md`.
- Inspect the current rendered screen when possible.
- Identify whether the screen is product UI, public/landing UI, shopping UI, admin/report UI, or auth UI.
- Name the primary user task for the screen.
- Note what must remain secure, authenticated, owner-only, or provider-neutral.

## Composition

- Is there one clear primary workspace?
- Is the navigation obvious without duplicate buttons?
- Can the page be understood by scanning headings, labels, and primary actions?
- Does every section have one job?
- Are cards actually needed, or would layout, rows, tabs, or dividers be cleaner?
- Are controls close to the content they affect?
- Does the first viewport reveal the most important task without feeling like a generic hero?

## App UI Rules

- Favor dense but readable information.
- Keep routine product UI calm: fewer colors, fewer borders, fewer decorative gradients.
- Use one clear accent for selected state or primary action.
- Keep admin/report screens practical and scannable.
- Remove buttons that duplicate sidebar or header navigation.
- Avoid walls of text; prefer grouped controls, tabs, lists, and direct labels.

## Shopping And Affiliate UI

- Use provider-neutral structure that can later support Lazada, Shopee, and Amazon.
- Use normal shopping language such as `shopping option`, `open in Lazada`, `budget target`, and `report`.
- Do not imply search-style links know the exact product before provider reporting maps the conversion.
- Keep affiliate disclosure visible but compact.
- Preserve owner-only report access and abuse-sensitive redirect behavior.

## Visual Quality

- Use contrast and spacing before decoration.
- Check text contrast on patterned or image backgrounds.
- Avoid nested cards, glassmorphism, neon glow, generic SaaS card grids, and cluttered badge clusters.
- Keep images stable, useful, and non-overlapping with text or price labels.
- Keep touch targets at least 44px.
- Do not use negative letter spacing or viewport-scaled font sizes in app UI.

## Responsive Checks

Check useful widths:

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
- buttons wrapping badly
- text hidden by sticky headers or panels
- fixed-height panels cutting content
- overlapping badges, images, prices, and controls
- sidebars blocking the workspace
- blank or dark transition screens

## Browser Verification

- Use the Codex App Browser when available.
- Use Playwright screenshots for viewport comparisons and visual regression checks.
- Confirm console errors are absent on changed screens.
- Add or update Playwright assertions for meaningful UI regressions.

## Source Lessons

- OpenAI frontend guidance emphasizes design-system constraints, visual references, content strategy, browser verification, restraint, readable hierarchy, and avoiding generic component piles.
- Reddit field reports consistently say skills alone are not enough; a real design system, browser loop, screenshots, Stitch/design references, and small iterative passes matter more.
- For this repo, `DESIGN.md`, the Shopping Ideas screen, Stitch when relevant, Playwright, and the shared app shell are the practical source of truth.
