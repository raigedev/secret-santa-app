---
name: frontend-product-ui
description: Use this skill for frontend UI work in this Secret Santa app: redesigns, responsive fixes, visual polish, dashboard/app screens, landing/public pages, component layout, readability, motion, imagery, browser verification, or avoiding generic AI-looking UI.
---

# Frontend Product UI

Use this skill to make the app interface feel polished, useful, and consistent with the Secret Santa design system.

This skill is repo-specific. It adapts OpenAI's frontend guidance and Reddit field reports to this app's actual stack, design direction, and workflow.

## Core Workflow

1. Read `DESIGN.md` before changing UI.
2. Read the relevant route/component files and preserve existing behavior.
3. Define a short visual thesis before editing: mood, hierarchy, and main interaction.
4. Start from the user's screenshot, Stitch context, existing app shell, or current rendered screen.
5. Improve composition first: layout, spacing, hierarchy, contrast, scan path.
6. Use components/cards only when they help the workflow.
7. Keep app surfaces task-focused; avoid marketing-page heroes inside dashboards or tools.
8. Verify with the Codex App Browser or Playwright screenshots across useful viewports.
9. Check for overflow, clipping, unreadable text, redundant buttons, slow/blank loading transitions, and broken auth navigation.

## Project Fit

- Treat `/secret-santa` Shopping Ideas as the strongest current visual reference.
- Keep the shared authenticated shell calm, readable, and predictable.
- Use warm holiday personality through small details, not decorative clutter.
- Keep owner/admin/report surfaces utilitarian and secure.
- Keep shopping/affiliate UI provider-neutral and shopper-friendly.
- Avoid backend wording in UI copy.

## Design Rules

- Prefer one clear workspace, one navigation model, and one supporting context area.
- Use strong typography, spacing, and contrast before adding borders, shadows, gradients, or badges.
- Remove redundant controls when navigation already covers the action.
- Avoid nested cards and dashboard-card mosaics.
- Keep card treatment for repeated items, modals, product suggestions, notifications, and actual interactive units.
- Use sections, rows, dividers, tabs, segmented controls, and inspector panels when they fit better than more cards.
- Keep copy short and operational on app screens.
- Use imagery only when it does narrative or product work; decorative texture alone is not enough for public/marketing first viewports.
- Use motion to clarify state or affordance, not to decorate.

## Verification Loop

Use a real browser loop for meaningful UI work:

1. Start or reuse the local dev server.
2. Open the relevant route in the app browser when available.
3. Use Playwright screenshots if the app browser is unavailable or if viewport comparisons are needed.
4. Inspect desktop, tablet, and mobile widths for text clipping, horizontal overflow, overlapping controls, and unreadable contrast.
5. Run the repo checks required by `AGENTS.md` after source changes.

## Reference

For the detailed checklist, read `references/frontend-product-ui-checklist.md` when doing a non-trivial UI change.
