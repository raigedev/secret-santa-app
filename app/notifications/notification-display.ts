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
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function getNotificationActionLabel(notification: NotificationItem): string {
  if (!getNotificationTargetPath(notification)) {
    return "Open";
  }

  switch (notification.type) {
    case "reminder_wishlist_incomplete":
      return "View Wishlist";
    case "reminder_event_tomorrow":
      return "Open Group";
    case "reminder_post_draw":
      return "Open Gift Ideas";
    case "reminder_digest":
      return "View Exchange";
    case "chat":
      return "Open Messages";
    case "invite":
      return "View Invite";
    case "welcome":
      return "Get Started";
    case "affiliate_lazada_health":
      return "Open report";
    case "gift_received":
      return "Gift Progress";
    default:
      return "Open";
  }
}

export function getNotificationTargetPath(notification: NotificationItem): string | null {
  if (notification.type === "reminder_wishlist_incomplete") {
    return "/wishlist";
  }

  return notification.link_path;
}
