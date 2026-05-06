"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShellIcon } from "@/app/components/AppShellIcons";
import {
  DASHBOARD_THEME_CHANGED_EVENT,
  readStoredDashboardTheme,
  writeStoredDashboardTheme,
  type DashboardTheme,
} from "@/app/components/theme-preferences";
import { ThemeIcon } from "@/app/dashboard/dashboard-icons";
import {
  readSantaAssistantHiddenPreference,
  setSantaAssistantHiddenPreference,
  SANTA_ASSISTANT_VISIBILITY_EVENT,
} from "@/app/hooks/useSantaAssistant";
import {
  getReminderPreferences,
  saveReminderPreferences,
  type ReminderPreferenceFormState,
} from "@/app/profile/actions";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_REMINDER_PREFERENCES: ReminderPreferenceFormState = {
  reminder_delivery_mode: "immediate",
  reminder_event_tomorrow: true,
  reminder_post_draw: true,
  reminder_wishlist_incomplete: true,
};

type ReminderToggleProps = {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: () => void;
};

function ReminderToggle({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: ReminderToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className="group flex min-h-26 w-full items-center justify-between gap-4 rounded-[22px] border bg-white/86 px-4 py-4 text-left shadow-[0_14px_32px_rgba(46,52,50,.05)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0 sm:px-5"
      style={{
        borderColor: checked ? "rgba(72,102,78,.28)" : "rgba(148,163,184,.18)",
      }}
      aria-pressed={checked}
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-black text-[#2e3432]">{label}</span>
        <span className="mt-1 block text-[13px] font-semibold leading-5 text-[#64748b]">
          {description}
        </span>
      </span>
      <span
        className="relative h-8 w-14 shrink-0 rounded-full transition"
        style={{ background: checked ? "#48664e" : "#e2e8f0" }}
        aria-hidden="true"
      >
        <span
          className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_3px_10px_rgba(15,23,42,.18)] transition"
          style={{ left: checked ? 26 : 4 }}
        />
      </span>
    </button>
  );
}

function DeliveryOption({
  description,
  disabled = false,
  label,
  selected,
  onSelect,
}: {
  description: string;
  disabled?: boolean;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className="rounded-[20px] border px-5 py-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
      style={{
        background: selected ? "rgba(72,102,78,.1)" : "#fff",
        borderColor: selected ? "rgba(72,102,78,.32)" : "rgba(148,163,184,.18)",
      }}
    >
      <span className="block text-[14px] font-black text-[#2e3432]">{label}</span>
      <span className="mt-1 block text-[12px] font-semibold leading-5 text-[#64748b]">
        {description}
      </span>
    </button>
  );
}

