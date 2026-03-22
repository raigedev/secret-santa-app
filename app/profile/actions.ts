"use server";

// ═══════════════════════════════════════
// PROFILE SERVER ACTIONS
// ═══════════════════════════════════════
// Security: Core#1 sanitization, Core#3 least privilege,
// Playbook#19 server-side auth, Playbook#20 logging
// No dangerouslySetInnerHTML
// ═══════════════════════════════════════

import { createClient } from "@/lib/supabase/server";

function sanitize(input: string, max: number): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, max);
}

// ─── Get or create profile ───
export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Try to get existing profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile) return profile;

  // Create new profile if doesn't exist
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
    console.error("[PROFILE] Create failed:", error.message);
    return null;
  }

  console.log(`[PROFILE] Created profile for user ${user.id}`);
  return newProfile;
}

// ─── Update profile ───
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "You must be logged in." };

  const cleanName = sanitize(displayName, 50);
  const cleanBio = sanitize(bio, 200);
  const cleanEmoji = sanitize(avatarEmoji, 10);
  const cleanCurrency = sanitize(currency, 5);
  const cleanBudget = Math.min(Math.max(Math.floor(defaultBudget || 0), 0), 10000);

  if (cleanName.length === 0) {
    return { success: false, message: "Display name is required." };
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
    console.error("[PROFILE] Update failed:", error.message);
    return { success: false, message: "Failed to save. Please try again." };
  }

  console.log(`[PROFILE] Updated profile for user ${user.id}`);
  return { success: true, message: "Profile saved!" };
}

// ─── Quick setup (first-time modal) ───
export async function quickSetup(
  displayName: string,
  avatarEmoji: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "You must be logged in." };

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
    console.error("[PROFILE] Quick setup failed:", error.message);
    return { success: false, message: "Failed to save. Please try again." };
  }

  console.log(`[PROFILE] Quick setup complete for user ${user.id}`);
  return { success: true, message: "Welcome!" };
}