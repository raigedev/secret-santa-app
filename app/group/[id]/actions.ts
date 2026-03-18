"use server";

import { createClient, supabaseAdmin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Delete group by ID (expects FormData with "id")
export async function deleteGroup(formData: FormData): Promise<void> {
  const groupId = formData.get("id") as string;
  const supabase = await createClient();

  const { error } = await supabase.from("groups").delete().eq("id", groupId);

  if (error) {
    console.error("Failed to delete group:", error);
    return;
  }

  // Redirect back to dashboard after successful delete
  redirect("/dashboard");
}

// Invite user by email (for useFormState, expects prevState + FormData)
export async function inviteUser(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const groupId = formData.get("id") as string;
  const email = formData.get("email") as string;

  // Step 1: Send actual invite email via Supabase Admin
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (error) {
    console.error("Failed to send invite email:", error);
    return { message: "❌ Error sending invite email" };
  }

  // Step 2: Insert into group_members so they appear in the list
  const supabase = await createClient();
  const { error: insertError } = await supabase.from("group_members").insert({
    group_id: groupId,
    user_id: data.user.id, // link invited user to group
    nickname: email.split("@")[0],
  });

  if (insertError) {
    console.error("Failed to insert member:", insertError);
    return { message: "❌ Error adding member to group" };
  }

  return { message: "✅ Invite email sent successfully" };
}