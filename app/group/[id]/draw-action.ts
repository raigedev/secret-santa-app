"use server";

import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function drawSecretSanta(
  groupId: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || typeof groupId !== "string" || groupId.trim().length === 0) {
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
    action: "group.draw_secret_santa",
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
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    return { success: false, message: "Group not found." };
  }

  if (group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can draw names." };
  }

  const { data: existingDraw } = await supabaseAdmin
    .from("assignments")
    .select("id")
    .eq("group_id", groupId)
    .limit(1);

  if (existingDraw && existingDraw.length > 0) {
    return { success: false, message: "Names have already been drawn for this group." };
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from("group_members")
    .select("user_id, nickname")
    .eq("group_id", groupId)
    .eq("status", "accepted");

  if (membersError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membersError.message,
      eventType: "group.draw_secret_santa.fetch_members",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load members." };
  }

  if (!members || members.length < 3) {
    return {
      success: false,
      message: "Need at least 3 accepted members to draw names.",
    };
  }

  const unlinkedMembers = members.filter((member) => !member.user_id);
  if (unlinkedMembers.length > 0) {
    return {
      success: false,
      message: `${unlinkedMembers.length} member(s) have not registered yet. All members must have accounts.`,
    };
  }

  const { data: nonAccepted } = await supabaseAdmin
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .neq("status", "accepted");

  if (nonAccepted && nonAccepted.length > 0) {
    return {
      success: false,
      message: "All invited members must accept before drawing names.",
    };
  }

  const shuffled = [...members];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const assignments = shuffled.map((member, index) => ({
    group_id: groupId,
    giver_id: member.user_id,
    receiver_id: shuffled[(index + 1) % shuffled.length].user_id,
  }));

  const { error: insertError } = await supabaseAdmin.from("assignments").insert(assignments);

  if (insertError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { assignmentCount: assignments.length },
      errorMessage: insertError.message,
      eventType: "group.draw_secret_santa.save_assignments",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to save assignments. Please try again." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { assignmentCount: assignments.length },
    eventType: "group.draw_secret_santa",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return {
    success: true,
    message: `Names drawn! ${assignments.length} members assigned.`,
  };
}
