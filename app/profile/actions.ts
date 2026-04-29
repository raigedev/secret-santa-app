"use server";

import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import {
  getReminderPreferencesForUser,
  reschedulePendingReminderJobsForUser,
  type ReminderDeliveryMode,
} from "@/lib/notifications";
import { requireRateLimitedAction } from "@/lib/auth/server-action-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sanitizePlainText } from "@/lib/validation/common";

// Profile actions stay on the server because they touch auth state and user-owned
// records that should never rely on client-side validation alone.
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "GBP", "PHP", "JPY", "AUD", "CAD"]);
const REMINDER_DELIVERY_MODES = new Set<ReminderDeliveryMode>([
  "immediate",
  "daily_digest",
]);
const PROFILE_SELECT_FIELDS =
  "user_id, display_name, avatar_emoji, avatar_url, bio, default_budget, currency, notify_invites, notify_draws, notify_chat, notify_wishlist, notify_marketing, profile_setup_complete";

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

function sanitize(input: string, max: number): string {
  return sanitizePlainText(input, max);
}

function normalizeAvatarUrl(userId: string, avatarUrl: string | null): string | null {
  if (!avatarUrl) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    const candidate = new URL(avatarUrl);
    const allowedOrigin = new URL(supabaseUrl).origin;
    const allowedPathPrefix = `/storage/v1/object/public/profile-avatars/${userId}/`;

    if (candidate.origin !== allowedOrigin || !candidate.pathname.startsWith(allowedPathPrefix)) {
      return null;
    }

    return `${candidate.origin}${candidate.pathname}${candidate.search}`;
  } catch {
    return null;
  }
}

// Lazily create the profile row so older or partially-created accounts can still recover.
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile) return profile;

  const email = user.email || "";
  const defaultName = email.split("@")[0] || "";

  const { data: newProfile, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      display_name: defaultName,
      avatar_emoji: "🎅",
      profile_setup_complete: false,
    })
    .select(PROFILE_SELECT_FIELDS)
    .single();

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "profile.create",
      resourceId: user.id,
      resourceType: "profile",
    });
    return null;
  }

  return newProfile;
}

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
    action: "profile.update_reminder_preferences",
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
      eventType: "profile.update_reminder_preferences",
      resourceId: user.id,
      resourceType: "profile",
    });

    return { success: false, message: "We could not save reminder settings." };
  }

  await reschedulePendingReminderJobsForUser(user.id);

  return { success: true, message: "Reminder settings saved." };
}

export async function updateProfile(
  displayName: string,
  avatarEmoji: string,
  avatarUrl: string | null,
  bio: string,
  defaultBudget: number,
  currency: string,
  notifyInvites: boolean,
  notifyDraws: boolean,
  notifyChat: boolean,
  notifyWishlist: boolean,
  notifyMarketing: boolean,
  markSetupComplete: boolean
): Promise<{ success: boolean; message: string }> {
  const context = await requireRateLimitedAction({
    action: "profile.update",
    maxAttempts: 15,
    resourceId: (userId) => userId,
    resourceType: "profile",
    subject: (userId) => userId,
    windowSeconds: 900,
  });

  if (!context.ok) {
    return { success: false, message: context.message };
  }

  const { supabase, user } = context;
  const cleanName = sanitize(displayName, 50);
  const cleanBio = sanitize(bio, 200);
  const cleanEmoji = sanitize(avatarEmoji, 10);
  const cleanCurrency = sanitize(currency, 5);
  const cleanAvatarUrl = normalizeAvatarUrl(user.id, avatarUrl ? sanitize(avatarUrl, 1000) : null);
  const cleanBudget = Math.min(Math.max(Math.floor(defaultBudget || 0), 0), 10000);

  if (cleanName.length === 0) {
    return { success: false, message: "Display name is required." };
  }

  if (!ALLOWED_CURRENCIES.has(cleanCurrency)) {
    return { success: false, message: "Choose a valid currency." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: cleanName,
      avatar_emoji: cleanEmoji,
      avatar_url: cleanAvatarUrl,
      bio: cleanBio,
      default_budget: cleanBudget,
      currency: cleanCurrency,
      notify_invites: notifyInvites,
      notify_draws: notifyDraws,
      notify_chat: notifyChat,
      notify_wishlist: notifyWishlist,
      notify_marketing: notifyMarketing,
      profile_setup_complete: markSetupComplete ? true : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "profile.update",
      resourceId: user.id,
      resourceType: "profile",
    });
    return { success: false, message: "We could not save your profile. Please try again." };
  }

  return { success: true, message: "Profile saved." };
}

export async function quickSetup(
  displayName: string,
  avatarEmoji: string
): Promise<{ success: boolean; message: string }> {
  const context = await requireRateLimitedAction({
    action: "profile.quick_setup",
    maxAttempts: 10,
    resourceId: (userId) => userId,
    resourceType: "profile",
    subject: (userId) => userId,
    windowSeconds: 900,
  });

  if (!context.ok) {
    return { success: false, message: context.message };
  }

  const { supabase, user } = context;
  const cleanName = sanitize(displayName, 50);
  const cleanEmoji = sanitize(avatarEmoji, 10);

  if (cleanName.length === 0) {
    return { success: false, message: "Display name is required." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: cleanName,
      avatar_emoji: cleanEmoji,
      profile_setup_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "profile.quick_setup",
      resourceId: user.id,
      resourceType: "profile",
    });
    return { success: false, message: "We could not save your profile. Please try again." };
  }

  return { success: true, message: "Welcome!" };
}

