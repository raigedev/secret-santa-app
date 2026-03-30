"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function sanitize(input: string, max: number): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, max);
}

// ─── INVITE USER ───
export async function inviteUser(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const groupId = formData.get("id") as string;
  const email = formData.get("email") as string;

  if (!groupId || !email) return { message: "❌ Missing group ID or email." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "❌ You must be logged in." };

  const { data: group } = await supabase
    .from("groups").select("owner_id").eq("id", groupId).single();

  if (!group || group.owner_id !== user.id) {
    return { message: "❌ Only the group owner can invite members." };
  }

  const cleanEmail = sanitize(email, 100).toLowerCase();

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail);
  if (inviteError) console.error("[GROUP] Invite email failed:", inviteError.message);

  const { error: insertError } = await supabase
    .from("group_members")
    .insert([{ group_id: groupId, email: cleanEmail, nickname: cleanEmail.split("@")[0], role: "member" }]);

  if (insertError) {
    console.error("[GROUP] Insert member failed:", insertError.message);
    return { message: "❌ Failed to add member. They may already be in the group." };
  }

  return { message: `✅ Invite sent to ${cleanEmail}` };
}

// ─── UPDATE NICKNAME ───
export async function updateNickname(
  prevState: { message: string },
  formData: FormData
): Promise<{ message: string }> {
  const groupId = formData.get("groupId") as string;
  const nickname = formData.get("nickname") as string;
  const cleanNick = sanitize(nickname, 30);
  if (cleanNick.length === 0) return { message: "❌ Nickname can't be empty." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "❌ You must be logged in." };

  const { error } = await supabase
    .from("group_members").update({ nickname: cleanNick })
    .eq("group_id", groupId).eq("user_id", user.id);

  if (error) {
    console.error("[GROUP] Nickname update failed:", error.message);
    return { message: "❌ Failed to update nickname." };
  }

  return { message: `✅ Nickname updated to "${cleanNick}"!` };
}

// ─── RESEND INVITE ───
export async function resendInvite(
  groupId: string,
  memberEmail: string
): Promise<{ message: string }> {
  if (!groupId || !memberEmail) return { message: "❌ Missing group ID or email." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "❌ You must be logged in." };

  const { data: group } = await supabase
    .from("groups").select("owner_id").eq("id", groupId).maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { message: "❌ Only the group owner can resend invites." };
  }

  const { error } = await supabaseAdmin
    .from("group_members").update({ status: "pending" })
    .eq("group_id", groupId).eq("email", memberEmail).eq("status", "declined");

  if (error) {
    console.error("[GROUP] Resend invite failed:", error.message);
    return { message: "❌ Failed to resend invite." };
  }

  return { message: "✅ Invite resent!" };
}

// ─── EDIT GROUP (owner only) ───
export async function editGroup(
  groupId: string, name: string, description: string,
  eventDate: string, budget: number, currency: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  const cleanName = sanitize(name, 100);
  const cleanDesc = sanitize(description, 300);
  const cleanCurrency = sanitize(currency, 5);
  const cleanBudget = Math.min(Math.max(Math.floor(budget || 0), 0), 100000);

  if (cleanName.length === 0) return { success: false, message: "Group name is required." };
  if (!eventDate) return { success: false, message: "Event date is required." };

  const { data: group } = await supabase
    .from("groups").select("owner_id").eq("id", groupId).single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can edit this group." };
  }

  const { error } = await supabase
    .from("groups")
    .update({ name: cleanName, description: cleanDesc, event_date: eventDate, budget: cleanBudget, currency: cleanCurrency })
    .eq("id", groupId);

  if (error) {
    console.error("[GROUP] Edit failed:", error.message);
    return { success: false, message: "Failed to update group. Please try again." };
  }

  return { success: true, message: "Group updated!" };
}

// ─── DELETE GROUP (owner only) ───
export async function deleteGroup(
  groupId: string, confirmName: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  const { data: group } = await supabase
    .from("groups").select("owner_id, name").eq("id", groupId).single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can delete this group." };
  }

  if (confirmName.trim().toLowerCase() !== group.name.trim().toLowerCase()) {
    return { success: false, message: "Group name doesn't match. Please type it exactly." };
  }

  const { error } = await supabase.from("groups").delete().eq("id", groupId);

  if (error) {
    console.error("[GROUP] Delete failed:", error.message);
    return { success: false, message: "Failed to delete group. Please try again." };
  }

  return { success: true, message: "Group deleted." };
}

// ─── REMOVE MEMBER (owner only) ───
export async function removeMember(
  groupId: string, memberId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  if (memberId === user.id) return { success: false, message: "Use 'Leave Group' to remove yourself." };

  const { data: group } = await supabase
    .from("groups").select("owner_id").eq("id", groupId).single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can remove members." };
  }

  const { error } = await supabase
    .from("group_members").delete().eq("group_id", groupId).eq("user_id", memberId);

  if (error) {
    console.error("[GROUP] Remove member failed:", error.message);
    return { success: false, message: "Failed to remove member. Please try again." };
  }

  return { success: true, message: "Member removed." };
}

// ─── LEAVE GROUP (member only) ───
export async function leaveGroup(
  groupId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  const { data: group } = await supabase
    .from("groups").select("owner_id").eq("id", groupId).single();

  if (!group) return { success: false, message: "Group not found." };
  if (group.owner_id === user.id) return { success: false, message: "The owner can't leave. Delete the group instead." };

  const { error } = await supabase
    .from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);

  if (error) {
    console.error("[GROUP] Leave failed:", error.message);
    return { success: false, message: "Failed to leave group. Please try again." };
  }

  return { success: true, message: "You left the group." };
}

// ─── TRIGGER BIG REVEAL (owner only, event day) ───
export async function triggerReveal(
  groupId: string
): Promise<{ success: boolean; message: string; matches?: { giver: string; receiver: string }[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  const { data: group } = await supabase
    .from("groups").select("owner_id, revealed").eq("id", groupId).single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can trigger the reveal." };
  }

  if (group.revealed) {
    return { success: false, message: "This group has already been revealed." };
  }

  // Set revealed = true
  const { error: updateError } = await supabase
    .from("groups")
    .update({ revealed: true, revealed_at: new Date().toISOString() })
    .eq("id", groupId);

  if (updateError) {
    console.error("[GROUP] Reveal failed:", updateError.message);
    return { success: false, message: "Failed to trigger reveal. Please try again." };
  }

  // Fetch all assignments with nicknames using admin (bypasses RLS during transition)
  const { data: assignments } = await supabaseAdmin
    .from("assignments")
    .select("giver_id, receiver_id")
    .eq("group_id", groupId);

  const { data: members } = await supabaseAdmin
    .from("group_members")
    .select("user_id, nickname")
    .eq("group_id", groupId)
    .eq("status", "accepted");

  const getNick = (uid: string) => members?.find((m) => m.user_id === uid)?.nickname || "Participant";

  const matches = (assignments || []).map((a) => ({
    giver: getNick(a.giver_id),
    receiver: getNick(a.receiver_id),
  }));

  return { success: true, message: "Reveal triggered!", matches };
}
