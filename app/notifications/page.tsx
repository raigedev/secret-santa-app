"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationsSkeleton } from "@/app/components/PageSkeleton";
import {
  clearClientSnapshots,
  hasFreshClientSnapshotMetadata,
  readClientSnapshot,
  writeClientSnapshot,
  type ClientSnapshotMetadata,
} from "@/lib/client-snapshot";
import { isNullableString, isRecord } from "@/lib/validation/common";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "./actions";
import {
  getNotificationTargetPath,
  type NotificationItem,
} from "./notification-display";
import FadeIn from "@/app/components/FadeIn";
import { NotificationsInboxView } from "./NotificationsInboxView";

type NotificationsPageSnapshot = ClientSnapshotMetadata & {
  notifications: NotificationItem[];
};

const NOTIFICATIONS_PAGE_SNAPSHOT_STORAGE_PREFIX = "ss_notifications_page_snapshot_v1:";

function getNotificationsPageSnapshotStorageKey(userId: string): string {
  return `${NOTIFICATIONS_PAGE_SNAPSHOT_STORAGE_PREFIX}${userId}`;
}

function isNotificationSnapshot(value: unknown): value is NotificationItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    isNullableString(value.body) &&
    isNullableString(value.link_path) &&
    isNullableString(value.read_at) &&
    typeof value.created_at === "string"
  );
}

function isNotificationsPageSnapshot(
  value: unknown,
  userId: string
): value is NotificationsPageSnapshot {
  return (
    hasFreshClientSnapshotMetadata(value, userId) &&
    Array.isArray(value.notifications) &&
    value.notifications.every(isNotificationSnapshot)
  );
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
  const hasAppliedSnapshotRef = useRef(false);

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
      writeClientSnapshot(getNotificationsPageSnapshotStorageKey(targetUserId), {
        createdAt: Date.now(),
        notifications: (data || []) as NotificationItem[],
        userId: targetUserId,
      });
      hasAppliedSnapshotRef.current = true;
      setLoading(false);
    };

    loadNotificationsRef.current = loadNotifications;

    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        clearClientSnapshots(NOTIFICATIONS_PAGE_SNAPSHOT_STORAGE_PREFIX);
        router.push("/login");
        return;
      }

      if (!isMounted) {
        return;
      }

      setUserId(session.user.id);

      if (!hasAppliedSnapshotRef.current) {
        const cachedNotifications = readClientSnapshot(
          getNotificationsPageSnapshotStorageKey(session.user.id),
          session.user.id,
          isNotificationsPageSnapshot
        );

        if (cachedNotifications) {
          hasAppliedSnapshotRef.current = true;
          setNotifications(cachedNotifications.notifications);
          setLoading(false);
        }
      }

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

    // Realtime is the primary path; this fallback is intentionally light to avoid
    // repeated notification reads while the database is already under I/O pressure.
    pollInterval = setInterval(refreshIfVisible, 30000);
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
      const targetPath = getNotificationTargetPath(notification);

      if (targetPath) {
        prefetchOnce(targetPath);
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
        {
          const nextNotifications = currentNotifications.map((currentNotification) =>
          currentNotification.id === notification.id
            ? { ...currentNotification, read_at: new Date().toISOString() }
            : currentNotification
          );

          if (userId) {
            writeClientSnapshot(getNotificationsPageSnapshotStorageKey(userId), {
              createdAt: Date.now(),
              notifications: nextNotifications,
              userId,
            });
          }

          return nextNotifications;
        }
      );

      void markNotificationRead(notification.id).then((result) => {
        if (!result.success) {
          setMessage(result.message);
        }
      });
    }

    setProcessingId(null);

    const targetPath = getNotificationTargetPath(notification);

    if (targetPath) {
      router.push(targetPath);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setMessage("");
    setNotifications((currentNotifications) =>
      {
        const nextNotifications = currentNotifications.map((notification) =>
          notification.read_at
            ? notification
            : { ...notification, read_at: new Date().toISOString() }
        );

        if (userId) {
          writeClientSnapshot(getNotificationsPageSnapshotStorageKey(userId), {
            createdAt: Date.now(),
            notifications: nextNotifications,
            userId,
          });
        }

        return nextNotifications;
      }
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
        background:
          "repeating-linear-gradient(135deg,rgba(72,102,78,.055) 0 1px,transparent 1px 34px), linear-gradient(180deg,#fffdf8 0%,#f8fbff 44%,#eef6ee 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <FadeIn className="mx-auto max-w-7xl px-0 py-2 sm:px-0 sm:py-3">
        <NotificationsInboxView
          markingAll={markingAll}
          message={message}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          onOpenNotification={handleOpenNotification}
          processingId={processingId}
          unreadCount={unreadCount}
        />
      </FadeIn>
    </main>
  );
}
