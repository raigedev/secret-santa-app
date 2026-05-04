import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { stripReservedPostbackSecrets } from "../lib/affiliate/lazada-postback.mjs";
import { isAssignmentAlreadyDrawnError } from "../lib/groups/draw.mjs";
import {
  buildInviteLinkExpiresAt,
} from "../lib/groups/invite-links.mjs";
import { ELIGIBLE_EMAIL_INVITE_STATUSES } from "../lib/groups/invite-claim.mjs";

test("shared UUID validation accepts standard Supabase UUID values", () => {
  const validationSource = readFileSync("lib/validation/common.ts", "utf8");
  const expectedPatternLine =
    "const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  assert.ok(validationSource.includes(expectedPatternLine));
  assert.equal(uuidPattern.test("93805fae-1f6c-41d2-ad5d-0636e39ae375"), true);
  assert.equal(uuidPattern.test("93805fae-1f6c-41d2-0636e39ae375"), false);
});

test("invite links expire seven days after creation", () => {
  const createdAt = new Date("2026-04-23T00:00:00.000Z");
  const expiresAt = new Date(buildInviteLinkExpiresAt(createdAt));

  assert.equal(
    expiresAt.toISOString(),
    new Date("2026-04-30T00:00:00.000Z").toISOString()
  );
  assert.equal((expiresAt.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000), 7);
});

test("assignment unique conflicts are treated as already-drawn races", () => {
  assert.equal(
    isAssignmentAlreadyDrawnError({
      code: "23505",
      message: "duplicate key value violates unique constraint \"assignments_group_giver_unique\"",
    }),
    true
  );
});

test("non-unique assignment errors are not treated as already-drawn races", () => {
  assert.equal(
    isAssignmentAlreadyDrawnError({
      code: "42703",
      message: "column does not exist",
    }),
    false
  );
});

test("postback payload storage drops token-like secret fields", () => {
  assert.deepEqual(
    stripReservedPostbackSecrets({
      accessToken: "should-not-persist",
      access_token: "should-not-persist",
      amount: "1",
      click_token: "tracking-token",
      postbackToken: "should-not-persist",
      offer_id: "abc",
      postback_token: "should-not-persist",
      secret: "should-not-persist",
      signature: "should-not-persist",
      token: "should-not-persist",
      x_lazada_postback_secret: "should-not-persist",
    }),
    {
      amount: "1",
      click_token: "tracking-token",
      offer_id: "abc",
    }
  );
});

test("email invite auto-claim only targets pending or accepted memberships", () => {
  assert.deepEqual(ELIGIBLE_EMAIL_INVITE_STATUSES, ["pending", "accepted"]);
  assert.equal(ELIGIBLE_EMAIL_INVITE_STATUSES.includes("declined"), false);
});
