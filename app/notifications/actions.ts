"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { requireRateLimitedAction } from "@/lib/auth/server-action-context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/validation/common";

export async function markNotificationRead(
  notificationId: string
): Promise<{ success: boolean; message: string }> {
  if (!isUuid(notificationId)) {
    return { success: false, message: "Choose a notification first." };
  }

  const context = await requireRateLimitedAction({
    action: "notifications.mark_read",
    maxAttempts: 200,
    resourceId: notificationId,
    resourceType: "notification",
    subject: (userId) => userId,
    windowSeconds: 3600,
  });

  if (!context.ok) {
    return { success: false, message: context.message };
  }

  const { user } = context;
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

    return { success: false, message: "We could not update this notification." };
  }

  return { success: true, message: "Notification updated." };
}

export async function markAllNotificationsRead(): Promise<{
  success: boolean;
  message: string;
}> {
  const context = await requireRateLimitedAction({
    action: "notifications.mark_all_read",
    maxAttempts: 40,
    resourceId: (userId) => userId,
    resourceType: "notification",
    subject: (userId) => userId,
    windowSeconds: 3600,
  });

  if (!context.ok) {
    return { success: false, message: context.message };
  }

  const { user } = context;
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

    return { success: false, message: "We could not update your notifications." };
  }

  return { success: true, message: "All notifications marked as read." };
}
