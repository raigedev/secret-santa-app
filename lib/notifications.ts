import { recordServerFailure } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

type NotificationPreferenceKey =
  | "notify_invites"
  | "notify_draws"
  | "notify_chat"
  | "notify_wishlist";

type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  linkPath?: string | null;
  metadata?: Record<string, unknown>;
  preferenceKey?: NotificationPreferenceKey | null;
};

type NotificationPreferenceRow = Partial<Record<NotificationPreferenceKey, boolean>>;

function sanitizeNotificationText(value: string, maxLength: number): string {
  return value.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, maxLength);
}

async function shouldSendNotification(
  userId: string,
  preferenceKey: NotificationPreferenceKey | null | undefined
): Promise<boolean> {
  if (!preferenceKey) {
    return true;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(preferenceKey)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "notifications.preference_lookup",
      resourceId: userId,
      resourceType: "profile",
      details: { preferenceKey },
    });

    // If the preference row cannot be read, default to sending the in-app
    // notification rather than silently dropping an important update.
    return true;
  }

  const typedData = data as NotificationPreferenceRow | null;

  if (!typedData || typeof typedData[preferenceKey] !== "boolean") {
    return true;
  }

  return Boolean(typedData[preferenceKey]);
}

export async function createNotification(input: NotificationInput): Promise<void> {
  const userId = input.userId?.trim();

  if (!userId) {
    return;
  }

  if (!(await shouldSendNotification(userId, input.preferenceKey))) {
    return;
  }

  const title = sanitizeNotificationText(input.title, 120);
  const body = sanitizeNotificationText(input.body, 240);
  const linkPath = input.linkPath ? sanitizeNotificationText(input.linkPath, 200) : null;

  if (!title) {
    return;
  }

  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: sanitizeNotificationText(input.type, 50) || "general",
    title,
    body,
    link_path: linkPath,
    metadata: input.metadata || {},
  });

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "notifications.create",
      resourceId: userId,
      resourceType: "notification",
      details: {
        type: input.type,
        linkPath,
      },
    });
  }
}

export async function createNotifications(inputs: NotificationInput[]): Promise<void> {
  await Promise.all(inputs.map((input) => createNotification(input)));
}