export async function deleteAccount(): Promise<{ success: boolean; message: string }> {
  const context = await requireRateLimitedAction({
    action: "profile.delete_account",
    maxAttempts: 3,
    resourceId: (userId) => userId,
    resourceType: "profile",
    subject: (userId) => userId,
    windowSeconds: 3600,
  });

  if (!context.ok) {
    return { success: false, message: context.message };
  }

  const { user } = context;
  const normalizedEmail = (user.email || "").toLowerCase();
  const [ownedGroupsResult, membershipsByUserResult, membershipsByEmailResult] = await Promise.all([
    supabaseAdmin.from("groups").select("id, name").eq("owner_id", user.id),
    supabaseAdmin
      .from("group_members")
      .select("id, group_id, role, status")
      .eq("user_id", user.id),
    normalizedEmail
      ? supabaseAdmin
          .from("group_members")
          .select("id, group_id, role, status")
          .eq("email", normalizedEmail)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const discoveryError =
    ownedGroupsResult.error || membershipsByUserResult.error || membershipsByEmailResult.error;

  if (discoveryError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: discoveryError.message,
      eventType: "profile.delete_account.discovery",
      resourceId: user.id,
      resourceType: "profile",
    });

    return { success: false, message: "We could not prepare account deletion. Please try again." };
  }

  const ownedGroupIds = new Set((ownedGroupsResult.data || []).map((group) => group.id));
  const membershipById = new Map<string, { group_id: string; role: string; status: string }>();

  for (const membership of membershipsByUserResult.data || []) {
    membershipById.set(membership.id, membership);
  }

  for (const membership of membershipsByEmailResult.data || []) {
    membershipById.set(membership.id, membership);
  }

  const nonOwnedAcceptedGroupIds = [...membershipById.values()]
    .filter(
      (membership) =>
        membership.status === "accepted" && !ownedGroupIds.has(membership.group_id)
    )
    .map((membership) => membership.group_id);

  // Deleting the auth user cascades through memberships, assignments, messages,
  // and other linked rows. Block the delete if the user still belongs to
  // someone else's already-drawn group so we do not corrupt that event.
  if (nonOwnedAcceptedGroupIds.length > 0) {
    const [blockingAssignmentsResult, blockingGroupsResult] = await Promise.all([
      supabaseAdmin.from("assignments").select("group_id").in("group_id", nonOwnedAcceptedGroupIds),
      supabaseAdmin.from("groups").select("id, name").in("id", nonOwnedAcceptedGroupIds),
    ]);

    const blockingError = blockingAssignmentsResult.error || blockingGroupsResult.error;

    if (blockingError) {
      await recordServerFailure({
        actorUserId: user.id,
        errorMessage: blockingError.message,
        eventType: "profile.delete_account.blocking_groups",
        resourceId: user.id,
        resourceType: "profile",
      });

      return {
        success: false,
        message: "We could not check whether your account can be deleted safely. Please try again.",
      };
    }

    const drawnGroupIds = new Set(
      (blockingAssignmentsResult.data || []).map((assignment) => assignment.group_id)
    );
    const blockingGroupNames = (blockingGroupsResult.data || [])
      .filter((group) => drawnGroupIds.has(group.id))
      .map((group) => group.name);

    if (blockingGroupNames.length > 0) {
      const preview = blockingGroupNames.slice(0, 2).join(", ");
      const suffix =
        blockingGroupNames.length > 2 ? ` and ${blockingGroupNames.length - 2} more` : "";

      return {
        success: false,
        message: `You are still part of a group where names were drawn (${preview}${suffix}). Ask the owner to reset the draw or remove you first.`,
      };
    }
  }

  const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (deleteUserError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: deleteUserError.message,
      eventType: "profile.delete_account.delete_auth_user",
      resourceId: user.id,
      resourceType: "profile",
    });

    return { success: false, message: "We could not delete your account. Please try again." };
  }

  if (normalizedEmail) {
    const { error: cleanupError } = await supabaseAdmin
      .from("group_members")
      .delete()
      .eq("email", normalizedEmail)
      .is("user_id", null);

    if (cleanupError) {
      await recordServerFailure({
        actorUserId: user.id,
        errorMessage: cleanupError.message,
        eventType: "profile.delete_account.cleanup_pending_invites",
        resourceId: user.id,
        resourceType: "profile",
      });
    }
  }

  await recordAuditEvent({
    actorUserId: user.id,
    details: {
      ownedGroupCount: ownedGroupsResult.data?.length || 0,
      removedMembershipCount: membershipById.size,
    },
    eventType: "profile.delete_account",
    outcome: "success",
    resourceId: user.id,
    resourceType: "profile",
  });

  return { success: true, message: "Your account was deleted." };
}
