"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteAccount, getProfile, updateProfile } from "./actions";
import { ProfileSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";

const PRESET_AVATARS = [
  "🎅", "🧝", "🦌", "⛄", "🎄", "🎁", "🧑‍🎄", "❄️",
  "🔔", "⭐", "🍪", "🕯️", "🧦", "🎿", "☃️", "🎶",
];

const BUDGET_OPTIONS = [10, 15, 25, 50, 100];

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

export default function ProfilePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [message, setMessage] = useState("");
  const [customBudget, setCustomBudget] = useState(false);

  const [profile, setProfile] = useState<Profile>({
    display_name: "",
    avatar_emoji: "🎅",
    bio: "",
    default_budget: 25,
    currency: "USD",
    notify_invites: true,
    notify_draws: true,
    notify_chat: true,
    notify_wishlist: false,
    notify_marketing: false,
    profile_setup_complete: false,
  });

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      if (!isMounted) return;

      setUserId(session.user.id);
      setEmail(session.user.email || "");

      const data = await getProfile();
      if (!isMounted) return;

      if (data) {
        setProfile({
          display_name: data.display_name || "",
          avatar_emoji: data.avatar_emoji || "🎅",
          bio: data.bio || "",
          default_budget: data.default_budget || 25,
          currency: data.currency || "USD",
          notify_invites: data.notify_invites ?? true,
          notify_draws: data.notify_draws ?? true,
          notify_chat: data.notify_chat ?? true,
          notify_wishlist: data.notify_wishlist ?? false,
          notify_marketing: data.notify_marketing ?? false,
          profile_setup_complete: data.profile_setup_complete ?? false,
        });
        setCustomBudget(!BUDGET_OPTIONS.includes(data.default_budget || 25));
      }
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
            void getProfile().then((data) => {
              if (!data) {
                return;
              }

              setProfile({
                display_name: data.display_name || "",
                avatar_emoji: data.avatar_emoji || "🎅",
                bio: data.bio || "",
                default_budget: data.default_budget || 25,
                currency: data.currency || "USD",
                notify_invites: data.notify_invites ?? true,
                notify_draws: data.notify_draws ?? true,
                notify_chat: data.notify_chat ?? true,
                notify_wishlist: data.notify_wishlist ?? false,
                notify_marketing: data.notify_marketing ?? false,
                profile_setup_complete: data.profile_setup_complete ?? false,
              });
              setCustomBudget(!BUDGET_OPTIONS.includes(data.default_budget || 25));
            });
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
    const result = await updateProfile(
      profile.display_name, profile.avatar_emoji, profile.bio,
      profile.default_budget, profile.currency,
      profile.notify_invites, profile.notify_draws, profile.notify_chat,
      profile.notify_wishlist, profile.notify_marketing, true
    );
    setMessage(result.message);
    setSaving(false);
    if (result.success) setTimeout(() => setMessage(""), 3000);
  };

  const update = (key: keyof Profile, value: Profile[keyof Profile]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Fredoka:wght@400;500;600;700&display=swap');
      `}</style>

      <FadeIn className="max-w-[640px] mx-auto px-4 py-6">

        {/* Back */}
        <button data-fade onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-5 px-4 py-2 rounded-lg transition"
          style={{ color: "#4a6fa5", background: "rgba(255,255,255,.6)", border: "1px solid rgba(74,111,165,.15)", fontFamily: "inherit" }}>
          ← Back to Dashboard
        </button>

        {/* Header */}
        <div data-fade className="text-center mb-8">
          <h1 className="text-[28px] font-bold mb-1" style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}>🎅 My Profile</h1>
          <p className="text-[14px]" style={{ color: "#6b7280" }}>Manage your account and preferences</p>
        </div>

        {/* ═══ AVATAR SECTION ═══ */}
        <div data-fade className="rounded-[20px] p-7 mb-4 text-center" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.04)" }}>
          <div className="relative inline-block mb-3">
            <div className="w-[120px] h-[120px] rounded-full flex items-center justify-center text-[56px]"
              style={{ background: "linear-gradient(135deg,#fef2f2,#fee2e2)", border: "4px solid #fff", boxShadow: "0 4px 16px rgba(192,57,43,.15)" }}>
              {profile.avatar_emoji}
            </div>
          </div>
          <div className="text-[13px] font-bold" style={{ color: "#1f2937" }}>{profile.display_name || "Set your name"}</div>
          <div className="text-[11px] font-semibold" style={{ color: "#9ca3af" }}>{email}</div>

          <p className="text-[13px] font-extrabold mt-5 mb-3 text-left" style={{ color: "#374151" }}>Choose a festive avatar</p>
          <div className="grid grid-cols-8 gap-2.5">
            {PRESET_AVATARS.map((emoji) => (
              <button key={emoji} onClick={() => update("avatar_emoji", emoji)}
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
        <div data-fade className="rounded-[20px] p-7 mb-4" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.04)" }}>
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
        <div data-fade className="rounded-[20px] p-7 mb-4" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.04)" }}>
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
                className="mt-2 w-32 px-3 py-2 rounded-lg text-[14px] outline-none"
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
        <div data-fade className="rounded-[20px] p-7 mb-4" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.04)" }}>
          <h2 className="text-[18px] font-bold mb-5 flex items-center gap-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}>🔔 Notifications</h2>

          {[
            { key: "notify_invites" as const, label: "Group Invitations", desc: "Get notified when someone invites you to a group" },
            { key: "notify_draws" as const, label: "Draw Results", desc: "Get notified when names are drawn in your groups" },
            { key: "notify_chat" as const, label: "Chat Messages", desc: "Get notified when your Secret Santa sends a message" },
            { key: "notify_wishlist" as const, label: "Wishlist Updates", desc: "Get notified when your recipient updates their wishlist" },
            { key: "notify_marketing" as const, label: "Marketing Emails", desc: "Tips, new features, and seasonal reminders" },
          ].map((item, i, arr) => (
            <div key={item.key} className="flex items-center justify-between py-3"
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
        </div>

        {/* ═══ SAVE ═══ */}
        <div data-fade className="text-center mb-6">
          {message && (
            <p className={`text-[13px] font-bold mb-3 ${message.includes("saved") ? "text-green-600" : "text-red-600"}`}>
              {message}
            </p>
          )}
          <button onClick={handleSave} disabled={saving}
            className="px-12 py-3.5 rounded-[14px] text-[16px] font-extrabold text-white transition"
            style={{
              background: saving ? "#9ca3af" : "linear-gradient(135deg,#c0392b,#e74c3c)",
              border: "none", cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: saving ? "none" : "0 4px 20px rgba(192,57,43,.25)",
            }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <p className="text-[11px] mt-2" style={{ color: "#9ca3af" }}>Changes are saved to your account</p>
        </div>

        {/* ═══ DANGER ZONE ═══ */}
        <div data-fade className="rounded-[20px] p-7" style={{ background: "#fff", border: "1px solid rgba(220,38,38,.1)", boxShadow: "0 4px 20px rgba(0,0,0,.04)" }}>
          <h2 className="text-[18px] font-bold mb-3" style={{ fontFamily: "'Fredoka', sans-serif", color: "#dc2626" }}>⚠️ Danger Zone</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => router.push("/reset-password")}
              className="px-5 py-2.5 rounded-[10px] text-[13px] font-bold transition"
              style={{ background: "rgba(220,38,38,.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,.15)", cursor: "pointer", fontFamily: "inherit" }}>
              🔑 Change Password
            </button>
            <button onClick={() => void handleDeleteAccount()}
              disabled={deletingAccount}
              className="px-5 py-2.5 rounded-[10px] text-[13px] font-bold transition"
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
