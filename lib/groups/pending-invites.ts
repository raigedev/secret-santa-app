import "server-only";

import { isGroupInHistory } from "@/lib/groups/history";
import { recordServerFailure } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PendingInvite = {
  group_id: string;
  group_name: string;
  group_description: string;
  group_event_date: string;
  require_anonymous_nickname: boolean;
};

export async function loadPendingInvitesForUser(user: {
  email?: string | null;
  id: string;
}): Promise<{ invites: PendingInvite[]; success: boolean }> {
  const email = user.email?.trim().toLowerCase();
  const pendingMemberships = () =>
    supabaseAdmin.from("group_members").select("group_id").eq("status", "pending");
  const [linked, emailOnly] = await Promise.all([
    pendingMemberships().eq("user_id", user.id),
    email
      ? pendingMemberships().eq("email", email).is("user_id", null)
      : { data: [], error: null },
  ]);
  const membershipError = linked.error || emailOnly.error;

  if (membershipError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: membershipError.message,
      eventType: "groups.pending_invites.read",
      resourceType: "group_membership",
    });
    return { success: false, invites: [] };
  }

  const memberships = [...(linked.data || []), ...(emailOnly.data || [])];
  const groupIds = [...new Set(memberships.map((membership) => membership.group_id))];
  if (!groupIds.length) {
    return { success: true, invites: [] };
  }

  const { data: groups, error } = await supabaseAdmin
    .from("groups")
    .select("id, name, description, event_date, event_timezone, require_anonymous_nickname")
    .in("id", groupIds)
    .order("event_date");

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      details: { groupCount: groupIds.length },
      errorMessage: error.message,
      eventType: "groups.pending_invites.groups",
      resourceType: "group_membership",
    });
    return { success: false, invites: [] };
  }

  const now = Date.now();
  const invites = (groups || [])
    .filter((group) => !isGroupInHistory(group.event_date, now, group.event_timezone))
    .map((group) => ({
      group_id: group.id,
      group_name: group.name || "Secret Santa Group",
      group_description: group.description || "",
      group_event_date: group.event_date,
      require_anonymous_nickname: Boolean(group.require_anonymous_nickname),
    }));

  return { success: true, invites };
}
