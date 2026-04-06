"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markNotificationRead(
  notificationId: string
): Promise<{ success: boolean; message: string }> {
  if (!notificationId || !UUID_PATTERN.test(notificationId)) {
    return { success: false, message: "Missing notification." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "notifications.mark_read",
    actorUserId: user.id,
    maxAttempts: 200,
    resourceId: notificationId,
    resourceType: "notification",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "notifications.mark_read",
      resourceId: notificationId,
      resourceType: "notification",
    });

    return { success: false, message: "Failed to update notification." };
  }

  return { success: true, message: "Notification updated." };
}

export async function markAllNotificationsRead(): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "notifications.mark_all_read",
    actorUserId: user.id,
    maxAttempts: 40,
    resourceId: user.id,
    resourceType: "notification",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "notifications.mark_all_read",
      resourceId: user.id,
      resourceType: "notification",
    });

    return { success: false, message: "Failed to update notifications." };
  }

  return { success: true, message: "All notifications marked as read." };
}
