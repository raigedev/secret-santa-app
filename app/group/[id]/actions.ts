"use server";

// ─── Server Actions ───
// These functions run on the SERVER, not in the browser.
// This is important because:
// 1. They can use the admin client (for sending invite emails)
// 2. They're more secure — users can't tamper with them
// 3. They can access secret environment variables

import { createClient, supabaseAdmin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// ─── DELETE GROUP ───
// Called when the owner clicks "Delete Group".
// Receives the group ID from a hidden form field.
export async function deleteGroup(formData: FormData): Promise<void> {
  // Get the group ID from the form's hidden input
  const groupId = formData.get("id") as string;

  // Create a server-side Supabase client (knows who's logged in via cookies)
  const supabase = await createClient();

  // Delete the group row from the database.
  // RLS policy ensures only the owner can do this.
  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);

  if (error) {
    console.error("Failed to delete group:", error.message);
    return;
  }

  // After deleting, send the user back to the dashboard
  redirect("/dashboard");
}

// ─── INVITE USER ───
// Called when the owner types an email and clicks "Invite".
// Uses useFormState pattern: receives previous state + form data,
// returns a new state with a success/error message.
export async function inviteUser(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  // Extract values from the form
  const groupId = formData.get("id") as string;
  const email = formData.get("email") as string;

  // Validate: make sure we have both values
  if (!groupId || !email) {
    return { message: "❌ Missing group ID or email." };
  }

  // Step 1: Send an invitation email using the Supabase Admin client.
  // The admin client uses the SERVICE_ROLE_KEY which has full access.
  // This sends a "You've been invited" email to the person.
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    console.error("Failed to send invite email:", inviteError.message);
    // Don't return yet — even if email fails, still add them to the group.
    // They can register manually through the app link.
  }

  // Step 2: Add this person to the group_members table.
  // They don't have an account yet, so user_id is null.
  // Their nickname defaults to their email prefix (e.g. "kate" from "kate@gmail.com")
  // but they'll be able to change it to an anonymous alias later.
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
// Called when a member changes their own nickname.
// This is how users set their anonymous alias (e.g. "GiftNinja").
// RLS policy ensures users can only update their OWN row.
export async function updateNickname(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  // Get the values from the form
  const groupId = formData.get("groupId") as string;
  const nickname = formData.get("nickname") as string;

  // Validate: nickname must not be empty
  if (!nickname || nickname.trim().length === 0) {
    return { message: "❌ Nickname can't be empty." };
  }

  // Validate: nickname shouldn't be too long
  if (nickname.trim().length > 30) {
    return { message: "❌ Nickname must be 30 characters or less." };
  }

  // Create server client (knows who's logged in)
  const supabase = await createClient();

  // Get the logged-in user's ID
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "❌ You must be logged in." };
  }

  // Update ONLY this user's row in the specified group.
  // The .eq("user_id", user.id) ensures they can't change someone else's nickname.
  // The .eq("group_id", groupId) ensures it only affects this group.
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
// Called when the group owner clicks "Resend" on a declined member.
// Resets their status from "declined" back to "pending"
// so the invitation appears on their dashboard again.
//
// Security: #19 — only the group owner can resend invites
export async function resendInvite(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const groupId = formData.get("groupId") as string;
  const memberEmail = formData.get("memberEmail") as string;

  if (!groupId || !memberEmail) {
    return { message: "❌ Missing group ID or email." };
  }

  const supabase = await createClient();

  // Verify the current user is the group owner
  // This prevents regular members from resending invites
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "❌ You must be logged in." };
  }

  // Check that this user actually owns the group
  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { message: "❌ Only the group owner can resend invites." };
  }

  // Reset the member's status from "declined" back to "pending"
  const { error } = await supabase
    .from("group_members")
    .update({ status: "pending" })
    .eq("group_id", groupId)
    .eq("email", memberEmail)
    .eq("status", "declined");

  if (error) {
    console.error("Failed to resend invite:", error.message);
    return { message: `❌ Error: ${error.message}` };
  }

  return { message: `✅ Invite resent to ${memberEmail}` };
}