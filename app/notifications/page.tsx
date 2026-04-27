"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationsSkeleton } from "@/app/components/PageSkeleton";
import {
  markAllNotificationsRead,
  markNotificationRead,
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
    case "affiliate_lazada_health":
      return "\u{1F4CA}";
    default:
      return "\u{1F514}";
  }
}

function getNotificationLabel(type: string): string {
  switch (type) {
    case "invite":
      return "Group invite";
    case "chat":
      return "Anonymous chat";
    case "draw":
      return "Draw update";
    case "reveal":
      return "Reveal moment";
    case "gift_received":
      return "Gift progress";
    case "reminder_wishlist_incomplete":
      return "Reminder: wishlist";
    case "reminder_event_tomorrow":
      return "Reminder: gift date";
    case "reminder_post_draw":
      return "Gift planning reminder";
    case "reminder_digest":
      return "Reminder digest";
    case "affiliate_lazada_health":
      return "Lazada health";
    default:
      return "Notification";
  }
}

function getNotificationLabelStyles(type: string): {
  background: string;
  border: string;
  color: string;
} {
  switch (type) {
    case "reminder_wishlist_incomplete":
      return {
        background: "rgba(59,130,246,.09)",
        border: "1px solid rgba(59,130,246,.18)",
        color: "#1d4ed8",
      };
    case "reminder_event_tomorrow":
      return {
        background: "rgba(249,115,22,.08)",
        border: "1px solid rgba(249,115,22,.18)",
        color: "#c2410c",
      };
    case "reminder_post_draw":
      return {
        background: "rgba(16,185,129,.08)",
        border: "1px solid rgba(16,185,129,.18)",
        color: "#047857",
      };
    case "reminder_digest":
      return {
        background: "rgba(139,92,246,.08)",
        border: "1px solid rgba(139,92,246,.18)",
        color: "#6d28d9",
      };
    case "affiliate_lazada_health":
      return {
        background: "rgba(245,158,11,.09)",
        border: "1px solid rgba(245,158,11,.2)",
        color: "#b45309",
      };
    default:
      return {
        background: "rgba(148,163,184,.08)",
        border: "1px solid rgba(148,163,184,.16)",
        color: "#475569",
      };
  }
}

function getNotificationActionLabel(notification: NotificationItem): string {
  if (!notification.link_path) {
    return "Open";
  }

  switch (notification.type) {
    case "reminder_wishlist_incomplete":
      return "Add wishlist";
    case "reminder_event_tomorrow":
      return "Review group";
    case "reminder_post_draw":
      return "Start planning";
    case "reminder_digest":
      return "Open summary";
    case "chat":
      return "Open chat";
    case "invite":
      return "View invite";
    case "affiliate_lazada_health":
      return "Open report";
    default:
      return "Open";
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
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
        setMessage("We could not load your notifications. Please refresh the page.");
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

      await loadNotifications(session.user.id);
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

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg,#eef4fb 0%,#dce8f5 38%,#e8ecef 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <FadeIn className="mx-auto max-w-[1040px] px-4 py-5 sm:px-6 sm:py-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition sm:w-auto"
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
                  Important updates from your groups, private messages, gift progress, and reminders.
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
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span
                                className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]"
                                style={getNotificationLabelStyles(notification.type)}
                              >
                                {getNotificationLabel(notification.type)}
                              </span>
                            </div>
                            <div className="text-[15px] font-extrabold text-slate-900">
                              {notification.title}
                            </div>
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
                            <span className="text-[12px] font-bold text-blue-700">
                              {getNotificationActionLabel(notification)}
                            </span>
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
