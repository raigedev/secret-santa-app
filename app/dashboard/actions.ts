"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type MembershipActionResult = {
  success: boolean;
  message: string;
};

export async function claimInvitedMemberships(): Promise<{
  linkedCount: number;
  success: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return { success: false, linkedCount: 0 };
  }

  const normalizedEmail = user.email.toLowerCase();

  const { data: memberships, error: membershipError } = await supabase
    .from("group_members")
    .select("id")
    .eq("email", normalizedEmail)
    .is("user_id", null);

  if (membershipError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membershipError.message,
      eventType: "dashboard.claim_invited_memberships.read",
      resourceType: "group_membership",
    });

    return { success: false, linkedCount: 0 };
  }

  const linkedCount = memberships?.length || 0;

  if (linkedCount === 0) {
    return { success: true, linkedCount: 0 };
  }

  const { error: updateError } = await supabaseAdmin
    .from("group_members")
    .update({ user_id: user.id })
    .eq("email", normalizedEmail)
    .is("user_id", null);

  if (updateError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { linkedCount },
      errorMessage: updateError.message,
      eventType: "dashboard.claim_invited_memberships.update",
      resourceType: "group_membership",
    });

    return { success: false, linkedCount: 0 };
  }

  return { success: true, linkedCount };
}

export async function acceptInvite(groupId: string): Promise<MembershipActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
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
    return { success: false, message: rateLimit.message };
  }

  const normalizedEmail = (user.email || "").toLowerCase();
  const { data: memberships, error: membershipError } = await supabase
    .from("group_members")
    .select("id, user_id, email")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .limit(20);

  if (membershipError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membershipError.message,
      eventType: "dashboard.accept_invite.lookup",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to accept invite. Please try again." };
  }

  const membership = (memberships || []).find(
    (row) => row.user_id === user.id || (!row.user_id && row.email === normalizedEmail)
  );

  if (!membership) {
    return { success: false, message: "Invitation not found." };
  }

  const { error } = await supabaseAdmin
    .from("group_members")
    .update({ status: "accepted", user_id: user.id })
    .eq("id", membership.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "dashboard.accept_invite.update",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to accept invite. Please try again." };
  }

  return { success: true, message: "Invitation accepted!" };
}

export async function declineInvite(groupId: string): Promise<MembershipActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
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
    return { success: false, message: rateLimit.message };
  }

  const normalizedEmail = (user.email || "").toLowerCase();
  const { data: memberships, error: membershipError } = await supabase
    .from("group_members")
    .select("id, user_id, email")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .limit(20);

  if (membershipError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membershipError.message,
      eventType: "dashboard.decline_invite.lookup",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to decline invite. Please try again." };
  }

  const membership = (memberships || []).find(
    (row) => row.user_id === user.id || (!row.user_id && row.email === normalizedEmail)
  );

  if (!membership) {
    return { success: false, message: "Invitation not found." };
  }

  const { error } = await supabaseAdmin
    .from("group_members")
    .update({ status: "declined", user_id: user.id })
    .eq("id", membership.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "dashboard.decline_invite.update",
      resourceId: groupId,
      resourceType: "group_membership",
    });

    return { success: false, message: "Failed to decline invite. Please try again." };
  }

  return { success: true, message: "Invitation declined." };
}
