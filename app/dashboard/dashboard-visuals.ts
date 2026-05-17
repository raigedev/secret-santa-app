import type { DashboardActivityItem } from "./dashboard-types";

export function getActivityFeedVisual(type: string): Pick<DashboardActivityItem, "icon" | "tone"> {
  switch (type) {
    case "gift_progress":
      return { icon: "Done", tone: "amber" };
    case "gift_received":
      return { icon: "Gift", tone: "emerald" };
    case "chat":
      return { icon: "Chat", tone: "blue" };
    case "draw":
      return { icon: "Draw", tone: "violet" };
    case "reveal":
      return { icon: "Live", tone: "rose" };
    case "invite":
      return { icon: "Mail", tone: "amber" };
    case "welcome":
      return { icon: "OK", tone: "emerald" };
    case "affiliate_lazada_health":
      return { icon: "Stats", tone: "amber" };
    default:
      return { icon: "•", tone: "blue" };
  }
}
