"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { createNotification } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MembershipActionResult = {
  success: boolean;
  message: string;
};

async function notifyOwnerAboutInviteResponse(options: {
  actorUserId: string;
  groupId: string;
  response: "accepted" | "declined";
}) {
  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("owner_id, name")
    .eq("id", options.groupId)
    .maybeSingle();

  if (!group || group.owner_id === options.actorUserId) {
    return;
  }

  await createNotification({
    userId: group.owner_id,
    type: "invite",
    title:
      options.response === "accepted"
        ? "A member accepted your invite"
        : "A member declined your invite",
    body:
      options.response === "accepted"
        ? `Someone accepted your invite to ${group.name}.`
        : `Someone declined your invite to ${group.name}.`,
    linkPath: `/group/${options.groupId}`,
    metadata: {
      groupId: options.groupId,
      response: options.response,
    },
    preferenceKey: "notify_invites",
  });
}

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
    .select("id, group_id, status")
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

  const pendingMemberships = (memberships || []).filter(
    (membership) => membership.status === "pending"
  );

  if (pendingMemberships.length > 0) {
    const pendingGroupIds = [...new Set(pendingMemberships.map((membership) => membership.group_id))];
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name")
      .in("id", pendingGroupIds);

    const groupNameById = new Map(
      (groups || []).map((group) => [group.id, group.name || "Secret Santa Group"])
    );

    await Promise.all(
      pendingMemberships.map((membership) =>
        createNotification({
          userId: user.id,
          type: "invite",
          title: `New group invite: ${groupNameById.get(membership.group_id) || "Secret Santa Group"}`,
          body: "You have a pending group invitation. Open your dashboard to accept or decline it.",
          linkPath: "/dashboard",
          metadata: {
            groupId: membership.group_id,
            membershipId: membership.id,
          },
          preferenceKey: "notify_invites",
        })
      )
    );
  }

  return { success: true, linkedCount };
}

export async function acceptInvite(groupId: string): Promise<MembershipActionResult> {
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

  await notifyOwnerAboutInviteResponse({
    actorUserId: user.id,
    groupId,
    response: "accepted",
  });

  return { success: true, message: "Invitation accepted!" };
}

export async function declineInvite(groupId: string): Promise<MembershipActionResult> {
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

  await notifyOwnerAboutInviteResponse({
    actorUserId: user.id,
    groupId,
    response: "declined",
  });

  return { success: true, message: "Invitation declined." };
}
