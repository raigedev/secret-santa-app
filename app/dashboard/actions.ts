"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvite(groupId: string): Promise<{ message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "dashboard.accept_invite",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "group_membership",
    subject: user.id,
    windowSeconds: 600,
  });

  if (!rateLimit.allowed) {
    return { message: rateLimit.message };
  }

  const { error } = await supabase
    .from("group_members")
    .update({ status: "accepted" })
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "dashboard.accept_invite",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { message: "Failed to accept invite. Please try again." };
  }

  return { message: "Invitation accepted!" };
}

export async function declineInvite(groupId: string): Promise<{ message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "dashboard.decline_invite",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "group_membership",
    subject: user.id,
    windowSeconds: 600,
  });

  if (!rateLimit.allowed) {
    return { message: rateLimit.message };
  }

  const { error } = await supabase
    .from("group_members")
    .update({ status: "declined" })
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "dashboard.decline_invite",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { message: "Failed to decline invite. Please try again." };
  }

  return { message: "Invitation declined." };
}
