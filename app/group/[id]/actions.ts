"use server";

import { createHash, randomBytes } from "crypto";
import {
  countActiveGroupSlots,
  getGroupCapacityMessage,
  MAX_GROUP_MEMBERS,
} from "@/lib/groups/capacity";
import { buildInviteLinkExpiresAt } from "@/lib/groups/invite-links.mjs";
import { sanitizeGroupNickname, validateAnonymousGroupNickname } from "@/lib/groups/nickname";
import { hasDeclinedInviteResendTarget } from "@/lib/groups/resend-invite.mjs";
import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { createNotification, createNotifications } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function sanitize(input: string, max: number): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, max);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "GBP", "PHP", "JPY", "AUD", "CAD"]);

function buildInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

async function sendInviteEmail(
  email: string,
  actorUserId: string,
  groupId: string,
  eventType: string
): Promise<{ message?: string; success: boolean }> {
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (!error) {
    return { success: true };
  }

  await recordServerFailure({
    actorUserId,
    details: { invitedEmail: email },
    errorMessage: error.message,
    eventType,
    resourceId: groupId,
    resourceType: "group",
  });

  return {
    success: false,
    message: "Failed to send the invite email. Please try again.",
  };
}

async function findExistingUserIdByEmail(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      return null;
    }

    const matchedUser = data.users.find(
      (candidateUser) => (candidateUser.email || "").toLowerCase() === normalizedEmail
    );

    if (matchedUser) {
      return matchedUser.id;
    }

    if (data.users.length < 200) {
      break;
    }
  }

  return null;
}

async function notifyInvitedUser(options: {
  userId: string | null;
  groupId: string;
  groupName: string;
}): Promise<void> {
  if (!options.userId) {
    return;
  }

  await createNotification({
    userId: options.userId,
    type: "invite",
    title: `New group invite: ${options.groupName}`,
    body: "You have a pending group invitation. Open your dashboard to accept or decline it.",
    linkPath: "/dashboard",
    metadata: {
      groupId: options.groupId,
    },
    preferenceKey: "notify_invites",
  });
}

async function groupHasDrawStarted(groupId: string): Promise<boolean> {
  const { data: existingDraw } = await supabaseAdmin
    .from("assignments")
    .select("id")
    .eq("group_id", groupId)
    .limit(1);

  return Boolean(existingDraw && existingDraw.length > 0);
}

async function assertOwnerCanManageInvites(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  actorUserId: string
): Promise<{ ok: boolean; message?: string }> {
  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== actorUserId) {
    return { ok: false, message: "Only the group owner can manage invites." };
  }

  if (await groupHasDrawStarted(groupId)) {
    return {
      ok: false,
      message: "Invites can only be managed before names are drawn.",
    };
  }

  return { ok: true };
}

