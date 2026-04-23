# Test Case Matrix

This document lists route-by-route UI test scenarios for the current app surface. It is intended to guide Playwright expansion, manual Vercel verification, and regression reviews.

## Scope
- Public screens
- Auth and recovery screens
- Protected app screens
- Invite, group, draw, and affiliate-facing screens
- High-risk browser and edge-case behavior

## Test Data Assumptions
- `PLAYWRIGHT_E2E_EMAIL` and `PLAYWRIGHT_E2E_PASSWORD` point to a safe non-production account.
- Seeded data should include:
  - one owner account
  - one member account
  - one active group
  - one expired invite
  - one valid invite
  - one drawn group state and one pre-draw group state
  - wishlist items with and without direct Lazada matches
  - at least one affiliate report row

## Coverage Legend
- `Covered`: already exercised by current Playwright coverage
- `Partial`: some coverage exists, but key flows or edge cases are still missing
- `Gap`: not currently covered in automation

## Public Screens

### `/`
- Core scenarios:
  - Render the landing hero, metadata, and main CTA.
  - Navigate from landing to in-page sections.
  - Navigate from landing to `/login`.
  - Render cleanly on mobile.
- Edge cases:
  - Footer links remain readable and tappable on mobile.
  - Browser back/forward preserves the in-page anchor state.
  - Missing session should not leak protected content.
  - No console errors after hydration.
- Status: `Covered` for render/navigation/a11y/mobile, `Gap` for browser-history anchor behavior.

### `/login`
- Core scenarios:
  - Render the login screen and all auth controls.
  - Email/password validation for empty fields.
  - Google OAuth trigger is available.
  - `next` query value is preserved when moving to create-account.
- Edge cases:
  - Back-navigation after `Continue with Google` clears the redirect overlay.
  - Invalid `next` value falls back safely to `/dashboard`.
  - OAuth error query params render a friendly error.
  - Multiple rapid clicks do not create duplicate auth attempts.
  - Refresh while the overlay is visible should not leave the page stuck.
- Status: `Partial` for core render and validation, `Gap` for OAuth cancellation/back-navigation.

### `/create-account`
- Core scenarios:
  - Render all fields and the sign-up CTA.
  - Validate required name, valid email, and password length.
  - Successful submission shows the confirmation state.
  - `next` query survives through the signup flow.
- Edge cases:
  - Existing email shows the expected error.
  - SMTP / confirmation-email failure shows the fallback message.
  - Repeated submit clicks do not duplicate requests.
  - Refresh on the confirmation state behaves predictably.
  - Switching to login preserves the `next` path.
- Status: `Partial` for validation/render/mobile/a11y, `Gap` for success/error state coverage.

### `/forgot-password`
- Core scenarios:
  - Render the recovery screen and the `Send Reset Link` CTA.
  - Validate empty email submission.
  - Successful reset request shows the success state.
  - `Return to Login` navigates to `/login`.
- Edge cases:
  - Invalid email format should remain user-friendly.
  - Provider error returns a visible failure state.
  - Repeated clicks do not spam the endpoint.
  - Refresh after success does not leave stale UI in a broken state.
- Status: `Partial` for render/validation/mobile, `Gap` for success and provider-error coverage.

### `/reset-password`
- Core scenarios:
  - Render the reset-password screen.
  - Enforce the minimum password length.
  - Successful password update returns the user to sign-in.
- Edge cases:
  - Missing or expired reset token shows a fail-closed state.
  - Password confirmation mismatch shows a validation error.
  - Reused reset link is rejected.
  - Refresh during an in-progress reset does not mask errors.
- Status: `Partial` for route render and minimum-length validation, `Gap` for token and success flows.

## Protected Core Screens

### `/dashboard`
- Core scenarios:
  - Unauthenticated access redirects to `/login`.
  - Authenticated access loads the dashboard.
  - Dashboard reflects seeded groups and member role.
- Edge cases:
  - Empty state when the user has no groups.
  - Deleted or orphaned membership is handled safely.
  - Session expiry from an open tab returns the user to login.
- Status: `Partial` for unauthenticated redirect, `Gap` for authenticated dashboard behavior.

### `/create-group`
- Core scenarios:
  - Owner can create a new group with valid inputs.
  - Successful submission returns to the correct next screen.
  - Validation errors render cleanly.
- Edge cases:
  - Duplicate/blank names are rejected.
  - Invalid budget or date values are rejected.
  - Double-submit does not create duplicate groups.
  - Session expiry mid-submit fails closed.
- Status: `Gap`.

### `/wishlist`
- Core scenarios:
  - Render wishlist items for an authenticated user.
  - Add, edit, and delete wishlist entries.
  - Reflect persisted data after refresh.
- Edge cases:
  - Long titles/notes do not break layout.
  - Empty-state rendering is clear.
  - Unauthorized user cannot reach another user’s wishlist.
  - Duplicate rapid actions do not create conflicting entries.
