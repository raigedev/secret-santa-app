"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function deleteGroup(groupId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);

  if (error) {
    console.error(error);
    return { success: false };
  }

  redirect("/dashboard");
}

export async function inviteUser(groupId: string, email: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("group_members").insert({
    group_id: groupId,
    nickname: email.split("@")[0],
  });

  if (error) {
    console.error("Failed to insert member:", error);
    return { success: false, message: "Error adding member" };
  }

  return { success: true, message: "User invited" };
}