export async function inviteUser(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const groupId = formData.get("id") as string;
  const email = formData.get("email") as string;

  if (!groupId || !UUID_PATTERN.test(groupId) || !email) {
    return { message: "Missing group ID or email." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.invite_user",
    actorUserId: user.id,
    maxAttempts: 15,
    resourceId: groupId,
    resourceType: "group",
    subject: `${user.id}:${groupId}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { message: rateLimit.message };
  }

  const permission = await assertOwnerCanManageInvites(supabase, groupId, user.id);
  if (!permission.ok) {
    return { message: permission.message || "Invite unavailable." };
  }

  const cleanEmail = sanitize(email, 100).toLowerCase();
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    return { message: "Enter a valid email address." };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("name, require_anonymous_nickname")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    return { message: "Group not found." };
  }

  const existingUserId = await findExistingUserIdByEmail(cleanEmail);
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("group_members")
    .select("id, status, user_id, email")
    .eq("group_id", groupId)
    .limit(100);

  if (membershipsError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { invitedEmail: cleanEmail },
      errorMessage: membershipsError.message,
      eventType: "group.invite_user.lookup_memberships",
      resourceId: groupId,
      resourceType: "group",
    });

    return { message: "Failed to check the current group members." };
  }

  const matchingMembership =
    (memberships || []).find(
      (membership) =>
        (existingUserId ? membership.user_id === existingUserId : false) ||
        (membership.email || "").toLowerCase() === cleanEmail
    ) || null;

  if (matchingMembership?.status === "accepted") {
    return { message: "That person is already in the group." };
  }

  if (matchingMembership?.status === "pending") {
    return { message: "That person already has a pending invite." };
  }

  if (matchingMembership?.status === "declined") {
    return { message: "That invite was declined. Use Resend to invite them again." };
  }

  try {
    const activeSlotCount = await countActiveGroupSlots(groupId);
    if (activeSlotCount >= MAX_GROUP_MEMBERS) {
      return { message: getGroupCapacityMessage() };
    }
  } catch (capacityError) {
    const errorMessage =
      capacityError instanceof Error ? capacityError.message : "Unknown capacity error";

    await recordServerFailure({
      actorUserId: user.id,
      details: { invitedEmail: cleanEmail },
      errorMessage,
      eventType: "group.invite_user.capacity_check",
      resourceId: groupId,
      resourceType: "group",
    });

    return { message: "Failed to check the current group capacity." };
  }

  if (!existingUserId) {
    const inviteResult = await sendInviteEmail(
      cleanEmail,
      user.id,
      groupId,
      "group.invite_user.send_email"
    );

    if (!inviteResult.success) {
      return { message: inviteResult.message || "Failed to send the invite email." };
    }
  }

  const { error: insertError } = await supabaseAdmin.from("group_members").insert([
    {
      group_id: groupId,
      user_id: existingUserId,
      email: cleanEmail,
      nickname: group.require_anonymous_nickname ? null : cleanEmail.split("@")[0],
      role: "member",
      status: "pending",
    },
  ]);

  if (insertError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { invitedEmail: cleanEmail },
      errorMessage: insertError.message,
      eventType: "group.invite_user.insert_member",
      resourceId: groupId,
      resourceType: "group",
    });

    return { message: "Failed to add member. They may already be in the group." };
  }

  await notifyInvitedUser({
    userId: existingUserId,
    groupId,
    groupName: group.name,
  });

  await recordAuditEvent({
    actorUserId: user.id,
    details: { invitedEmail: cleanEmail },
    eventType: "group.invite_user",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return { message: `Invite sent to ${cleanEmail}` };
}

export async function updateNickname(
  groupId: string,
  nickname: string
): Promise<{ success: boolean; message: string }> {
  const cleanNick = sanitizeGroupNickname(nickname);

  if (cleanNick.length === 0) {
    return { success: false, message: "Nickname cannot be empty." };
  }

  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Invalid group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.update_nickname",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "group_membership",
    subject: user.id,
    windowSeconds: 900,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const [membershipResult, groupResult, profileResult] = await Promise.all([
    supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("groups")
      .select("require_anonymous_nickname")
      .eq("id", groupId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const { data: membership, error: membershipError } = membershipResult;

  if (membershipError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membershipError.message,
      eventType: "group.update_nickname.lookup",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to update nickname." };
  }

  if (groupResult.data?.require_anonymous_nickname) {
    const nicknameMessage = validateAnonymousGroupNickname({
      nickname: cleanNick,
      displayName: profileResult.data?.display_name || null,
      email: user.email || null,
    });

    if (nicknameMessage) {
      return { success: false, message: nicknameMessage };
    }
  }

  if (!membership) {
    return { success: false, message: "Membership not found." };
  }

  const { error } = await supabaseAdmin
    .from("group_members")
    .update({ nickname: cleanNick })
    .eq("id", membership.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "group.update_nickname.update",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to update nickname." };
  }

  return { success: true, message: `Nickname updated to "${cleanNick}"!` };
}

export async function resendInvite(
  groupId: string,
  memberEmail: string
): Promise<{ message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId) || !memberEmail) {
    return { message: "Missing group ID or email." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.resend_invite",
    actorUserId: user.id,
    maxAttempts: 10,
    resourceId: groupId,
    resourceType: "group",
    subject: `${user.id}:${groupId}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { message: rateLimit.message };
  }

  const permission = await assertOwnerCanManageInvites(supabase, groupId, user.id);
  if (!permission.ok) {
    return { message: permission.message || "Invite unavailable." };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    return { message: "Group not found." };
  }

  const normalizedEmail = sanitize(memberEmail, 100).toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return { message: "Enter a valid email address." };
  }

  const existingUserId = await findExistingUserIdByEmail(normalizedEmail);
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("group_members")
    .select("id, status, user_id, email")
    .eq("group_id", groupId)
    .limit(100);

  if (membershipsError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { memberEmail: normalizedEmail },
      errorMessage: membershipsError.message,
      eventType: "group.resend_invite.lookup_memberships",
      resourceId: groupId,
      resourceType: "group",
    });

    return { message: "Failed to resend invite." };
  }

  if (
    !hasDeclinedInviteResendTarget(memberships, {
      email: normalizedEmail,
      existingUserId,
    })
  ) {
    return { message: "Only declined invites can be resent." };
  }

  if (!existingUserId) {
    const inviteResult = await sendInviteEmail(
      normalizedEmail,
      user.id,
      groupId,
      "group.resend_invite.send_email"
    );

    if (!inviteResult.success) {
      return { message: inviteResult.message || "Failed to resend invite." };
    }
  }

  const { data: updatedRows, error } = await supabaseAdmin
    .from("group_members")
    .update({ status: "pending", user_id: existingUserId })
    .eq("group_id", groupId)
    .eq("email", normalizedEmail)
    .eq("status", "declined")
    .select("id");

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { memberEmail: normalizedEmail },
      errorMessage: error.message,
      eventType: "group.resend_invite",
      resourceId: groupId,
      resourceType: "group",
    });

    return { message: "Failed to resend invite." };
  }

  if (!updatedRows || updatedRows.length === 0) {
    return { message: "Only declined invites can be resent." };
  }

  await notifyInvitedUser({
    userId: existingUserId,
    groupId,
    groupName: group.name,
  });

  return { message: "Invite resent!" };
}

