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

test("live reveal group actions reject malformed group IDs before side effects", () => {
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");

  for (const functionName of [
    "startRevealCountdown",
    "updateRevealSessionState",
    "getRevealMatches",
    "triggerReveal",
  ]) {
    const functionStart = groupActionsSource.indexOf(`export async function ${functionName}(`);
    assert.notEqual(functionStart, -1, `Expected ${functionName} to be exported.`);
    assert.match(
      groupActionsSource.slice(functionStart, functionStart + 1200),
      /if \(!isUuid\(groupId\)\)/
    );
  }
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

test("server failure audit logging redacts token-like error text", () => {
  const auditSource = readFileSync("lib/security/audit.ts", "utf8");

  assert.match(auditSource, /const SENSITIVE_STRING_PATTERNS = \[/);
  assert.match(auditSource, /function redactSensitiveString\(value: string\): string/);
  assert.match(
    auditSource,
    /errorMessage: redactSensitiveString\(params\.errorMessage\)\.slice\(0, 500\)/
  );
  assert.doesNotMatch(auditSource, /errorMessage: params\.errorMessage\.slice\(0, 500\)/);
});

test("email invite auto-claim only targets pending or accepted memberships", () => {
  assert.deepEqual(ELIGIBLE_EMAIL_INVITE_STATUSES, ["pending", "accepted"]);
  assert.equal(ELIGIBLE_EMAIL_INVITE_STATUSES.includes("declined"), false);
});

test("auth callback creates one-time welcome notifications and welcome email", () => {
  const callbackSource = readFileSync("app/auth/callback/route.ts", "utf8");
  const welcomeEmailSource = readFileSync("lib/email/welcome-email.ts", "utf8");
  const notificationsSource = readFileSync("lib/notifications.ts", "utf8");
  const notificationDisplaySource = readFileSync(
    "app/notifications/notification-display.ts",
    "utf8"
  );
  const loginSource = readFileSync("app/login/page.tsx", "utf8");

  assert.match(callbackSource, /import \{ createHash \} from "node:crypto";/);
  assert.match(callbackSource, /import \{ sendWelcomeEmail \} from "@\/lib\/email\/welcome-email";/);
  assert.match(callbackSource, /import \{ createNotification \} from "@\/lib\/notifications";/);
  assert.match(callbackSource, /const WELCOME_NOTIFICATION_TYPE = "welcome";/);
  assert.match(callbackSource, /const WELCOME_NOTIFICATION_ID_NAMESPACE = "secret-santa:welcome-notification";/);
  assert.match(callbackSource, /const WELCOME_EMAIL_RECEIPTS_TABLE = "welcome_email_receipts";/);
  assert.match(callbackSource, /function buildWelcomeNotificationId\(userId: string\): string/);
  assert.match(callbackSource, /createHash\("sha256"\)/);
  assert.match(
    callbackSource,
    /async function ensureWelcomeNotification\(userId: string\): Promise<WelcomeNotificationState \| null>/
  );
  assert.match(callbackSource, /async function loadWelcomeNotification\(/);
  assert.match(callbackSource, /async function getWelcomeEmailReceiptState\(userId: string\): Promise<WelcomeEmailReceiptState>/);
  assert.match(callbackSource, /\.from\(WELCOME_EMAIL_RECEIPTS_TABLE\)[\s\S]{0,120}\.select\("user_id"\)[\s\S]{0,120}\.maybeSingle\(\)/);
  assert.match(callbackSource, /async function recordWelcomeEmailReceipt\(input: \{[\s\S]{0,120}notificationId: string;[\s\S]{0,80}userId: string;[\s\S]{0,80}\}\): Promise<void>/);
  assert.match(callbackSource, /\.from\(WELCOME_EMAIL_RECEIPTS_TABLE\)\.insert\(\{[\s\S]{0,120}notification_id: input\.notificationId[\s\S]{0,80}user_id: input\.userId/);
  assert.match(callbackSource, /error && error\.code !== "23505"/);
  assert.match(callbackSource, /eventType: "email\.welcome\.receipt_lookup"/);
  assert.match(callbackSource, /eventType: "email\.welcome\.receipt_record"/);
  assert.match(callbackSource, /const \{ data: authData, error \} = await supabase\.auth\.exchangeCodeForSession\(code\);/);
  assert.match(callbackSource, /const user = authData\.user;/);
  assert.doesNotMatch(callbackSource, /await supabase\.auth\.getUser\(\)/);
  assert.match(callbackSource, /eventType: "auth\.callback\.missing_user"/);
  assert.match(callbackSource, /eventType: "auth\.callback\.missing_user_email"/);
  assert.match(callbackSource, /return NextResponse\.redirect\(new URL\("\/login\?error=auth_failed", origin\)\);/);
  assert.match(callbackSource, /return NextResponse\.redirect\(new URL\("\/login\?error=missing_email", origin\)\);/);
  assert.match(
    callbackSource,
    /const welcomeNotificationId = buildWelcomeNotificationId\(userId\);[\s\S]{0,220}await createNotification\(\{[\s\S]{0,160}id: welcomeNotificationId[\s\S]{0,80}ignoreDuplicate: true[\s\S]{0,160}linkPath: "\/dashboard"[\s\S]{0,160}type: WELCOME_NOTIFICATION_TYPE[\s\S]{0,80}userId/
  );
  assert.match(
    callbackSource,
    /const welcomeNotification = await ensureWelcomeNotification\(user\.id\);[\s\S]{0,120}const welcomeEmailReceiptState = await getWelcomeEmailReceiptState\(user\.id\);[\s\S]{0,220}if \(welcomeNotification && welcomeEmailReceiptState === "missing"\)/
  );
  assert.match(callbackSource, /const welcomeEmailResult = await sendWelcomeEmail\(\{[\s\S]{0,120}dashboardUrl: new URL\("\/dashboard", origin\)\.toString\(\)[\s\S]{0,160}email: user\.email/);
  assert.match(callbackSource, /if \(welcomeEmailResult === "sent"\) \{[\s\S]{0,80}await recordWelcomeEmailReceipt\(\{[\s\S]{0,80}email: user\.email[\s\S]{0,80}notificationId: welcomeNotification\.id[\s\S]{0,80}userId: user\.id/);
  assert.doesNotMatch(callbackSource, /welcomeEmailSentAt/);
  assert.doesNotMatch(callbackSource, /markWelcomeEmailSent/);
  assert.match(notificationsSource, /id\?: string;/);
  assert.match(notificationsSource, /const id = isUuid\(input\.id\) \? input\.id : undefined;/);
  assert.match(notificationsSource, /\.\.\.\(id \? \{ id \} : \{\}\)/);
  assert.match(
    notificationsSource,
    /if \(input\.ignoreDuplicate && error\.code === "23505"\) \{[\s\S]{0,80}return null;/
  );
  assert.match(welcomeEmailSource, /import "server-only";/);
  assert.match(welcomeEmailSource, /import nodemailer from "nodemailer";/);
  assert.match(welcomeEmailSource, /import \{ recordAuditEvent, recordServerFailure \} from "@\/lib\/security\/audit";/);
  assert.match(welcomeEmailSource, /readTrimmedEnv\("SMTP_HOST"\)/);
  assert.match(welcomeEmailSource, /readTrimmedEnv\("SMTP_PASSWORD"\)/);
  assert.match(welcomeEmailSource, /readTrimmedEnv\("GMAIL_APP_PASSWORD"\)/);
  assert.match(welcomeEmailSource, /function normalizeSmtpPassword\(host: string, password: string\): string/);
  assert.match(welcomeEmailSource, /host\.toLowerCase\(\) === "smtp\.gmail\.com"/);
  assert.match(welcomeEmailSource, /return password\.replace\(\/\\s\+\/g, ""\);/);
  assert.match(welcomeEmailSource, /port < 1 \|\| port > 65535/);
  assert.match(welcomeEmailSource, /function getEmailAssetUrl\(baseUrl: string, path: string\): string/);
  assert.match(welcomeEmailSource, /secret-santa-logo\.png/);
  assert.match(welcomeEmailSource, /shhh, it's a secret/);
  assert.match(welcomeEmailSource, /Welcome Gift Tag/);
  assert.match(welcomeEmailSource, /nodemailer\.createTransport\(/);
  assert.match(welcomeEmailSource, /eventType: "email\.welcome\.sent"/);
  assert.match(welcomeEmailSource, /outcome: "success"/);
  assert.match(welcomeEmailSource, /eventType: "email\.welcome\.send"/);
  assert.match(welcomeEmailSource, /eventType: "email\.welcome\.config_missing"/);
  assert.match(welcomeEmailSource, /eventType: "email\.welcome\.invalid_recipient"/);
  assert.match(welcomeEmailSource, /missingKeys/);
  assert.match(welcomeEmailSource, /EMAIL_ADDRESS_PATTERN/);
  assert.doesNotMatch(welcomeEmailSource, /NEXT_PUBLIC_.*SMTP/);
  assert.match(loginSource, /missing_email:[\s\S]{0,120}Google did not share an email address/);
  assert.match(notificationDisplaySource, /case "welcome":[\s\S]{0,40}return "Get Started";/);
});

test("notification links are normalized to app-local paths before navigation", () => {
  const notificationsSource = readFileSync("lib/notifications.ts", "utf8");
  const safeAppPathSource = readFileSync("lib/security/safe-app-path.ts", "utf8");
  const dashboardSource = readFileSync("app/dashboard/page.tsx", "utf8");
  const notificationDisplaySource = readFileSync(
    "app/notifications/notification-display.ts",
    "utf8"
  );

  assert.match(safeAppPathSource, /normalizeSafeAppPath\(candidate: unknown/);
  assert.match(safeAppPathSource, /typeof candidate === "string"/);
  assert.match(notificationsSource, /import \{ normalizeSafeAppPath \} from "@\/lib\/security\/safe-app-path";/);
  assert.match(notificationsSource, /function sanitizeNotificationLinkPath/);
  assert.match(notificationsSource, /const linkPath = sanitizeNotificationLinkPath\(input\.linkPath\);/);
  assert.doesNotMatch(notificationsSource, /const linkPath = input\.linkPath \? sanitizeNotificationText/);
  assert.match(notificationDisplaySource, /normalizeSafeAppPath\(candidate, ""\)/);
  assert.doesNotMatch(notificationDisplaySource, /return notification\.link_path;/);
  assert.match(dashboardSource, /function normalizeDashboardNotificationHref/);
  assert.match(dashboardSource, /normalizeSafeAppPath\(candidate, ""\)/);
  assert.doesNotMatch(dashboardSource, /href: count > 1 \? "\/notifications" : latest\.link_path/);
});

test("welcome email receipts are server-only and notification edits are narrowed", () => {
  const receiptMigrationName = [
    "20260515125250",
    "server",
    "only",
    "welcome",
    "email",
    "receipts.sql",
  ].join("_");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a fixed repo-local migration assembled from safe string pieces.
  const migrationSource = readFileSync(
    ["supabase", "migrations", receiptMigrationName].join("/"),
    "utf8"
  );

  assert.match(migrationSource, /create table if not exists public\.welcome_email_receipts/i);
  assert.match(migrationSource, /user_id uuid primary key references auth\.users\(id\) on delete cascade/i);
  assert.match(
    migrationSource,
    /notification_id uuid references public\.notifications\(id\) on delete set null/i
  );
  assert.match(migrationSource, /alter table public\.welcome_email_receipts enable row level security/i);
  assert.match(
    migrationSource,
    /create policy welcome_email_receipts_no_client_access[\s\S]{0,220}using \(false\)[\s\S]{0,80}with check \(false\)/i
  );
  assert.match(migrationSource, /revoke all on table public\.welcome_email_receipts from anon/i);
  assert.match(
    migrationSource,
    /revoke all on table public\.welcome_email_receipts from authenticated/i
  );
  assert.match(
    migrationSource,
    /grant select, insert, update, delete on table public\.welcome_email_receipts to service_role/i
  );
  assert.match(migrationSource, /revoke update on table public\.notifications from authenticated/i);
  assert.match(migrationSource, /revoke delete on table public\.notifications from authenticated/i);
  assert.match(
    migrationSource,
    /grant update \(read_at\) on table public\.notifications to authenticated/i
  );
});

test("welcome email receipt backfill preserves already-sent users", () => {
  const backfillMigrationName = [
    "20260515131122",
    "backfill",
    "welcome",
    "email",
    "receipts.sql",
  ].join("_");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a fixed repo-local migration assembled from safe string pieces.
  const migrationSource = readFileSync(
    ["supabase", "migrations", backfillMigrationName].join("/"),
    "utf8"
  );

  assert.match(
    migrationSource,
    /insert into public\.welcome_email_receipts[\s\S]{0,220}select[\s\S]{0,220}notifications\.user_id/i
  );
  assert.match(migrationSource, /notifications\.metadata->>'welcomeEmailSentAt'/);
  assert.match(migrationSource, /where notifications\.type = 'welcome'/i);
  assert.match(migrationSource, /auth_users\.email is not null/i);
  assert.match(migrationSource, /on conflict \(user_id\) do nothing/i);
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
  assert.match(actionsSource, /async function validateThreadSendAccess/);
  assert.match(actionsSource, /\.eq\("giver_id", threadGiverId\)/);
  assert.match(actionsSource, /\.eq\("receiver_id", threadReceiverId\)/);
  assert.match(actionsSource, /userId !== threadReceiverId/);
  assert.match(actionsSource, /!group\?\.revealed/);
  assert.match(actionsSource, /const threadAccess = await validateThreadSendAccess/);

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

test("reveal presentation loads service-role source data after viewer authorization", () => {
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");
  const presentationStart = groupActionsSource.indexOf(
    "export async function getRevealPresentationData"
  );
  const sourceDataLoad = groupActionsSource.indexOf("const [storedSession, sourceData]", presentationStart);
  const membershipRejection = groupActionsSource.indexOf(
    "Only accepted members can view this reveal screen.",
    presentationStart
  );

  assert.ok(presentationStart >= 0);
  assert.ok(sourceDataLoad > membershipRejection);
  assert.doesNotMatch(
    groupActionsSource.slice(presentationStart, membershipRejection),
    /loadRevealSourceData|getStoredRevealSession/
  );
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

test("invite page query errors are bounded plain text", () => {
  const invitePageSource = readFileSync("app/invite/[token]/page.tsx", "utf8");

  assert.match(invitePageSource, /import \{ sanitizePlainText \} from "@\/lib\/validation\/common";/);
  assert.match(invitePageSource, /function normalizeInviteErrorMessage/);
  assert.match(invitePageSource, /sanitizePlainText\(value \|\| "", 180\)/);
  assert.match(invitePageSource, /const errorMessage = normalizeInviteErrorMessage\(resolvedSearchParams\.error\)/);
  assert.doesNotMatch(invitePageSource, /decodeURIComponent\(resolvedSearchParams\.error\)/);
});

test("invite link tokens are bounded before hashing or redirect reuse", () => {
  const invitePageSource = readFileSync("app/invite/[token]/page.tsx", "utf8");
  const loadPreviewStart = invitePageSource.indexOf("async function loadInvitePreview");
  const joinInviteStart = invitePageSource.indexOf("async function joinGroupViaInviteToken");
  const pageStart = invitePageSource.indexOf("export default async function InviteLinkPage");

  assert.match(invitePageSource, /const INVITE_TOKEN_MAX_LENGTH = 96/);
  assert.match(invitePageSource, /const INVITE_TOKEN_PATTERN = \/\^\[A-Za-z0-9_-\]\+\$\//);
  assert.match(invitePageSource, /trimmed\.length > INVITE_TOKEN_MAX_LENGTH/);
  assert.match(invitePageSource, /!INVITE_TOKEN_PATTERN\.test\(trimmed\)/);
  assert.match(invitePageSource, /function buildInvalidInvitePreview/);
  assert.ok(loadPreviewStart >= 0 && joinInviteStart > loadPreviewStart);
  assert.match(
    invitePageSource.slice(loadPreviewStart, joinInviteStart),
    /const normalizedToken = normalizeToken\(token\);[\s\S]{0,120}if \(!normalizedToken\)[\s\S]{0,120}return buildInvalidInvitePreview\(\);[\s\S]{0,120}const tokenHash = hashInviteToken\(normalizedToken\);/
  );
  assert.ok(pageStart > joinInviteStart);
  assert.match(
    invitePageSource.slice(joinInviteStart, pageStart),
    /const normalizedToken = normalizeToken\(token\);[\s\S]{0,120}if \(!normalizedToken\)[\s\S]{0,120}INVALID_INVITE_MESSAGE[\s\S]{0,120}const tokenHash = hashInviteToken\(normalizedToken\);/
  );
  assert.match(invitePageSource, /const normalizedToken = normalizeToken\(token\);/);
  assert.match(
    invitePageSource,
    /const nextPath = `\/invite\/\$\{encodeURIComponent\(normalizedToken \|\| "invalid"\)\}`;/
  );
}
);

test("peer profile route always rechecks authorization before profile output", () => {
  const peerProfilesRouteSource = readFileSync("app/api/groups/peer-profiles/route.ts", "utf8");

  assert.doesNotMatch(peerProfilesRouteSource, /peerProfileCache/);
  assert.doesNotMatch(peerProfilesRouteSource, /readPeerProfileCache/);
  assert.doesNotMatch(peerProfilesRouteSource, /writePeerProfileCache/);
  assert.match(peerProfilesRouteSource, /normalizeProfileAvatarUrlForUser/);
  assert.match(
    peerProfilesRouteSource,
    /normalizeProfileAvatarUrlForUser\(profile\.user_id, profile\.avatar_url\)/
  );
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
  assert.match(createGroupActionsSource, /INVITE_EMAILS_JSON_MAX_LENGTH = 8 \* 1024/);
  assert.match(createGroupActionsSource, /rawValue\.length > INVITE_EMAILS_JSON_MAX_LENGTH/);
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

test("security definer helper functions use constrained search paths", () => {
  const hardenedSearchPathMigrationName = [
    "202605210001",
    "harden",
    "security",
    "definer",
    "search",
    "paths.sql",
  ].join("_");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixed repo-local migration path assembled from literal pieces for no-secrets scanning.
  const migrationSource = readFileSync(
    ["supabase", "migrations", hardenedSearchPathMigrationName].join("/"),
    "utf8"
  );

  assert.match(
    migrationSource,
    /create or replace function public\.list_my_assignment_gift_prep\(p_group_ids uuid\[\]\)[\s\S]{0,260}security definer[\s\S]{0,80}set search_path = ''/i
  );
  assert.match(
    migrationSource,
    /create or replace function private\.enforce_wishlist_item_limit\(\)[\s\S]{0,160}security definer[\s\S]{0,80}set search_path = ''/i
  );
  for (const publicHelperPattern of [
    /create or replace function public\.is_group_owner\([\s\S]{0,420}security definer[\s\S]{0,80}set search_path = ''/i,
    /create or replace function public\.is_group_member\([\s\S]{0,420}security definer[\s\S]{0,80}set search_path = ''/i,
    /create or replace function public\.is_group_member_or_invited\([\s\S]{0,420}security definer[\s\S]{0,80}set search_path = ''/i,
    /create or replace function public\.can_view_wishlist\([\s\S]{0,420}security definer[\s\S]{0,80}set search_path = ''/i,
    /create or replace function public\.list_group_peer_profiles\([\s\S]{0,420}security definer[\s\S]{0,80}set search_path = ''/i,
    /create or replace function public\.cleanup_security_rate_limits\([\s\S]{0,420}security definer[\s\S]{0,80}set search_path = ''/i,
    /create or replace function public\.consume_rate_limit\([\s\S]{0,420}security definer[\s\S]{0,80}set search_path = ''/i,
    /create or replace function public\.write_audit_log\([\s\S]{0,420}security definer[\s\S]{0,80}set search_path = ''/i,
  ]) {
    assert.match(migrationSource, publicHelperPattern);
  }
  assert.match(
    migrationSource,
    /revoke all on function public\.list_my_assignment_gift_prep\(uuid\[\]\) from public, anon, authenticated/i
  );
  assert.match(
    migrationSource,
    /revoke all on function public\.consume_rate_limit\(text, text, integer, integer\) from public, anon, authenticated/i
  );
  assert.match(
    migrationSource,
    /revoke all on function public\.write_audit_log\(uuid, text, text, text, text, jsonb\) from public, anon, authenticated/i
  );
  assert.match(migrationSource, /private\.is_group_member_or_invited/);
  assert.match(migrationSource, /RLS policies still reference public or unqualified auth helper functions/);
  assert.match(migrationSource, /pg_catalog\.pg_advisory_xact_lock/i);
  assert.match(migrationSource, /pg_catalog\.hashtextextended/i);
  assert.doesNotMatch(migrationSource, /set search_path = public/i);
});

test("secret santa shopping does not auto-load recipient supplied wishlist images", () => {
  const secretSantaPageSource = readFileSync("app/secret-santa/page.tsx", "utf8");
  const wishlistPageSource = readFileSync("app/wishlist/page.tsx", "utf8");

  assert.doesNotMatch(secretSantaPageSource, /item_image_url/);
  assert.doesNotMatch(secretSantaPageSource, /safeItemImageUrl/);
  assert.doesNotMatch(secretSantaPageSource, /input\.wishlistItem\.item_image_url/);
  assert.match(
    secretSantaPageSource,
    /const resolvedWishlistImageUrl = wishlistMatchedImageUrl;/
  );
  assert.match(
    wishlistPageSource,
    /src=\{item\.item_image_url\}[\s\S]{0,160}referrerPolicy="no-referrer"/
  );
});

test("wishlist URLs stay https-only across migrations and UI reads", () => {
  const migrationPath = [
    "supabase",
    "migrations",
    "20260524050000_enforce_https_wishlist_urls.sql",
  ].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path assembled to avoid a no-secrets false positive.
  const migrationSource = readFileSync(
    migrationPath,
    "utf8"
  );
  const wishlistPageSource = readFileSync("app/wishlist/page.tsx", "utf8");
  const historyPageSource = readFileSync("app/history/page.tsx", "utf8");
  const wishlistUrlSource = readFileSync("lib/wishlist/url.ts", "utf8");

  assert.match(
    migrationSource,
    /item_link is null[\s\S]*or item_link = ''[\s\S]*char_length\(item_link\) <= 500[\s\S]*and item_link ~\* '\^https:\/\/'/i
  );
  assert.match(migrationSource, /wishlists_item_link_protocol_check[\s\S]*not valid/i);
  assert.doesNotMatch(migrationSource, /set item_link = ''/i);
  assert.match(wishlistUrlSource, /trimmed\.length > maxLength/);
  assert.match(wishlistUrlSource, /parsed\.protocol !== "https:"/);
  assert.doesNotMatch(wishlistUrlSource, /parsed\.protocol !== "http:"/);
  assert.doesNotMatch(wishlistUrlSource, /trimmed\.slice\(0, maxLength\)/);
  assert.match(wishlistPageSource, /item_link: cleanUrl\(row\.item_link \|\| ""\)/);
  assert.match(historyPageSource, /item_link: normalizeOptionalWishlistUrl\(item\.item_link\)/);
});

test("wishlist image URLs are HTTPS-only at the database boundary", () => {
  const migrationPath = [
    "supabase",
    "migrations",
    "20260524050000_enforce_https_wishlist_urls.sql",
  ].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test reads a fixed repo migration assembled for no-secrets lint stability.
  const migrationSource = readFileSync(migrationPath, "utf8");

  assert.match(migrationSource, /regexp_replace\(item_link, '\^http:\/\/', 'https:\/\/'/i);
  assert.match(migrationSource, /regexp_replace\(item_image_url, '\^http:\/\/', 'https:\/\/'/i);
  assert.match(migrationSource, /wishlists_item_image_url_protocol_check/i);
  assert.match(migrationSource, /wishlists_item_image_url_protocol_check[\s\S]*not valid/i);
  assert.doesNotMatch(migrationSource, /set item_image_url = ''/i);
  assert.match(
    migrationSource,
    /item_image_url is null[\s\S]*or item_image_url = ''[\s\S]*char_length\(item_image_url\) <= 500[\s\S]*and item_image_url ~\* '\^https:\/\/'/i
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
    /if\s*\(\s*directProducts\.length\s*>\s*0\s*\)\s*{[\s\S]{0,220}return noStoreJson/
  );
  assert.doesNotMatch(lazadaMatchesRouteSource, /const\s+fallbackProducts\s*=/);
});

test("affiliate redirect rate limits do not trust spoofed client IP headers", () => {
  const redirectRouteSource = readFileSync("lib/affiliate/redirect-route.ts", "utf8");
  const webSecuritySource = readFileSync("lib/security/web.ts", "utf8");
  const rateLimitIndex = redirectRouteSource.indexOf("enforceAffiliateRedirectRateLimit({");
  const accessCheckIndex = redirectRouteSource.indexOf("canTrackWishlistAffiliateRedirect({");

  assert.doesNotMatch(webSecuritySource, /extractRequestClientIp|x-forwarded-for|cf-connecting-ip|x-real-ip/i);
  assert.doesNotMatch(redirectRouteSource, /extractRequestClientIp/);
  assert.match(
    redirectRouteSource,
    /subject:\s*`\$\{options\.rateLimitSubjectPrefix\}:\$\{options\.userId\}`/
  );
  assert.match(redirectRouteSource, /"Cache-Control": "no-store"/);
  assert.ok(
    rateLimitIndex > 0 && rateLimitIndex < accessCheckIndex,
    "Affiliate redirect quota must run before wishlist access lookups."
  );
  assert.doesNotMatch(redirectRouteSource, /x-forwarded-for|cf-connecting-ip|x-real-ip/i);
});

test("lazada promotion redirect targets are allowlisted", () => {
  const lazadaUrlSource = readFileSync("lib/affiliate/lazada-url.ts", "utf8");
  const lazadaSource = readFileSync("lib/affiliate/lazada.ts", "utf8");

  assert.match(lazadaUrlSource, /export function normalizeLazadaPromotionLinkUrl/);
  assert.match(lazadaUrlSource, /isLazadaPromotionShortLinkHostname\(parsed\.hostname\)/);
  assert.match(lazadaUrlSource, /isLazadaHostname\(parsed\.hostname\)[\s\S]*isLazadaProductPath\(parsed\.pathname\)/);
  assert.match(lazadaUrlSource, /parsed\.protocol = "https:";/);
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

test("lazada postback unauthorized rate limit does not trust spoofed client IP headers", () => {
  const postbackRouteSource = readFileSync(
    "app/api/affiliate/lazada/postback/route.ts",
    "utf8"
  );

  assert.doesNotMatch(postbackRouteSource, /extractRequestClientIp/);
  assert.doesNotMatch(postbackRouteSource, /x-forwarded-for|cf-connecting-ip|x-real-ip/i);
  assert.match(
    postbackRouteSource,
    /subject:\s*UNAUTHORIZED_POSTBACK_RATE_LIMIT_SUBJECT/
  );
});

test("lazada match route requires access to the wishlist item before matching or priming", () => {
  const lazadaMatchesRouteSource = readFileSync(
    "app/api/affiliate/lazada/matches/route.ts",
    "utf8"
  );
  const recipientAccessSource = readFileSync("lib/wishlist/recipient-access.ts", "utf8");
  const accessCheckIndex = lazadaMatchesRouteSource.indexOf("canAccessRecipientWishlistItem");
  const feedMatchIndex = lazadaMatchesRouteSource.indexOf("findBestLazadaFeedMatches({");
  const primingIndex = lazadaMatchesRouteSource.indexOf("primeLazadaPromotionLinks({");

  assert.match(recipientAccessSource, /import \{ isUuid \} from "@\/lib\/validation\/common";/);
  assert.match(
    recipientAccessSource,
    /!isUuid\(options\.groupId\) \|\| !isUuid\(options\.userId\) \|\| !isUuid\(options\.wishlistItemId\)/
  );
  assert.match(recipientAccessSource, /return \{ allowed: false, reason: "unauthorized" \};/);
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

test("auth and affiliate fallback redirects use trusted app origins", () => {
  const appOriginSource = readFileSync("lib/security/app-origin.ts", "utf8");
  const proxySource = readFileSync("proxy.ts", "utf8");
  const redirectRouteSource = readFileSync("lib/affiliate/redirect-route.ts", "utf8");
  const suggestionRedirectSource = readFileSync("app/go/suggestion/route.ts", "utf8");
  const wishlistRedirectSource = readFileSync("app/go/wishlist-link/route.ts", "utf8");
  const affiliateReportSource = readFileSync("app/dashboard/affiliate-report/page.tsx", "utf8");
  const inviteEmailSource = readFileSync("lib/groups/invite-email.ts", "utf8");

  assert.match(appOriginSource, /import "server-only";/);
  assert.match(appOriginSource, /function isLocalDevelopmentOrigin/);
  assert.match(appOriginSource, /normalizeHttpOrigin\(candidate: unknown\)/);
  assert.match(appOriginSource, /typeof rawValue !== "string"/);
  assert.match(appOriginSource, /configuredOrigins\.includes\(requestOrigin\)/);
  assert.match(appOriginSource, /return configuredOrigins\[0\] \|\| DEFAULT_LOCAL_APP_ORIGIN/);
  assert.match(proxySource, /const trustedOrigin = resolveTrustedAppOrigin\(req\.nextUrl\)/);
  assert.match(proxySource, /new URL\("\/auth\/callback", trustedOrigin\)/);
  assert.match(proxySource, /new URL\("\/login", trustedOrigin\)/);
  assert.match(proxySource, /new URL\("\/dashboard", trustedOrigin\)/);
  assert.doesNotMatch(proxySource, /new URL\("\/(?:login|dashboard)", req\.url\)/);
  assert.match(redirectRouteSource, /const trustedOrigin = resolveTrustedAppOrigin\(new URL\(request\.url\)\)/);
  assert.match(redirectRouteSource, /new URL\("\/login", trustedOrigin\)/);
  assert.match(redirectRouteSource, /new URL\("\/secret-santa", trustedOrigin\)/);
  assert.doesNotMatch(redirectRouteSource, /new URL\("\/(?:login|secret-santa)", request\.url\)/);
  assert.match(suggestionRedirectSource, /resolveTrustedAppOrigin\(request\.nextUrl\)/);
  assert.match(wishlistRedirectSource, /resolveTrustedAppOrigin\(request\.nextUrl\)/);
  assert.match(affiliateReportSource, /resolveTrustedAppOrigin\(headerOrigin\)/);
  assert.doesNotMatch(affiliateReportSource, /function isSafeHostHeader/);
  assert.doesNotMatch(affiliateReportSource, /fallbackOrigin/);
  assert.match(inviteEmailSource, /import \{ resolveTrustedAppOrigin \} from "@\/lib\/security\/app-origin";/);
  assert.match(inviteEmailSource, /new URL\("\/auth\/callback", resolveTrustedAppOrigin\(null\)\)/);
  assert.doesNotMatch(inviteEmailSource, /function normalizeHttpOrigin/);
});

test("post-login next cookies are marked secure on HTTPS clients", () => {
  const cookieSource = readFileSync("lib/auth/post-login-next-cookie.ts", "utf8");
  const loginSource = readFileSync("app/login/page.tsx", "utf8");
  const createAccountSource = readFileSync("app/create-account/page.tsx", "utf8");

  assert.match(cookieSource, /SameSite=Lax/);
  assert.match(cookieSource, /isHttps \? "; Secure" : ""/);
  assert.match(loginSource, /buildPostLoginNextCookie\(/);
  assert.match(createAccountSource, /buildPostLoginNextCookie\(/);
  assert.doesNotMatch(loginSource, /document\.cookie = `post_login_next=/);
  assert.doesNotMatch(createAccountSource, /document\.cookie = `post_login_next=/);
});

test("login page does not render arbitrary query-string error copy", () => {
  const loginSource = readFileSync("app/login/page.tsx", "utf8");

  assert.match(loginSource, /import \{ sanitizePlainText \} from "@\/lib\/validation\/common";/);
  assert.match(loginSource, /AUTH_ERROR_MESSAGE_MAX_LENGTH = 220/);
  assert.match(loginSource, /sanitizePlainText\(trimmedMessage, AUTH_ERROR_MESSAGE_MAX_LENGTH\)/);
  assert.match(loginSource, /sanitizePlainText\(parsedMessage, AUTH_ERROR_MESSAGE_MAX_LENGTH\)/);
  assert.match(
    loginSource,
    /function mapAuthErrorMessage\(errorCode: string \| null\): string \| null \{[\s\S]{0,120}AUTH_ERROR_MESSAGES\[errorCode\]/
  );
  assert.match(loginSource, /const pageError = mapAuthErrorMessage\(searchParams\.get\("error"\)\)/);
  assert.doesNotMatch(loginSource, /mapAuthErrorMessage\(searchParams\.get\("error"\), searchParams\.get\("message"\)\)/);
  assert.doesNotMatch(loginSource, /getReadableAuthErrorMessage\(searchParams\.get\("message"\)\)/);
}
);

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

test("affiliate report access probe is dynamic and not cacheable", () => {
  const reportAccessRouteSource = readFileSync("app/api/affiliate/report-access/route.ts", "utf8");
  const noStoreResponseSource = readFileSync("lib/security/no-store-response.ts", "utf8");

  assert.match(noStoreResponseSource, /headers\.set\("Cache-Control", "no-store"\)/);
  assert.match(reportAccessRouteSource, /export const dynamic = "force-dynamic"/);
  assert.match(reportAccessRouteSource, /noStoreJson\(\{ allowed: false \}/);
  assert.match(reportAccessRouteSource, /noStoreJson\(\{ allowed: canViewAffiliateReport\(user\.email\) \}/);
});

test("private AI and affiliate helper API responses are not cacheable", () => {
  const aiRouteSource = readFileSync("app/api/ai/wishlist-suggestions/route.ts", "utf8");
  const affiliateRouteHelperSource = readFileSync(
    "app/api/affiliate/lazada/_shared/authenticated-affiliate-route.ts",
    "utf8"
  );
  const lazadaHealthRouteSource = readFileSync(
    "app/api/affiliate/lazada/health-check/route.ts",
    "utf8"
  );
  const lazadaMatchesRouteSource = readFileSync("app/api/affiliate/lazada/matches/route.ts", "utf8");
  const lazadaPrimeLinksRouteSource = readFileSync(
    "app/api/affiliate/lazada/prime-links/route.ts",
    "utf8"
  );
  const lazadaTestPostbackRouteSource = readFileSync(
    "app/api/affiliate/lazada/test-postback/route.ts",
    "utf8"
  );
  const reminderProcessorRouteSource = readFileSync(
    "app/api/notifications/process-reminders/route.ts",
    "utf8"
  );

  assert.match(aiRouteSource, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(aiRouteSource, /NextResponse\.json/);
  assert.match(aiRouteSource, /noStoreJson\(\{\s*aiProvider,/);
  assert.match(affiliateRouteHelperSource, /noStoreJson\(\{ error: "Forbidden" \}/);
  assert.match(affiliateRouteHelperSource, /noStoreJson\(\{ error: "Unauthorized" \}/);
  assert.doesNotMatch(lazadaHealthRouteSource, /NextResponse\.json/);
  assert.match(lazadaHealthRouteSource, /noStoreJson\(\{ error: "Unauthorized" \}/);
  assert.match(lazadaHealthRouteSource, /error: "Lazada health check failed\."/);
  assert.doesNotMatch(lazadaHealthRouteSource, /error: message/);
  assert.match(lazadaMatchesRouteSource, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(lazadaMatchesRouteSource, /NextResponse\.json/);
  assert.match(lazadaMatchesRouteSource, /noStoreJson\(\{\s*products:/);
  assert.match(lazadaPrimeLinksRouteSource, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(lazadaPrimeLinksRouteSource, /NextResponse\.json/);
  assert.match(lazadaPrimeLinksRouteSource, /noStoreJson\(\{\s*primed:/);
  assert.match(lazadaTestPostbackRouteSource, /noStoreText\("Forbidden", \{ status: 403 \}\)/);
  assert.match(lazadaTestPostbackRouteSource, /headers\.set\("Cache-Control", "no-store"\)/);
  assert.doesNotMatch(reminderProcessorRouteSource, /NextResponse\.json/);
  assert.match(reminderProcessorRouteSource, /noStoreJson\(\{ error: "Unauthorized" \}/);
  assert.match(reminderProcessorRouteSource, /error: "Reminder processing failed\."/);
  assert.doesNotMatch(reminderProcessorRouteSource, /error: message/);
});

test("deployed cron endpoints require configured secrets", () => {
  const deployedRuntimeSource = readFileSync("lib/security/deployed-runtime.ts", "utf8");
  const lazadaHealthRouteSource = readFileSync(
    "app/api/affiliate/lazada/health-check/route.ts",
    "utf8"
  );
  const reminderProcessorRouteSource = readFileSync(
    "app/api/notifications/process-reminders/route.ts",
    "utf8"
  );

  assert.match(deployedRuntimeSource, /process\.env\.VERCEL === "1"/);
  assert.match(deployedRuntimeSource, /process\.env\.VERCEL_ENV\?\.trim\(\)/);
  assert.match(deployedRuntimeSource, /process\.env\.VERCEL_URL\?\.trim\(\)/);
  assert.match(deployedRuntimeSource, /process\.env\.NODE_ENV !== "production"/);
  assert.match(deployedRuntimeSource, /!isDeployedAppRuntime\(\)/);

  for (const routeSource of [lazadaHealthRouteSource, reminderProcessorRouteSource]) {
    assert.match(routeSource, /isLocalCronBypassAllowed\(\)/);
    assert.match(routeSource, /allowLocalBypass && request\.headers\.has\("x-vercel-cron"\)/);
    assert.match(routeSource, /if \(allowLocalBypass\)/);
    assert.doesNotMatch(routeSource, /!isProduction/);
  }
});

test("private JSON POST routes cap request bodies before parsing", () => {
  const requestBodySource = readFileSync("lib/security/request-body.ts", "utf8");
  const giftPrepRouteSource = readFileSync("app/api/assignments/gift-prep/route.ts", "utf8");
  const peerProfilesRouteSource = readFileSync("app/api/groups/peer-profiles/route.ts", "utf8");
  const aiRouteSource = readFileSync("app/api/ai/wishlist-suggestions/route.ts", "utf8");
  const lazadaMatchesRouteSource = readFileSync("app/api/affiliate/lazada/matches/route.ts", "utf8");
  const lazadaPrimeLinksRouteSource = readFileSync(
    "app/api/affiliate/lazada/prime-links/route.ts",
    "utf8"
  );

  assert.match(requestBodySource, /import "server-only";/);
  assert.match(requestBodySource, /request\.headers\.get\("content-length"\)/);
  assert.match(requestBodySource, /request\.body\.getReader\(\)/);
  assert.match(requestBodySource, /totalBytes > maxBytes/);
  assert.match(requestBodySource, /reader\.cancel\(\)/);
  assert.match(requestBodySource, /export async function readLimitedTextBody/);
  assert.match(requestBodySource, /JSON\.parse\(bodyText\)/);
  assert.doesNotMatch(requestBodySource, /request\.arrayBuffer\(\)/);
  assert.doesNotMatch(requestBodySource, /request\.json\(\)/);
  assert.doesNotMatch(requestBodySource, /request\.formData\(\)/);
  assert.doesNotMatch(requestBodySource, /request\.text\(\)/);

  for (const routeSource of [
    giftPrepRouteSource,
    peerProfilesRouteSource,
    aiRouteSource,
    lazadaMatchesRouteSource,
    lazadaPrimeLinksRouteSource,
  ]) {
    assert.match(routeSource, /readLimitedJsonBody/);
    assert.doesNotMatch(routeSource, /request\.json\(\)/);
  }

  assert.match(giftPrepRouteSource, /GIFT_PREP_BODY_LIMIT_BYTES = 8 \* 1024/);
  assert.match(peerProfilesRouteSource, /PEER_PROFILE_BODY_LIMIT_BYTES = 8 \* 1024/);
  assert.match(aiRouteSource, /WISHLIST_SUGGESTION_BODY_LIMIT_BYTES = 32 \* 1024/);
  assert.match(lazadaMatchesRouteSource, /LAZADA_MATCH_BODY_LIMIT_BYTES = 32 \* 1024/);
  assert.match(lazadaPrimeLinksRouteSource, /PRIME_LINKS_BODY_LIMIT_BYTES = 64 \* 1024/);
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

test("draw cycle pair advisor policy stays deny-all for browser clients", () => {
  const migrationFile = readdirSync("supabase/migrations").find((fileName) =>
    fileName.endsWith("_deny_client_group_draw_cycle_pairs.sql")
  );

  assert.ok(migrationFile);

  const migrationPath = ["supabase", "migrations", migrationFile].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path assembled to avoid a no-secrets false positive.
  const migrationSource = readFileSync(migrationPath, "utf8");

  assert.match(migrationSource, /group_draw_cycle_pairs_no_client_select/i);
  assert.match(migrationSource, /for select\s+to anon, authenticated/i);
  assert.match(migrationSource, /using \(false\)/i);
});

test("advisor foreign key performance indexes are durable", () => {
  const migrationFile = readdirSync("supabase/migrations").find((fileName) =>
    fileName.endsWith("_add_missing_fk_indexes.sql")
  );

  assert.ok(migrationFile);

  const migrationPath = ["supabase", "migrations", migrationFile].join("/");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a repo-local migration path selected by a stable migration suffix.
  const migrationSource = readFileSync(migrationPath, "utf8");
  const normalizedMigrationSource = migrationSource.toLowerCase();

  for (const indexName of [
    "group_draw_cycle_pairs_giver_id_idx",
    "group_draw_cycle_pairs_receiver_id_idx",
    "group_draw_cycles_created_by_idx",
    "group_draw_exclusions_created_by_idx",
    "group_draw_exclusions_giver_user_id_idx",
    "group_draw_exclusions_receiver_user_id_idx",
    "group_draw_resets_created_by_idx",
    "group_invite_links_created_by_idx",
    "group_reveal_sessions_started_by_idx",
    "messages_sender_idx",
    "messages_thread_giver_idx",
    "messages_thread_receiver_idx",
    "reminder_deliveries_notification_id_idx",
    "thread_reads_group_id_idx",
    "welcome_email_receipts_notification_id_idx",
  ]) {
    assert.ok(
      normalizedMigrationSource.includes(`create index if not exists ${indexName}`)
    );
  }
});

test("profile avatar cache-busting stays out of persisted avatar urls", () => {
  const avatarHelperSource = readFileSync("lib/profile/avatar.ts", "utf8");
  const profileActionsSource = readFileSync("app/profile/actions.ts", "utf8");
  const profilePageSource = readFileSync("app/profile/page.tsx", "utf8");
  const imageUploadSource = readFileSync("lib/security/image-upload.ts", "utf8");
  const viewerProfileSource = readFileSync("app/components/viewer-profile-client.ts", "utf8");
  const peerProfilesRouteSource = readFileSync("app/api/groups/peer-profiles/route.ts", "utf8");

  assert.match(avatarHelperSource, /PROFILE_AVATAR_PATH_PATTERN/);
  assert.match(avatarHelperSource, /avatar-\[a-z0-9\]\+-\[a-z0-9\]\+\\\.\(jpg\|png\|webp\)/);
  assert.match(avatarHelperSource, /export function normalizeProfileAvatarUrlForUser/);
  assert.match(avatarHelperSource, /isProfileAvatarStoragePathForUser\(userId, storagePath\)/);
  assert.match(
    avatarHelperSource,
    /return `\$\{candidate\.origin\}\$\{allowedPathPrefix\}\$\{storagePath\}`;/
  );
  assert.match(profileActionsSource, /normalizeProfileAvatarUrlForUser/);
  assert.doesNotMatch(profileActionsSource, /\$\{candidate\.search\}/);
  assert.match(viewerProfileSource, /normalizeAnyProfileAvatarUrl\(value\) \|\| ""/);
  assert.match(peerProfilesRouteSource, /normalizeProfileAvatarUrlForUser/);
  assert.doesNotMatch(peerProfilesRouteSource, /\$\{candidate\.search\}/);
  assert.match(profilePageSource, /avatar_url: normalizeProfileAvatarUrlForUser\(data\.user_id/);
  assert.match(profilePageSource, /const nextCachedProfile = normalizeCachedProfileForUser/);
  assert.match(profilePageSource, /const profileForSave = \{/);
  assert.match(profilePageSource, /avatar_url: normalizeProfileAvatarUrlForUser\(userId, profile\.avatar_url\)/);
  assert.match(profilePageSource, /function buildAvatarPreviewUrl/);
  assert.match(profilePageSource, /previewUrl\.searchParams\.set\("v", String\(previewVersion\)\)/);
  assert.match(profilePageSource, /PROFILE_AVATAR_EXTENSIONS_BY_TYPE\.has\(file\.type\)/);
  assert.doesNotMatch(profilePageSource, /file\.name\.split/);
  assert.doesNotMatch(profilePageSource, /function buildProfileAvatarPath/);
  assert.doesNotMatch(profilePageSource, /supabase\.storage/);
  assert.match(profilePageSource, /const uploadResult = await uploadProfileAvatar\(formData\)/);
  assert.match(profilePageSource, /const nextAvatarUrl = uploadResult\.avatarUrl;/);
  assert.doesNotMatch(profilePageSource, /data\.publicUrl\}\?v=/);
  assert.match(profileActionsSource, /export async function uploadProfileAvatar/);
  assert.match(profileActionsSource, /prepareVerifiedImageUpload/);
  assert.match(profileActionsSource, /buildProfileAvatarPath/);
  assert.match(profileActionsSource, /supabaseAdmin\.storage[\s\S]{0,120}\.upload\(path, preparedAvatar\.image\.bytes/);
  assert.match(profileActionsSource, /getProfileAvatarStoragePathForUser/);
  assert.match(profileActionsSource, /\.remove\(\[previousAvatarPath\]\)/);
  assert.match(imageUploadSource, /function bytesMatchContentType/);
  assert.match(imageUploadSource, /Buffer\.from\(await file\.arrayBuffer\(\)\)/);
  assert.match(imageUploadSource, /bytes\.length > options\.maxBytes/);
});

test("profile avatar storage paths are constrained at the database boundary", () => {
  const avatarMigrationName = [
    "20260524031022",
    "restrict",
    "profile",
    "avatar",
    "paths.sql",
  ].join("_");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a fixed repo-local migration assembled from safe string pieces.
  const migrationSource = readFileSync(
    ["supabase", "migrations", avatarMigrationName].join("/"),
    "utf8"
  );
  const serverUploadMigrationName = [
    "20260524043000",
    "server",
    "validate",
    "profile",
    "avatar",
    "uploads.sql",
  ].join("_");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a fixed repo-local migration assembled from safe string pieces.
  const serverUploadMigrationSource = readFileSync(
    ["supabase", "migrations", serverUploadMigrationName].join("/"),
    "utf8"
  );

  assert.match(migrationSource, /drop constraint if exists profiles_avatar_url_storage_owner_check/i);
  assert.match(migrationSource, /avatar-\[a-z0-9\]\+-\[a-z0-9\]\+\\\.\(jpg\|png\|webp\)/i);
  assert.match(migrationSource, /drop policy if exists profile_avatars_insert_own/i);
  assert.match(migrationSource, /name ~\* \(/i);
  assert.match(migrationSource, /\|\| auth\.uid\(\)::text/i);
  assert.doesNotMatch(migrationSource, /storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/i);
  assert.match(serverUploadMigrationSource, /file_size_limit = 2097152/i);
  assert.match(serverUploadMigrationSource, /allowed_mime_types = array\['image\/jpeg', 'image\/png', 'image\/webp'\]/i);
  assert.match(serverUploadMigrationSource, /drop policy if exists profile_avatars_insert_own/i);
  assert.match(serverUploadMigrationSource, /drop policy if exists profile_avatars_update_own/i);
  assert.match(serverUploadMigrationSource, /drop policy if exists profile_avatars_delete_own/i);
  assert.doesNotMatch(serverUploadMigrationSource, /create policy profile_avatars_(insert|update|delete)_own/i);
});

test("group images are server-uploaded after validation", () => {
  const groupImageMigrationName = [
    "20260524044500",
    "server",
    "validate",
    "group",
    "image",
    "uploads.sql",
  ].join("_");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test only reads a fixed repo-local migration assembled from safe string pieces.
  const groupImageMigrationSource = readFileSync(
    ["supabase", "migrations", groupImageMigrationName].join("/"),
    "utf8"
  );
  const createGroupActionsSource = readFileSync("app/create-group/actions.ts", "utf8");
  const createGroupPageSource = readFileSync("app/create-group/page.tsx", "utf8");
  const groupImageUploadSource = readFileSync("lib/groups/group-image-upload.ts", "utf8");
  const imageUploadSource = readFileSync("lib/security/image-upload.ts", "utf8");

  assert.match(groupImageUploadSource, /prepareVerifiedImageUpload\(file/);
  assert.match(imageUploadSource, /import "server-only";/);
  assert.match(imageUploadSource, /bytesMatchContentType/);
  assert.match(imageUploadSource, /readImageDimensions/);
  assert.match(imageUploadSource, /maxDecodedPixels/);
  assert.match(createGroupActionsSource, /prepareGroupImageUpload\(groupImage\)/);
  assert.match(createGroupActionsSource, /uploadGroupImage\(/);
  assert.match(createGroupActionsSource, /supabaseAdmin\.storage/);
  assert.doesNotMatch(createGroupPageSource, /supabase\.storage/);
  assert.match(groupImageMigrationSource, /where id = 'group-images'/);
  assert.match(groupImageMigrationSource, /file_size_limit = 2097152/i);
  assert.match(groupImageMigrationSource, /allowed_mime_types = array\['image\/jpeg', 'image\/png', 'image\/webp'\]/i);
  assert.match(groupImageMigrationSource, /drop policy if exists group_images_insert_owned_group/i);
  assert.match(groupImageMigrationSource, /drop policy if exists group_images_update_owned_group/i);
  assert.match(groupImageMigrationSource, /drop policy if exists group_images_delete_owned_group/i);
  assert.doesNotMatch(groupImageMigrationSource, /create policy group_images_(insert|update|delete)/i);
});

test("lazada cards avoid untrusted remote image hosts and private redirect notes", () => {
  const lazadaUrlSource = readFileSync("lib/affiliate/lazada-url.ts", "utf8");
  const secretSantaPageSource = readFileSync("app/secret-santa/page.tsx", "utf8");
  const suggestionSource = readFileSync("lib/wishlist/suggestions.ts", "utf8");
  const redirectSource = readFileSync("app/go/suggestion/route.ts", "utf8");
  const wishlistRedirectSource = readFileSync("app/go/wishlist-link/route.ts", "utf8");

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
  assert.match(
    secretSantaPageSource,
    /src=\{resolvedWishlistImageUrl\}[\s\S]{0,160}referrerPolicy="no-referrer"[\s\S]{0,160}className="h-full w-full object-contain p-1\.5"/
  );
  assert.match(
    secretSantaPageSource,
    /src=\{resolvedWishlistImageUrl\}[\s\S]{0,160}referrerPolicy="no-referrer"[\s\S]{0,160}className="h-full w-full object-contain p-1"/
  );
  assert.doesNotMatch(suggestionSource, /params\.set\("itemNote"/);
  assert.doesNotMatch(suggestionSource, /params\.set\("preferredPrice/);
  assert.match(redirectSource, /const itemNote = "";/);
  assert.match(redirectSource, /MAX_SUGGESTION_SEARCH_QUERY_LENGTH = 160/);
  assert.match(redirectSource, /readBoundedSearchParam\(\s*searchParams,\s*"q"/);
  assert.doesNotMatch(redirectSource, /searchParams\.get\("q"\)\?\.trim\(\) \|\| ""/);
  assert.match(wishlistRedirectSource, /MAX_WISHLIST_LINK_URL_LENGTH = 2048/);
  assert.match(
    wishlistRedirectSource,
    /const normalizedItemUrl = itemUrlTooLong \? null : normalizeLazadaProductPageUrl\(itemUrl\)/
  );
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
  assert.match(lazadaPostbackSource, /stripPayloadPostbackAuthParams/);
  assert.match(lazadaPostbackSource, /const MAX_POSTBACK_BODY_BYTES = 64 \* 1024/);
  assert.match(lazadaPostbackSource, /getPostbackBodyPreflightResponse/);
  assert.match(lazadaPostbackSource, /contentLength > MAX_POSTBACK_BODY_BYTES/);
  assert.match(lazadaPostbackSource, /readLimitedTextBody\(request, MAX_POSTBACK_BODY_BYTES\)/);
  assert.doesNotMatch(lazadaPostbackSource, /request\.arrayBuffer\(\)/);
  assert.doesNotMatch(lazadaPostbackSource, /request\.json\(\)/);
  assert.doesNotMatch(lazadaPostbackSource, /request\.formData\(\)/);
  assert.doesNotMatch(lazadaPostbackSource, /request\.text\(\)/);
  assert.match(lazadaPostbackSource, /multipart\/form-data/);
  assert.match(lazadaPostbackSource, /noStoreText\("Unauthorized"/);
  assert.match(lazadaPostbackSource, /noStoreText\("OK"/);
  assert.match(
    lazadaPostbackSource,
    /request\.headers\.get\("x-lazada-postback-secret"\)[\s\S]{0,140}request\.headers\.get\("x-postback-secret"\)/
  );
  assert.doesNotMatch(lazadaPostbackSource, /getFirstPayloadValue\(payload, \["token", "secret"\]\)/);
  assert.match(lazadaPostbackSource, /payload: stripPayloadPostbackAuthParams\(\{/);
  assert.match(affiliateReportSource, /const path = "\/api\/affiliate\/lazada\/postback";/);
  assert.doesNotMatch(affiliateReportSource, /postback\?token/);
  assert.doesNotMatch(affiliateReportSource, /x-forwarded-host|x-forwarded-proto/);
});

test("page CSP uses per-request script nonces instead of production unsafe-inline", () => {
  const contentSecurityPolicySource = readFileSync("lib/security/content-security-policy.ts", "utf8");
  const rootLayoutSource = readFileSync("app/layout.tsx", "utf8");
  const proxySource = readFileSync("proxy.ts", "utf8");
  const nextConfigSource = readFileSync("next.config.ts", "utf8");

  assert.match(contentSecurityPolicySource, /createContentSecurityPolicyNonce/);
  assert.match(contentSecurityPolicySource, /crypto\.getRandomValues\(bytes\)/);
  assert.match(contentSecurityPolicySource, /`'nonce-\$\{nonce\}'`/);
  assert.match(contentSecurityPolicySource, /isDevelopment && !nonce \? \["'unsafe-inline'"\] : \[\]/);
  assert.doesNotMatch(contentSecurityPolicySource, /isDevelopment \? \["'unsafe-inline'"\] : \[\]/);
  assert.doesNotMatch(contentSecurityPolicySource, /"'strict-dynamic'"/);
  assert.match(contentSecurityPolicySource, /function shouldUpgradeInsecureRequests/);
  assert.match(contentSecurityPolicySource, /!isDevelopment && !usesLocalSupabaseUrl\(supabaseUrl\)/);
  assert.match(contentSecurityPolicySource, /"upgrade-insecure-requests"/);

  assert.match(proxySource, /createContentSecurityPolicyNonce\(\)/);
  assert.match(proxySource, /buildContentSecurityPolicy\(\{ nonce \}\)/);
  assert.match(proxySource, /requestHeaders\.set\("x-nonce", nonce\)/);
  assert.match(proxySource, /res\.headers\.set\("Content-Security-Policy", contentSecurityPolicy\)/);
  assert.match(rootLayoutSource, /import \{ connection \} from "next\/server"/);
  assert.match(rootLayoutSource, /await connection\(\)/);
  assert.doesNotMatch(nextConfigSource, /key: "Content-Security-Policy"/);
});

/* eslint-disable security/detect-non-literal-fs-filename -- This regression test intentionally walks fixed repo source roots to catch unsafe browser sinks. */
test("production source avoids raw HTML and string-code execution sinks", () => {
  const sourceRoots = ["app", "lib", "utils"];
  const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
  const dangerousSinkPatterns = [
    { label: "React raw HTML rendering", pattern: /dangerouslySetInnerHTML/ },
    { label: "raw innerHTML assignment", pattern: /\.innerHTML\b/ },
    { label: "raw outerHTML assignment", pattern: /\.outerHTML\b/ },
    { label: "HTML string insertion", pattern: /insertAdjacentHTML\s*\(/ },
    { label: "document.write HTML insertion", pattern: /document\.write(?:ln)?\s*\(/ },
    { label: "eval string execution", pattern: /\beval\s*\(/ },
    { label: "Function constructor string execution", pattern: /new Function\s*\(/ },
    { label: "string timer callback execution", pattern: /set(?:Timeout|Interval)\s*\(\s*["'`]/ },
    { label: "javascript URL", pattern: /javascript:/i },
  ];
  const sourceFiles = [];

  function collectSourceFiles(directoryPath) {
    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      const entryPath = `${directoryPath}/${entry.name}`;

      if (entry.isDirectory()) {
        collectSourceFiles(entryPath);
        continue;
      }

      const extension = entry.name.slice(entry.name.lastIndexOf("."));

      if (sourceExtensions.has(extension)) {
        sourceFiles.push(entryPath);
      }
    }
  }

  for (const sourceRoot of sourceRoots) {
    collectSourceFiles(sourceRoot);
  }

  const violations = [];

  for (const sourceFile of sourceFiles) {
    const source = readFileSync(sourceFile, "utf8");

    for (const { label, pattern } of dangerousSinkPatterns) {
      if (pattern.test(source)) {
        violations.push(`${sourceFile}: ${label}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
/* eslint-enable security/detect-non-literal-fs-filename */

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

test("github workflow actions are pinned to immutable commit SHAs", () => {
  const workflowSource = [
    readFileSync(".github/workflows/ci.yml", "utf8"),
    readFileSync(".github/workflows/codeql.yml", "utf8"),
    readFileSync(".github/workflows/dependency-review.yml", "utf8"),
  ].join("\n");

  assert.doesNotMatch(workflowSource, /uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@v\d+(?:\s|$)/);
  assert.match(workflowSource, /uses:\s+actions\/checkout@[a-f0-9]{40}\s+# v6/);
  assert.match(workflowSource, /uses:\s+actions\/setup-node@[a-f0-9]{40}\s+# v6/);
  assert.match(workflowSource, /uses:\s+github\/codeql-action\/init@[a-f0-9]{40}\s+# v4/);
  assert.match(workflowSource, /uses:\s+actions\/dependency-review-action@[a-f0-9]{40}\s+# v4\.9\.0/);
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
  assert.match(webSecuritySource, /request\.headers\.get\("sec-fetch-site"\)/);
  assert.match(webSecuritySource, /fetchSite === "same-origin"/);
  assert.match(webSecuritySource, /fetchSite === "same-site"/);
  assert.match(webSecuritySource, /fetchSite === "none"/);
  assert.match(webSecuritySource, /isLocalDevelopmentOrigin\(requestOrigin\)/);
  assert.doesNotMatch(webSecuritySource, /uniqueOrigins\(\[\s*requestOrigin,/);
  assert.doesNotMatch(webSecuritySource, /!== "cross-site"/);
  assert.match(aiSuggestionsSource, /isTrustedRequestOrigin\(request\)/);
  assert.match(peerProfilesSource, /isTrustedRequestOrigin\(request\)/);
  assert.match(affiliateAuthSource, /isTrustedRequestOrigin\(request\)/);
  assert.match(lazadaMatchesSource, /requireAuthenticatedAffiliateRoute\(request,/);
  assert.match(lazadaPrimeLinksSource, /requireAuthenticatedAffiliateRoute\(request,/);
  assert.match(lazadaTestPostbackSource, /isTrustedRequestOrigin\(request\)/);
  assert.doesNotMatch(lazadaPostbackSource, /isTrustedRequestOrigin/);
  assert.doesNotMatch(reminderProcessorSource, /isTrustedRequestOrigin/);
});

test("browser-invoked server mutations share trusted origin context", () => {
  const webSecuritySource = readFileSync("lib/security/web.ts", "utf8");
  const serverActionContextSource = readFileSync("lib/auth/server-action-context.ts", "utf8");
  const createGroupActionsSource = readFileSync("app/create-group/actions.ts", "utf8");
  const dashboardActionsSource = readFileSync("app/dashboard/actions.ts", "utf8");
  const groupActionsSource = readFileSync("app/group/[id]/actions.ts", "utf8");
  const profileActionsSource = readFileSync("app/profile/actions.ts", "utf8");
  const chatActionsSource = readFileSync("app/secret-santa-chat/chat-actions.ts", "utf8");
  const wishlistActionsSource = readFileSync("app/dashboard/wishlist-actions.ts", "utf8");
  const invitePageSource = readFileSync("app/invite/[token]/page.tsx", "utf8");
  const joinInviteStart = invitePageSource.indexOf("async function joinGroupViaInviteToken");
  const joinInviteEnd = invitePageSource.indexOf("export default async function InviteLinkPage");

  assert.match(webSecuritySource, /export function isTrustedHeaderOrigin/);
  assert.match(webSecuritySource, /function getHeaderRequestOrigin/);
  assert.match(webSecuritySource, /headers\.get\("host"\)/);
  assert.match(webSecuritySource, /isLocalDevelopmentOrigin\(requestOrigin\)/);
  assert.doesNotMatch(webSecuritySource, /uniqueOrigins\(\[\s*requestOrigin,/);
  assert.doesNotMatch(webSecuritySource, /x-forwarded-host/);
  assert.doesNotMatch(webSecuritySource, /x-forwarded-proto/);
  assert.match(serverActionContextSource, /import \{ headers \} from "next\/headers"/);
  assert.match(serverActionContextSource, /isTrustedHeaderOrigin\(requestHeaders\)/);
  assert.match(serverActionContextSource, /message: "We could not verify this request\."/);
  assert.match(createGroupActionsSource, /const context = await getServerActionContext\(\)/);
  assert.match(createGroupActionsSource, /enforceRateLimit\(\{[\s\S]{0,220}action: "group\.create"/);
  assert.doesNotMatch(createGroupActionsSource, /supabase\.auth\.getUser\(\)/);
  assert.match(dashboardActionsSource, /const context = await getServerActionContext\(\)/);
  assert.doesNotMatch(dashboardActionsSource, /supabase\.auth\.getUser\(\)/);
  assert.match(groupActionsSource, /getServerActionContext\(\)/);
  assert.doesNotMatch(groupActionsSource, /supabase\.auth\.getUser\(\)/);
  assert.match(profileActionsSource, /getServerActionContext\(\)/);
  assert.doesNotMatch(profileActionsSource, /supabase\.auth\.getUser\(\)/);
  assert.match(chatActionsSource, /getServerActionContext\(\)/);
  assert.match(chatActionsSource, /requireRateLimitedAction\(\{[\s\S]{0,220}action: "chat\.send_message"/);
  assert.doesNotMatch(chatActionsSource, /supabase\.auth\.getUser\(\)/);
  assert.match(wishlistActionsSource, /requireRateLimitedAction\(\{[\s\S]{0,220}action: rateLimitConfig\.action/);
  assert.match(wishlistActionsSource, /requireRateLimitedAction\(\{[\s\S]{0,220}action: "wishlist\.delete_item"/);
  assert.ok(joinInviteStart >= 0 && joinInviteEnd > joinInviteStart);
  assert.match(
    invitePageSource.slice(joinInviteStart, joinInviteEnd),
    /const context = await getServerActionContext\(\)/
  );
});

test("lazada test postback is rate limited and idempotent by day", () => {
  const lazadaTestPostbackSource = readFileSync(
    "app/api/affiliate/lazada/test-postback/route.ts",
    "utf8"
  );
  const lazadaPostbackSource = readFileSync(
    "app/api/affiliate/lazada/postback/route.ts",
    "utf8"
  );
  const affiliateClickTrackingSource = readFileSync("lib/affiliate/click-tracking.ts", "utf8");

  assert.match(lazadaTestPostbackSource, /enforceRateLimit\(\{/);
  assert.match(lazadaTestPostbackSource, /action: "affiliate\.lazada\.test_postback"/);
  assert.match(lazadaTestPostbackSource, /maxAttempts: 5/);
  assert.match(lazadaTestPostbackSource, /windowSeconds: 300/);
  assert.match(lazadaTestPostbackSource, /recordServerFailure\(\{/);
  assert.match(lazadaPostbackSource, /recordServerFailure\(\{/);
  assert.match(affiliateClickTrackingSource, /recordServerFailure\(\{/);
  assert.doesNotMatch(lazadaTestPostbackSource, /console\.error/);
  assert.doesNotMatch(lazadaPostbackSource, /console\.error/);
  assert.doesNotMatch(affiliateClickTrackingSource, /console\.error/);
  assert.match(lazadaTestPostbackSource, /resolveTrustedAppOrigin\(request\.nextUrl\)/);
  assert.doesNotMatch(lazadaTestPostbackSource, /new URL\("\/dashboard\/affiliate-report", request\.url\)/);
  assert.match(lazadaTestPostbackSource, /redirectToReport\(request, "rate_limited"\)/);
  assert.match(lazadaTestPostbackSource, /toISOString\(\)\.slice\(0, 10\)/);
  assert.doesNotMatch(lazadaTestPostbackSource, /transaction_id: `debug-\$\{click\.id\.slice\(0, 8\)\}-\$\{Date\.now\(\)\}`/);
  assert.doesNotMatch(lazadaTestPostbackSource, /function isSameOriginRequest/);
});
