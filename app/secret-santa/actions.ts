"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

// ─── CONFIRM GIFT RECEIVED (receiver only) ───
export async function confirmGiftReceived(
  groupId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "You must be logged in." };

  const rateLimit = await enforceRateLimit({
    action: "secret_santa.confirm_gift_received",
    actorUserId: user.id,
    maxAttempts: 10,
    resourceId: groupId,
    resourceType: "assignment",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { error } = await supabase
    .from("assignments")
    .update({ gift_received: true, gift_received_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("receiver_id", user.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "secret_santa.confirm_gift_received",
      resourceId: groupId,
      resourceType: "assignment",
    });
    return { success: false, message: "Failed to confirm. Please try again." };
  }

  return { success: true, message: "Gift confirmed!" };
}