export async function createInviteLink(
  groupId: string
): Promise<{ success: boolean; message: string; token?: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.create_invite_link",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "group",
    subject: `${user.id}:${groupId}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const permission = await assertOwnerCanManageInvites(supabase, groupId, user.id);
  if (!permission.ok) {
    return { success: false, message: permission.message || "Invite link unavailable." };
  }

  const revokedAt = new Date().toISOString();
  const { error: revokeExistingError } = await supabaseAdmin
    .from("group_invite_links")
    .update({ is_active: false, revoked_at: revokedAt })
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (revokeExistingError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: revokeExistingError.message,
      eventType: "group.create_invite_link.revoke_existing",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to refresh the invite link." };
  }

  const token = buildInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = buildInviteLinkExpiresAt();
  const { error: insertError } = await supabaseAdmin.from("group_invite_links").insert({
    group_id: groupId,
    token: null,
    token_hash: tokenHash,
    created_by: user.id,
    expires_at: expiresAt,
  });

  if (insertError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: insertError.message,
      eventType: "group.create_invite_link.insert",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to create invite link." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { linkType: "shared" },
    eventType: "group.create_invite_link",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return {
    success: true,
    message: "✅ Invite link ready.",
    token,
  };
}

export async function revokeInviteLink(
  groupId: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.revoke_invite_link",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "group",
    subject: `${user.id}:${groupId}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const permission = await assertOwnerCanManageInvites(supabase, groupId, user.id);
  if (!permission.ok) {
    return { success: false, message: permission.message || "Invite link unavailable." };
  }

  const revokedAt = new Date().toISOString();
  const { data: revokedRows, error: revokeError } = await supabaseAdmin
    .from("group_invite_links")
    .update({ is_active: false, revoked_at: revokedAt })
    .eq("group_id", groupId)
    .eq("is_active", true)
    .select("id");

  if (revokeError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: revokeError.message,
      eventType: "group.revoke_invite_link",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to revoke invite link." };
  }

  if (!revokedRows || revokedRows.length === 0) {
    return { success: false, message: "No active invite link to revoke." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { revokedCount: revokedRows.length },
    eventType: "group.revoke_invite_link",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return { success: true, message: "✅ Invite link revoked." };
}

export async function getActiveInviteLink(
  groupId: string
): Promise<{ success: boolean; hasActiveLink?: boolean; message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can view invite links." };
  }

  const { data: link, error } = await supabaseAdmin
    .from("group_invite_links")
    .select("id, expires_at")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "group.get_active_invite_link",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load the active invite link." };
  }

  if (!link) {
    return { success: true, hasActiveLink: false, message: "No active invite link." };
  }

  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return { success: true, hasActiveLink: false, message: "No active invite link." };
  }

  return {
    success: true,
    hasActiveLink: true,
    message: "An active invite link already exists. Generate a fresh one to copy a new shareable link.",
  };
}

