import type { DashboardActivityItem } from "./dashboard-types";

export function getActivityFeedVisual(type: string): Pick<DashboardActivityItem, "icon" | "tone"> {
  switch (type) {
    case "gift_progress":
      return { icon: "✓", tone: "amber" };
    case "gift_received":
      return { icon: "🎁", tone: "emerald" };
    case "chat":
      return { icon: "💬", tone: "blue" };
    case "draw":
      return { icon: "🎲", tone: "violet" };
    case "reveal":
      return { icon: "🎉", tone: "rose" };
    case "invite":
      return { icon: "✉️", tone: "amber" };
    case "welcome":
      return { icon: "OK", tone: "emerald" };
    case "affiliate_lazada_health":
      return { icon: "📊", tone: "amber" };
    default:
      return { icon: "•", tone: "blue" };
  }
}
