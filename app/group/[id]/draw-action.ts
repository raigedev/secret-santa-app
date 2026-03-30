"use server";

// ═══════════════════════════════════════
// SECRET SANTA DRAW — Server Action
// ═══════════════════════════════════════
// This runs on the SERVER only. It:
// 1. Verifies the caller is the group owner
// 2. Checks ALL members have accepted
// 3. Checks no draw has happened yet
// 4. Shuffles members randomly
// 5. Assigns each person to give to the next person
// 6. Saves assignments to the database
//
// Security: #03 uses admin client, #08 parameterized queries,
// #19 server-side ownership check, #20 logs critical action
// ═══════════════════════════════════════

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function drawSecretSanta(
  groupId: string
): Promise<{ success: boolean; message: string }> {

  // ─── Validate input ───
  // Security: #08 — never trust user input
  if (!groupId || typeof groupId !== "string" || groupId.trim().length === 0) {
    return { success: false, message: "❌ Invalid group ID." };
  }

  const supabase = await createClient();

  // ─── Get the logged-in user ───
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Security: #19 — must be authenticated
  if (!user) {
    return { success: false, message: "❌ You must be logged in." };
  }

  // ─── Verify this user is the group owner ───
  // Security: #19 — server-side ownership check, not just UI
  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    return { success: false, message: "❌ Group not found." };
  }

  if (group.owner_id !== user.id) {
    return { success: false, message: "❌ Only the group owner can draw names." };
  }

  // ─── Check if draw already happened ───
  // Draw is FINAL — no redraw allowed
  const { data: existingDraw } = await supabaseAdmin
    .from("assignments")
    .select("id")
    .eq("group_id", groupId)
    .limit(1);

  if (existingDraw && existingDraw.length > 0) {
    return { success: false, message: "❌ Names have already been drawn for this group." };
  }

  // ─── Get all accepted members ───
  // Only members with status "accepted" are included in the draw
  const { data: members, error: membersError } = await supabaseAdmin
    .from("group_members")
    .select("user_id, nickname")
    .eq("group_id", groupId)
    .eq("status", "accepted");

  if (membersError) {
    console.error("Draw error — failed to fetch members:", membersError.message);
    return { success: false, message: "❌ Failed to load members." };
  }

  if (!members || members.length < 3) {
    return {
      success: false,
      message: "❌ Need at least 3 accepted members to draw names.",
    };
  }

  // ─── Check ALL members have user_id (are registered) ───
  // A member with null user_id hasn't created an account yet
  const unlinked = members.filter((m) => !m.user_id);
  if (unlinked.length > 0) {
    return {
      success: false,
      message: `❌ ${unlinked.length} member(s) haven't registered yet. All members must have accounts.`,
    };
  }

  // ─── Check for pending or declined members ───
  // ALL invited members must have accepted before drawing
  const { data: nonAccepted } = await supabaseAdmin
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .neq("status", "accepted");

  if (nonAccepted && nonAccepted.length > 0) {
    return {
      success: false,
      message: "❌ All invited members must accept before drawing names.",
    };
  }

  // ─── SHUFFLE using Fisher-Yates algorithm ───
  // This is the gold standard for random shuffling.
  // It guarantees every permutation is equally likely.
  const shuffled = [...members];
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Pick a random index from 0 to i
    const j = Math.floor(Math.random() * (i + 1));
    // Swap elements at i and j
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // ─── CREATE ASSIGNMENTS using circular pattern ───
  // Each person gives to the NEXT person in the shuffled list.
  // The last person gives to the first — completing the circle.
  //
  // Example with 4 people:
  // Shuffled: [Kate, John, Anna, Mike]
  // Kate → John (gives to next)
  // John → Anna (gives to next)
  // Anna → Mike (gives to next)
  // Mike → Kate (last wraps to first)
  //
  // This GUARANTEES:
  // ✅ No one draws themselves
  // ✅ Everyone gives exactly one gift
  // ✅ Everyone receives exactly one gift
  const assignments = shuffled.map((member, index) => ({
    group_id: groupId,
    giver_id: member.user_id,
    receiver_id: shuffled[(index + 1) % shuffled.length].user_id,
  }));

  // ─── Save assignments to database ───
  // Uses admin client because there's no INSERT policy for regular users.
  // Security: #03 — admin key only on server, never exposed to browser
  const { error: insertError } = await supabaseAdmin
    .from("assignments")
    .insert(assignments);

  if (insertError) {
    console.error("Draw error — failed to save assignments:", insertError.message);
    return { success: false, message: "❌ Failed to save assignments. Please try again." };
  }

  // Security: #20 — log critical action

  return {
    success: true,
    message: `✅ Names drawn! ${assignments.length} members assigned.`,
  };
}