export async function revokePendingInvite(
  groupId: string,
  membershipId: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId) || !membershipId || !UUID_PATTERN.test(membershipId)) {
    return { success: false, message: "Missing invite details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.revoke_pending_invite",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "group_membership",
    subject: `${user.id}:${groupId}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const permission = await assertOwnerCanManageInvites(supabase, groupId, user.id);
  if (!permission.ok) {
    return { success: false, message: permission.message || "Invite unavailable." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("id, role, status, email")
    .eq("group_id", groupId)
    .eq("id", membershipId)
    .maybeSingle();

  if (membershipError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membershipError.message,
      eventType: "group.revoke_pending_invite.lookup",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to load invite." };
  }

  if (!membership) {
    return { success: false, message: "Invite not found." };
  }

  if (membership.role === "owner" || membership.status === "accepted") {
    return { success: false, message: "Only non-accepted invites can be revoked." };
  }

  const { error: deleteError } = await supabaseAdmin
    .from("group_members")
    .delete()
    .eq("id", membership.id);

  if (deleteError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { membershipId: membership.id, inviteEmail: membership.email },
      errorMessage: deleteError.message,
      eventType: "group.revoke_pending_invite.delete",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to revoke invite." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { inviteEmail: membership.email || null, inviteStatus: membership.status },
    eventType: "group.revoke_pending_invite",
    outcome: "success",
    resourceId: membership.id,
    resourceType: "group_membership",
  });

  return { success: true, message: "✅ Invite revoked." };
}

export async function getGroupOwnerInsights(groupId: string): Promise<{
  success: boolean;
  message: string;
  insights?: {
    acceptedCount: number;
    wishlistReadyCount: number;
    missingWishlistMemberNames: string[];
    activeChatThreadCount: number;
    totalChatThreadCount: number;
    confirmedGiftCount: number;
    totalGiftCount: number;
  };
}> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.get_owner_insights",
    actorUserId: user.id,
    maxAttempts: 1000,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can view insights." };
  }

  const [
    { data: acceptedMembers, error: acceptedMembersError },
    { data: wishlistRows, error: wishlistRowsError },
    { data: assignments, error: assignmentsError },
    { data: messageRows, error: messageRowsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("group_members")
      .select("user_id, nickname, email")
      .eq("group_id", groupId)
      .eq("status", "accepted"),
    supabaseAdmin.from("wishlists").select("user_id").eq("group_id", groupId),
    supabaseAdmin
      .from("assignments")
      .select("giver_id, receiver_id, gift_received")
      .eq("group_id", groupId),
    supabaseAdmin
      .from("messages")
      .select("thread_giver_id, thread_receiver_id")
      .eq("group_id", groupId),
  ]);

  const firstError =
    acceptedMembersError || wishlistRowsError || assignmentsError || messageRowsError;

  if (firstError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: firstError.message,
      eventType: "group.get_owner_insights",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load owner insights." };
  }

  const safeAcceptedMembers = (acceptedMembers || []).filter(
    (member): member is { user_id: string; nickname: string | null; email: string | null } =>
      Boolean(member.user_id)
  );

  const acceptedUserIds = new Set(safeAcceptedMembers.map((member) => member.user_id));
  const membersWithWishlist = new Set(
    (wishlistRows || [])
      .map((row) => row.user_id)
      .filter((userId): userId is string => Boolean(userId) && acceptedUserIds.has(userId))
  );

  const missingWishlistMemberNames = safeAcceptedMembers
    .filter((member) => !membersWithWishlist.has(member.user_id))
    .map((member) => member.nickname?.trim() || member.email?.split("@")[0] || "Member");

  const assignmentThreadKeys = new Set(
    (assignments || []).map((assignment) => `${assignment.giver_id}:${assignment.receiver_id}`)
  );
  const activeChatThreadKeys = new Set(
    (messageRows || [])
      .map((message) => `${message.thread_giver_id}:${message.thread_receiver_id}`)
      .filter((threadKey) => assignmentThreadKeys.has(threadKey))
  );

  const confirmedGiftCount = (assignments || []).filter(
    (assignment) => assignment.gift_received
  ).length;

  return {
    success: true,
    message: "Owner insights loaded.",
    insights: {
      acceptedCount: safeAcceptedMembers.length,
      wishlistReadyCount: safeAcceptedMembers.length - missingWishlistMemberNames.length,
      missingWishlistMemberNames,
      activeChatThreadCount: activeChatThreadKeys.size,
      totalChatThreadCount: assignmentThreadKeys.size,
      confirmedGiftCount,
      totalGiftCount: assignmentThreadKeys.size,
    },
  };
}

export async function getGroupRecap(groupId: string): Promise<{
  success: boolean;
  message: string;
  recap?: {
    activeChatThreadCount: number;
    aliasRoster: Array<{
      alias: string;
      avatarEmoji: string;
      realName: string;
    }>;
    confirmedGiftCount: number;
    participantCount: number;
    totalChatThreadCount: number;
    totalGiftCount: number;
    wishlistMissingAliases: string[];
    wishlistReadyCount: number;
  };
}> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.get_recap",
    actorUserId: user.id,
    maxAttempts: 500,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, revealed")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    return { success: false, message: "Group not found." };
  }

  const isOwner = group.owner_id === user.id;

  if (!isOwner) {
    const { data: membership } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (!membership) {
      return { success: false, message: "Only accepted members can view the group recap." };
    }
  }

  if (!group.revealed) {
    return { success: false, message: "The owner has not revealed the group recap yet." };
  }

  const [{ assignments, participants }, { data: wishlistRows, error: wishlistRowsError }, { data: messageRows, error: messageRowsError }] =
    await Promise.all([
      loadRevealSourceData(groupId),
      supabaseAdmin.from("wishlists").select("user_id").eq("group_id", groupId),
      supabaseAdmin
        .from("messages")
        .select("thread_giver_id, thread_receiver_id")
        .eq("group_id", groupId),
    ]);

  const firstError = wishlistRowsError || messageRowsError;

  if (firstError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: firstError.message,
      eventType: "group.get_recap",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load the group recap." };
  }

  const participantUserIds = new Set(participants.map((participant) => participant.userId));
  const membersWithWishlist = new Set(
    (wishlistRows || [])
      .map((row) => row.user_id)
      .filter((userId): userId is string => Boolean(userId) && participantUserIds.has(userId))
  );
  const wishlistMissingAliases = participants
    .filter((participant) => !membersWithWishlist.has(participant.userId))
    .map((participant) => participant.alias);
  const assignmentThreadKeys = new Set(
    assignments.map((assignment) => `${assignment.giver_id}:${assignment.receiver_id}`)
  );
  const activeChatThreadKeys = new Set(
    (messageRows || [])
      .map((message) => `${message.thread_giver_id}:${message.thread_receiver_id}`)
      .filter((threadKey) => assignmentThreadKeys.has(threadKey))
  );
  const { data: confirmedAssignments, error: confirmedAssignmentsError } = await supabaseAdmin
    .from("assignments")
    .select("gift_received")
    .eq("group_id", groupId);

  if (confirmedAssignmentsError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: confirmedAssignmentsError.message,
      eventType: "group.get_recap.confirmed_assignments",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load the group recap." };
  }

  const confirmedGiftCount = (confirmedAssignments || []).filter(
    (assignment) => assignment.gift_received
  ).length;

  return {
    success: true,
    message: "Group recap loaded.",
    recap: {
      activeChatThreadCount: activeChatThreadKeys.size,
      aliasRoster: participants.map((participant) => ({
        alias: participant.alias,
        avatarEmoji: participant.avatarEmoji,
        realName: participant.realName,
      })),
      confirmedGiftCount,
      participantCount: participants.length,
      totalChatThreadCount: assignmentThreadKeys.size,
      totalGiftCount: assignments.length,
      wishlistMissingAliases,
      wishlistReadyCount: participants.length - wishlistMissingAliases.length,
    },
  };
}

export async function editGroup(
  groupId: string,
  name: string,
  description: string,
  eventDate: string,
  budget: number,
  currency: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Invalid group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.edit",
    actorUserId: user.id,
    maxAttempts: 15,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 900,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const cleanName = sanitize(name, 100);
  const cleanDesc = sanitize(description, 300);
  const cleanCurrency = sanitize(currency, 5).toUpperCase();
  const cleanBudget = Math.min(Math.max(Math.floor(budget || 0), 0), 100000);

  if (cleanName.length === 0) {
    return { success: false, message: "Group name is required." };
  }

  if (!eventDate) {
    return { success: false, message: "Event date is required." };
  }

  if (!ALLOWED_CURRENCIES.has(cleanCurrency)) {
    return { success: false, message: "Choose a valid currency." };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can edit this group." };
  }

  const { error } = await supabase
    .from("groups")
    .update({
      name: cleanName,
      description: cleanDesc,
      event_date: eventDate,
      budget: cleanBudget,
      currency: cleanCurrency,
    })
    .eq("id", groupId);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "group.edit",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to update group. Please try again." };
  }

  return { success: true, message: "Group saved." };
}

export async function deleteGroup(
  groupId: string,
  confirmName: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Invalid group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.delete",
    actorUserId: user.id,
    maxAttempts: 5,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, name")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can delete this group." };
  }

  if (confirmName.trim().toLowerCase() !== group.name.trim().toLowerCase()) {
    return { success: false, message: "Group name does not match. Please type it exactly." };
  }

  const { error } = await supabase.from("groups").delete().eq("id", groupId);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "group.delete",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to delete group. Please try again." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    eventType: "group.delete",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return { success: true, message: "Group deleted." };
}

export async function removeMember(
  groupId: string,
  memberId: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId) || !memberId || !UUID_PATTERN.test(memberId)) {
    return { success: false, message: "Invalid group or member ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (memberId === user.id) {
    return { success: false, message: "Use 'Leave Group' to remove yourself." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.remove_member",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "group",
    subject: `${user.id}:${groupId}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can remove members." };
  }

  if (await groupHasDrawStarted(groupId)) {
    return {
      success: false,
      message: "Members cannot be removed after names are drawn. Reset the draw first.",
    };
  }

  const { error } = await supabaseAdmin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { memberId },
      errorMessage: error.message,
      eventType: "group.remove_member",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to remove member. Please try again." };
  }

  return { success: true, message: "Member removed." };
}

