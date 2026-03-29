"use server";

// ═══════════════════════════════════════
// SERVER ACTIONS — GROUP DETAIL PAGE
// ═══════════════════════════════════════
// Security: Core#1 sanitization, Core#3 RLS,
// Playbook#19 server-side auth, Playbook#20 logging
// ═══════════════════════════════════════

import { createClient, supabaseAdmin } from "@/lib/supabase/server";

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

  if (!groupId || !email) {
    return { message: "❌ Missing group ID or email." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "❌ You must be logged in." };

  // Playbook#19: Verify ownership
  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { message: "❌ Only the group owner can invite members." };
  }

  const cleanEmail = sanitize(email, 100).toLowerCase();

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail);
  if (inviteError) {
    console.error("[GROUP] Invite email failed:", inviteError.message);
  }

  const { error: insertError } = await supabase
    .from("group_members")
    .insert([{
      group_id: groupId,
      email: cleanEmail,
      nickname: cleanEmail.split("@")[0],
      role: "member",
    }]);

  if (insertError) {
    console.error("[GROUP] Insert member failed:", insertError.message);
    return { message: "❌ Failed to add member. They may already be in the group." };
  }

  console.log(`[GROUP] Invited ${cleanEmail} to group ${groupId} by ${user.id}`);
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
    .from("group_members")
    .update({ nickname: cleanNick })
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[GROUP] Nickname update failed:", error.message);
    return { message: "❌ Failed to update nickname." };
  }

  console.log(`[GROUP] Nickname updated to "${cleanNick}" by ${user.id}`);
  return { message: `✅ Nickname updated to "${cleanNick}"!` };
}

// ─── RESEND INVITE (owner only, uses admin client) ───
export async function resendInvite(
  groupId: string,
  memberEmail: string
): Promise<{ message: string }> {
  if (!groupId || !memberEmail) return { message: "❌ Missing group ID or email." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "❌ You must be logged in." };

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || group.owner_id !== user.id) {
    return { message: "❌ Only the group owner can resend invites." };
  }

  const { error } = await supabaseAdmin
    .from("group_members")
    .update({ status: "pending" })
    .eq("group_id", groupId)
    .eq("email", memberEmail)
    .eq("status", "declined");

  if (error) {
    console.error("[GROUP] Resend invite failed:", error.message);
    return { message: "❌ Failed to resend invite." };
  }

  console.log(`[GROUP] Resent invite to ${memberEmail} for group ${groupId}`);
  return { message: "✅ Invite resent!" };
}

// ─── EDIT GROUP (owner only) ───
export async function editGroup(
  groupId: string,
  name: string,
  description: string,
  eventDate: string,
  budget: number,
  currency: string
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
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can edit this group." };
  }

  const { error } = await supabase
    .from("groups")
    .update({
      name: cleanName,
      description: cleanDesc,
      event_date: eventDate,
      budget: cleanBudget,
      currency: cleanCurrency,
    })
    .eq("id", groupId);

  if (error) {
    console.error("[GROUP] Edit failed:", error.message);
    return { success: false, message: "Failed to update group. Please try again." };
  }

  console.log(`[GROUP] Edited group ${groupId} by user ${user.id}`);
  return { success: true, message: "Group updated!" };
}

// ─── DELETE GROUP (owner only, requires name confirmation) ───
export async function deleteGroup(
  groupId: string,
  confirmName: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id, name")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can delete this group." };
  }

  if (confirmName.trim().toLowerCase() !== group.name.trim().toLowerCase()) {
    return { success: false, message: "Group name doesn't match. Please type it exactly." };
  }

  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);

  if (error) {
    console.error("[GROUP] Delete failed:", error.message);
    return { success: false, message: "Failed to delete group. Please try again." };
  }

  console.log(`[GROUP] Deleted group ${groupId} by owner ${user.id}`);
  return { success: true, message: "Group deleted." };
}

// ─── REMOVE MEMBER (owner only) ───
export async function removeMember(
  groupId: string,
  memberId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  if (memberId === user.id) {
    return { success: false, message: "Use 'Leave Group' to remove yourself." };
  }

  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    return { success: false, message: "Only the group owner can remove members." };
  }

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId);

  if (error) {
    console.error("[GROUP] Remove member failed:", error.message);
    return { success: false, message: "Failed to remove member. Please try again." };
  }

  console.log(`[GROUP] Removed member ${memberId} from group ${groupId} by owner ${user.id}`);
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
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group) return { success: false, message: "Group not found." };
  if (group.owner_id === user.id) {
    return { success: false, message: "The owner can't leave. Delete the group instead." };
  }

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[GROUP] Leave failed:", error.message);
    return { success: false, message: "Failed to leave group. Please try again." };
  }

  console.log(`[GROUP] User ${user.id} left group ${groupId}`);
  return { success: true, message: "You left the group." };
}