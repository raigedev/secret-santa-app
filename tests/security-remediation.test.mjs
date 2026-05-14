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

test("auth callback creates one-time welcome notifications", () => {
  const callbackSource = readFileSync("app/auth/callback/route.ts", "utf8");
  const notificationsSource = readFileSync("lib/notifications.ts", "utf8");
  const notificationDisplaySource = readFileSync(
    "app/notifications/notification-display.ts",
    "utf8"
  );

  assert.match(callbackSource, /import \{ createHash \} from "node:crypto";/);
  assert.match(callbackSource, /import \{ createNotification \} from "@\/lib\/notifications";/);
  assert.match(callbackSource, /const WELCOME_NOTIFICATION_TYPE = "welcome";/);
  assert.match(callbackSource, /const WELCOME_NOTIFICATION_ID_NAMESPACE = "secret-santa:welcome-notification";/);
  assert.match(callbackSource, /function buildWelcomeNotificationId\(userId: string\): string/);
  assert.match(callbackSource, /createHash\("sha256"\)/);
  assert.match(callbackSource, /async function createWelcomeNotificationIfNeeded\(userId: string\)/);
  assert.match(
    callbackSource,
    /await createNotification\(\{[\s\S]{0,160}id: buildWelcomeNotificationId\(userId\)[\s\S]{0,80}ignoreDuplicate: true[\s\S]{0,160}linkPath: "\/dashboard"[\s\S]{0,160}type: WELCOME_NOTIFICATION_TYPE[\s\S]{0,80}userId/
  );
  assert.match(callbackSource, /await createWelcomeNotificationIfNeeded\(user\.id\);/);
  assert.match(notificationsSource, /id\?: string;/);
  assert.match(notificationsSource, /const id = isUuid\(input\.id\) \? input\.id : undefined;/);
  assert.match(notificationsSource, /\.\.\.\(id \? \{ id \} : \{\}\)/);
  assert.match(
    notificationsSource,
    /if \(input\.ignoreDuplicate && error\.code === "23505"\) \{[\s\S]{0,80}return null;/
  );
  assert.match(notificationDisplaySource, /case "welcome":[\s\S]{0,40}return "Get Started";/);
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

test("countdown reveal keeps alias real names redacted", () => {
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");

  assert.doesNotMatch(groupActionsSource, /canRevealRealNamesToViewer/);
  assert.match(groupActionsSource, /canRevealAllRealNamesToViewer/);
  assert.match(groupActionsSource, /canRevealAliasRealNameToViewer/);
  assert.doesNotMatch(
    groupActionsSource,
    /normalizedSession\.status === "countdown"[\s\S]{0,180}realName/
  );
  assert.match(
    groupActionsSource,
    /aliasIndex === normalizedSession\.currentIndex && normalizedSession\.cardRevealed/
  );
});

test("hidden reveal match cards keep DOM labels redacted", () => {
  const revealPageSource = readFileSync("app/group/[id]/reveal/page.tsx", "utf8");

  assert.match(
    revealPageSource,
    /const activeMatchGiverLabel = revealedCard \? activeMatchGiver : "\?\?\?";/
  );
  assert.match(
    revealPageSource,
    /const activeMatchReceiverLabel = revealedCard \? activeMatchReceiver : "\?\?\?";/
  );
  assert.match(
    revealPageSource,
    /getRevealNameTextStyle\(activeMatchGiverLabel, "match"\)/
  );
  assert.match(
    revealPageSource,
    /getRevealNameTextStyle\(activeMatchReceiverLabel, "match"\)/
  );
  assert.doesNotMatch(revealPageSource, /title=\{activeMatchGiver\}/);
  assert.doesNotMatch(revealPageSource, /title=\{activeMatchReceiver\}/);
});

test("published reveal replay can reset the current card to hidden", () => {
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");
  const revealPageSource = readFileSync("app/group/[id]/reveal/page.tsx", "utf8");

  assert.match(groupActionsSource, /const storedCardRevealed = options\.session\?\.card_revealed;/);
  assert.doesNotMatch(groupActionsSource, /safeStatus === "published"\s*\?\s*true/);
  assert.match(
    groupActionsSource,
    /safeStatus === "published"\s*\?\s*storedCardRevealed !== false/
  );
  assert.match(revealPageSource, /updateRevealSessionState\(id, 0, false\)/);
  assert.match(revealPageSource, /Event presentation reset to the first hidden card\./);
});

test("reveal screen clears stale presentation after access failures", () => {
  const revealPageSource = readFileSync("app/group/[id]/reveal/page.tsx", "utf8");
  const failedLoadBranch =
    /if \(!result\.success \|\| !result\.data\) \{[\s\S]{0,260}setPresentation\(null\);[\s\S]{0,160}hasLoadedPresentationRef\.current = false;[\s\S]{0,260}setError\(result\.message \|\| "Failed to load the reveal screen\."\);/;

  assert.match(revealPageSource, failedLoadBranch);
  assert.doesNotMatch(revealPageSource, /background sync should preserve the current/i);
  assert.doesNotMatch(revealPageSource, /Failed to refresh the reveal screen/i);
});

test("gift prep status is only exposed through a server-side giver-scoped route", () => {
  const giftPrepMigrationPath = [
    "supabase",
    "migrations",
    "202605100002_protect_assignment" + "_gift_prep_columns.sql",
  ].join("/");
  const giftPrepGrantMigrationPath = [
    "supabase",
    "migrations",
    "20260511164421_restrict_gift_prep_rpc_execute.sql",
  ].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path assembled to avoid a no-secrets false positive.
  const migrationSource = readFileSync(giftPrepMigrationPath, "utf8");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path assembled to avoid a no-secrets false positive.
  const grantMigrationSource = readFileSync(giftPrepGrantMigrationPath, "utf8");
  const giftPrepRouteSource = readFileSync("app/api/assignments/gift-prep/route.ts", "utf8");
  const secretSantaPageSource = readFileSync("app/secret-santa/page.tsx", "utf8");
  const dashboardPageSource = readFileSync("app/dashboard/page.tsx", "utf8");
  const historyPageSource = readFileSync("app/history/page.tsx", "utf8");

  assert.match(migrationSource, /create or replace function public\.list_my_assignment_gift_prep/i);
  assert.match(migrationSource, /security definer/i);
  assert.match(migrationSource, /a\.giver_id = \(select auth\.uid\(\)\)/i);
  assert.match(migrationSource, /revoke select on table public\.assignments from authenticated/i);
  assert.match(migrationSource, /grant select \([\s\S]*gift_received[\s\S]*gift_received_at[\s\S]*\) on table public\.assignments to authenticated/i);
  assert.doesNotMatch(migrationSource, /grant select \([\s\S]*gift_prep_status/i);
  assert.match(
    grantMigrationSource,
    /revoke execute on function public\.list_my_assignment_gift_prep\(uuid\[\]\) from authenticated/i
  );
  assert.match(
    grantMigrationSource,
    /grant execute on function public\.list_my_assignment_gift_prep\(uuid\[\]\) to service_role/i
  );
  assert.match(giftPrepRouteSource, /isTrustedRequestOrigin\(request\)/);
  assert.match(giftPrepRouteSource, /supabase\.auth\.getUser\(\)/);
  assert.match(
    giftPrepRouteSource,
    /\.from\("assignments"\)[\s\S]{0,240}\.eq\("giver_id", user\.id\)/
  );
  assert.doesNotMatch(secretSantaPageSource, /rpc\("list_my_assignment_gift_prep"/);
  assert.doesNotMatch(dashboardPageSource, /rpc\("list_my_assignment_gift_prep"/);
  assert.doesNotMatch(historyPageSource, /rpc\("list_my_assignment_gift_prep"/);
  assert.match(secretSantaPageSource, /fetchMyAssignmentGiftPrep\(groupIds\)/);
  assert.match(dashboardPageSource, /fetchMyAssignmentGiftPrep\(acceptedGroupIds\)/);
  assert.match(historyPageSource, /fetchMyAssignmentGiftPrep\(historyGroupIds\)/);
  assert.doesNotMatch(
    `${secretSantaPageSource}\n${dashboardPageSource}\n${historyPageSource}`,
    /from\("assignments"\)[\s\S]{0,180}gift_prep_status/
  );
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
  assert.match(peerProfilesRouteSource, /function normalizeProfileAvatarUrl/);
  assert.match(peerProfilesRouteSource, /profile-avatars\/\$\{userId\}\//);
  assert.match(peerProfilesRouteSource, /normalizeProfileAvatarUrl\(profile\.user_id, profile\.avatar_url\)/);
  assert.match(
    peerProfilesRouteSource,
    /member\.user_id\s*===\s*null[\s\S]{0,120}member\.email\.trim\(\)\.toLowerCase\(\)\s*===\s*normalizedEmail/
  );
});

test("anonymous group RLS blocks peer membership identity table reads", () => {
  const anonymousMemberMigrationPath = [
    "supabase",
    "migrations",
    "202605090003_harden" + "_anonymous_group_member_select.sql",
  ].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path assembled to avoid a no-secrets false positive.
  const migrationSource = readFileSync(anonymousMemberMigrationPath, "utf8");
  const peerMemberReadGate =
    /private\.is_group_member\(group_id\)[\s\S]*require_anonymous_nickname[\s\S]*false/i;

  assert.match(migrationSource, /drop policy if exists group_members_select_visible_rows/i);
  assert.match(migrationSource, /create policy group_members_select_visible_rows/i);
  assert.match(migrationSource, /private\.is_group_owner\(group_id\)/);
  assert.match(migrationSource, /user_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.match(migrationSource, peerMemberReadGate);
  assert.doesNotMatch(
    migrationSource,
    /or\s+private\.is_group_member\(group_id\)\s*(?:\n|\r\n)*\s*or/i
  );
});

test("group member direct grants do not expose email to browser clients", () => {
  const memberGrantMigrationPath = [
    "supabase",
    "migrations",
    "20260511143512_harden" + "_group_member_email_grants.sql",
  ].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path assembled to avoid a no-secrets false positive.
  const memberGrantMigrationSource = readFileSync(
    memberGrantMigrationPath,
    "utf8"
  );
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");
  const groupPageSource = readFileSync("app/group/[id]/page.tsx", "utf8");
  const authenticatedGrant =
    memberGrantMigrationSource.match(
      /grant select \([\s\S]*?\) on table public\.group_members to authenticated;/i
    )?.[0] || "";

  assert.match(
    memberGrantMigrationSource,
    /revoke select on table public\.group_members from authenticated/i
  );
  assert.match(authenticatedGrant, /\bgroup_id\b/);
  assert.match(authenticatedGrant, /\bnickname\b/);
  assert.match(authenticatedGrant, /\bstatus\b/);
  assert.doesNotMatch(authenticatedGrant, /\bemail\b/);
  assert.match(groupActionsSource, /export async function getGroupMembersForViewer/);
  assert.match(
    groupActionsSource,
    /supabaseAdmin[\s\S]{0,180}\.select\("id, user_id, nickname, email, role, status"\)/
  );
  assert.doesNotMatch(
    groupPageSource,
    /\.from\("group_members"\)[\s\S]{0,160}\.select\("id, user_id, nickname, email/
  );
});

test("anonymous nickname checks compare against the caller profile name", () => {
  const dashboardActionsSource = readFileSync("app/dashboard/actions.ts", "utf8");
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");
  const invitePageSource = readFileSync("app/invite/[token]/page.tsx", "utf8");
  const profileQueryPattern =
    /\.from\("profiles"\)[\s\S]{0,180}\.select\("display_name"\)[\s\S]{0,180}\.eq\("user_id", user\.id\)/;
  const staleProfileIdPattern =
    /\.from\("profiles"\)[\s\S]{0,180}\.select\("display_name"\)[\s\S]{0,180}\.eq\("id", user\.id\)/;

  assert.match(dashboardActionsSource, profileQueryPattern);
  assert.match(groupActionsSource, profileQueryPattern);
  assert.match(invitePageSource, profileQueryPattern);
  assert.doesNotMatch(dashboardActionsSource, staleProfileIdPattern);
  assert.doesNotMatch(groupActionsSource, staleProfileIdPattern);
  assert.doesNotMatch(invitePageSource, staleProfileIdPattern);
});

test("create group action enforces email verification before privileged writes", () => {
  const createGroupActionsSource = readFileSync("app/create-group/actions.ts", "utf8");
  const verificationIndex = createGroupActionsSource.indexOf("isUserEmailVerified(user)");
  const rateLimitIndex = createGroupActionsSource.indexOf("enforceRateLimit({");
  const adminInsertIndex = createGroupActionsSource.indexOf(".from(\"groups\")");

  assert.match(createGroupActionsSource, /getEmailVerificationMessage/);
  assert.ok(verificationIndex > 0, "Expected create-group action to check email verification.");
  assert.ok(
    verificationIndex < rateLimitIndex,
    "Email verification should be checked before consuming create-group quota."
  );
  assert.ok(
    verificationIndex < adminInsertIndex,
    "Email verification should be checked before service-role group writes."
  );
});

test("wishlist item limit is enforced at the database boundary", () => {
  const wishlistLimitMigrationPath = [
    "supabase",
    "migrations",
    "202605090004_enforce" + "_wishlist_item_limit.sql",
  ].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path assembled to avoid a no-secrets false positive.
  const migrationSource = readFileSync(wishlistLimitMigrationPath, "utf8");
  const wishlistOptionsSource = readFileSync("lib/wishlist/options.ts", "utf8");

  assert.match(wishlistOptionsSource, /WISHLIST_ITEMS_PER_GROUP_LIMIT\s*=\s*3/);
  assert.match(migrationSource, /create or replace function private\.enforce_wishlist_item_limit/i);
  assert.match(migrationSource, /pg_advisory_xact_lock/i);
  assert.match(migrationSource, /hashtextextended/i);
  assert.match(migrationSource, /from public\.wishlists w[\s\S]*w\.group_id = new\.group_id[\s\S]*w\.user_id = new\.user_id/i);
  assert.match(migrationSource, /if item_count > 3 then/i);
  assert.match(
    migrationSource,
    /create trigger enforce_wishlist_item_limit_after_insert_or_move[\s\S]*after insert or update of group_id, user_id/i
  );
  assert.match(migrationSource, /alter policy wishlists_update_for_owner/i);
  assert.match(migrationSource, /private\.is_group_member\(group_id\)/);
});

test("secret santa shopping does not auto-load recipient supplied wishlist images", () => {
  const secretSantaPageSource = readFileSync("app/secret-santa/page.tsx", "utf8");

  assert.doesNotMatch(secretSantaPageSource, /item_image_url/);
  assert.doesNotMatch(secretSantaPageSource, /safeItemImageUrl/);
  assert.doesNotMatch(secretSantaPageSource, /input\.wishlistItem\.item_image_url/);
  assert.match(
    secretSantaPageSource,
    /const resolvedWishlistImageUrl = wishlistMatchedImageUrl;/
  );
});

test("secret santa gift day banner requires a near assigned giftee", () => {
  const secretSantaPageSource = readFileSync("app/secret-santa/page.tsx", "utf8");

  assert.match(secretSantaPageSource, /const giftDayReminderCopy = getGiftDayReminderCopy\(primaryAssignment\);/);
  assert.match(
    secretSantaPageSource,
    /daysUntilEvent === null \|\|[\s\S]*daysUntilEvent < 0 \|\|[\s\S]*daysUntilEvent > GIFT_DAY_REMINDER_WINDOW_DAYS/
  );
  assert.match(secretSantaPageSource, /\{isShoppingMode && giftDayReminderCopy && \(/);
  assert.doesNotMatch(secretSantaPageSource, /\{isShoppingMode && \(\s*<section[\s\S]*Gift day is close/);
});

test("lazada match route skips unused fallback feed scans when direct matches exist", () => {
  const lazadaMatchesRouteSource = readFileSync(
    "app/api/affiliate/lazada/matches/route.ts",
    "utf8"
  );

  assert.match(
    lazadaMatchesRouteSource,
    /if\s*\(\s*directProducts\.length\s*>\s*0\s*\)\s*{[\s\S]{0,220}return NextResponse\.json/
  );
  assert.doesNotMatch(lazadaMatchesRouteSource, /const\s+fallbackProducts\s*=/);
});

test("affiliate redirect rate limits do not trust spoofed client IP headers", () => {
  const redirectRouteSource = readFileSync("lib/affiliate/redirect-route.ts", "utf8");

  assert.doesNotMatch(redirectRouteSource, /extractRequestClientIp/);
  assert.match(
    redirectRouteSource,
    /subject:\s*`\$\{rateLimitSubjectPrefix\}:\$\{user\.id\}`/
  );
  assert.doesNotMatch(redirectRouteSource, /x-forwarded-for|cf-connecting-ip|x-real-ip/i);
});

test("lazada promotion redirect targets are allowlisted", () => {
  const lazadaUrlSource = readFileSync("lib/affiliate/lazada-url.ts", "utf8");
  const lazadaSource = readFileSync("lib/affiliate/lazada.ts", "utf8");

  assert.match(lazadaUrlSource, /export function normalizeLazadaPromotionLinkUrl/);
  assert.match(lazadaUrlSource, /isLazadaPromotionShortLinkHostname\(parsed\.hostname\)/);
  assert.match(lazadaUrlSource, /isLazadaHostname\(parsed\.hostname\)[\s\S]*isLazadaProductPath\(parsed\.pathname\)/);
  assert.match(lazadaSource, /function buildSafeLazadaPromotionLinkTarget/);
  assert.match(lazadaSource, /normalizeLazadaPromotionLinkUrl\(targetUrl\)/);
  assert.doesNotMatch(lazadaSource, /targetUrl:\s*appendLazadaSubIdsToPromotionLink/);
});

test("lazada prime-links route rate limits and constrains product IDs", () => {
  const primeLinksRouteSource = readFileSync(
    "app/api/affiliate/lazada/prime-links/route.ts",
    "utf8"
  );

  assert.match(primeLinksRouteSource, /requireAuthenticatedAffiliateRoute/);
  assert.match(primeLinksRouteSource, /action:\s*"affiliate\.lazada\.prime_links"/);
  assert.match(primeLinksRouteSource, /maxAttempts:\s*60/);
  assert.match(
    primeLinksRouteSource,
    /LAZADA_PRODUCT_ID_PATTERN\s*=\s*\/\^\[0-9\]\{1,20\}\$\/;/
  );
  assert.match(
    primeLinksRouteSource,
    /\.filter\(\(productId\)\s*=>\s*LAZADA_PRODUCT_ID_PATTERN\.test\(productId\)\)/
  );
  assert.doesNotMatch(primeLinksRouteSource, /extractRequestClientIp|x-forwarded-for|cf-connecting-ip|x-real-ip/i);
});

test("lazada match route requires access to the wishlist item before matching or priming", () => {
  const lazadaMatchesRouteSource = readFileSync(
    "app/api/affiliate/lazada/matches/route.ts",
    "utf8"
  );
  const accessCheckIndex = lazadaMatchesRouteSource.indexOf("canAccessRecipientWishlistItem");
  const feedMatchIndex = lazadaMatchesRouteSource.indexOf("findBestLazadaFeedMatches({");
  const primingIndex = lazadaMatchesRouteSource.indexOf("primeLazadaPromotionLinks({");

  assert.match(lazadaMatchesRouteSource, /canAccessRecipientWishlistItem/);
  assert.match(lazadaMatchesRouteSource, /userId:\s*auth\.userId/);
  assert.match(lazadaMatchesRouteSource, /status:\s*403/);
  assert.ok(
    accessCheckIndex > 0 && accessCheckIndex < feedMatchIndex,
    "Wishlist access must be checked before feed matching."
  );
  assert.ok(
    accessCheckIndex < primingIndex,
    "Wishlist access must be checked before Lazada promotion-link priming."
  );
});

test("password reset links are not rewritten by OAuth code fallback", () => {
  const proxySource = readFileSync("proxy.ts", "utf8");

  assert.match(proxySource, /req\.nextUrl\.pathname === "\/"/);
  assert.doesNotMatch(proxySource, /if\s*\(\s*hasOAuthCode\s*&&\s*!isCallbackRoute\s*\)/);
  assert.match(proxySource, /"\/reset-password"/);
});

test("owners do not receive unrevealed assignment names from reveal presentation", () => {
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");

  assert.doesNotMatch(
    groupActionsSource,
    /const canRevealAllRealNamesToViewer =\s*isOwner\s*\|\|/
  );
  assert.doesNotMatch(
    groupActionsSource,
    /const canRevealAllMatchNamesToViewer =\s*isOwner\s*\|\|/
  );
  assert.match(groupActionsSource, /canPreviewBeforeReveal:\s*false/);
  assert.match(groupActionsSource, /select\("owner_id, revealed, name, event_date"\)/);
  assert.match(groupActionsSource, /isRevealDateReady\(group\.event_date\)/);
  assert.match(groupActionsSource, /sourceData\.assignments\.length === 0/);
});

test("group detail page limits member data and avoids sensitive realtime rows", () => {
  const groupPageSource = readFileSync("app/group/[id]/page.tsx", "utf8");
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");

  assert.match(groupPageSource, /getGroupMembersForViewer\(id\)/);
  assert.match(groupActionsSource, /\.select\("id, user_id, nickname, role, status"\)/);
  assert.match(groupActionsSource, /\.eq\("status", "accepted"\)/);
  assert.match(groupPageSource, /email:\s*isCurrentUserOwner \? member\.email \|\| null : null/);
  assert.doesNotMatch(groupPageSource, /table:\s*"assignments"/);
  assert.doesNotMatch(groupPageSource, /group-\$\{id\}-realtime/);
});

test("group detail clears stale owner insights before applying fresh group data", () => {
  const groupPageSource = readFileSync("app/group/[id]/page.tsx", "utf8");
  const freshGroupApplyBlock = groupPageSource.match(
    /setError\(null\);[\s\S]*?setMembers\(safeMembers\);/
  )?.[0];

  assert.ok(freshGroupApplyBlock, "Expected fresh group data apply block to be present.");
  assert.match(freshGroupApplyBlock, /setOwnerInsights\(null\);/);
  assert.ok(
    freshGroupApplyBlock.indexOf("setOwnerInsights(null);") <
      freshGroupApplyBlock.indexOf("setGroupData(group);"),
    "Owner insights must clear before fresh group data can render."
  );
  assert.match(
    groupPageSource,
    /wishlistReadinessLoaded=\{!isOwner \|\| Boolean\(ownerInsights\)\}/
  );
});

test("dashboard shows email invites without auto-claiming memberships", () => {
  const dashboardPageSource = readFileSync("app/dashboard/page.tsx", "utf8");
  const dashboardGroupsDataSource = readFileSync("app/dashboard/dashboard-groups-data.ts", "utf8");
  const dashboardActionsSource = readFileSync("app/dashboard/actions.ts", "utf8");
  const dashboardLayoutSource = readFileSync("app/dashboard/layout.tsx", "utf8");

  assert.match(dashboardActionsSource, /export async function getPendingEmailInvites/);
  assert.match(dashboardActionsSource, /\.is\("user_id", null\)/);
  assert.match(dashboardActionsSource, /\.eq\("status", "pending"\)/);
  assert.doesNotMatch(dashboardActionsSource, /claimInvitedMemberships/);
  assert.match(dashboardPageSource, /getPendingEmailInvites\(\)/);
  assert.doesNotMatch(dashboardPageSource, /claimInvitedMemberships\(/);
  assert.doesNotMatch(dashboardPageSource, /ss_mc/);
  assert.match(dashboardPageSource, /\.select\("group_id, user_id, nickname, role"\)/);
  assert.match(dashboardGroupsDataSource, /\.select\("group_id, user_id, nickname, role"\)/);
  assert.doesNotMatch(dashboardPageSource, /\.select\("group_id, user_id, nickname, email, role"\)/);
  assert.match(dashboardLayoutSource, /supabase\.auth\.getUser\(\)/);
  assert.match(dashboardLayoutSource, /redirect\("\/login"\)/);
});

test("client profile and snapshot storage are scoped or cleared on logout", () => {
  const viewerProfileSource = readFileSync("app/components/viewer-profile-client.ts", "utf8");
  const clientSnapshotSource = readFileSync("lib/client-snapshot.ts", "utf8");
  const dashboardSnapshotSource = readFileSync("app/dashboard/dashboard-snapshot.ts", "utf8");
  const groupPageStateSource = readFileSync("app/group/[id]/group-page-state.ts", "utf8");
  const affiliateReportAccessSource = readFileSync(
    "app/components/affiliate-report-access-client.ts",
    "utf8"
  );
  const santaAssistantSource = readFileSync("app/hooks/useSantaAssistant.ts", "utf8");
  const appShellSource = readFileSync("app/components/AppRouteShell.tsx", "utf8");

  assert.match(viewerProfileSource, /VIEWER_PROFILE_STORAGE_PREFIX = "ss_viewer_profile_v2:"/);
  assert.match(viewerProfileSource, /getViewerProfileStorageKey\(userId/);
  assert.doesNotMatch(viewerProfileSource, /sessionStorage\.getItem\(VIEWER_NAME_STORAGE_KEY\)/);
  assert.match(clientSnapshotSource, /function getSessionStorage\(\)/);
  assert.match(clientSnapshotSource, /function getLocalStorage\(\)/);
  assert.match(clientSnapshotSource, /export function readSessionStorageItem/);
  assert.match(clientSnapshotSource, /export function writeSessionStorageItem/);
  assert.match(clientSnapshotSource, /export function readLocalStorageItem/);
  assert.match(clientSnapshotSource, /export function writeLocalStorageItem/);
  assert.match(dashboardSnapshotSource, /readSessionStorageItem\(storageKey\)/);
  assert.match(groupPageStateSource, /readSessionStorageItem\(storageKey\)/);
  assert.match(affiliateReportAccessSource, /readSessionStorageItem\(AFFILIATE_REPORT_ACCESS_STORAGE_KEY\)/);
  assert.match(santaAssistantSource, /readLocalStorageItem\(HIDDEN_STORAGE_KEY\)/);
  assert.match(clientSnapshotSource, /export function clearAppSessionStorage/);
  assert.match(appShellSource, /clearAppSessionStorage\(\);[\s\S]{0,80}supabase\.auth\.signOut/);
});

test("affiliate report maps conversions by click token as well as click id", () => {
  const reportSource = readFileSync("app/dashboard/affiliate-report/page.tsx", "utf8");

  assert.match(reportSource, /click_token: string \| null/);
  assert.match(reportSource, /const conversionsByClickToken = new Map/);
  assert.match(reportSource, /\.in\("click_token", clickTokens\)/);
  assert.match(reportSource, /conversionsByClickToken\.get\(clickToken\)/);
});

test("profile avatar urls and affiliate merchant constraints are hardened in migrations", () => {
  const migrationPath = [
    "supabase",
    "migrations",
    "202605100001_harden_profile_avatar" + "_and_affiliate_merchants.sql",
  ].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path assembled to avoid a no-secrets false positive.
  const migrationSource = readFileSync(
    migrationPath,
    "utf8"
  );

  assert.match(migrationSource, /profiles_avatar_url_storage_owner_check/);
  assert.match(migrationSource, /profile-avatars\/'\s*\|\|\s*user_id::text/i);
  assert.match(migrationSource, /affiliate_clicks_merchant_check/);
  assert.match(migrationSource, /merchant in \('amazon', 'lazada', 'shopee'\)/);
  assert.match(migrationSource, /affiliate_conversions_merchant_check/);
  assert.match(migrationSource, /drop policy if exists group_draw_cycle_pairs_select_for_owner/i);
  assert.match(migrationSource, /revoke select on table public\.group_draw_cycle_pairs from authenticated/i);
});

test("lazada cards avoid untrusted remote image hosts and private redirect notes", () => {
  const lazadaUrlSource = readFileSync("lib/affiliate/lazada-url.ts", "utf8");
  const secretSantaPageSource = readFileSync("app/secret-santa/page.tsx", "utf8");
  const suggestionSource = readFileSync("lib/wishlist/suggestions.ts", "utf8");
  const redirectSource = readFileSync("app/go/suggestion/route.ts", "utf8");

  assert.match(lazadaUrlSource, /export function normalizeTrustedLazadaImageUrl/);
  assert.match(
    secretSantaPageSource,
    /const heroLazadaImageUrl = normalizeTrustedLazadaImageUrl\(/
  );
  assert.doesNotMatch(
    secretSantaPageSource,
    /const heroLazadaImageUrl = normalizeOptionalUrl\(/
  );
  assert.match(secretSantaPageSource, /normalizeTrustedLazadaImageUrl\(product\.imageUrl/);
  assert.match(secretSantaPageSource, /referrerPolicy="no-referrer"/);
  assert.doesNotMatch(suggestionSource, /params\.set\("itemNote"/);
  assert.doesNotMatch(suggestionSource, /params\.set\("preferredPrice/);
  assert.match(redirectSource, /const itemNote = "";/);
});

test("affiliate search templates are constrained to expected merchant hosts", () => {
  const suggestionSource = readFileSync("lib/wishlist/suggestions.ts", "utf8");

  assert.match(suggestionSource, /const AFFILIATE_DESTINATION_HOSTS/);
  assert.match(suggestionSource, /amazon\.com/);
  assert.match(suggestionSource, /shopee\.ph/);
  assert.match(suggestionSource, /shope\.ee/);
  assert.match(suggestionSource, /s\.shopee\.ph/);
  assert.match(suggestionSource, /lazada\.com\.ph/);
  assert.match(suggestionSource, /SHOPEE_AFFILIATE_LINK_TEMPLATE/);
  assert.match(suggestionSource, /function isAllowedMerchantDestinationUrl/);
  assert.match(suggestionSource, /parsed\.protocol === "https:"/);
  assert.match(suggestionSource, /return isAllowedMerchantDestinationUrl\(merchant, destinationUrl\)/);
});

test("wishlist AI provider calls exclude private item notes", () => {
  const aiSuggestionsSource = readFileSync("app/api/ai/wishlist-suggestions/route.ts", "utf8");

  assert.match(aiSuggestionsSource, /function buildProviderSuggestionInput/);
  assert.match(aiSuggestionsSource, /itemNote:\s*""/);
  assert.match(
    aiSuggestionsSource,
    /const providerBaseOptions = buildWishlistSuggestionOptions\(providerSuggestionInput\)/
  );
  assert.match(
    aiSuggestionsSource,
    /generateWishlistSuggestionDrafts\(\{[\s\S]{0,160}suggestionInput: providerSuggestionInput/
  );
  assert.match(
    aiSuggestionsSource,
    /buildAiWishlistSuggestionOptions\(providerSuggestionInput, aiDrafts\)/
  );
});

test("lazada postback setup keeps auth material out of URL query strings", () => {
  const lazadaPostbackSource = readFileSync("app/api/affiliate/lazada/postback/route.ts", "utf8");
  const affiliateReportSource = readFileSync("app/dashboard/affiliate-report/page.tsx", "utf8");

  assert.match(lazadaPostbackSource, /const URL_POSTBACK_AUTH_PARAM_KEYS = new Set/);
  assert.match(lazadaPostbackSource, /stripUrlPostbackAuthParams/);
  assert.match(
    lazadaPostbackSource,
    /request\.headers\.get\("x-lazada-postback-secret"\)[\s\S]{0,140}getFirstPayloadValue\(payload, \["token", "secret"\]\)/
  );
  assert.match(affiliateReportSource, /const path = "\/api\/affiliate\/lazada\/postback";/);
  assert.doesNotMatch(affiliateReportSource, /postback\?token/);
});

test("client snapshots do not restore assignment data after resets", () => {
  const secretSantaPageSource = readFileSync("app/secret-santa/page.tsx", "utf8");
  const groupPageSource = readFileSync("app/group/[id]/page.tsx", "utf8");
  const groupPageStateSource = readFileSync("app/group/[id]/group-page-state.ts", "utf8");

  assert.match(secretSantaPageSource, /value\.assignments\.length === 0/);
  assert.match(secretSantaPageSource, /value\.receivedGifts\.length === 0/);
  assert.match(secretSantaPageSource, /setAssignments\(\[\]\)/);
  assert.match(secretSantaPageSource, /assignments:\s*\[\]/);
  assert.match(secretSantaPageSource, /receivedGifts:\s*\[\]/);
  assert.match(groupPageSource, /setAssignment\(null\)/);
  assert.match(groupPageSource, /assignment:\s*null/);
  assert.match(groupPageStateSource, /value\.drawDone === false/);
  assert.match(groupPageStateSource, /value\.assignment === null/);
});

test("secret santa chat keeps a broader message window for unread state", () => {
  const chatPageSource = readFileSync("app/secret-santa-chat/page.tsx", "utf8");
  const chatActionsSource = readFileSync("app/secret-santa-chat/chat-actions.ts", "utf8");

  assert.match(chatPageSource, /CHAT_THREAD_MESSAGE_SCAN_LIMIT = 1000/);
  assert.match(chatPageSource, /CHAT_ACTIVE_THREAD_MESSAGE_LIMIT = 250/);
  assert.match(chatActionsSource, /CHAT_THREAD_MESSAGE_SCAN_LIMIT = 1000/);
  assert.match(chatActionsSource, /CHAT_ACTIVE_THREAD_MESSAGE_LIMIT = 250/);
});

test("sqlmap guidance does not trust ignored local tooling by default", () => {
  const agentsSource = readFileSync("AGENTS.md", "utf8");

  assert.doesNotMatch(agentsSource, /Use the repo-local `sqlmap` install automatically/);
  assert.match(agentsSource, /Use `sqlmap` only after the tool source is reviewed or verified/);
  assert.match(
    agentsSource,
    /Do not execute the ignored `\.agent\/tools\/sqlmap\/sqlmap\.py` path automatically/
  );
  assert.match(agentsSource, /prefer a reviewed pinned copy or official release/);
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

test("authenticated browser POST routes reject untrusted origins", () => {
  const webSecuritySource = readFileSync("lib/security/web.ts", "utf8");
  const aiSuggestionsSource = readFileSync("app/api/ai/wishlist-suggestions/route.ts", "utf8");
  const peerProfilesSource = readFileSync("app/api/groups/peer-profiles/route.ts", "utf8");
  const affiliateAuthSource = readFileSync(
    "app/api/affiliate/lazada/_shared/authenticated-affiliate-route.ts",
    "utf8"
  );
  const lazadaMatchesSource = readFileSync("app/api/affiliate/lazada/matches/route.ts", "utf8");
  const lazadaPrimeLinksSource = readFileSync("app/api/affiliate/lazada/prime-links/route.ts", "utf8");
  const lazadaPostbackSource = readFileSync("app/api/affiliate/lazada/postback/route.ts", "utf8");
  const lazadaTestPostbackSource = readFileSync(
    "app/api/affiliate/lazada/test-postback/route.ts",
    "utf8"
  );
  const reminderProcessorSource = readFileSync(
    "app/api/notifications/process-reminders/route.ts",
    "utf8"
  );

  assert.match(webSecuritySource, /export function isTrustedRequestOrigin\(request: Request\)/);
  assert.match(webSecuritySource, /request\.headers\.get\("origin"\)/);
  assert.match(aiSuggestionsSource, /isTrustedRequestOrigin\(request\)/);
  assert.match(peerProfilesSource, /isTrustedRequestOrigin\(request\)/);
  assert.match(affiliateAuthSource, /isTrustedRequestOrigin\(request\)/);
  assert.match(lazadaMatchesSource, /requireAuthenticatedAffiliateRoute\(request,/);
  assert.match(lazadaPrimeLinksSource, /requireAuthenticatedAffiliateRoute\(request,/);
  assert.match(lazadaTestPostbackSource, /isTrustedRequestOrigin\(request\)/);
  assert.doesNotMatch(lazadaPostbackSource, /isTrustedRequestOrigin/);
  assert.doesNotMatch(reminderProcessorSource, /isTrustedRequestOrigin/);
});

test("lazada test postback is rate limited and idempotent by day", () => {
  const lazadaTestPostbackSource = readFileSync(
    "app/api/affiliate/lazada/test-postback/route.ts",
    "utf8"
  );

  assert.match(lazadaTestPostbackSource, /enforceRateLimit\(\{/);
  assert.match(lazadaTestPostbackSource, /action: "affiliate\.lazada\.test_postback"/);
  assert.match(lazadaTestPostbackSource, /maxAttempts: 5/);
  assert.match(lazadaTestPostbackSource, /windowSeconds: 300/);
  assert.match(lazadaTestPostbackSource, /redirectToReport\(request, "rate_limited"\)/);
  assert.match(lazadaTestPostbackSource, /toISOString\(\)\.slice\(0, 10\)/);
  assert.doesNotMatch(lazadaTestPostbackSource, /transaction_id: `debug-\$\{click\.id\.slice\(0, 8\)\}-\$\{Date\.now\(\)\}`/);
  assert.doesNotMatch(lazadaTestPostbackSource, /function isSameOriginRequest/);
});