export async function leaveGroup(
  groupId: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Invalid group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.leave",
    actorUserId: user.id,
    maxAttempts: 10,
    resourceId: groupId,
    resourceType: "group_membership",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group) {
    return { success: false, message: "Group not found." };
  }

  if (group.owner_id === user.id) {
    return { success: false, message: "The owner cannot leave. Delete the group instead." };
  }

  if (await groupHasDrawStarted(groupId)) {
    return {
      success: false,
      message: "You cannot leave after names are drawn. Ask the owner to reset the draw first.",
    };
  }

  const { error } = await supabaseAdmin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "group.leave",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to leave group. Please try again." };
  }

  return { success: true, message: "You left the group." };
}

type RevealMatch = {
  giver: string;
  receiver: string;
};

type RevealParticipant = {
  avatarEmoji: string;
  realName: string;
  userId: string;
  alias: string;
};

type RevealSourceData = {
  assignments: { giver_id: string; receiver_id: string }[];
  participants: RevealParticipant[];
};

type RevealSessionState = {
  cardRevealed: boolean;
  countdownSeconds: number;
  countdownStartedAt: string | null;
  currentIndex: number;
  lastUpdatedAt: string | null;
  publishedAt: string | null;
  startedAt: string | null;
  status: "idle" | "waiting" | "countdown" | "live" | "published";
};

async function loadRevealSourceData(groupId: string): Promise<RevealSourceData> {
  const supabase = await createClient();

  const [{ data: assignments }, { data: members }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from("assignments").select("giver_id, receiver_id").eq("group_id", groupId),
    supabaseAdmin
      .from("group_members")
      .select("user_id, nickname, email")
      .eq("group_id", groupId)
      .eq("status", "accepted"),
    supabase.rpc("list_group_peer_profiles", { p_group_id: groupId }),
  ]);

  const profileByUserId = new Map<
    string,
    { avatarEmoji: string | null; displayName: string | null }
  >();

  for (const profile of profiles || []) {
    if (profile.user_id) {
      profileByUserId.set(profile.user_id, {
        avatarEmoji: profile.avatar_emoji || null,
        displayName: profile.display_name || null,
      });
    }
  }

  const participants: RevealParticipant[] = [];

  for (const member of members || []) {
    if (member.user_id) {
      const profile = profileByUserId.get(member.user_id);
      const emailLabel = member.email?.split("@")[0] || "Member";
      const alias = member.nickname?.trim() || profile?.displayName?.trim() || emailLabel;
      const realName = profile?.displayName?.trim() || alias || emailLabel;

      participants.push({
        userId: member.user_id,
        alias,
        realName,
        avatarEmoji: profile?.avatarEmoji || "🎁",
      });
    }
  }

  return {
    assignments: assignments || [],
    participants: participants.sort((left, right) => left.alias.localeCompare(right.alias)),
  };
}