- Status: `Gap`.

### `/notifications`
- Core scenarios:
  - Render the notifications screen.
  - Toggle or update notification preferences.
  - Persist settings across refresh.
- Edge cases:
  - Empty-state rendering is correct.
  - Partial backend failure shows an error instead of silent success.
  - Session expiry mid-save fails closed.
- Status: `Gap`.

### `/profile`
- Core scenarios:
  - Render the profile screen for an authenticated user.
  - Update supported profile fields.
  - Persist values after refresh.
- Edge cases:
  - Invalid avatar/file inputs fail cleanly if uploads exist.
  - Malformed profile values are rejected server-side.
  - Session expiry during save fails closed.
- Status: `Gap`.

## Secret Santa Flow Screens

### `/secret-santa`
- Core scenarios:
  - Render assignment details for the authenticated user.
  - Show wishlist context and Lazada recommendation panels.
  - Open direct Lazada and search-backed fallback links correctly.
  - Preserve affiliate attribution on click-through routes.
- Edge cases:
  - No assignment yet state.
  - No wishlist data state.
  - No Lazada match state.
  - Rate-limited or failed match request shows a clear fallback state.
  - Region mismatch or unsupported region fails safely.
  - Long product names and prices do not break mobile layout.
- Status: `Gap`.

### `/secret-santa-chat`
- Core scenarios:
  - Render the anonymous/private chat surface for a valid assignment.
  - Send and receive messages.
  - Refresh preserves the thread history.
- Edge cases:
  - Empty conversation state.
  - Very long messages wrap correctly.
  - Unauthorized participant cannot access another chat.
  - Network failure while sending shows an error and avoids duplicate sends.
- Status: `Gap`.

### `/group/[id]`
- Core scenarios:
  - Owner can view group details and member list.
  - Member can view their allowed group details.
  - Group data reflects current draw state.
- Edge cases:
  - Unauthorized group ID fails closed.
  - Missing group ID shows the error state.
  - Stale membership or removed member is handled cleanly.
  - Owner/member role differences are enforced in UI and backend.
- Status: `Gap`.

### `/group/[id]/reveal`
- Core scenarios:
  - Reveal screen renders only when reveal conditions are met.
  - Correct assignment is shown for the current user.
- Edge cases:
  - Access before reveal date or before draw is blocked.
  - Wrong member cannot access another reveal.
  - Missing assignment state is handled without leaking data.
- Status: `Gap`.

### `/invite/[token]`
- Core scenarios:
  - Valid invite renders the join flow.
  - Invalid/expired invite renders the unavailable state.
  - Joining with an authenticated user links the right group.
- Edge cases:
  - Reused invite token.
  - Invite for a removed/archived group.
  - Signed-out to signed-in transitions preserve the token flow.
  - Authenticated wrong-user attempts are handled safely.
- Status: `Partial` for invalid-token rendering, `Gap` for valid invite and join behavior.

## Report / Affiliate Screens

### `/dashboard/affiliate-report`
- Core scenarios:
  - Authorized owner can view affiliate report data.
  - Report filters and totals render correctly.
  - Empty report state is clear.
- Edge cases:
  - Non-owner access fails closed.
  - Missing report-access token/session fails closed.
  - Large result sets paginate or render safely.
  - Click and sale rows with missing metadata do not break the UI.
- Status: `Gap`.

## Cross-Screen Edge Cases

### Auth and session
- Expired session redirects protected screens back to `/login`.
- Returning from OAuth cancel/back does not leave loading overlays stuck.
- Invalid `next` values never allow open redirects.
- Browser refresh during pending auth actions does not leave unusable UI.

### Browser history and navigation
- Back/forward behavior works across landing -> login -> create-account -> login.
- Anchor navigation on the landing page survives back/forward cache restores.
- Browser back after form submission does not show misleading stale success state.

### Mobile and responsive
- All public auth screens remain usable at `390x844`.
- Long copy, errors, and success messages do not clip or overlap.
- CTA buttons remain visible without horizontal scrolling.

### Error handling
- Network failures produce visible user-facing errors.
- Server-side validation errors are not swallowed.
- Loading states always resolve back to interactive UI after cancellation or failure.

### Security-sensitive UI flows
- Unauthenticated access to protected screens always redirects.
- Non-owner access to owner-only screens fails closed.
- Affiliate redirect flows remain session-bound and do not expose unsafe redirect behavior.
- Invite and reveal routes do not leak data across users.

## Recommended Next Automation Order
1. Add login OAuth cancellation/back-navigation coverage.
2. Add forgot-password success/error state tests.
3. Add reset-password token and success-path coverage.
4. Unblock authenticated seeded-account coverage for dashboard/create-group/wishlist/profile/notifications.
5. Add Secret Santa assignment plus Lazada recommendation flow coverage.
6. Add invite token happy-path and owner/member authorization coverage.
