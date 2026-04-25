"use server";

import { recordServerFailure } from "@/lib/security/audit";
import {
  getReminderPreferencesForUser,
  reschedulePendingReminderJobsForUser,
  type ReminderDeliveryMode,
} from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfile } from "@/app/profile/actions";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REMINDER_DELIVERY_MODES = new Set<ReminderDeliveryMode>([
  "immediate",
  "daily_digest",
]);

export type ReminderPreferenceFormState = {
  reminder_delivery_mode: ReminderDeliveryMode;
  reminder_event_tomorrow: boolean;
  reminder_post_draw: boolean;
  reminder_wishlist_incomplete: boolean;
};

const DEFAULT_REMINDER_PREFERENCES: ReminderPreferenceFormState = {
  reminder_delivery_mode: "immediate",
  reminder_event_tomorrow: true,
  reminder_post_draw: true,
  reminder_wishlist_incomplete: true,
};

export async function getReminderPreferences(): Promise<ReminderPreferenceFormState> {
  const profile = await getProfile();

  if (!profile?.user_id) {
    return DEFAULT_REMINDER_PREFERENCES;
  }

  return getReminderPreferencesForUser(profile.user_id);
}

export async function saveReminderPreferences(
  preferences: ReminderPreferenceFormState
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!REMINDER_DELIVERY_MODES.has(preferences.reminder_delivery_mode)) {
    return { success: false, message: "Choose a valid reminder delivery mode." };
  }

  const rateLimit = await enforceRateLimit({
    action: "notifications.update_reminder_preferences",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: user.id,
    resourceType: "profile",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      reminder_delivery_mode: preferences.reminder_delivery_mode,
      reminder_event_tomorrow: Boolean(preferences.reminder_event_tomorrow),
      reminder_post_draw: Boolean(preferences.reminder_post_draw),
      reminder_wishlist_incomplete: Boolean(preferences.reminder_wishlist_incomplete),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      details: {
        reminderDeliveryMode: preferences.reminder_delivery_mode,
      },
      errorMessage: error.message,
      eventType: "notifications.update_reminder_preferences",
      resourceId: user.id,
      resourceType: "profile",
    });

    return { success: false, message: "We could not save reminder settings." };
  }

  await reschedulePendingReminderJobsForUser(user.id);

  return { success: true, message: "Reminder settings saved." };
}

export async function markNotificationRead(
  notificationId: string
): Promise<{ success: boolean; message: string }> {
  if (!notificationId || !UUID_PATTERN.test(notificationId)) {
    return { success: false, message: "Choose a notification first." };
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

    return { success: false, message: "We could not update this notification." };
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

    return { success: false, message: "We could not update your notifications." };
  }

  return { success: true, message: "All notifications marked as read." };
}
