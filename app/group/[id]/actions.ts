"use server";

import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function sanitize(input: string, max: number): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, max);
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

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { message: "Only the group owner can invite members." };
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

  const { error: insertError } = await supabase.from("group_members").insert([
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
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const groupId = formData.get("groupId") as string;
  const nickname = formData.get("nickname") as string;
  const cleanNick = sanitize(nickname, 30);

  if (cleanNick.length === 0) {
    return { message: "Nickname cannot be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be logged in." };
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
    return { message: rateLimit.message };
  }

  const { error } = await supabase
    .from("group_members")
    .update({ nickname: cleanNick })
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "group.update_nickname",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { message: "Failed to update nickname." };
  }

  return { message: `Nickname updated to "${cleanNick}"!` };
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

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { message: "Only the group owner can resend invites." };
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

  const { error } = await supabase
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

  const { error } = await supabase
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
