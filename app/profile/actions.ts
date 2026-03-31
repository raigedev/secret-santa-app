"use server";

import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Profile actions stay on the server because they touch auth state and user-owned
// records that should never rely on client-side validation alone.
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "GBP", "PHP", "JPY", "AUD", "CAD"]);

function sanitize(input: string, max: number): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, max);
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
    .select("*")
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
    .select()
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

export async function updateProfile(
  displayName: string,
  avatarEmoji: string,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "You must be logged in." };

  const rateLimit = await enforceRateLimit({
    action: "profile.update",
    actorUserId: user.id,
    maxAttempts: 15,
    resourceId: user.id,
    resourceType: "profile",
    subject: user.id,
    windowSeconds: 900,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const cleanName = sanitize(displayName, 50);
  const cleanBio = sanitize(bio, 200);
  const cleanEmoji = sanitize(avatarEmoji, 10);
  const cleanCurrency = sanitize(currency, 5);
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
    return { success: false, message: "Failed to save. Please try again." };
  }

  return { success: true, message: "Profile saved!" };
}

export async function quickSetup(
  displayName: string,
  avatarEmoji: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "You must be logged in." };

  const rateLimit = await enforceRateLimit({
    action: "profile.quick_setup",
    actorUserId: user.id,
    maxAttempts: 10,
    resourceId: user.id,
    resourceType: "profile",
    subject: user.id,
    windowSeconds: 900,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

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
    return { success: false, message: "Failed to save. Please try again." };
  }

  return { success: true, message: "Welcome!" };
}

export async function deleteAccount(): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "profile.delete_account",
    actorUserId: user.id,
    maxAttempts: 3,
    resourceId: user.id,
    resourceType: "profile",
    subject: user.id,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

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

    return { success: false, message: "Failed to prepare account deletion. Please try again." };
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
        message: "Failed to verify account deletion safety. Please try again.",
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
        message: `You are still part of a drawn group (${preview}${suffix}). Ask the owner to reset the draw or remove you first.`,
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

    return { success: false, message: "Failed to delete your account. Please try again." };
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