async function buildRevealMatches(groupId: string): Promise<RevealMatch[]> {
  const { assignments, participants } = await loadRevealSourceData(groupId);
  const realNameByUserId = new Map(participants.map((participant) => [participant.userId, participant.realName]));

  return assignments
    .map((assignment) => ({
      giver: realNameByUserId.get(assignment.giver_id) || "Member",
      receiver: realNameByUserId.get(assignment.receiver_id) || "Member",
    }))
    .sort((left, right) => left.giver.localeCompare(right.giver));
}

function getRevealStepCount(sourceData: RevealSourceData): number {
  return sourceData.participants.length + sourceData.assignments.length;
}

function normalizeRevealSession(options: {
  entryCount: number;
  groupRevealed: boolean;
  groupRevealedAt: string | null;
  session: {
    card_revealed: boolean | null;
    countdown_seconds: number | null;
    countdown_started_at: string | null;
    current_index: number | null;
    last_updated_at: string | null;
    published_at: string | null;
    started_at: string | null;
    status: string | null;
  } | null;
}): RevealSessionState {
  const fallbackStatus: RevealSessionState["status"] = options.groupRevealed ? "published" : "idle";
  const safeStatus =
    options.session?.status === "waiting" ||
    options.session?.status === "countdown" ||
    options.session?.status === "live" ||
    options.session?.status === "published"
      ? options.session.status
      : fallbackStatus;
  const maxIndex = Math.max(options.entryCount - 1, 0);
  const rawIndex = options.session?.current_index ?? 0;

  return {
    status: safeStatus,
    // The client uses the persisted timestamp plus this duration to render the
    // same countdown on the TV and every joined phone without needing a server tick.
    countdownSeconds: Math.max(Math.floor(options.session?.countdown_seconds || 0), 0),
    countdownStartedAt: options.session?.countdown_started_at || null,
    currentIndex: Math.min(Math.max(rawIndex, 0), maxIndex),
    cardRevealed:
      safeStatus === "published"
        ? true
        : Boolean(options.session?.card_revealed) && options.entryCount > 0,
    startedAt: options.session?.started_at || null,
    lastUpdatedAt: options.session?.last_updated_at || options.groupRevealedAt,
    publishedAt: options.session?.published_at || options.groupRevealedAt,
  };
}

async function getStoredRevealSession(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from("group_reveal_sessions")
    .select(
      "status, current_index, card_revealed, countdown_started_at, countdown_seconds, started_at, published_at, last_updated_at"
    )
    .eq("group_id", groupId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

async function upsertRevealSession(options: {
  cardRevealed: boolean;
  countdownSeconds?: number;
  countdownStartedAt?: string | null;
  currentIndex: number;
  groupId: string;
  publishedAt?: string | null;
  startedBy?: string | null;
  startedAt?: string | null;
  status: RevealSessionState["status"];
}): Promise<RevealSessionState | null> {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("group_reveal_sessions")
    .upsert(
      {
        group_id: options.groupId,
        status: options.status,
        current_index: options.currentIndex,
        card_revealed: options.cardRevealed,
        countdown_started_at: options.countdownStartedAt || null,
        countdown_seconds: Math.max(Math.floor(options.countdownSeconds || 0), 0),
        started_by: options.startedBy || null,
        started_at: options.startedAt || null,
        published_at: options.publishedAt || null,
        last_updated_at: timestamp,
      },
      { onConflict: "group_id" }
    )
    .select(
      "status, current_index, card_revealed, countdown_started_at, countdown_seconds, started_at, published_at, last_updated_at"
    )
    .single();

  if (error) {
    return null;
  }

  return normalizeRevealSession({
    entryCount: Number.MAX_SAFE_INTEGER,
    groupRevealed: options.status === "published",
    groupRevealedAt: options.publishedAt || null,
    session: data,
  });
}

async function assertOwnerCanControlReveal(
  groupId: string,
  actorUserId: string
): Promise<{
  groupName?: string;
  ok: boolean;
  revealed?: boolean;
}> {
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, name, revealed")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== actorUserId) {
    return { ok: false };
  }

  return {
    ok: true,
    groupName: group.name,
    revealed: group.revealed,
  };
}

export async function getRevealPresentationData(
  groupId: string
): Promise<{
  success: boolean;
  message: string;
  data?: {
    aliasEntries: Array<{
      alias: string;
      avatarEmoji: string;
      realName: string | null;
    }>;
    matchEntries: Array<{
      giver: string | null;
      receiver: string | null;
    }>;
    canPreviewBeforeReveal: boolean;
    groupName: string;
    isOwner: boolean;
    revealed: boolean;
    revealedAt: string | null;
    session: RevealSessionState;
  };
}> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.get_reveal_presentation",
    actorUserId: user.id,
    maxAttempts: 500,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const [{ data: group }, storedSession, sourceData] = await Promise.all([
    supabase
      .from("groups")
      .select("name, owner_id, revealed, revealed_at")
      .eq("id", groupId)
      .maybeSingle(),
    getStoredRevealSession(groupId),
    loadRevealSourceData(groupId),
  ]);

  if (!group) {
    return { success: false, message: "Group not found." };
  }

  if (sourceData.assignments.length === 0) {
    return { success: false, message: "Names have not been drawn yet." };
  }

  const isOwner = group.owner_id === user.id;

  if (!isOwner) {
    const { data: membership } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (!membership) {
      return { success: false, message: "Only accepted members can view this reveal screen." };
    }
  }

  const normalizedSession = normalizeRevealSession({
    entryCount: getRevealStepCount(sourceData),
    groupRevealed: group.revealed,
    groupRevealedAt: group.revealed_at,
    session: storedSession,
  });

  // Keep real names hidden from non-owners until the shared reveal actually starts.
  // Owners can always preview locally before the public reveal begins.
  const canRevealRealNamesToViewer =
    isOwner ||
    normalizedSession.status === "countdown" ||
    normalizedSession.status === "live" ||
    normalizedSession.status === "published" ||
    group.revealed;
  const canRevealMatchNamesToViewer =
    isOwner ||
    group.revealed ||
    normalizedSession.status === "published" ||
    (normalizedSession.status === "live" &&
      normalizedSession.currentIndex >= sourceData.participants.length);
  const revealMatches = sourceData.assignments
    .map((assignment) => {
      const giver = sourceData.participants.find(
        (participant) => participant.userId === assignment.giver_id
      );
      const receiver = sourceData.participants.find(
        (participant) => participant.userId === assignment.receiver_id
      );

      return {
        giver: giver?.realName || "Member",
        receiver: receiver?.realName || "Member",
      };
    })
    .sort((left, right) => left.giver.localeCompare(right.giver));

  return {
    success: true,
    message: "Reveal screen loaded.",
    data: {
      aliasEntries: sourceData.participants.map((participant) => ({
        alias: participant.alias,
        avatarEmoji: participant.avatarEmoji,
        realName: canRevealRealNamesToViewer ? participant.realName : null,
      })),
      matchEntries: revealMatches.map((match) => ({
        giver: canRevealMatchNamesToViewer ? match.giver : null,
        receiver: canRevealMatchNamesToViewer ? match.receiver : null,
      })),
      canPreviewBeforeReveal: isOwner,
      groupName: group.name,
      isOwner,
      revealed: group.revealed,
      revealedAt: group.revealed_at,
      session: normalizedSession,
    },
  };
}

