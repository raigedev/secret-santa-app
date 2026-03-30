"use server";

import { createClient } from "@/lib/supabase/server";

// ─── CONFIRM GIFT RECEIVED (receiver only) ───
export async function confirmGiftReceived(
  groupId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  const { error } = await supabase
    .from("assignments")
    .update({ gift_received: true, gift_received_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("receiver_id", user.id);

  if (error) {
    console.error("[SANTA] Confirm gift failed:", error.message);
    return { success: false, message: "Failed to confirm. Please try again." };
  }

  console.log(`[SANTA] User ${user.id} confirmed gift received for group ${groupId}`);
  return { success: true, message: "Gift confirmed!" };
}