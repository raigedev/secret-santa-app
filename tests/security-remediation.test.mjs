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

test("reveal screen clears stale presentation after access failures", () => {
  const revealPageSource = readFileSync("app/group/[id]/reveal/page.tsx", "utf8");
  const failedLoadBranch =
    /if \(!result\.success \|\| !result\.data\) \{[\s\S]{0,260}setPresentation\(null\);[\s\S]{0,160}hasLoadedPresentationRef\.current = false;[\s\S]{0,260}setError\(result\.message \|\| "Failed to load the reveal screen\."\);/;

  assert.match(revealPageSource, failedLoadBranch);
  assert.doesNotMatch(revealPageSource, /background sync should preserve the current/i);
  assert.doesNotMatch(revealPageSource, /Failed to refresh the reveal screen/i);
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

  assert.match(groupPageSource, /\.select\("id, user_id, nickname, role, status"\)/);
  assert.match(groupPageSource, /\.eq\("status", "accepted"\)/);
  assert.match(groupPageSource, /email:\s*isCurrentUserOwner \? member\.email \|\| null : null/);
  assert.doesNotMatch(groupPageSource, /table:\s*"assignments"/);
  assert.doesNotMatch(groupPageSource, /group-\$\{id\}-realtime/);
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
  const appShellSource = readFileSync("app/components/AppRouteShell.tsx", "utf8");

  assert.match(viewerProfileSource, /VIEWER_PROFILE_STORAGE_PREFIX = "ss_viewer_profile_v2:"/);
  assert.match(viewerProfileSource, /getViewerProfileStorageKey\(userId/);
  assert.doesNotMatch(viewerProfileSource, /sessionStorage\.getItem\(VIEWER_NAME_STORAGE_KEY\)/);
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
  assert.match(secretSantaPageSource, /normalizeTrustedLazadaImageUrl\(product\.imageUrl/);
  assert.match(secretSantaPageSource, /referrerPolicy="no-referrer"/);
  assert.doesNotMatch(suggestionSource, /params\.set\("itemNote"/);
  assert.doesNotMatch(suggestionSource, /params\.set\("preferredPrice/);
  assert.match(redirectSource, /const itemNote = "";/);
});

test("secret santa chat keeps a broader message window for unread state", () => {
  const chatPageSource = readFileSync("app/secret-santa-chat/page.tsx", "utf8");
  const chatActionsSource = readFileSync("app/secret-santa-chat/chat-actions.ts", "utf8");

  assert.match(chatPageSource, /CHAT_THREAD_MESSAGE_SCAN_LIMIT = 1000/);
  assert.match(chatPageSource, /CHAT_ACTIVE_THREAD_MESSAGE_LIMIT = 250/);
  assert.match(chatActionsSource, /CHAT_THREAD_MESSAGE_SCAN_LIMIT = 1000/);
  assert.match(chatActionsSource, /CHAT_ACTIVE_THREAD_MESSAGE_LIMIT = 250/);
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
