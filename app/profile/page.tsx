"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  deleteAccount,
  getProfile,
  getReminderPreferences,
  saveReminderPreferences,
  updateProfile,
  type ReminderPreferenceFormState,
} from "./actions";
import { ProfileSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";
import {
  clearClientSnapshots,
  hasFreshClientSnapshotMetadata,
  readClientSnapshot,
  writeClientSnapshot,
  type ClientSnapshotMetadata,
} from "@/lib/client-snapshot";
import { publishViewerProfileChanged } from "@/app/components/viewer-profile-client";
import { isNullableString, isRecord } from "@/lib/validation/common";

const PRESET_AVATARS = [
  "🎅", "🧝", "🦌", "⛄", "🎄", "🎁", "🧑‍🎄", "❄️",
  "🔔", "⭐", "🍪", "🕯️", "🧦", "🎿", "☃️", "🎶",
];

const BUDGET_OPTIONS = [10, 15, 25, 50, 100];
const DEFAULT_AVATAR_EMOJI = PRESET_AVATARS[0] || "\u{1F385}";
const DEFAULT_REMINDER_PREFERENCES: ReminderPreferenceFormState = {
  reminder_delivery_mode: "immediate",
  reminder_event_tomorrow: true,
  reminder_post_draw: true,
  reminder_wishlist_incomplete: true,
};

const CURRENCIES = [
  { code: "USD", label: "$ USD — US Dollar" },
  { code: "EUR", label: "€ EUR — Euro" },
  { code: "GBP", label: "£ GBP — British Pound" },
  { code: "PHP", label: "₱ PHP — Philippine Peso" },
  { code: "JPY", label: "¥ JPY — Japanese Yen" },
  { code: "AUD", label: "A$ AUD — Australian Dollar" },
  { code: "CAD", label: "C$ CAD — Canadian Dollar" },
];

type Profile = {
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  bio: string;
  default_budget: number;
  currency: string;
  notify_invites: boolean;
  notify_draws: boolean;
  notify_chat: boolean;
  notify_wishlist: boolean;
  notify_marketing: boolean;
  profile_setup_complete: boolean;
};

type ProfileRecord = NonNullable<Awaited<ReturnType<typeof getProfile>>>;
type ProfilePageSnapshot = ClientSnapshotMetadata & {
  customBudget: boolean;
  email: string;
  profile: Profile;
  reminderPreferences: ReminderPreferenceFormState;
};

const PROFILE_PAGE_SNAPSHOT_STORAGE_PREFIX = "ss_profile_page_snapshot_v1:";
const DEFAULT_PROFILE: Profile = {
  display_name: "",
  avatar_emoji: DEFAULT_AVATAR_EMOJI,
  avatar_url: null,
  bio: "",
  default_budget: 25,
  currency: "USD",
  notify_invites: true,
  notify_draws: true,
  notify_chat: true,
  notify_wishlist: false,
  notify_marketing: false,
  profile_setup_complete: false,
};

function getProfilePageSnapshotStorageKey(userId: string): string {
  return `${PROFILE_PAGE_SNAPSHOT_STORAGE_PREFIX}${userId}`;
}

function isReminderDeliveryMode(value: unknown): value is ReminderPreferenceFormState["reminder_delivery_mode"] {
  return value === "immediate" || value === "daily_digest";
}

function isReminderPreferenceSnapshot(value: unknown): value is ReminderPreferenceFormState {
  return (
    isRecord(value) &&
    isReminderDeliveryMode(value.reminder_delivery_mode) &&
    typeof value.reminder_event_tomorrow === "boolean" &&
    typeof value.reminder_post_draw === "boolean" &&
    typeof value.reminder_wishlist_incomplete === "boolean"
  );
}

function isProfileSnapshotValue(value: unknown): value is Profile {
  return (
    isRecord(value) &&
    typeof value.display_name === "string" &&
    typeof value.avatar_emoji === "string" &&
    isNullableString(value.avatar_url) &&
    typeof value.bio === "string" &&
    typeof value.default_budget === "number" &&
    typeof value.currency === "string" &&
    typeof value.notify_invites === "boolean" &&
    typeof value.notify_draws === "boolean" &&
    typeof value.notify_chat === "boolean" &&
    typeof value.notify_wishlist === "boolean" &&
    typeof value.notify_marketing === "boolean" &&
    typeof value.profile_setup_complete === "boolean"
  );
}

function isProfilePageSnapshot(
  value: unknown,
  userId: string
): value is ProfilePageSnapshot {
  return (
    hasFreshClientSnapshotMetadata(value, userId) &&
    typeof value.email === "string" &&
    typeof value.customBudget === "boolean" &&
    isProfileSnapshotValue(value.profile) &&
    isReminderPreferenceSnapshot(value.reminderPreferences)
  );
}

function normalizeProfile(data: ProfileRecord): Profile {
  return {
    display_name: data.display_name || "",
    avatar_emoji: data.avatar_emoji || DEFAULT_AVATAR_EMOJI,
    avatar_url: data.avatar_url || null,
    bio: data.bio || "",
    default_budget: data.default_budget || 25,
    currency: data.currency || "USD",
    notify_invites: data.notify_invites ?? true,
    notify_draws: data.notify_draws ?? true,
    notify_chat: data.notify_chat ?? true,
    notify_wishlist: data.notify_wishlist ?? false,
    notify_marketing: data.notify_marketing ?? false,
    profile_setup_complete: data.profile_setup_complete ?? false,
  };
}

function notifyShellProfileChanged(profile: Profile) {
  publishViewerProfileChanged({
    avatarEmoji: profile.avatar_emoji.trim() || DEFAULT_AVATAR_EMOJI,
    avatarUrl: profile.avatar_url?.trim() || null,
    displayName: profile.display_name,
  });
}

function ReminderToggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[14px] px-4 py-3"
      style={{ background: "rgba(0,0,0,.02)", border: "1px solid #f3f4f6" }}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-bold" style={{ color: "#1f2937" }}>
          {label}
        </div>
        <div className="text-[12px] leading-5" style={{ color: "#9ca3af" }}>
          {description}
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="relative shrink-0 transition"
        style={{
          width: 48,
          height: 26,
          borderRadius: 13,
          background: checked ? "#22c55e" : "#e5e7eb",
          border: "none",
          cursor: "pointer",
        }}
        aria-pressed={checked}
      >
        <span
          className="absolute rounded-full bg-white transition-all"
          style={{
            width: 22,
            height: 22,
            top: 2,
            left: checked ? 24 : 2,
            boxShadow: "0 1px 4px rgba(0,0,0,.15)",
          }}
        />
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [message, setMessage] = useState("");
  const [customBudget, setCustomBudget] = useState(false);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferenceFormState>(
    DEFAULT_REMINDER_PREFERENCES
  );
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        clearClientSnapshots(PROFILE_PAGE_SNAPSHOT_STORAGE_PREFIX);
        router.push("/login");
        return;
      }
      if (!isMounted) return;

      setUserId(session.user.id);
      setEmail(session.user.email || "");

      const cachedProfile = readClientSnapshot(
        getProfilePageSnapshotStorageKey(session.user.id),
        session.user.id,
        isProfilePageSnapshot
      );

      if (cachedProfile) {
        setProfile(cachedProfile.profile);
        setCustomBudget(cachedProfile.customBudget);
        setReminderPreferences(cachedProfile.reminderPreferences);
        setEmail(cachedProfile.email);
        setLoading(false);
      }

      const [data, loadedReminderPreferences] = await Promise.all([
        getProfile(),
        getReminderPreferences(),
      ]);
      if (!isMounted) return;

      const nextProfile = data ? normalizeProfile(data) : DEFAULT_PROFILE;
      const nextCustomBudget = data
        ? !BUDGET_OPTIONS.includes(data.default_budget || 25)
        : false;
      const nextReminderPreferences =
        loadedReminderPreferences || DEFAULT_REMINDER_PREFERENCES;

      setProfile(nextProfile);
      setCustomBudget(nextCustomBudget);
      setReminderPreferences(nextReminderPreferences);
      writeClientSnapshot(getProfilePageSnapshotStorageKey(session.user.id), {
        createdAt: Date.now(),
        customBudget: nextCustomBudget,
        email: session.user.email || "",
        profile: nextProfile,
        reminderPreferences: nextReminderPreferences,
        userId: session.user.id,
      });
      setLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [supabase, router]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`profile-${userId}-realtime`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (reloadTimer) {
            clearTimeout(reloadTimer);
          }

          reloadTimer = setTimeout(() => {
            void Promise.all([getProfile(), getReminderPreferences()]).then(
              ([data, loadedReminderPreferences]) => {
                if (data) {
                  setProfile(normalizeProfile(data));
                  setCustomBudget(!BUDGET_OPTIONS.includes(data.default_budget || 25));
                }

                setReminderPreferences(loadedReminderPreferences || DEFAULT_REMINDER_PREFERENCES);
              }
            );
          }, 120);
        }
      )
      .subscribe();

    return () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const profileResult = await updateProfile(
      profile.display_name, profile.avatar_emoji, profile.avatar_url, profile.bio,
      profile.default_budget, profile.currency,
      profile.notify_invites, profile.notify_draws, profile.notify_chat,
      profile.notify_wishlist, profile.notify_marketing, true
    );

    if (!profileResult.success) {
      setMessage(profileResult.message);
      setSaving(false);
      return;
    }

    const savedProfile = {
      ...profile,
      profile_setup_complete: true,
    };
    notifyShellProfileChanged(savedProfile);

    const reminderResult = await saveReminderPreferences(reminderPreferences);

    setMessage(
      reminderResult.success
        ? "Profile and reminder settings saved."
        : reminderResult.message
    );
    setSaving(false);
    if (reminderResult.success) {
      if (userId) {
        writeClientSnapshot(getProfilePageSnapshotStorageKey(userId), {
          createdAt: Date.now(),
          customBudget,
          email,
          profile: savedProfile,
          reminderPreferences,
          userId,
        });
      }
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const update = (key: keyof Profile, value: Profile[keyof Profile]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleFestiveAvatarSelect = (emoji: string) => {
    const nextProfile = {
      ...profile,
      avatar_emoji: emoji,
    };

    setProfile(nextProfile);
    notifyShellProfileChanged(nextProfile);
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !userId) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Please upload a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Please keep your profile photo under 5 MB.");
      event.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    setMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar.${extension}`;
      const uploadResult = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: true,
        });

      if (uploadResult.error) {
        setMessage("Failed to upload your photo. Please try again.");
        return;
      }

      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      const nextAvatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      update("avatar_url", nextAvatarUrl);
      notifyShellProfileChanged({
        ...profile,
        avatar_url: nextAvatarUrl,
      });
      setMessage("Photo uploaded. Save changes to keep it across the app.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const handleRemovePhoto = () => {
    update("avatar_url", null);
    notifyShellProfileChanged({
      ...profile,
      avatar_url: null,
    });
    setMessage("Photo removed. Save changes to use your festive avatar again.");
  };

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        "Are you sure? This will permanently delete your account, the groups you own, and your profile data. This cannot be undone."
      )
    ) {
      return;
    }

    setDeletingAccount(true);
    setMessage("");

    const result = await deleteAccount();

    if (!result.success) {
      setMessage(result.message);
      setDeletingAccount(false);
      return;
    }

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // The auth user may already be gone on the server. A redirect is enough.
    }

    router.replace("/");
  };

  if (loading) return <ProfileSkeleton />;

  return (
    <main className="min-h-screen" style={{ background: "linear-gradient(180deg,#eef4fb,#dce8f5,#e8dce0)", fontFamily: "'Nunito', sans-serif" }}>
      <FadeIn className="mx-auto max-w-[640px] px-4 py-5 sm:px-6 sm:py-8">

        {/* Back */}
        <button data-fade onClick={() => router.push("/dashboard")}
          className="mb-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition sm:w-auto"
          style={{ color: "#4a6fa5", background: "rgba(255,255,255,.6)", border: "1px solid rgba(74,111,165,.15)", fontFamily: "inherit" }}>
          ← Back to Dashboard
        </button>

        {/* Header */}
        <div data-fade className="text-center mb-8">
          <h1 className="mb-1 text-[24px] font-bold sm:text-[28px]" style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}>🎅 My Profile</h1>
          <p className="text-[14px]" style={{ color: "#6b7280" }}>Manage how your name, photo, and notifications appear in groups.</p>
        </div>

        {/* ═══ AVATAR SECTION ═══ */}
        <div data-fade className="mb-4 rounded-[20px] p-5 text-center sm:p-7" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.04)" }}>
          <div className="relative inline-block mb-3">
            <div className="flex h-[96px] w-[96px] items-center justify-center rounded-full text-[44px] sm:h-[120px] sm:w-[120px] sm:text-[56px]"
              style={{ background: "linear-gradient(135deg,#fef2f2,#fee2e2)", border: "4px solid #fff", boxShadow: "0 4px 16px rgba(192,57,43,.15)" }}>
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt="Profile avatar"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                profile.avatar_emoji
              )}
            </div>
          </div>
          <div className="text-[13px] font-bold" style={{ color: "#1f2937" }}>{profile.display_name || "Set your name"}</div>
          <div className="text-[11px] font-semibold" style={{ color: "#9ca3af" }}>{email}</div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <label
              className="w-full cursor-pointer rounded-[10px] px-4 py-2 text-[13px] font-bold transition sm:w-auto"
              style={{
                background: "rgba(59,130,246,.08)",
                color: "#2563eb",
                border: "1px solid rgba(37,99,235,.15)",
                fontFamily: "inherit",
              }}
            >
              {uploadingAvatar ? "Uploading..." : "Upload photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
            {profile.avatar_url && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="w-full rounded-[10px] px-4 py-2 text-[13px] font-bold transition sm:w-auto"
                style={{
                  background: "rgba(0,0,0,.03)",
                  color: "#6b7280",
                  border: "1px solid rgba(0,0,0,.06)",
                  fontFamily: "inherit",
                }}
              >
                Use a festive avatar
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "#9ca3af" }}>
            Profile photos show on group cards when available. Festive avatars stay as your fallback.
          </p>

          <p className="text-[13px] font-extrabold mt-5 mb-3 text-left" style={{ color: "#374151" }}>Choose a festive avatar</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 md:gap-2.5">
            {PRESET_AVATARS.map((emoji) => (
              <button key={emoji} onClick={() => handleFestiveAvatarSelect(emoji)}
                className="aspect-square rounded-full flex items-center justify-center text-[26px] transition"
                style={{
                  background: profile.avatar_emoji === emoji ? "#fef2f2" : "rgba(0,0,0,.02)",
                  border: `3px solid ${profile.avatar_emoji === emoji ? "#c0392b" : "transparent"}`,
                  cursor: "pointer",
                  transform: profile.avatar_emoji === emoji ? "scale(1.1)" : "scale(1)",
                  boxShadow: profile.avatar_emoji === emoji ? "0 2px 10px rgba(192,57,43,.15)" : "none",
                  fontFamily: "inherit",
                }}>
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ PERSONAL INFO ═══ */}
        <div data-fade className="mb-4 rounded-[20px] p-5 sm:p-7" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.04)" }}>
          <h2 className="text-[18px] font-bold mb-5 flex items-center gap-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}>👤 Personal Info</h2>

          <div className="mb-4">
            <label className="text-[13px] font-extrabold mb-1.5 block" style={{ color: "#374151" }}>Display Name</label>
            <input value={profile.display_name} onChange={(e) => update("display_name", e.target.value)}
              placeholder="How others see you in groups..." maxLength={50}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition"
              style={{ border: "2px solid #e5e7eb", fontFamily: "inherit", color: "#1f2937" }} />
            <p className="text-[11px] mt-1" style={{ color: "#9ca3af" }}>This is shown to other members in your groups</p>
          </div>

          <div className="mb-4">
            <label className="text-[13px] font-extrabold mb-1.5 block" style={{ color: "#374151" }}>Email</label>
            <input value={email} disabled
              className="w-full px-4 py-3 rounded-xl text-[14px]"
              style={{ border: "2px solid #e5e7eb", background: "#f9fafb", color: "#9ca3af", fontFamily: "inherit" }} />
            <p className="text-[11px] mt-1" style={{ color: "#9ca3af" }}>Email can&apos;t be changed — it&apos;s tied to your account</p>
          </div>

          <div>
            <label className="text-[13px] font-extrabold mb-1.5 flex items-center gap-1.5" style={{ color: "#374151" }}>
              Bio <span className="text-[11px] font-semibold" style={{ color: "#9ca3af" }}>(optional)</span>
            </label>
            <textarea value={profile.bio} onChange={(e) => update("bio", e.target.value)}
              placeholder="Tell your Secret Santa a bit about yourself..." maxLength={200} rows={3}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition resize-y"
              style={{ border: "2px solid #e5e7eb", fontFamily: "inherit", color: "#1f2937", minHeight: "80px" }} />
            <p className="text-[11px] mt-1" style={{ color: "#9ca3af" }}>Your Secret Santa can see this for gift inspiration · {200 - profile.bio.length} chars left</p>
          </div>
        </div>

        {/* ═══ PREFERENCES ═══ */}
        <div data-fade className="mb-4 rounded-[20px] p-5 sm:p-7" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.04)" }}>
          <h2 className="text-[18px] font-bold mb-5 flex items-center gap-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}>⚙️ Preferences</h2>

          <div className="mb-5">
            <label className="text-[13px] font-extrabold mb-2 block" style={{ color: "#374151" }}>Default Budget</label>
            <div className="flex gap-2 flex-wrap">
              {BUDGET_OPTIONS.map((amount) => (
                <button key={amount} onClick={() => { update("default_budget", amount); setCustomBudget(false); }}
                  className="px-4 py-2 rounded-[10px] text-[13px] font-bold transition"
                  style={{
                    border: `2px solid ${!customBudget && profile.default_budget === amount ? "#c0392b" : "#e5e7eb"}`,
                    background: !customBudget && profile.default_budget === amount ? "#fef2f2" : "#fff",
                    color: !customBudget && profile.default_budget === amount ? "#c0392b" : "#6b7280",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  ${amount}
                </button>
              ))}
              <button onClick={() => setCustomBudget(true)}
                className="px-4 py-2 rounded-[10px] text-[13px] font-bold transition"
                style={{
                  border: `2px solid ${customBudget ? "#c0392b" : "#e5e7eb"}`,
                  background: customBudget ? "#fef2f2" : "#fff",
                  color: customBudget ? "#c0392b" : "#6b7280",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                Custom
              </button>
            </div>
            {customBudget && (
              <input type="number" value={profile.default_budget} onChange={(e) => update("default_budget", parseInt(e.target.value) || 0)}
                placeholder="Enter amount..."
                className="mt-2 w-full rounded-lg px-3 py-2 text-[14px] outline-none sm:w-32"
                style={{ border: "2px solid #c0392b", fontFamily: "inherit", color: "#1f2937" }} />
            )}
            <p className="text-[11px] mt-1.5" style={{ color: "#9ca3af" }}>Pre-fills when you create a new group</p>
          </div>

          <div>
            <label className="text-[13px] font-extrabold mb-1.5 block" style={{ color: "#374151" }}>Currency</label>
            <select value={profile.currency} onChange={(e) => update("currency", e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none"
              style={{ border: "2px solid #e5e7eb", fontFamily: "inherit", color: "#1f2937", cursor: "pointer", background: "#fff" }}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ═══ NOTIFICATIONS ═══ */}
        <div data-fade className="mb-4 rounded-[20px] p-5 sm:p-7" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.04)" }}>
          <h2 className="text-[18px] font-bold mb-5 flex items-center gap-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}>🔔 Notifications</h2>

          {[
            { key: "notify_invites" as const, label: "Group invitations", desc: "Tell me when someone invites me to a group." },
            { key: "notify_draws" as const, label: "Name draw results", desc: "Tell me when names are drawn in my groups." },
            { key: "notify_chat" as const, label: "Private messages", desc: "Tell me when my Santa or recipient sends a message." },
            { key: "notify_wishlist" as const, label: "Wishlist updates", desc: "Tell me when my recipient updates their wishlist." },
            { key: "notify_marketing" as const, label: "Tips and updates", desc: "Send occasional product updates and seasonal tips." },
          ].map((item, i, arr) => (
            <div key={item.key} className="flex items-center justify-between gap-3 py-3"
              style={{ borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <div className="flex-1">
                <div className="text-[14px] font-bold" style={{ color: "#1f2937" }}>{item.label}</div>
                <div className="text-[12px]" style={{ color: "#9ca3af" }}>{item.desc}</div>
              </div>
              <button onClick={() => update(item.key, !profile[item.key])}
                className="flex-shrink-0 relative transition"
                style={{
                  width: 48, height: 26, borderRadius: 13,
                  background: profile[item.key] ? "#22c55e" : "#e5e7eb",
                  border: "none", cursor: "pointer",
                }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#fff", position: "absolute", top: 2,
                  left: profile[item.key] ? 24 : 2,
                  boxShadow: "0 1px 4px rgba(0,0,0,.15)",
                  transition: "left .2s",
                }} />
              </button>
            </div>
          ))}

          <div
            className="mt-5 border-t pt-5"
            style={{ borderColor: "#f3f4f6" }}
          >
            <div className="mb-4">
              <h3 className="text-[16px] font-bold" style={{ color: "#1a1a1a" }}>
                Reminder settings
              </h3>
              <p className="mt-1 text-[12px] leading-5" style={{ color: "#9ca3af" }}>
                Choose which gift reminders you receive and how they arrive.
              </p>
            </div>

            <div className="grid gap-3">
              <ReminderToggle
                checked={reminderPreferences.reminder_wishlist_incomplete}
                description="Tell me when an upcoming group still needs wishlist ideas."
                label="Wishlist needed"
                onChange={() =>
                  setReminderPreferences((current) => ({
                    ...current,
                    reminder_wishlist_incomplete: !current.reminder_wishlist_incomplete,
                  }))
                }
              />
              <ReminderToggle
                checked={reminderPreferences.reminder_event_tomorrow}
                description="Send a heads-up the day before the gift exchange."
                label="Gift date tomorrow"
                onChange={() =>
                  setReminderPreferences((current) => ({
                    ...current,
                    reminder_event_tomorrow: !current.reminder_event_tomorrow,
                  }))
                }
              />
              <ReminderToggle
                checked={reminderPreferences.reminder_post_draw}
                description="Remind me after names are drawn so I can check the wishlist or send a private message."
                label="After names are drawn"
                onChange={() =>
                  setReminderPreferences((current) => ({
                    ...current,
                    reminder_post_draw: !current.reminder_post_draw,
                  }))
                }
              />
            </div>

            <div className="mt-4 rounded-[14px] p-4" style={{ background: "rgba(0,0,0,.02)", border: "1px solid #f3f4f6" }}>
              <div className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "#6b7280" }}>
                Delivery mode
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    description: "Send each reminder as its own notification.",
                    label: "Immediate",
                    value: "immediate" as const,
                  },
                  {
                    description: "Bundle due reminders into one daily in-app summary.",
                    label: "Daily summary",
                    value: "daily_digest" as const,
                  },
                ].map((option) => {
                  const selected = reminderPreferences.reminder_delivery_mode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setReminderPreferences((current) => ({
                          ...current,
                          reminder_delivery_mode: option.value,
                        }))
                      }
                      className="rounded-[12px] px-4 py-3 text-left transition"
                      style={{
                        background: selected ? "#fef2f2" : "#fff",
                        border: `2px solid ${selected ? "#c0392b" : "#e5e7eb"}`,
                        color: selected ? "#c0392b" : "#6b7280",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                      aria-pressed={selected}
                    >
                      <div className="text-[13px] font-extrabold">{option.label}</div>
                      <div className="mt-1 text-[11px] leading-5">{option.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SAVE ═══ */}
        <div data-fade className="text-center mb-6">
          {message && (
            <p className={`text-[13px] font-bold mb-3 ${message.includes("saved") ? "text-green-600" : "text-red-600"}`}>
              {message}
            </p>
          )}
          <button onClick={handleSave} disabled={saving}
            className="w-full rounded-[14px] px-8 py-3.5 text-[16px] font-extrabold text-white transition sm:w-auto sm:px-12"
            style={{
              background: saving ? "#9ca3af" : "linear-gradient(135deg,#c0392b,#e74c3c)",
              border: "none", cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: saving ? "none" : "0 4px 20px rgba(192,57,43,.25)",
            }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <p className="text-[11px] mt-2" style={{ color: "#9ca3af" }}>Your changes apply the next time members see your profile.</p>
        </div>

        {/* ═══ DANGER ZONE ═══ */}
        <div data-fade className="rounded-[20px] p-5 sm:p-7" style={{ background: "#fff", border: "1px solid rgba(220,38,38,.1)", boxShadow: "0 4px 20px rgba(0,0,0,.04)" }}>
          <h2 className="text-[18px] font-bold mb-3" style={{ fontFamily: "'Fredoka', sans-serif", color: "#dc2626" }}>⚠️ Account actions</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push("/reset-password")}
              className="w-full rounded-[10px] px-5 py-2.5 text-[13px] font-bold transition sm:w-auto"
              style={{ background: "rgba(220,38,38,.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,.15)", cursor: "pointer", fontFamily: "inherit" }}>
              🔑 Change Password
            </button>
            <button onClick={() => void handleDeleteAccount()}
              disabled={deletingAccount}
              className="w-full rounded-[10px] px-5 py-2.5 text-[13px] font-bold transition sm:w-auto"
              style={{ background: "rgba(220,38,38,.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,.15)", cursor: deletingAccount ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: deletingAccount ? 0.7 : 1 }}>
              🗑️ Delete Account
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "#9ca3af" }}>Deleting your account will remove all your data, groups, and messages permanently.</p>
        </div>

      </FadeIn>
    </main>
  );
}
