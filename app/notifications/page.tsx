"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationsSkeleton } from "@/app/components/PageSkeleton";
import { markAllNotificationsRead, markNotificationRead } from "./actions";
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
      return "📩";
    case "chat":
      return "💬";
    case "draw":
      return "🎲";
    case "reveal":
      return "🎉";
    case "gift_received":
      return "🎁";
    default:
      return "🔔";
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
      if (document.visibilityState !== "visible") {
        return;
      }

      scheduleReload();
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

    // Realtime is ideal, but we keep a light fallback so notifications still
    // update after missed websocket events, network hiccups, or sleeping tabs.
    pollInterval = setInterval(() => {
      refreshIfVisible();
    }, 8000);

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
      <FadeIn className="max-w-190 mx-auto px-4 py-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-5 px-4 py-2 rounded-lg transition"
          style={{
            color: "#4a6fa5",
            background: "rgba(255,255,255,.68)",
            border: "1px solid rgba(74,111,165,.15)",
            fontFamily: "inherit",
          }}
        >
          ← Back to Dashboard
        </button>

        <div
          className="rounded-3xl overflow-hidden"
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div
                  className="text-[30px] font-bold"
                  style={{ fontFamily: "'Fredoka', sans-serif" }}
                >
                  🔔 Notifications
                </div>
                <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,.84)" }}>
                  Important updates from your groups, chats, and gift progress.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="px-3 py-1.5 rounded-full text-[11px] font-extrabold"
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
                  className="px-4 py-2 rounded-xl text-[12px] font-extrabold transition"
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

          <div className="p-6">
            {message && (
              <div
                className="rounded-xl px-4 py-3 text-sm font-bold mb-4"
                style={{
                  background: "rgba(239,68,68,.08)",
                  color: "#b91c1c",
                  border: "1px solid rgba(239,68,68,.14)",
                }}
              >
                {message}
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="rounded-[18px] p-5 animate-pulse"
                    style={{
                      background: "rgba(255,255,255,.8)",
                      border: "1px solid rgba(226,232,240,.8)",
                    }}
                  >
                    <div className="h-4 w-40 rounded bg-slate-200 mb-3" />
                    <div className="h-3 w-full rounded bg-slate-100 mb-2" />
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div
                className="rounded-[20px] p-10 text-center"
                style={{
                  background: "rgba(255,255,255,.78)",
                  border: "1px solid rgba(226,232,240,.82)",
                }}
              >
                <div className="text-[42px] mb-3">🔔</div>
                <div
                  className="text-[22px] font-bold"
                  style={{ fontFamily: "'Fredoka', sans-serif", color: "#1f2937" }}
                >
                  No notifications yet
                </div>
                <p className="text-[13px] mt-2" style={{ color: "#64748b" }}>
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
                    className="w-full text-left rounded-[18px] p-5 transition"
                    style={{
                      background: notification.read_at
                        ? "rgba(255,255,255,.72)"
                        : "linear-gradient(135deg,rgba(255,255,255,.98),rgba(240,249,255,.96))",
                      border: notification.read_at
                        ? "1px solid rgba(226,232,240,.84)"
                        : "1px solid rgba(59,130,246,.16)",
                      boxShadow: notification.read_at
                        ? "none"
                        : "0 10px 24px rgba(59,130,246,.08)",
                      cursor: processingId === notification.id ? "wait" : "pointer",
                      opacity: processingId === notification.id ? 0.8 : 1,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-11.5 h-11.5 rounded-[14px] flex items-center justify-center text-[22px] shrink-0"
                        style={{
                          background: notification.read_at
                            ? "rgba(148,163,184,.12)"
                            : "rgba(59,130,246,.1)",
                        }}
                      >
                        {getNotificationIcon(notification.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div
                            className="text-[15px] font-extrabold"
                            style={{ color: notification.read_at ? "#334155" : "#0f172a" }}
                          >
                            {notification.title}
                          </div>
                          <div className="flex items-center gap-2">
                            {!notification.read_at && (
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ background: "#2563eb" }}
                              />
                            )}
                            <span className="text-[11px] font-bold" style={{ color: "#64748b" }}>
                              {formatNotificationTime(notification.created_at)}
                            </span>
                          </div>
                        </div>

                        {notification.body && (
                          <p
                            className="text-[13px] font-semibold mt-1 leading-relaxed"
                            style={{ color: "#64748b" }}
                          >
                            {notification.body}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                          <span
                            className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                            style={{ color: notification.read_at ? "#94a3b8" : "#2563eb" }}
                          >
                            {notification.read_at ? "Read" : "Unread"}
                          </span>

                          {notification.link_path && (
                            <span
                              className="text-[12px] font-bold"
                              style={{ color: "#1d4ed8" }}
                            >
                              Open →
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
