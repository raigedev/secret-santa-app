"use server";

// ─── Server Actions for Group Detail Page ───
// These run on the SERVER for security.
// They can use the admin client and access secret env variables.

import { createClient, supabaseAdmin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// ─── DELETE GROUP ───
export async function deleteGroup(formData: FormData): Promise<void> {
  const groupId = formData.get("id") as string;
  const supabase = await createClient();

  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);

  if (error) {
    console.error("Failed to delete group:", error.message);
    return;
  }

  redirect("/dashboard");
}

// ─── INVITE USER ───
export async function inviteUser(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const groupId = formData.get("id") as string;
  const email = formData.get("email") as string;

  if (!groupId || !email) {
    return { message: "❌ Missing group ID or email." };
  }

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    console.error("Failed to send invite email:", inviteError.message);
  }

  const supabase = await createClient();
  const { error: insertError } = await supabase
    .from("group_members")
    .insert([{
      group_id: groupId,
      email: email.toLowerCase().trim(),
      nickname: email.split("@")[0],
      role: "member",
    }]);

  if (insertError) {
    console.error("Failed to insert member:", insertError.message);
    return { message: `❌ Error adding member: ${insertError.message}` };
  }

  return { message: `✅ Invite sent to ${email}` };
}

// ─── UPDATE NICKNAME ───
export async function updateNickname(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const groupId = formData.get("groupId") as string;
  const nickname = formData.get("nickname") as string;

  if (!nickname || nickname.trim().length === 0) {
    return { message: "❌ Nickname can't be empty." };
  }

  if (nickname.trim().length > 30) {
    return { message: "❌ Nickname must be 30 characters or less." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "❌ You must be logged in." };
  }

  const { error } = await supabase
    .from("group_members")
    .update({ nickname: nickname.trim() })
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to update nickname:", error.message);
    return { message: `❌ Error: ${error.message}` };
  }

  return { message: `✅ Nickname updated to "${nickname.trim()}"!` };
}

// ─── RESEND INVITE ───
// Called when the owner clicks "Resend Invite" on a declined member.
// Uses admin client to bypass RLS after verifying ownership.
export async function resendInvite(
  groupId: string,
  memberEmail: string
): Promise<{ message: string }> {
  if (!groupId || !memberEmail) {
    return { message: "❌ Missing group ID or email." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "❌ You must be logged in." };
  }

  // Verify caller is the group owner
  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { message: "❌ Only the group owner can resend invites." };
  }

  // Admin client bypasses RLS — safe because we verified ownership above
  const { error } = await supabaseAdmin
    .from("group_members")
    .update({ status: "pending" })
    .eq("group_id", groupId)
    .eq("email", memberEmail)
    .eq("status", "declined");

  if (error) {
    console.error("Failed to resend invite:", error.message);
    return { message: `❌ Error: ${error.message}` };
  }

  return { message: "✅ Invite resent!" };
}