export async function startRevealSession(
  groupId: string,
  currentIndex: number
): Promise<{
  success: boolean;
  message: string;
  session?: RevealSessionState;
}> {
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.start_reveal_session",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const permission = await assertOwnerCanControlReveal(groupId, user.id);
  if (!permission.ok) {
    return { success: false, message: "Only the group owner can start the live reveal." };
  }

  if (permission.revealed) {
    return { success: false, message: "This group has already been fully revealed." };
  }

  const sourceData = await loadRevealSourceData(groupId);
  if (sourceData.assignments.length === 0 || sourceData.participants.length === 0) {
    return { success: false, message: "Names need to be drawn before the live reveal can start." };
  }

  const safeIndex = Math.min(
    Math.max(Math.floor(currentIndex || 0), 0),
    Math.max(getRevealStepCount(sourceData) - 1, 0)
  );
  const startedAt = new Date().toISOString();
  const session = await upsertRevealSession({
    groupId,
    // Opening the room first lets audience devices join and wait without seeing
    // the countdown or codename progression start unexpectedly.
    status: "waiting",
    currentIndex: safeIndex,
    cardRevealed: false,
    countdownStartedAt: null,
    countdownSeconds: 0,
    startedBy: user.id,
    startedAt,
  });

  if (!session) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: "Failed to upsert live reveal session.",
      eventType: "group.start_reveal_session",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to start the live reveal." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { currentIndex: safeIndex },
    eventType: "group.start_reveal_session",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return {
    success: true,
    message: "Live reveal room opened. Start the countdown when everyone is ready.",
    session: {
      ...session,
      currentIndex: Math.min(session.currentIndex, Math.max(getRevealStepCount(sourceData) - 1, 0)),
    },
  };
}

export async function startRevealCountdown(
  groupId: string,
  currentIndex: number
): Promise<{
  success: boolean;
  message: string;
  session?: RevealSessionState;
}> {
  if (!groupId) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.start_reveal_countdown",
    actorUserId: user.id,
    maxAttempts: 30,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const permission = await assertOwnerCanControlReveal(groupId, user.id);
  if (!permission.ok) {
    return { success: false, message: "Only the group owner can start the countdown." };
  }

  if (permission.revealed) {
    return { success: false, message: "This group has already been fully revealed." };
  }

  const sourceData = await loadRevealSourceData(groupId);
  if (sourceData.assignments.length === 0 || sourceData.participants.length === 0) {
    return { success: false, message: "Names need to be drawn before the countdown can start." };
  }

  const existingSession = await getStoredRevealSession(groupId);
  const safeIndex = Math.min(
    Math.max(Math.floor(currentIndex || 0), 0),
    Math.max(getRevealStepCount(sourceData) - 1, 0)
  );
  const countdownStartedAt = new Date().toISOString();
  const session = await upsertRevealSession({
    groupId,
    // Persist the countdown start so every joined screen can derive the same
    // remaining time from one shared source of truth.
    status: "countdown",
    currentIndex: safeIndex,
    cardRevealed: false,
    countdownStartedAt,
    countdownSeconds: 3,
    startedBy: user.id,
    startedAt: existingSession?.started_at || new Date().toISOString(),
  });

  if (!session) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: "Failed to start the shared reveal countdown.",
      eventType: "group.start_reveal_countdown",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to start the live countdown." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { currentIndex: safeIndex, countdownSeconds: 3 },
    eventType: "group.start_reveal_countdown",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return {
    success: true,
    message: "Countdown started. The reveal card will appear on every joined screen.",
    session: {
      ...session,
      currentIndex: Math.min(session.currentIndex, Math.max(getRevealStepCount(sourceData) - 1, 0)),
    },
  };
}

