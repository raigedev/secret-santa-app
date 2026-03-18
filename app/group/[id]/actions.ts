"use server";

import { createClient, supabaseAdmin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Delete group by ID (expects FormData with "id")
export async function deleteGroup(formData: FormData): Promise<void> {
  const groupId = formData.get("id") as string;
  const supabase = await createClient(); // ✅ await here

  const { error } = await supabase.from("groups").delete().eq("id", groupId);

  if (error) {
    console.error("Failed to delete group:", error.message);
    return;
  }

  redirect("/dashboard");
}

// Invite user by email (for useFormState, expects prevState + FormData)
export async function inviteUser(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const groupId = formData.get("id") as string;
  const email = formData.get("email") as string;

  if (!groupId || !email) {
    return { message: "❌ Missing group ID or email." };
  }

  // Step 1: Send actual invite email via Supabase Admin
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    console.error("Failed to send invite email:", inviteError.message);
    return { message: `❌ Error sending invite email: ${inviteError.message}` };
  }

  // Step 2: Insert into group_members reserved by email (no user_id yet)
  const supabase = await createClient(); // ✅ await here
  const { data, error: insertError } = await supabase
    .from("group_members")
    .insert([{ group_id: groupId, email, nickname: email.split("@")[0] }]);

  if (insertError) {
    console.error("Failed to insert member:", insertError.message);
    return { message: `❌ Error adding member: ${insertError.message}` };
  }

  console.log("Invite inserted:", data);

  return { message: `✅ Invite sent to ${email}` };
}