import "server-only";

import { recordServerFailure } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PendingEmailInvite = {
  group_id: string;
  group_name: string;
  group_description: string;
  group_event_date: string;
  require_anonymous_nickname: boolean;
};

export async function loadPendingEmailInvitesForUser(user: {
  email?: string | null;
  id: string;
}): Promise<{
  invites: PendingEmailInvite[];
  success: boolean;
}> {
  if (!user.email) {
    return { success: false, invites: [] };
  }

  const normalizedEmail = user.email.trim().toLowerCase();

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("group_members")
    .select("group_id")
    .eq("email", normalizedEmail)
    .is("user_id", null)
    .eq("status", "pending");

  if (membershipError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membershipError.message,
      eventType: "dashboard.pending_email_invites.read",
      resourceType: "group_membership",
    });

    return { success: false, invites: [] };
  }

  const groupIds = [...new Set((memberships || []).map((membership) => membership.group_id))];

  if (groupIds.length === 0) {
    return { success: true, invites: [] };
  }

  const { data: groups, error: groupError } = await supabaseAdmin
    .from("groups")
    .select("id, name, description, event_date, require_anonymous_nickname")
    .in("id", groupIds);

  if (groupError) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { groupCount: groupIds.length },
      errorMessage: groupError.message,
      eventType: "dashboard.pending_email_invites.groups",
      resourceType: "group",
    });

    return { success: false, invites: [] };
  }

  return {
    success: true,
    invites: (groups || []).map((group) => ({
      group_id: group.id,
      group_name: group.name || "Secret Santa Group",
      group_description: group.description || "",
      group_event_date: group.event_date,
      require_anonymous_nickname: Boolean(group.require_anonymous_nickname),
    })),
  };
}
