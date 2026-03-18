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