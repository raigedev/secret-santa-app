"use server";

// ─── Dashboard Server Actions ───
// These handle accepting or declining group invitations.
// They run on the SERVER for security — a user can only
// accept/decline their OWN invitations, not someone else's.
//
// Security: #19 — permissions checked server-side, not just UI

import { createClient } from "@/lib/supabase/server";

// ─── Accept an invitation ───
// Changes the status from "pending" to "accepted" in group_members.
// Only works if the logged-in user's ID matches the row.
export async function acceptInvite(groupId: string): Promise<{ message: string }> {
  // Create server client (knows who's logged in via cookies)
  const supabase = await createClient();

  // Get the logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Security check: must be logged in
  if (!user) {
    return { message: "❌ You must be logged in." };
  }

  // Update this user's row in group_members to "accepted".
  // The .eq("user_id") ensures you can only accept YOUR OWN invite.
  // The .eq("status", "pending") ensures you can't re-accept.
  const { error } = await supabase
    .from("group_members")
    .update({ status: "accepted" })
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to accept invite:", error.message);
    return { message: `❌ Error: ${error.message}` };
  }

  return { message: "✅ Invitation accepted!" };
}

// ─── Decline an invitation ───
// Changes the status from "pending" to "declined".
// The user won't see the group anymore after declining.
export async function declineInvite(groupId: string): Promise<{ message: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "❌ You must be logged in." };
  }

  // Update status to "declined" — same security checks as accept
  const { error } = await supabase
    .from("group_members")
    .update({ status: "declined" })
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to decline invite:", error.message);
    return { message: `❌ Error: ${error.message}` };
  }

  return { message: "✅ Invitation declined." };
}