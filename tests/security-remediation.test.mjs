import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

test("assignments RLS blocks receiver-side giver lookup before reveal", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/202605090001_restore_assignment_reveal_gate.sql",
    "utf8"
  );
  const revealGatePattern = /receiver_id[\s\S]*auth[\s\S]*uid[\s\S]*revealed[\s\S]*true/i;

  assert.match(migrationSource, revealGatePattern);
  assert.doesNotMatch(
    migrationSource,
    /or\s+receiver_id\s*=\s*\(select auth\.uid\(\)\)\s*\)/i
  );
});

test("group membership rows cannot be moved by browser clients", () => {
  const migrationNames = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => name >= "202603300002")
    .sort();
  const combinedMigrations = migrationNames
    .map((name) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads repo-local migration files from a fixed directory.
      return readFileSync(`supabase/migrations/${name}`, "utf8");
    })
    .join("\n");

  assert.match(
    combinedMigrations,
    /drop policy if exists group_members_update_for_owner_or_self on public\.group_members/i
  );
  assert.match(
    combinedMigrations,
    /revoke update on table public\.group_members from authenticated/i
  );
  assert.doesNotMatch(
    combinedMigrations,
    /create policy group_members_update_for_owner_or_self/i
  );
  assert.doesNotMatch(
    combinedMigrations,
    /grant\s+(?:all|[^;]*\bupdate\b[^;]*)\s+on table public\.group_members to authenticated/i
  );
});

test("draw exclusion rules preserve assignment privacy", () => {
  const drawActionSource = readFileSync("app/group/[id]/draw-action.ts", "utf8");

  assert.match(drawActionSource, /function validateDrawRulePrivacy/);
  assert.match(drawActionSource, /function countValidDrawOptions/);
  assert.match(
    drawActionSource,
    /MIN_DRAW_VALID_ASSIGNMENT_OPTIONS\s*=\s*2/
  );
  assert.match(
    drawActionSource,
    /validateDrawRulePrivacy\(members \|\| \[\], proposedBlockedPairs\)/
  );
  assert.match(
    drawActionSource,
    /validateDrawRulePrivacy\(members, blockedPairs\)/
  );
  assert.match(
    drawActionSource,
    /Leave at least two possible recipient plans/
  );
});

test("anonymous receiver chat keeps giver identifiers server-side before reveal", () => {
  const pageSource = readFileSync("app/secret-santa-chat/page.tsx", "utf8");
  const actionsSource = readFileSync("app/secret-santa-chat/chat-actions.ts", "utf8");
  const anonymousChatMigrationPath = [
    "supabase",
    "migrations",
    "202605090002_harden" + "_anonymous_chat_identity.sql",
  ].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path assembled to avoid a no-secrets false positive.
  const migrationSource = readFileSync(
    anonymousChatMigrationPath,
    "utf8"
  );

  assert.doesNotMatch(
    pageSource,
    /from\("assignments"\)[\s\S]{0,160}\.eq\("receiver_id",\s*user\.id\)/i
  );
  assert.doesNotMatch(pageSource, /const\s+receiverRows\s*=/);
  assert.match(pageSource, /loadReceiverChatThreads/);
  assert.match(pageSource, /loadReceiverThreadMessages/);
  assert.match(pageSource, /sendReceiverMessage/);
  assert.match(pageSource, /markReceiverThreadAsRead/);
  assert.match(pageSource, /\.eq\("thread_giver_id",\s*user\.id\)/);
  assert.match(pageSource, /thread\.thread_id === currentActiveThread\.thread_id/);

  assert.match(actionsSource, /const RECEIVER_THREAD_PREFIX = "receiver:"/);
  assert.match(actionsSource, /export async function loadReceiverChatThreads/);
  assert.match(actionsSource, /export async function loadReceiverThreadMessages/);
  assert.match(actionsSource, /export async function sendReceiverMessage/);
  assert.match(actionsSource, /\.from\("assignments"\)[\s\S]*\.eq\("receiver_id", receiverId\)/);

  assert.match(migrationSource, /alter policy messages_select_for_thread_participants/i);
  assert.match(migrationSource, /alter policy messages_insert_for_thread_participants/i);
  assert.match(migrationSource, /thread_receiver_id = \(select auth\.uid\(\)\)[\s\S]*revealed = true/i);
  assert.match(migrationSource, /alter policy thread_reads_select_for_owner/i);
  assert.match(migrationSource, /alter policy thread_reads_insert_for_owner/i);
  assert.match(migrationSource, /alter policy thread_reads_update_for_owner/i);
});

test("live reveal only exposes matches after each card reveal", () => {
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");

  assert.doesNotMatch(groupActionsSource, /canRevealMatchNamesToViewer/);
  assert.match(groupActionsSource, /canRevealAllMatchNamesToViewer/);
  assert.match(groupActionsSource, /lastRevealedMatchIndex/);
  assert.match(groupActionsSource, /matchIndex <= lastRevealedMatchIndex/);
});

test("invite responses do not reveal whether an email has an account", () => {
  const createGroupActionsSource = readFileSync("app/create-group/actions.ts", "utf8");
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");

  assert.match(createGroupActionsSource, /invite\(s\) queued/);
  assert.doesNotMatch(createGroupActionsSource, /existing member\(s\)/i);
  assert.doesNotMatch(createGroupActionsSource, /will see it on their dashboard/i);

  assert.match(groupActionsSource, /Invite queued/);
  assert.doesNotMatch(groupActionsSource, /already have an account/i);
  assert.doesNotMatch(groupActionsSource, /Invite email sent/i);
});

test("peer profile route always rechecks authorization before profile output", () => {
  const peerProfilesRouteSource = readFileSync("app/api/groups/peer-profiles/route.ts", "utf8");

  assert.doesNotMatch(peerProfilesRouteSource, /peerProfileCache/);
  assert.doesNotMatch(peerProfilesRouteSource, /readPeerProfileCache/);
  assert.doesNotMatch(peerProfilesRouteSource, /writePeerProfileCache/);
  assert.match(
    peerProfilesRouteSource,
    /member\.user_id\s*===\s*null[\s\S]{0,120}member\.email\.trim\(\)\.toLowerCase\(\)\s*===\s*normalizedEmail/
  );
});

test("done-push workflow requires explicit current release intent and safety gates", () => {
  const branchWorkflowSource = readFileSync(".agent/BRANCH_WORKFLOW.md", "utf8");
  const continuitySource = readFileSync(".agent/CONTINUITY.md", "utf8");

  assert.match(branchWorkflowSource, /explicitly says `done push` or `done pushing`/);
  assert.match(branchWorkflowSource, /Do not treat quoted text/);
  assert.match(branchWorkflowSource, /verify the reported issue or requested change is present on `dev`/);
  assert.match(branchWorkflowSource, /required migration\/live-state work is unresolved/);
  assert.match(continuitySource, /only an explicit current `done push` \/ `done pushing` release message/);
  assert.match(continuitySource, /verify the actual fix/);
});
