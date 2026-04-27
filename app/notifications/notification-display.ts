export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
};

export function formatNotificationTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getNotificationIcon(type: string): string {
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

export function getNotificationLabel(type: string): string {
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

export function getNotificationLabelStyles(type: string): {
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

export function getNotificationActionLabel(notification: NotificationItem): string {
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
