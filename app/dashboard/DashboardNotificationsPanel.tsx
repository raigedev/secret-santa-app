import type { CSSProperties, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/app/notifications/actions";
import {
  formatNotificationTime,
  getNotificationActionLabel,
  getNotificationTargetPath,
  type NotificationItem,
} from "@/app/notifications/notification-display";
import { NotificationEnvelopeMark } from "@/app/notifications/NotificationEnvelopeMark";
import { createClient } from "@/lib/supabase/client";

type NotificationFilter = "all" | "unread";

type PanelPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
} | null;

type DashboardNotificationsPanelProps = {
  anchorRef: RefObject<HTMLButtonElement | null>;
  isDarkTheme: boolean;
  open: boolean;
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
};

function countUnread(notifications: NotificationItem[]): number {
  return notifications.filter((notification) => !notification.read_at).length;
}

export function DashboardNotificationsPanel({
  anchorRef,
  isDarkTheme,
  open,
  onClose,
  onUnreadCountChange,
}: DashboardNotificationsPanelProps) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<PanelPosition>(null);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const trigger = anchorRef.current;
      const width = window.innerWidth < 640
        ? Math.min(360, Math.max(280, window.innerWidth - 24))
        : 392;
      const rightInset = 12;
      const left = trigger
        ? Math.min(
            Math.max(12, trigger.getBoundingClientRect().right - width),
            Math.max(12, window.innerWidth - width - rightInset)
          )
        : Math.max(12, window.innerWidth - width - rightInset);
      const top = trigger ? trigger.getBoundingClientRect().bottom + 10 : 72;
      const availableHeight = Math.max(260, window.innerHeight - top - 16);
      const maxHeight = Math.min(window.innerWidth < 640 ? 420 : 440, availableHeight);

      setPosition({ top, left, width, maxHeight });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        !anchorRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorRef, onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("notifications")
          .select("id, type, title, body, link_path, read_at, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(40);

        if (!isMounted) {
          return;
        }

        if (error) {
          setMessage("We could not load notifications. Please try again.");
          return;
        }

        const nextNotifications = (data || []) as NotificationItem[];
        setNotifications(nextNotifications);
        onUnreadCountChange(countUnread(nextNotifications));
      } catch {
        if (isMounted) {
          setMessage("We could not load notifications. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [onUnreadCountChange, open, router, supabase]);

  const unreadCount = countUnread(notifications);
  const visibleNotifications = useMemo(
    () =>
      activeFilter === "unread"
        ? notifications.filter((notification) => !notification.read_at)
        : notifications,
    [activeFilter, notifications]
  );

  const panelStyle: CSSProperties | undefined = position
    ? {
        left: position.left,
        maxHeight: position.maxHeight,
        position: "fixed",
        top: position.top,
        width: position.width,
      }
    : undefined;
  const listStyle: CSSProperties | undefined = position
    ? { maxHeight: Math.max(180, position.maxHeight - 170) }
    : undefined;
  const surfaceClass = isDarkTheme
    ? "border-slate-700/80 bg-slate-950 text-slate-100 shadow-[0_24px_50px_rgba(0,0,0,0.42)]"
    : "border-[#48664e]/12 bg-[#fffefa] text-[#2e3432] shadow-[0_24px_50px_rgba(46,52,50,0.16)]";
  const mutedTextClass = isDarkTheme ? "text-slate-400" : "text-slate-500";
  const itemHoverClass = isDarkTheme ? "hover:bg-slate-800/80" : "hover:bg-slate-50";

  const updateNotifications = (updater: (items: NotificationItem[]) => NotificationItem[]) => {
    setNotifications((currentNotifications) => {
      const nextNotifications = updater(currentNotifications);
      onUnreadCountChange(countUnread(nextNotifications));
      return nextNotifications;
    });
  };

  const handleOpenNotification = async (notification: NotificationItem) => {
    setMessage("");
    setProcessingId(notification.id);

    try {
      if (!notification.read_at) {
        updateNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            currentNotification.id === notification.id
              ? { ...currentNotification, read_at: new Date().toISOString() }
              : currentNotification
          )
        );

        const result = await markNotificationRead(notification.id);

        if (!result.success) {
          setMessage(result.message);
        }
      }

      const targetPath = getNotificationTargetPath(notification);

      if (targetPath) {
        onClose();
        router.push(targetPath);
      }
    } catch {
      setMessage("We could not update this notification. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setMessage("");

    try {
      updateNotifications((currentNotifications) =>
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
    } catch {
      setMessage("We could not update your notifications. Please try again.");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpenInbox = () => {
    onClose();
    router.push("/notifications");
  };

  if (!open || !position || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      data-testid="dashboard-notifications-panel"
      style={panelStyle}
      className={`z-210 flex flex-col overflow-hidden rounded-3xl border ${surfaceClass}`}
    >
      <div className="shrink-0 border-b border-slate-500/10 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">Notifications</h2>
              {unreadCount > 0 && (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#fff0ef] px-2 text-xs font-black text-[#a43c3f] ring-1 ring-[#a43c3f]/20">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className={`mt-0.5 text-xs font-semibold ${mutedTextClass}`}>
              Sealed notes from your groups, messages, and reminders.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold transition ${itemHoverClass}`}
            aria-label="Close notifications"
          >
            x
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5">
        <div className="inline-flex rounded-full bg-slate-500/10 p-1">
          {(["all", "unread"] as NotificationFilter[]).map((filter) => {
            const isActive = activeFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                  isActive
                    ? isDarkTheme
                      ? "bg-[#48664e] text-white"
                      : "bg-[#48664e]/10 text-[#48664e]"
                    : isDarkTheme
                      ? "text-slate-400 hover:text-slate-100"
                      : "text-slate-500 hover:text-slate-900"
                }`}
                aria-pressed={isActive}
              >
                {filter === "all" ? "All" : "Unread"}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void handleMarkAllRead()}
          disabled={unreadCount === 0 || markingAll}
          className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
            unreadCount === 0 || markingAll
              ? isDarkTheme
                ? "bg-slate-800 text-slate-600"
                : "bg-slate-100 text-slate-400"
              : isDarkTheme
                ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {markingAll ? "Updating..." : "Mark all read"}
        </button>
      </div>

      {message && (
        <div
          className={`mx-4 mb-3 rounded-2xl px-3 py-2 text-xs font-bold ${
            isDarkTheme
              ? "bg-rose-500/12 text-rose-200"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {message}
        </div>
      )}

      <div
        data-testid="dashboard-notifications-list"
        style={listStyle}
        className="min-h-0 overflow-y-auto px-2 pb-2"
      >
        {loading ? (
          <div className="space-y-2 px-2 py-2" aria-label="Loading notifications">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className={`h-20 animate-pulse rounded-[18px] ${
                  isDarkTheme ? "bg-slate-800/80" : "bg-slate-100"
                }`}
              />
            ))}
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div
            className={`mx-2 rounded-[20px] border border-dashed px-5 py-8 text-center ${
              isDarkTheme ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"
            }`}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3f4f2]" aria-hidden="true">
              <NotificationEnvelopeMark className="h-8 w-8" read type="invite" />
            </div>
            <p className="mt-3 text-sm font-extrabold">
              {activeFilter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="mt-1 text-xs font-semibold">
              {activeFilter === "unread"
                ? "You are caught up for now."
                : "New group updates will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {visibleNotifications.map((notification) => {
              const isUnread = !notification.read_at;

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleOpenNotification(notification)}
                  disabled={processingId === notification.id}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${itemHoverClass}`}
                  style={{ cursor: processingId === notification.id ? "wait" : "pointer" }}
                >
                  <span
                    className={`relative inline-flex h-14 w-16 shrink-0 items-center justify-center rounded-2xl ${
                      isUnread
                        ? isDarkTheme
                          ? "bg-emerald-400/14"
                          : "bg-[#fff8ea]"
                        : isDarkTheme
                          ? "bg-slate-800"
                          : "bg-[#f3f4f2]"
                    }`}
                    aria-hidden="true"
                  >
                    <NotificationEnvelopeMark
                      className="h-11 w-12"
                      read={!isUnread}
                      type={notification.type}
                    />
                    {isUnread && (
                      <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#e33434] ring-2 ring-white" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span
                          className={`line-clamp-2 break-words text-sm leading-5 ${
                            isUnread ? "font-black" : "font-bold"
                          }`}
                        >
                          {notification.title}
                        </span>
                      </span>
                    </span>

                    {notification.body && (
                      <span className={`mt-1 block line-clamp-2 text-xs font-semibold leading-5 ${mutedTextClass}`}>
                        {notification.body}
                      </span>
                    )}

                    <span className="mt-2 flex items-center justify-between gap-3 text-[11px] font-extrabold">
                      <span className={mutedTextClass}>
                        {formatNotificationTime(notification.created_at)}
                      </span>
                      {getNotificationTargetPath(notification) && (
                        <span className={isDarkTheme ? "text-emerald-200" : "text-[#48664e]"}>
                          {getNotificationActionLabel(notification)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-500/10 px-4 py-2.5">
        <button
          type="button"
          onClick={handleOpenInbox}
          className={`w-full rounded-full px-3 py-2 text-xs font-extrabold transition ${itemHoverClass}`}
        >
          View all notifications
        </button>
      </div>
    </div>,
    document.body
  );
}
