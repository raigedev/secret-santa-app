import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmptyQueryResult } from "./dashboard-formatters";
import type {
  AssignmentRow,
  Group,
  GroupMemberRow,
  GroupRow,
  MembershipRow,
  PeerProfileRow,
} from "./dashboard-types";

type DashboardGroupsUser = {
  id: string;
  email?: string | null;
};

type GroupOwnerRow = {
  id: string;
};

export type DashboardGroupsLoadResult = {
  allGroups: Group[];
  invitedGroups: Group[];
  ownedGroups: Group[];
};

export function splitDashboardGroups(groups: Group[]): DashboardGroupsLoadResult {
  const ownedGroups = groups.filter((group) => group.isOwner);
  const invitedGroups = groups.filter((group) => !group.isOwner);

  return {
    allGroups: groups,
    invitedGroups,
    ownedGroups,
  };
}

export async function loadDashboardGroups(
  supabase: SupabaseClient,
  user: DashboardGroupsUser
): Promise<DashboardGroupsLoadResult> {
  const [membershipRes, ownedGroupLookupRes] = await Promise.all([
    supabase
      .from("group_members")
      .select("id, group_id, status, role")
      .eq("user_id", user.id),
    supabase.from("groups").select("id").eq("owner_id", user.id),
  ]);

  if (membershipRes.error) {
    throw membershipRes.error;
  }

  if (ownedGroupLookupRes.error) {
    throw ownedGroupLookupRes.error;
  }

  const memberRows = (membershipRes.data || []) as MembershipRow[];
  const ownedGroupRows = (ownedGroupLookupRes.data || []) as GroupOwnerRow[];
  const ownedGroupIds = [...new Set(ownedGroupRows.map((group) => group.id))];

  if (memberRows.length === 0 && ownedGroupIds.length === 0) {
    return splitDashboardGroups([]);
  }

  const acceptedRows = memberRows.filter((row) => row.status === "accepted");
  const acceptedGroupIds = [...new Set([...acceptedRows.map((row) => row.group_id), ...ownedGroupIds])];
  const roleMap: Record<string, string> = {};

  for (const ownedGroupId of ownedGroupIds) {
    roleMap[ownedGroupId] = "owner";
  }

  for (const row of acceptedRows) {
    roleMap[row.group_id] = row.role;
  }

  const [groupsRes, membersRes, assignmentsRes] = await Promise.all([
    acceptedGroupIds.length > 0
      ? supabase
          .from("groups")
          .select("id, name, description, event_date, budget, currency, owner_id, created_at, require_anonymous_nickname")
          .in("id", acceptedGroupIds)
      : createEmptyQueryResult<GroupRow>(),
    acceptedGroupIds.length > 0
      ? supabase
          .from("group_members")
          .select("group_id, user_id, nickname, email, role")
          .in("group_id", acceptedGroupIds)
          .eq("status", "accepted")
      : createEmptyQueryResult<GroupMemberRow>(),
    acceptedGroupIds.length > 0
      ? supabase.from("assignments").select("group_id").in("group_id", acceptedGroupIds)
      : createEmptyQueryResult<AssignmentRow>(),
  ]);

  if (groupsRes.error) {
    throw groupsRes.error;
  }

  if (membersRes.error) {
    throw membersRes.error;
  }

  if (assignmentsRes.error) {
    throw assignmentsRes.error;
  }

  const groupsData = (groupsRes.data || []) as GroupRow[];
  const allMembers = (membersRes.data || []) as GroupMemberRow[];
  const allAssignments = (assignmentsRes.data || []) as AssignmentRow[];
  const drawnGroupIds = new Set(allAssignments.map((assignment) => assignment.group_id));

  return splitDashboardGroups(
    groupsData.map((group) => ({
      ...group,
      hasDrawn: drawnGroupIds.has(group.id),
      isOwner: roleMap[group.id] === "owner",
      members: allMembers
        .filter((member) => member.group_id === group.id)
        .map((member) => ({
          avatarEmoji: null,
          avatarUrl: null,
          displayName: null,
          email: member.email,
          nickname: member.nickname,
          role: member.role,
          userId: member.user_id,
        })),
    }))
  );
}

export async function enhanceDashboardGroupsWithPeerProfiles(
  groups: Group[]
): Promise<Group[]> {
  if (groups.length === 0) {
    return groups;
  }

  const response = await fetch("/api/groups/peer-profiles", {
    cache: "no-store",
    credentials: "same-origin",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupIds: groups.map((group) => group.id) }),
  });

  if (!response.ok) {
    return groups;
  }

  const payload = (await response.json()) as {
    profilesByGroup?: Record<string, PeerProfileRow[]>;
  };
  const profilesByGroup = payload.profilesByGroup || {};
  const profileEntries = groups.map((group) => ({
    groupId: group.id,
    profiles: profilesByGroup[group.id] || [],
  }));

  const profileMapByGroup = new Map<
    string,
    Map<string, { avatarEmoji: string | null; avatarUrl: string | null; displayName: string | null }>
  >();

  for (const entry of profileEntries) {
    const profileMap = new Map<
      string,
      { avatarEmoji: string | null; avatarUrl: string | null; displayName: string | null }
    >();

    for (const profile of entry.profiles) {
      if (profile.user_id) {
        profileMap.set(profile.user_id, {
          avatarEmoji: profile.avatar_emoji || null,
          avatarUrl: profile.avatar_url || null,
          displayName: profile.display_name || null,
        });
      }
    }

    profileMapByGroup.set(entry.groupId, profileMap);
  }

  return groups.map((group) => {
    const groupProfileMap = profileMapByGroup.get(group.id);

    if (!groupProfileMap) {
      return group;
    }

    return {
      ...group,
      members: group.members.map((member) => {
        const profile = member.userId ? groupProfileMap.get(member.userId) : null;

        return {
          ...member,
          avatarEmoji: profile?.avatarEmoji || member.avatarEmoji,
          avatarUrl: group.require_anonymous_nickname ? null : profile?.avatarUrl || member.avatarUrl,
          displayName: group.require_anonymous_nickname ? null : profile?.displayName || member.displayName,
        };
      }),
    };
  });
}
