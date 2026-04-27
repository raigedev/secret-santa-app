# Design System: My Secret Santa

## Overview

My Secret Santa is a warm, task-focused gift exchange app. The interface should feel festive but dependable: soft winter surfaces, confident red and evergreen actions, clear hierarchy, and compact workflows for repeated use.

Design register: product UI first, with light seasonal personality. Favor clarity, speed, and trust over decoration.

## Visual Theme

- Atmosphere: cozy, organized, friendly, and quietly premium.
- Density: balanced daily-app density. Dashboards, group pages, wishlists, settings, and affiliate tools should scan quickly without feeling cramped.
- Personality: festive details are allowed when they clarify the Secret Santa context, but they must not compete with forms, actions, status, or security-sensitive flows.
- Surfaces: use soft white, winter blue, ivory, and subtle green-tinted neutrals. Avoid one-note red, beige, or dark-blue screens.
- Product pages should feel like a polished app, not a marketing landing page.

## Colors

Use semantic color names in prompts and new components. Do not introduce a new dominant palette unless the whole screen is intentionally redesigned.

- **Canvas Frost** `#f8fbff`: default authenticated light page background.
- **Canvas Snow** `#f9faf8`: auth and public utility page background.
- **Surface White** `#fbfcfa`: elevated panels, cards, popovers, and form surfaces.
- **Pure Panel** `#ffffff`: primary panel fill when content needs maximum readability.
- **Ink Charcoal** `#2e3432`: primary text on light surfaces.
- **Ink Deep** `#171717`: high-contrast headings only.
- **Muted Slate** `#64748b`: secondary text, helper copy, and timestamps.
- **Quiet Border** `rgba(148,163,184,0.18)`: subtle structural borders.
- **Santa Red** `#a43c3f`: primary destructive-safe brand action, auth primary button, important links.
- **Santa Red Deep** `#812227`: hover and pressed state for red actions.
- **Ribbon Red** `#c71824`: high-emphasis gift-planning CTA.
- **Evergreen** `#48664e`: selected states, success-forward primary actions, shopping-option active state.
- **Evergreen Deep** `#3c5a43`: evergreen hover and pressed state.
- **Gift Gold** `#fcce72`: small highlights, badges, festive separators, and warm skeleton accents.
- **Winter Blue** `#186be8`: dashboard create/open actions and informational emphasis.
- **Midnight Canvas** `#08111f`: dark dashboard background.
- **Midnight Surface** `#0f172a`: dark panels and popovers.
- **Error Rose** `#b91c1c`: validation errors, failed states, and destructive warnings.

Color rules:
- Use red or evergreen as the main action color, not both at equal weight in the same local component.
- Gold is an accent, not a primary button color.
- Blue is for information and dashboard utilities, not the global brand color.
- Do not use neon glows, purple-blue hero gradients, pure black `#000000`, or pure white as a full-page background.
- Keep text contrast at WCAG AA or better.

## Typography

- App body: `Nunito`, fallback `system-ui, sans-serif`.
- App display: `Fredoka`, fallback `Nunito, system-ui, sans-serif`.
- Dense operational screens may use `Plus Jakarta Sans` for compact headings where already present.
- Use `Fredoka` for friendly page titles and brand moments only. Do not use it for dense table text, helper text, or form labels.
- Body text: 14-16px, line-height 1.5-1.7.
- Compact labels: 11-12px, uppercase only for metadata badges, with letter spacing no more than `0.18em`.
- Buttons: 14-16px, 700-900 weight depending on hierarchy.
- Avoid fluid viewport-based font sizing in app UI. Use fixed responsive breakpoints.
- Reserve hero-scale type for public landing sections or true page heroes.

## Spacing

Base spacing unit: 4px.

- **2xs**: 4px, tight icon-label gaps.
- **xs**: 8px, control internals and compact rows.
- **sm**: 12px, button gaps, small card padding.
- **md**: 16px, form field rhythm, section internals.
- **lg**: 24px, panel padding on mobile.
- **xl**: 32px, panel padding on desktop.
- **2xl**: 48px, major section separation.
- **3xl**: 64px, page-level rhythm on large desktop only.

Spacing rules:
- Keep mobile pages single-column with 16-24px side padding.
- Keep authenticated desktop shells constrained around `max-w-7xl` unless a full-width tool genuinely needs more space.
- Do not use equal spacing everywhere. Use tighter rhythm inside tools and more breathing room between major sections.

## Shape And Elevation

- Standard controls: 14-18px radius.
- Pills and compact chips: full radius.
- App panels: 24-32px radius when the surface is a major repeated card.
- Modals and popovers: 20-28px radius.
- Affiliate/shopping product cards: 20-28px radius, with stable media wells and no overlapping text chips.
- Avoid nested cards. If a panel already has elevation, inner groups should use borders, dividers, or tinted rows.

