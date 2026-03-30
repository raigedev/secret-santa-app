"use server";

import { randomBytes } from "crypto";
import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function sanitize(input: string, max: number): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, max);
}

function buildInviteToken(): string {
  return randomBytes(24).toString("base64url");
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

  if (!groupId || !email) {
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

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail);
  if (inviteError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { invitedEmail: cleanEmail },
      errorMessage: inviteError.message,
      eventType: "group.invite_user.send_email",
      resourceId: groupId,
      resourceType: "group",
    });
  }

  const { error: insertError } = await supabaseAdmin.from("group_members").insert([
    {
      group_id: groupId,
      email: cleanEmail,
      nickname: cleanEmail.split("@")[0],
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
  const cleanNick = sanitize(nickname, 30);

  if (cleanNick.length === 0) {
    return { success: false, message: "Nickname cannot be empty." };
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

  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

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
  if (!groupId || !memberEmail) {
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

  const { error } = await supabaseAdmin
    .from("group_members")
    .update({ status: "pending" })
    .eq("group_id", groupId)
    .eq("email", memberEmail)
    .eq("status", "declined");

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { memberEmail },
      errorMessage: error.message,
      eventType: "group.resend_invite",
      resourceId: groupId,
      resourceType: "group",
    });

    return { message: "Failed to resend invite." };
  }

  return { message: "Invite resent!" };
}

export async function createInviteLink(
  groupId: string
): Promise<{ success: boolean; message: string; token?: string }> {
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
  const { error: insertError } = await supabaseAdmin.from("group_invite_links").insert({
    group_id: groupId,
    token,
    created_by: user.id,
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
): Promise<{ success: boolean; message: string; token?: string }> {
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
    .select("token, expires_at")
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
    return { success: true, message: "No active invite link." };
  }

  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return { success: true, message: "No active invite link." };
  }

  return {
    success: true,
    message: "Active invite link loaded.",
    token: link.token,
  };
}

export async function revokePendingInvite(
  groupId: string,
  membershipId: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || !membershipId) {
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
    .map((member) => member.nickname?.trim() || member.email?.split("@")[0] || "Participant");

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

export async function editGroup(
  groupId: string,
  name: string,
  description: string,
  eventDate: string,
  budget: number,
  currency: string
): Promise<{ success: boolean; message: string }> {
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
  const cleanCurrency = sanitize(currency, 5);
  const cleanBudget = Math.min(Math.max(Math.floor(budget || 0), 0), 100000);

  if (cleanName.length === 0) {
    return { success: false, message: "Group name is required." };
  }

  if (!eventDate) {
    return { success: false, message: "Event date is required." };
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

  return { success: true, message: "Group updated!" };
}

export async function deleteGroup(
  groupId: string,
  confirmName: string
): Promise<{ success: boolean; message: string }> {
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

export async function triggerReveal(
  groupId: string
): Promise<{
  success: boolean;
  message: string;
  matches?: { giver: string; receiver: string }[];
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
    .select("owner_id, revealed")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can trigger the reveal." };
  }

  if (group.revealed) {
    return { success: false, message: "This group has already been revealed." };
  }

  const { error: updateError } = await supabase
    .from("groups")
    .update({ revealed: true, revealed_at: new Date().toISOString() })
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

  const { data: assignments } = await supabaseAdmin
    .from("assignments")
    .select("giver_id, receiver_id")
    .eq("group_id", groupId);

  const { data: members } = await supabaseAdmin
    .from("group_members")
    .select("user_id, nickname")
    .eq("group_id", groupId)
    .eq("status", "accepted");

  const getNickname = (userId: string) =>
    members?.find((member) => member.user_id === userId)?.nickname || "Participant";

  const matches = (assignments || []).map((assignment) => ({
    giver: getNickname(assignment.giver_id),
    receiver: getNickname(assignment.receiver_id),
  }));

  await recordAuditEvent({
    actorUserId: user.id,
    details: { assignmentCount: matches.length },
    eventType: "group.trigger_reveal",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return { success: true, message: "Reveal triggered!", matches };
}