export default function RemindersPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(() =>
    readStoredDashboardTheme()
  );
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState<ReminderPreferenceFormState>(
    DEFAULT_REMINDER_PREFERENCES
  );
  const [assistantHidden, setAssistantHidden] = useState(() =>
    readSantaAssistantHiddenPreference()
  );

  useEffect(() => {
    const syncAssistantPreference = () => {
      setAssistantHidden(readSantaAssistantHiddenPreference());
    };
    const syncThemePreference = () => {
      setDashboardTheme(readStoredDashboardTheme());
    };

    window.addEventListener("storage", syncAssistantPreference);
    window.addEventListener(SANTA_ASSISTANT_VISIBILITY_EVENT, syncAssistantPreference);
    window.addEventListener("storage", syncThemePreference);
    window.addEventListener(DASHBOARD_THEME_CHANGED_EVENT, syncThemePreference);

    return () => {
      window.removeEventListener("storage", syncAssistantPreference);
      window.removeEventListener(SANTA_ASSISTANT_VISIBILITY_EVENT, syncAssistantPreference);
      window.removeEventListener("storage", syncThemePreference);
      window.removeEventListener(DASHBOARD_THEME_CHANGED_EVENT, syncThemePreference);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        const loadedPreferences = await getReminderPreferences();

        if (!mounted) {
          return;
        }

        setPreferences(loadedPreferences || DEFAULT_REMINDER_PREFERENCES);
      } catch {
        if (mounted) {
          setMessage("We could not load your saved reminder choices. Review the defaults and try again.");
        }
      } finally {
        if (mounted) {
          setLoadingPreferences(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const updatePreference = <Key extends keyof ReminderPreferenceFormState>(
    key: Key,
    value: ReminderPreferenceFormState[Key]
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const result = await saveReminderPreferences(preferences);
      setMessage(result.message);

      if (result.success) {
        setTimeout(() => setMessage(""), 3000);
      }
    } catch {
      setMessage("We could not save reminder settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAssistant = () => {
    setSantaAssistantHiddenPreference(!assistantHidden);
  };

  const toggleDashboardTheme = () => {
    writeStoredDashboardTheme(dashboardTheme === "midnight" ? "default" : "midnight");
  };

  const isMidnightTheme = dashboardTheme === "midnight";
  const panelBorder = isMidnightTheme ? "rgba(148,163,184,.22)" : "rgba(148,163,184,.18)";
  const textColor = isMidnightTheme ? "#f8fafc" : "#2e3432";
  const mutedColor = isMidnightTheme ? "#cbd5e1" : "#64748b";

  return (
    <main data-testid="settings-workspace" className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section
          className={`relative overflow-hidden rounded-[30px] px-5 py-6 sm:px-7 ${
            isMidnightTheme ? "holiday-panel-dark" : "holiday-panel-strong"
          }`}
          style={{
            color: textColor,
          }}
        >
          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#48664e]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#48664e]">
                <AppShellIcon name="settings" className="h-4 w-4" />
                Settings
              </div>
              <h1
                className="mt-4 text-[34px] font-black leading-none sm:text-[44px]"
                style={{ color: textColor, fontFamily: "'Fredoka','Nunito',sans-serif" }}
              >
                Make the app feel right
              </h1>
              <p className="mt-3 text-[15px] font-semibold leading-7" style={{ color: mutedColor }}>
                Control reminders, Santa Buddy, and display preferences for every exchange.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loadingPreferences}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#48664e] px-6 text-[14px] font-black text-white shadow-[0_18px_34px_rgba(72,102,78,.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPreferences ? "Loading choices..." : saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </section>

        {loadingPreferences && (
          <div
            role="status"
            className="holiday-panel-soft mt-5 rounded-[18px] px-4 py-3 text-[13px] font-extrabold text-[#48664e]"
          >
            Loading your saved reminder choices...
          </div>
        )}

        {message && (
          <div
            role={message.includes("could not") ? "alert" : "status"}
            className="holiday-panel-soft mt-5 rounded-[18px] px-4 py-3 text-[13px] font-extrabold text-[#48664e]"
          >
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <ReminderToggle
            checked={preferences.reminder_wishlist_incomplete}
            description="Tell me when an upcoming group still needs wishlist ideas."
            disabled={loadingPreferences}
            label="Wishlist ideas needed"
            onChange={() =>
              updatePreference(
                "reminder_wishlist_incomplete",
                !preferences.reminder_wishlist_incomplete
              )
            }
          />
          <ReminderToggle
            checked={preferences.reminder_event_tomorrow}
            description="Send a heads-up the day before the gift exchange."
            disabled={loadingPreferences}
            label="Gift date heads-up"
            onChange={() =>
              updatePreference("reminder_event_tomorrow", !preferences.reminder_event_tomorrow)
            }
          />
          <ReminderToggle
            checked={preferences.reminder_post_draw}
            description="Remind me after names are drawn to check the wishlist and plan."
            disabled={loadingPreferences}
            label="After names are drawn"
            onChange={() =>
              updatePreference("reminder_post_draw", !preferences.reminder_post_draw)
            }
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div
            className={`rounded-[28px] p-5 sm:p-6 ${
              isMidnightTheme ? "holiday-panel-dark" : "holiday-panel"
            }`}
            style={{ color: textColor }}
          >
            <h2 className="text-[20px] font-black" style={{ color: textColor }}>How reminders arrive</h2>
            <p className="mt-2 text-[13px] font-semibold leading-6" style={{ color: mutedColor }}>
              Choose whether each reminder appears right away or arrives as a single
              daily summary.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DeliveryOption
                description="Send each reminder as its own notification."
                disabled={loadingPreferences}
                label="Right away"
                selected={preferences.reminder_delivery_mode === "immediate"}
                onSelect={() => updatePreference("reminder_delivery_mode", "immediate")}
              />
              <DeliveryOption
                description="Bundle due reminders into one daily in-app summary."
                disabled={loadingPreferences}
                label="Daily summary"
                selected={preferences.reminder_delivery_mode === "daily_digest"}
                onSelect={() => updatePreference("reminder_delivery_mode", "daily_digest")}
              />
            </div>
          </div>

          <aside
            className={`space-y-4 rounded-[28px] p-5 ${
              isMidnightTheme ? "holiday-panel-dark" : "holiday-panel"
            }`}
            style={{ color: textColor }}
          >
            <div>
              <h2 className="text-[18px] font-black" style={{ color: textColor }}>Display</h2>
              <p className="mt-2 text-[13px] font-semibold leading-6" style={{ color: mutedColor }}>
                Use the warm light theme or a calmer midnight theme for app pages.
              </p>
              <button
                type="button"
                data-testid="dashboard-theme-preference-toggle"
                onClick={toggleDashboardTheme}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-[13px] font-black transition hover:-translate-y-0.5"
                style={{
                  background: isMidnightTheme ? "rgba(252,206,114,.14)" : "#fff",
                  borderColor: isMidnightTheme ? "rgba(252,206,114,.24)" : "rgba(72,102,78,.18)",
                  color: isMidnightTheme ? "#fde68a" : "#48664e",
                }}
                aria-pressed={isMidnightTheme}
              >
                <ThemeIcon dark={isMidnightTheme} className="h-4 w-4" />
                {isMidnightTheme ? "Use light mode" : "Use dark mode"}
              </button>
            </div>

            <div className="h-px" style={{ background: panelBorder }} />

            <div>
              <h2 className="text-[18px] font-black" style={{ color: textColor }}>Santa Buddy</h2>
              <p className="mt-2 text-[13px] font-semibold leading-6" style={{ color: mutedColor }}>
                Show the floating assistant when you want tips, or hide it for a quieter workspace.
              </p>
              <button
                type="button"
                data-testid="santa-assistant-preference-toggle"
                onClick={toggleAssistant}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full border px-4 text-[13px] font-black transition hover:-translate-y-0.5"
                style={{
                  background: isMidnightTheme ? "rgba(255,255,255,.08)" : "#fff",
                  borderColor: isMidnightTheme ? "rgba(148,163,184,.24)" : "rgba(72,102,78,.18)",
                  color: isMidnightTheme ? "#f8fafc" : "#48664e",
                }}
                aria-pressed={!assistantHidden}
              >
                {assistantHidden ? "Show Santa Buddy" : "Hide Santa Buddy"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
