"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { sanitizeGroupNickname, validateAnonymousGroupNickname } from "@/lib/groups/nickname";
import { createNotification } from "@/lib/notifications";
import {
  requireRateLimitedAction,
  type ServerActionUser,
  type ServerSupabaseClient,
} from "@/lib/auth/server-action-context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/common";

type MembershipActionResult = {
  success: boolean;
  message: string;
};

type PreparedInviteResponseAction =
  | {
      success: true;
      supabase: ServerSupabaseClient;
      user: ServerActionUser;
    }
  | {
      message: string;
      success: false;
    };

async function prepareInviteResponseAction(
  groupId: string,
  action: "dashboard.accept_invite" | "dashboard.decline_invite"
): Promise<PreparedInviteResponseAction> {
  if (!isUuid(groupId)) {
    return { success: false, message: "Invalid group ID." };
  }

  const context = await requireRateLimitedAction({
    action,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "group_membership",
    subject: (userId) => userId,
    windowSeconds: 600,
  });

  if (!context.ok) {
    return { success: false, message: context.message };
  }

  return { success: true, supabase: context.supabase, user: context.user };
}

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

  const { data: memberships, error: membershipError } = await supabaseAdmin
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

export async function acceptInvite(
  groupId: string,
  nickname?: string
): Promise<MembershipActionResult> {
  const preparedAction = await prepareInviteResponseAction(groupId, "dashboard.accept_invite");

  if (!preparedAction.success) {
    return { success: false, message: preparedAction.message };
  }

  const { supabase, user } = preparedAction;
  const normalizedEmail = (user.email || "").toLowerCase();
  const [membershipsResult, groupResult, profileResult] = await Promise.all([
    supabase
      .from("group_members")
      .select("id, user_id, email, nickname")
      .eq("group_id", groupId)
      .eq("status", "pending")
      .limit(20),
    supabase
      .from("groups")
      .select("id, require_anonymous_nickname")
      .eq("id", groupId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const { data: memberships, error: membershipError } = membershipsResult;

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

  const requiresAnonymousNickname = Boolean(groupResult.data?.require_anonymous_nickname);
  const cleanNickname = sanitizeGroupNickname(nickname || "");

  if (requiresAnonymousNickname) {
    const nicknameMessage = validateAnonymousGroupNickname({
      nickname: cleanNickname,
      displayName: profileResult.data?.display_name || null,
      email: normalizedEmail,
    });

    if (nicknameMessage) {
      return { success: false, message: nicknameMessage };
    }
  }

  const membershipUpdate: {
    nickname?: string;
    status: "accepted";
    user_id: string;
  } = {
    status: "accepted",
    user_id: user.id,
  };

  if (requiresAnonymousNickname) {
    membershipUpdate.nickname = cleanNickname;
  } else if (!membership.nickname) {
    membershipUpdate.nickname = normalizedEmail.split("@")[0] || "member";
  }

  const { error } = await supabaseAdmin
    .from("group_members")
    .update(membershipUpdate)
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
  const preparedAction = await prepareInviteResponseAction(groupId, "dashboard.decline_invite");

  if (!preparedAction.success) {
    return { success: false, message: preparedAction.message };
  }

  const { supabase, user } = preparedAction;
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