export async function updateRevealSessionState(
  groupId: string,
  currentIndex: number,
  cardRevealed: boolean
): Promise<{
  success: boolean;
  message: string;
  session?: RevealSessionState;
}> {
  if (!groupId) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.update_reveal_session",
    actorUserId: user.id,
    maxAttempts: 400,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const permission = await assertOwnerCanControlReveal(groupId, user.id);
  if (!permission.ok) {
    return { success: false, message: "Only the group owner can control the live reveal." };
  }

  const sourceData = await loadRevealSourceData(groupId);
  if (sourceData.assignments.length === 0 || sourceData.participants.length === 0) {
    return { success: false, message: "Names need to be drawn before the live reveal can run." };
  }

  const existingSession = await getStoredRevealSession(groupId);
  const nextStatus: RevealSessionState["status"] =
    existingSession?.status === "published" || permission.revealed ? "published" : "live";
  const safeIndex = Math.min(
    Math.max(Math.floor(currentIndex || 0), 0),
    Math.max(getRevealStepCount(sourceData) - 1, 0)
  );
  const session = await upsertRevealSession({
    groupId,
    status: nextStatus,
    currentIndex: safeIndex,
    cardRevealed,
    countdownStartedAt: null,
    countdownSeconds: 0,
    startedBy: existingSession ? user.id : user.id,
    startedAt: existingSession?.started_at || new Date().toISOString(),
    publishedAt: nextStatus === "published" ? existingSession?.published_at || new Date().toISOString() : null,
  });

  if (!session) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: "Failed to update live reveal session.",
      eventType: "group.update_reveal_session",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to update the live reveal." };
  }

  return {
    success: true,
    message: "Live reveal updated.",
    session: {
      ...session,
      currentIndex: Math.min(session.currentIndex, Math.max(getRevealStepCount(sourceData) - 1, 0)),
    },
  };
}

export async function getRevealMatches(
  groupId: string
): Promise<{
  success: boolean;
  message: string;
  matches?: RevealMatch[];
  revealedAt?: string | null;
}> {
  if (!groupId) {
    return { success: false, message: "Missing group ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.get_reveal_matches",
    actorUserId: user.id,
    maxAttempts: 500,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, revealed, revealed_at")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    return { success: false, message: "Group not found." };
  }

  const isOwner = group.owner_id === user.id;

  if (!isOwner) {
    const { data: membership } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (!membership) {
      return { success: false, message: "Only accepted members can view the reveal." };
    }
  }

  if (!group.revealed) {
    return { success: false, message: "The owner has not revealed the matches yet." };
  }

  return {
    success: true,
    message: "Reveal matches loaded.",
    matches: await buildRevealMatches(groupId),
    revealedAt: group.revealed_at,
  };
}

export async function triggerReveal(
  groupId: string
): Promise<{
  success: boolean;
  message: string;
  matches?: RevealMatch[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "group.trigger_reveal",
    actorUserId: user.id,
    maxAttempts: 5,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, revealed, name")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can trigger the reveal." };
  }

  if (group.revealed) {
    return { success: false, message: "This group has already been revealed." };
  }

  const revealedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("groups")
    .update({ revealed: true, revealed_at: revealedAt })
    .eq("id", groupId);

  if (updateError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: updateError.message,
      eventType: "group.trigger_reveal",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to trigger reveal. Please try again." };
  }

  const matches = await buildRevealMatches(groupId);
  const existingSession = await getStoredRevealSession(groupId);
  const publishedSession = await upsertRevealSession({
    groupId,
    status: "published",
    currentIndex: existingSession?.current_index ?? 0,
    cardRevealed: true,
    countdownStartedAt: null,
    countdownSeconds: 0,
    startedBy: user.id,
    startedAt: existingSession?.started_at || revealedAt,
    publishedAt: revealedAt,
  });

  if (!publishedSession) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: "Failed to persist published reveal session.",
      eventType: "group.trigger_reveal.persist_session",
      resourceId: groupId,
      resourceType: "group",
    });
  }

  const { data: members } = await supabaseAdmin
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "accepted");

  await createNotifications(
    (members || [])
      .map((member) => member.user_id)
      .filter((memberUserId): memberUserId is string => Boolean(memberUserId) && memberUserId !== user.id)
      .map((memberUserId) => ({
        userId: memberUserId,
        type: "reveal",
        title: `Reveal time in ${group.name}`,
        body: "The owner revealed the Secret Santa matches. Open the group to see the full reveal.",
        linkPath: `/group/${groupId}`,
        metadata: {
          groupId,
        },
        preferenceKey: "notify_draws" as const,
      }))
  );

  await recordAuditEvent({
    actorUserId: user.id,
    details: { assignmentCount: matches.length },
    eventType: "group.trigger_reveal",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return { success: true, message: "Matches revealed.", matches };
}
