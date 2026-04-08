"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationsSkeleton } from "@/app/components/PageSkeleton";
import {
  getReminderPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  saveReminderPreferences,
  type ReminderPreferenceFormState,
} from "./actions";
import FadeIn from "@/app/components/FadeIn";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
};

const DEFAULT_REMINDER_PREFERENCES: ReminderPreferenceFormState = {
  reminder_delivery_mode: "immediate",
  reminder_event_tomorrow: true,
  reminder_post_draw: true,
  reminder_wishlist_incomplete: true,
};

function formatNotificationTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case "invite":
      return "\u{1F4E9}";
    case "chat":
      return "\u{1F4AC}";
    case "draw":
      return "\u{1F3B2}";
    case "reveal":
      return "\u{1F389}";
    case "gift_received":
      return "\u{1F381}";
    case "reminder_wishlist_incomplete":
      return "\u{1F4DD}";
    case "reminder_event_tomorrow":
      return "\u{1F4C5}";
    case "reminder_post_draw":
      return "\u{1F6CE}";
    case "reminder_digest":
      return "\u{23F0}";
    default:
      return "\u{1F514}";
  }
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
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-extrabold text-slate-800">{label}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="relative h-7 w-13 shrink-0 rounded-full transition"
        style={{ background: checked ? "#22c55e" : "#e2e8f0" }}
        aria-pressed={checked}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.18)] transition-all"
          style={{ left: checked ? 26 : 2 }}
        />
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<ReminderPreferenceFormState>(
    DEFAULT_REMINDER_PREFERENCES
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const loadNotificationsRef = useRef<((targetUserId: string) => Promise<void>) | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async (targetUserId: string) => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, body, link_path, read_at, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!isMounted) {
        return;
      }

      if (error) {
        setMessage("Failed to load notifications.");
        setLoading(false);
        return;
      }

      setNotifications((data || []) as NotificationItem[]);
      setLoading(false);
    };

    loadNotificationsRef.current = loadNotifications;

    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      if (!isMounted) {
        return;
      }

      setUserId(session.user.id);

      const [loadedPreferences] = await Promise.all([
        getReminderPreferences(),
        loadNotifications(session.user.id),
      ]);

      if (!isMounted) {
        return;
      }

      setPreferences(loadedPreferences || DEFAULT_REMINDER_PREFERENCES);
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const scheduleReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        if (loadNotificationsRef.current) {
          void loadNotificationsRef.current(userId);
        }
      }, 120);
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleReload();
      }
    };

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => scheduleReload()
      )
      .subscribe();

    pollInterval = setInterval(refreshIfVisible, 8000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  useEffect(() => {
    const prefetchOnce = (route: string) => {
      if (prefetchedRoutesRef.current.has(route)) {
        return;
      }

      prefetchedRoutesRef.current.add(route);
      router.prefetch(route);
    };

    prefetchOnce("/dashboard");
    prefetchOnce("/secret-santa");

    for (const notification of notifications.slice(0, 20)) {
      if (notification.link_path) {
        prefetchOnce(notification.link_path);
      }
    }
  }, [router, notifications]);

  if (loading) {
    return <NotificationsSkeleton />;
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  const handleOpenNotification = async (notification: NotificationItem) => {
    setMessage("");
    setProcessingId(notification.id);

    if (!notification.read_at) {
      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) =>
          currentNotification.id === notification.id
            ? { ...currentNotification, read_at: new Date().toISOString() }
            : currentNotification
        )
      );

      void markNotificationRead(notification.id).then((result) => {
        if (!result.success) {
          setMessage(result.message);
        }
      });
    }

    setProcessingId(null);

    if (notification.link_path) {
      router.push(notification.link_path);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setMessage("");
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.read_at
          ? notification
          : { ...notification, read_at: new Date().toISOString() }
      )
    );

    const result = await markAllNotificationsRead();

    if (!result.success) {
      setMessage(result.message);
    }

    setMarkingAll(false);
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    setSettingsMessage("");
    const result = await saveReminderPreferences(preferences);
    setSettingsMessage(result.message);
    setSavingPreferences(false);
  };

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg,#eef4fb 0%,#dce8f5 38%,#e8ecef 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <FadeIn className="mx-auto max-w-[1040px] px-4 py-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition"
          style={{
            color: "#4a6fa5",
            background: "rgba(255,255,255,.68)",
            border: "1px solid rgba(74,111,165,.15)",
            fontFamily: "inherit",
          }}
        >
          Back to dashboard
        </button>

        <div
          className="overflow-hidden rounded-3xl"
          style={{
            background: "linear-gradient(180deg,#fffdf9,#f8f5ef)",
            border: "2px solid rgba(21,101,52,.1)",
            boxShadow: "0 18px 40px rgba(15,23,42,.08)",
          }}
        >
          <div
            className="px-6 py-5 text-white"
            style={{ background: "linear-gradient(135deg,#14532d,#166534)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[30px] font-bold" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                  {"\u{1F514}"} Notifications
                </div>
                <p className="mt-1 text-[13px]" style={{ color: "rgba(255,255,255,.84)" }}>
                  Important updates from your groups, chats, gift progress, and reminder system.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-3 py-1.5 text-[11px] font-extrabold"
                  style={{
                    background: unreadCount > 0 ? "rgba(251,191,36,.18)" : "rgba(255,255,255,.12)",
                    color: unreadCount > 0 ? "#fef3c7" : "rgba(255,255,255,.82)",
                  }}
                >
                  {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                </span>

                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0 || markingAll}
                  className="rounded-xl px-4 py-2 text-[12px] font-extrabold transition"
                  style={{
                    background:
                      unreadCount === 0 || markingAll
                        ? "rgba(255,255,255,.14)"
                        : "rgba(255,255,255,.22)",
                    color: unreadCount === 0 || markingAll ? "rgba(255,255,255,.55)" : "#fff",
                    border: "1px solid rgba(255,255,255,.16)",
                    cursor: unreadCount === 0 || markingAll ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {markingAll ? "Updating..." : "Mark all read"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            <section
              className="rounded-[22px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                    Reminder preferences
                  </div>
                  <h2 className="mt-2 text-[24px] font-bold text-slate-900">Smart reminders</h2>
                  <p className="mt-2 max-w-[680px] text-sm leading-6 text-slate-600">
                    Choose which reminder types we should send, and whether they arrive immediately
                    or as one daily digest. Daily digest groups reminders into one in-app update
                    around 9:00 AM Manila.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={savingPreferences}
                  className="rounded-full bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition"
                  style={{ cursor: savingPreferences ? "not-allowed" : "pointer", opacity: savingPreferences ? 0.7 : 1 }}
                >
                  {savingPreferences ? "Saving..." : "Save reminder settings"}
                </button>
              </div>

              {settingsMessage && (
                <div
                  className="mt-4 rounded-xl px-4 py-3 text-sm font-bold"
                  style={{
                    background: settingsMessage.toLowerCase().includes("saved")
                      ? "rgba(34,197,94,.08)"
                      : "rgba(239,68,68,.08)",
                    color: settingsMessage.toLowerCase().includes("saved") ? "#15803d" : "#b91c1c",
                    border: settingsMessage.toLowerCase().includes("saved")
                      ? "1px solid rgba(34,197,94,.18)"
                      : "1px solid rgba(239,68,68,.14)",
                  }}
                >
                  {settingsMessage}
                </div>
              )}

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_320px]">
                <div className="space-y-3">
                  <ReminderToggle
                    checked={preferences.reminder_wishlist_incomplete}
                    description="Remind users when an upcoming group still has no wishlist items to guide their Secret Santa."
                    label="Wishlist incomplete"
                    onChange={() =>
                      setPreferences((current) => ({
                        ...current,
                        reminder_wishlist_incomplete: !current.reminder_wishlist_incomplete,
                      }))
                    }
                  />
                  <ReminderToggle
                    checked={preferences.reminder_event_tomorrow}
                    description="Send a heads-up the day before the exchange so people can review their plans."
                    label="Event tomorrow"
                    onChange={() =>
                      setPreferences((current) => ({
                        ...current,
                        reminder_event_tomorrow: !current.reminder_event_tomorrow,
                      }))
                    }
                  />
                  <ReminderToggle
                    checked={preferences.reminder_post_draw}
                    description="Nudge gifters after a draw so they start planning, checking wishlists, or opening the anonymous chat."
                    label="Post-draw planning"
                    onChange={() =>
                      setPreferences((current) => ({
                        ...current,
                        reminder_post_draw: !current.reminder_post_draw,
                      }))
                    }
                  />
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Delivery mode
                  </div>
                  <div className="mt-3 grid gap-3">
                    {[
                      {
                        description: "Send reminders as soon as they become due during the hourly reminder run.",
                        label: "Immediate",
                        value: "immediate" as const,
                      },
                      {
                        description: "Bundle due reminders into one daily in-app digest around 9:00 AM Manila.",
                        label: "Daily digest",
                        value: "daily_digest" as const,
                      },
                    ].map((option) => {
                      const selected = preferences.reminder_delivery_mode === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setPreferences((current) => ({
                              ...current,
                              reminder_delivery_mode: option.value,
                            }))
                          }
                          className="rounded-2xl border px-4 py-3 text-left transition"
                          style={{
                            background: selected ? "rgba(37,99,235,.08)" : "#fff",
                            borderColor: selected ? "rgba(37,99,235,.35)" : "rgba(226,232,240,.9)",
                          }}
                        >
                          <div className="text-sm font-extrabold text-slate-800">{option.label}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{option.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {message && (
              <div
                className="rounded-xl px-4 py-3 text-sm font-bold"
                style={{
                  background: "rgba(239,68,68,.08)",
                  color: "#b91c1c",
                  border: "1px solid rgba(239,68,68,.14)",
                }}
              >
                {message}
              </div>
            )}

            {notifications.length === 0 ? (
              <div
                className="rounded-[20px] p-10 text-center"
                style={{
                  background: "rgba(255,255,255,.78)",
                  border: "1px solid rgba(226,232,240,.82)",
                }}
              >
                <div className="mb-3 text-[42px]">{"\u{1F514}"}</div>
                <div className="text-[22px] font-bold text-slate-900" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                  No notifications yet
                </div>
                <p className="mt-2 text-[13px] text-slate-500">
                  When something important happens, it will show up here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void handleOpenNotification(notification)}
                    disabled={processingId === notification.id}
                    className="w-full rounded-[18px] p-5 text-left transition"
                    style={{
                      background: notification.read_at
                        ? "rgba(255,255,255,.72)"
                        : "linear-gradient(135deg,rgba(255,255,255,.98),rgba(240,249,255,.96))",
                      border: notification.read_at
                        ? "1px solid rgba(226,232,240,.84)"
                        : "1px solid rgba(59,130,246,.16)",
                      boxShadow: notification.read_at ? "none" : "0 10px 24px rgba(59,130,246,.08)",
                      cursor: processingId === notification.id ? "wait" : "pointer",
                      opacity: processingId === notification.id ? 0.8 : 1,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-11.5 w-11.5 shrink-0 items-center justify-center rounded-[14px] text-[22px]"
                        style={{
                          background: notification.read_at
                            ? "rgba(148,163,184,.12)"
                            : "rgba(59,130,246,.1)",
                        }}
                      >
                        {getNotificationIcon(notification.type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-[15px] font-extrabold text-slate-900">
                            {notification.title}
                          </div>
                          <div className="flex items-center gap-2">
                            {!notification.read_at && (
                              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                            )}
                            <span className="text-[11px] font-bold text-slate-500">
                              {formatNotificationTime(notification.created_at)}
                            </span>
                          </div>
                        </div>

                        {notification.body && (
                          <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-500">
                            {notification.body}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <span
                            className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                            style={{ color: notification.read_at ? "#94a3b8" : "#2563eb" }}
                          >
                            {notification.read_at ? "Read" : "Unread"}
                          </span>

                          {notification.link_path && (
                            <span className="text-[12px] font-bold text-blue-700">Open</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </FadeIn>
    </main>
  );
}
