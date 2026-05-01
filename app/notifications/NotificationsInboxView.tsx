"use client";

import { useMemo, useState } from "react";
import {
  formatNotificationTime,
  getNotificationActionLabel,
  getNotificationTargetPath,
  type NotificationItem,
} from "./notification-display";
import { NotificationEnvelopeMark } from "./NotificationEnvelopeMark";

type NotificationFilter = "all" | "unread" | "read";

type NotificationsInboxViewProps = {
  markingAll: boolean;
  message: string;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onOpenNotification: (notification: NotificationItem) => void | Promise<void>;
  processingId: string | null;
  unreadCount: number;
};

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="m4.5 10.3 3.4 3.3 7.6-7.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="m7.5 4.5 5 5.5-5 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FilterIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 5h12l-4.7 5.2v3.9l-2.6 1.3v-5.2L4 5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function PineCorner() {
  return (
    <svg
      viewBox="0 0 140 140"
      className="pointer-events-none absolute -right-5 -top-6 hidden h-36 w-36 text-[#48664e] opacity-75 lg:block"
      fill="none"
      aria-hidden="true"
    >
      <path d="M118 4C95 27 67 51 33 75" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <g key={item} transform={`translate(${24 + item * 13} ${74 - item * 12}) rotate(${-34 + item * 3})`}>
          <path d="M0 0h42" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
          <path d="M12 0 1 12M24 0 8 18M34 0 18 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
        </g>
      ))}
      <circle cx="105" cy="20" r="3.5" fill="#a43c3f" />
      <circle cx="91" cy="34" r="3" fill="#fcce72" />
    </svg>
  );
}

function MysteryEnvelopeHero() {
  return (
    <div className="relative flex h-20 w-24 shrink-0 items-center justify-center sm:h-24 sm:w-30">
      <div
        className="absolute inset-x-1 bottom-1 h-6 rounded-full"
        style={{ background: "rgba(164,60,63,.08)", filter: "blur(8px)" }}
      />
      <svg viewBox="0 0 112 86" className="relative h-full w-full" fill="none" aria-hidden="true">
        <rect x="9" y="16" width="94" height="58" rx="9" fill="#fff8ea" />
        <path d="M12 20 56 52l44-32" stroke="#f1d4a2" strokeWidth="2.2" />
        <path d="M13 71 45 43M99 71 67 43" stroke="#f4dfb8" strokeWidth="2" />
        <rect x="9" y="16" width="94" height="58" rx="9" stroke="#f1d4a2" strokeWidth="2" />
        <circle cx="56" cy="48" r="13" fill="#a43c3f" />
        <circle cx="56" cy="48" r="9" fill="#bd4b4d" stroke="#812227" strokeWidth="2" />
        <path d="M49 48h14M56 41v14" stroke="#ffe4df" strokeLinecap="round" strokeWidth="2" />
      </svg>
      <span className="absolute left-0 top-2 h-2 w-2 rounded-full bg-[#fcce72]" />
      <span className="absolute right-0 top-8 h-2.5 w-2.5 rounded-full bg-[#a43c3f]" />
    </div>
  );
}

