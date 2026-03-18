"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Delete group by ID (expects FormData with "id")
export async function deleteGroup(formData: FormData): Promise<void> {
  const groupId = formData.get("id") as string;
  const supabase = await createClient();

  const { error } = await supabase.from("groups").delete().eq("id", groupId);

  if (error) {
    console.error(error);
    return;
  }

  redirect("/dashboard");
}

// Invite user by email (expects FormData with "id" and "email")
export async function inviteUser(formData: FormData): Promise<void> {
  const groupId = formData.get("id") as string;
  const email = formData.get("email") as string;

  const supabase = await createClient();

  const { error } = await supabase.from("group_members").insert({
    group_id: groupId,
    nickname: email.split("@")[0],
  });

  if (error) {
    console.error("Failed to insert member:", error);
    return;
  }
}