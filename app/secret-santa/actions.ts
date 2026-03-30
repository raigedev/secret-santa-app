"use server";

import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { createNotification } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GIFT_PREP_STATUSES = [
  "planning",
  "purchased",
  "wrapped",
  "ready_to_give",
] as const;

type GiftPrepStatus = (typeof GIFT_PREP_STATUSES)[number];

function isGiftPrepStatus(value: string): value is GiftPrepStatus {
  return GIFT_PREP_STATUSES.includes(value as GiftPrepStatus);
}

export async function updateGiftPrepStatus(
  groupId: string,
  status: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || typeof groupId !== "string" || !status || !isGiftPrepStatus(status)) {
    return { success: false, message: "Invalid gift progress update." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "secret_santa.update_gift_prep_status",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "assignment",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("assignments")
    .select("group_id, gift_received, gift_prep_status")
    .eq("group_id", groupId)
    .eq("giver_id", user.id)
    .maybeSingle();

  if (assignmentError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: assignmentError.message,
      eventType: "secret_santa.update_gift_prep_status.lookup",
      resourceId: groupId,
      resourceType: "assignment",
    });

    return { success: false, message: "Failed to update gift progress." };
  }

  if (!assignment) {
    return { success: false, message: "Assignment not found." };
  }

  if (assignment.gift_received) {
    return {
      success: false,
      message: "Gift progress is locked after the gift is marked received.",
    };
  }

  if (assignment.gift_prep_status === status) {
    return { success: true, message: "Gift progress is already up to date." };
  }

  const { error: updateError } = await supabaseAdmin
    .from("assignments")
    .update({
      gift_prep_status: status,
      gift_prep_updated_at: new Date().toISOString(),
    })
    .eq("group_id", groupId)
    .eq("giver_id", user.id);

  if (updateError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { status },
      errorMessage: updateError.message,
      eventType: "secret_santa.update_gift_prep_status.update",
      resourceId: groupId,
      resourceType: "assignment",
    });

    return { success: false, message: "Failed to update gift progress. Please try again." };
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: { status },
    eventType: "secret_santa.update_gift_prep_status",
    outcome: "success",
    resourceId: groupId,
    resourceType: "assignment",
  });

  return { success: true, message: "Gift progress updated." };
}

export async function confirmGiftReceived(
  groupId: string
): Promise<{ success: boolean; message: string }> {
  if (!groupId || typeof groupId !== "string") {
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
    action: "secret_santa.confirm_gift_received",
    actorUserId: user.id,
    maxAttempts: 10,
    resourceId: groupId,
    resourceType: "assignment",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("assignments")
    .select("group_id, giver_id, gift_received")
    .eq("group_id", groupId)
    .eq("receiver_id", user.id)
    .maybeSingle();

  if (assignmentError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: assignmentError.message,
      eventType: "secret_santa.confirm_gift_received.lookup",
      resourceId: groupId,
      resourceType: "assignment",
    });

    return { success: false, message: "Failed to confirm. Please try again." };
  }

  if (!assignment) {
    return { success: false, message: "Assignment not found." };
  }

  if (assignment.gift_received) {
    return { success: true, message: "Gift already confirmed." };
  }

  const { error: updateError } = await supabaseAdmin
    .from("assignments")
    .update({ gift_received: true, gift_received_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("receiver_id", user.id);

  if (updateError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: updateError.message,
      eventType: "secret_santa.confirm_gift_received.update",
      resourceId: groupId,
      resourceType: "assignment",
    });
    return { success: false, message: "Failed to confirm. Please try again." };
  }

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();

  if (assignment.giver_id) {
    await createNotification({
      userId: assignment.giver_id,
      type: "gift_received",
      title: "Your recipient confirmed their gift",
      body: `Your recipient confirmed they received their gift in ${group?.name || "your group"}.`,
      linkPath: "/secret-santa",
      metadata: {
        groupId,
      },
    });
  }

  await recordAuditEvent({
    actorUserId: user.id,
    eventType: "secret_santa.confirm_gift_received",
    outcome: "success",
    resourceId: groupId,
    resourceType: "assignment",
  });

  return { success: true, message: "Gift confirmed!" };
}