function NotificationEmptyState({ filter }: { filter: NotificationFilter }) {
  const title = filter === "unread" ? "No unread envelopes" : "You're all caught up";
  const body =
    filter === "unread"
      ? "Every new message has been opened for now."
      : "We'll deliver new updates here.";

  return (
    <div className="px-4 py-10 text-center sm:py-14">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[#f3f4f2] text-[#48664e]">
        <NotificationEnvelopeMark className="h-9 w-9" read type="invite" />
      </div>
      <h2 className="mt-4 text-xl font-black text-[#2e3432]">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{body}</p>
    </div>
  );
}

export function NotificationsInboxView({
  markingAll,
  message,
  notifications,
  onMarkAllRead,
  onOpenNotification,
  processingId,
  unreadCount,
}: NotificationsInboxViewProps) {
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const visibleNotifications = useMemo(() => {
    if (activeFilter === "unread") {
      return notifications.filter((notification) => !notification.read_at);
    }

    if (activeFilter === "read") {
      return notifications.filter((notification) => notification.read_at);
    }

    return notifications;
  }, [activeFilter, notifications]);

  return (
    <section
      className="relative overflow-hidden rounded-4xl px-4 py-5 shadow-[0_24px_70px_rgba(46,52,50,.08)] sm:px-7 sm:py-7 lg:px-10"
      style={{
        background:
          "linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,253,248,.86))",
        border: "1px solid rgba(72,102,78,.14)",
      }}
    >
      <PineCorner />
      <div className="relative">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <MysteryEnvelopeHero />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a43c3f]">
                Sealed letters
              </p>
              <h1
                className="mt-2 text-4xl font-black leading-none text-[#48664e] sm:text-5xl"
                style={{ fontFamily: "'Fredoka','Nunito',sans-serif" }}
              >
                Mystery Envelope Notifications
              </h1>
              <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-slate-600">
                Updates and important messages about your Secret Santa exchange.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={unreadCount === 0 || markingAll}
              aria-label="Mark all read"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#2e3432] shadow-[0_10px_24px_rgba(46,52,50,.05)] ring-1 ring-[#48664e]/12 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <CheckIcon />
              {markingAll ? "Updating" : "Mark all as read"}
            </button>

            <label className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#2e3432] shadow-[0_10px_24px_rgba(46,52,50,.05)] ring-1 ring-[#48664e]/12">
              <FilterIcon />
              <span className="sr-only">Filter notifications</span>
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value as NotificationFilter)}
                className="bg-transparent font-black outline-none"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </label>
          </div>
        </div>

        {message && (
          <p
            role="status"
            className="mt-6 rounded-2xl px-4 py-3 text-sm font-bold text-[#a43c3f]"
            style={{ background: "rgba(164,60,63,.08)", border: "1px solid rgba(164,60,63,.16)" }}
          >
            {message}
          </p>
        )}

        <div className="mt-8 space-y-4">
          {visibleNotifications.length === 0 ? (
            <NotificationEmptyState filter={activeFilter} />
          ) : (
            visibleNotifications.map((notification) => {
              const isUnread = !notification.read_at;
              const targetPath = getNotificationTargetPath(notification);

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void onOpenNotification(notification)}
                  disabled={processingId === notification.id}
                  className="group relative w-full overflow-hidden rounded-3xl bg-white/92 px-4 py-4 text-left shadow-[0_14px_32px_rgba(46,52,50,.055)] ring-1 ring-[#48664e]/12 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(46,52,50,.08)] disabled:cursor-wait disabled:opacity-75 sm:px-5"
                >
                  <span
                    className="absolute inset-y-3 right-0 w-2 rounded-l-full opacity-70"
                    style={{
                      background:
                        "repeating-linear-gradient(180deg,#f6d7cf 0 10px,#fff7ea 10px 20px,#c9d8ca 20px 30px)",
                    }}
                    aria-hidden="true"
                  />
                  <span className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <span className="relative flex h-18 w-22 shrink-0 items-center justify-center">
                      <NotificationEnvelopeMark
                        className="h-16 w-18"
                        read={!isUnread}
                        type={notification.type}
                      />
                      {isUnread && (
                        <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-[#e33434] ring-4 ring-white" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <span className="min-w-0">
                          <span className="block break-words text-xl font-black leading-7 text-[#2e3432]">
                            {notification.title}
                          </span>
                          {notification.body && (
                            <span className="mt-1 block max-w-2xl break-words text-sm font-semibold leading-6 text-slate-600">
                              {notification.body}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-slate-500">
                          {formatNotificationTime(notification.created_at)}
                        </span>
                      </span>

                      <span className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="inline-flex rounded-full bg-[#f3f4f2] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#48664e]">
                          {isUnread ? "Unread envelope" : "Opened"}
                        </span>
                        {targetPath && (
                          <span className="inline-flex items-center gap-2 text-sm font-black text-[#48664e] transition group-hover:translate-x-1">
                            {getNotificationActionLabel(notification)}
                            <ChevronRightIcon />
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {visibleNotifications.length > 0 && (
          <NotificationEmptyState filter="all" />
        )}
      </div>
    </section>
  );
}
