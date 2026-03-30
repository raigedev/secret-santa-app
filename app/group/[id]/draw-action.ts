"use server";

import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { createNotifications } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DRAW_MAX_ATTEMPTS = 5;
const DRAW_WINDOW_SECONDS = 3600;

const RESET_DRAW_MAX_ATTEMPTS = 5;
const RESET_DRAW_WINDOW_SECONDS = 3600;

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
    maxAttempts: DRAW_MAX_ATTEMPTS,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: DRAW_WINDOW_SECONDS,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, name")
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

  // Pair each giver with the next person in the shuffled list, then wrap the
  // last giver back to the first receiver to keep the assignment circular.
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

  await createNotifications(
    assignments
      .map((assignment) => assignment.giver_id)
      .filter((giverId): giverId is string => Boolean(giverId) && giverId !== user.id)
      .map((giverId) => ({
        userId: giverId,
        type: "draw",
        title: `Names were drawn in ${group.name}`,
        body: "Your recipient is ready. Open Secret Santa to see your assignment and start planning.",
        linkPath: "/secret-santa",
        metadata: {
          groupId,
        },
        preferenceKey: "notify_draws" as const,
      }))
  );

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
    message: `✅ Names drawn! ${assignments.length} members assigned.`,
  };
}

export async function resetSecretSantaDraw(
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
    action: "group.reset_secret_santa",
    actorUserId: user.id,
    maxAttempts: RESET_DRAW_MAX_ATTEMPTS,
    resourceId: groupId,
    resourceType: "group",
    subject: user.id,
    windowSeconds: RESET_DRAW_WINDOW_SECONDS,
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

  if (group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can reset the draw." };
  }

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from("assignments")
    .select("id, gift_received")
    .eq("group_id", groupId);

  if (assignmentsError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: assignmentsError.message,
      eventType: "group.reset_secret_santa.fetch_assignments",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to load the current draw." };
  }

  if (!assignments || assignments.length === 0) {
    return { success: false, message: "There is no active draw to reset." };
  }

  const assignmentCount = assignments.length;
  const confirmedGiftCount = assignments.filter((assignment) => assignment.gift_received).length;

  // A reset needs to clear chat state tied to the old assignment pairs,
  // otherwise stale anonymous threads survive into the next draw.
  const { error: threadReadsError } = await supabaseAdmin
    .from("thread_reads")
    .delete()
    .eq("group_id", groupId);

  if (threadReadsError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: threadReadsError.message,
      eventType: "group.reset_secret_santa.clear_thread_reads",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to clear thread read history." };
  }

  const { error: messagesError } = await supabaseAdmin
    .from("messages")
    .delete()
    .eq("group_id", groupId);

  if (messagesError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: messagesError.message,
      eventType: "group.reset_secret_santa.clear_messages",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to clear anonymous chat history." };
  }

  const { error: deleteAssignmentsError } = await supabaseAdmin
    .from("assignments")
    .delete()
    .eq("group_id", groupId);

  if (deleteAssignmentsError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { assignmentCount },
      errorMessage: deleteAssignmentsError.message,
      eventType: "group.reset_secret_santa.delete_assignments",
      resourceId: groupId,
      resourceType: "group",
    });

    return { success: false, message: "Failed to clear assignments." };
  }

  const { error: resetRevealError } = await supabaseAdmin
    .from("groups")
    .update({
      revealed: false,
      revealed_at: null,
    })
    .eq("id", groupId);

  if (resetRevealError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: resetRevealError.message,
      eventType: "group.reset_secret_santa.reset_reveal_state",
      resourceId: groupId,
      resourceType: "group",
    });

    return {
      success: false,
      message: "Assignments were cleared, but the group state was not fully reset.",
    };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: {
      assignmentCount,
      confirmedGiftCount,
    },
    eventType: "group.reset_secret_santa",
    outcome: "success",
    resourceId: groupId,
    resourceType: "group",
  });

  return {
    success: true,
    message: `✅ Draw reset. Removed ${assignmentCount} assignment(s) and cleared anonymous chat history.`,
  };
}
