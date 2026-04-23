import assert from "node:assert/strict";
import test from "node:test";

import { hasDeclinedInviteResendTarget } from "../lib/groups/resend-invite.mjs";

test("allows resend when a declined invite matches the email", () => {
  assert.equal(
    hasDeclinedInviteResendTarget(
      [
        { email: "friend@example.com", status: "pending", user_id: null },
        { email: "friend@example.com", status: "declined", user_id: null },
      ],
      { email: "friend@example.com", existingUserId: null }
    ),
    true
  );
});

test("allows resend when a declined invite matches the existing user id", () => {
  assert.equal(
    hasDeclinedInviteResendTarget(
      [
        { email: "old@example.com", status: "declined", user_id: "user-123" },
        { email: "friend@example.com", status: "pending", user_id: null },
      ],
      { email: "friend@example.com", existingUserId: "user-123" }
    ),
    true
  );
});

test("blocks resend when no declined invite exists", () => {
  assert.equal(
    hasDeclinedInviteResendTarget(
      [
        { email: "friend@example.com", status: "pending", user_id: null },
        { email: "friend@example.com", status: "accepted", user_id: null },
      ],
      { email: "friend@example.com", existingUserId: null }
    ),
    false
  );
});
