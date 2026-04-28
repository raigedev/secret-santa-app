"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function linkUserToGroup() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !user.id) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("group_members")
    .update({ user_id: user.id })
    .eq("email", user.email.toLowerCase())
    .is("user_id", null);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "auth.link_user_to_group",
      resourceType: "group_membership",
    });
  }
}
