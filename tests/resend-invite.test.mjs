import assert from "node:assert/strict";
import test from "node:test";

import {
  canReceiveResentAuthInvite,
  isInviteStatusEligibleForResend,
} from "../lib/groups/resend-invite.mjs";

test("allows pending and declined invites to be resent", () => {
  assert.equal(isInviteStatusEligibleForResend("pending"), true);
  assert.equal(isInviteStatusEligibleForResend("declined"), true);
});

test("blocks resend after an invite is accepted", () => {
  assert.equal(isInviteStatusEligibleForResend("accepted"), false);
  assert.equal(isInviteStatusEligibleForResend("removed"), false);
});

test("allows another Auth invite email only for an unaccepted invited user", () => {
  assert.equal(
    canReceiveResentAuthInvite({
      email_confirmed_at: null,
      invited_at: "2026-07-11T12:00:00.000Z",
      last_sign_in_at: null,
    }),
    true
  );

  assert.equal(
    canReceiveResentAuthInvite({
      email_confirmed_at: "2026-07-11T12:05:00.000Z",
      invited_at: "2026-07-11T12:00:00.000Z",
      last_sign_in_at: null,
    }),
    false
  );

  assert.equal(
    canReceiveResentAuthInvite({
      email_confirmed_at: null,
      invited_at: null,
      last_sign_in_at: null,
    }),
    false
  );
});
