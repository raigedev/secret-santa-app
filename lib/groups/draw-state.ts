import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export async function groupHasDrawStarted(groupId: string): Promise<boolean> {
  const { data: existingDraw } = await supabaseAdmin
    .from("assignments")
    .select("id")
    .eq("group_id", groupId)
    .limit(1);

  return Boolean(existingDraw && existingDraw.length > 0);
}
