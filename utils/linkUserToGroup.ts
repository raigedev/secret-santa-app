import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js"; // ✅ import Supabase User type

const supabase = createClient();

export async function linkUserToGroup(user: User) {
  if (!user?.email || !user?.id) return;

  await supabase
    .from("group_members")
    .update({ user_id: user.id })
    .eq("email", user.email);
}