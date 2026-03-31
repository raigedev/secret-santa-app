import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export async function linkUserToGroup(user: User) {
  if (!user?.email || !user?.id) return;

  const supabase = createClient();

  await supabase
    .from("group_members")
    .update({ user_id: user.id })
    .eq("email", user.email);
}