Elevation:
- Low: `0 8px 22px rgba(45,51,55,0.03)` for small cards.
- Medium: `0 14px 32px rgba(45,51,55,0.05)` for dashboard panels.
- High: `0 24px 70px rgba(148,163,184,0.14)` for overlays and prominent panels.
- Dark overlays may use stronger shadows, but avoid outer glow effects.

## Components

### Buttons

- Primary red: Santa Red or Ribbon Red fill, white text, rounded full, 44px minimum touch height.
- Primary evergreen: Evergreen fill, white or frost text, rounded full, 44px minimum touch height.
- Secondary: white or slate-50 surface with quiet border and dark text.
- Destructive: red text or red fill only when the action is genuinely destructive.
- Hover: translate up by 1-2px and deepen shadow slightly.
- Active: scale to `0.99` or translate down by 1px.
- Disabled: no transform, opacity 60-70%, cursor not allowed.
- Do not use text arrows like `->` for CTAs. Use an icon or a clear label.

### Forms

- Labels above inputs. Helper text below labels or below fields.
- Inputs use 14-18px radius or rounded-3xl depending on surrounding page style.
- Focus rings use Santa Red at low opacity or Evergreen for success-forward flows.
- Error messages are inline, plain-language, and placed near the field.
- Never show raw JSON or raw provider error objects to users.

### Cards And Panels

- Cards represent repeated items, summaries, product suggestions, notifications, or modal content.
- Page sections should not all become floating cards.
- Product cards must reserve fixed image/media areas so labels, price, and budget never overlap product images.
- Notification rows should work as list items with clear unread dots, timestamps, and concise body text.

### Navigation

- Dashboard top nav is sticky and calm.
- Notification access should prefer an in-place popover from the bell, with All and Unread filters.
- Settings/preferences belong in Profile, not in the notifications inbox.
- Preserve direct routes such as `/notifications` as fallbacks, but do not interrupt quick dashboard work with full page jumps when a popover is better.

### Loading And Empty States

- Use skeletons that match the final layout dimensions.
- Avoid generic centered spinners for full pages.
- Empty states should explain what will appear and offer one useful next action when appropriate.

### Affiliate And Shopping UI

- Shopping cards must use a uniform provider-neutral structure so Lazada, Shopee, and Amazon can share the same layout later.
- Use shopper-facing wording: shopping option, budget target, open in Lazada, browse similar items.
- Do not claim an exact product for search-style affiliate links until a provider report/postback maps the conversion.
- Affiliate disclosure should be short and visible without overwhelming the shopping flow.

## Layout

- Prefer predictable app layouts: top nav, side rail, main content, panels, tabs, segmented controls.
- Use CSS Grid for major layout composition. Use Flexbox for local alignment.
- Mobile below 768px collapses to a single column.
- No horizontal scroll on mobile.
- Fixed-format elements like boards, media wells, toolbar buttons, cards, and counters need stable dimensions.
- Sticky panels must have opaque backgrounds and clear stopping boundaries so content does not show through or overlap.
- Avoid decorative blobs/orbs as default backgrounds.

## Motion

- Motion should communicate state: opening a panel, selecting an option, hover affordance, loading, or saving.
- Most transitions should run 150-250ms.
- Animate `transform` and `opacity`, not layout properties.
- No bounce, elastic, or long choreographed page-load sequences.
- Respect reduced-motion preferences when adding new motion.

## Accessibility

- All interactive controls need visible focus states and accessible names.
- Buttons that toggle state need `aria-pressed` or equivalent state where useful.
- Popovers and menus need Escape and outside-click close behavior.
- Keep touch targets at least 44px.
- Do not rely on color alone for unread, selected, success, or error states.
- Use semantic HTML for forms, headings, lists, alerts, and navigation.

## Do

- Read this file before changing UI.
- Keep UI text plain and normal-user friendly.
- Match existing app patterns before adding a new component style.
- Use icons for compact tool actions where a standard icon exists.
- Test visual changes with Playwright or the Codex App Browser when practical.
- Keep security-sensitive UI calm, explicit, and predictable.

## Do Not

- Do not introduce a new design language for one screen.
- Do not make landing-page-style hero sections inside app workflows.
- Do not use nested cards, decorative glassmorphism, neon glows, or one-note purple/blue gradients.
- Do not hide important text behind truncation unless the full value is available nearby or via a natural detail view.
- Do not overlap badges, labels, prices, or controls on product images.
- Do not expose secrets, raw API errors, private user data, or affiliate tracking internals in UI.
- Do not copy third-party components without checking fit, accessibility, dependency cost, and license.
