import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const MAX_GROUP_MEMBERS = 26;
export const MAX_GROUP_CREATION_INVITES = MAX_GROUP_MEMBERS - 1;

export async function countActiveGroupSlots(groupId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .in("status", ["accepted", "pending"]);

  if (error) {
    throw error;
  }

  return count || 0;
}

export function getGroupCapacityMessage(): string {
  return `This group already has the maximum of ${MAX_GROUP_MEMBERS} accepted or pending members.`;
}
