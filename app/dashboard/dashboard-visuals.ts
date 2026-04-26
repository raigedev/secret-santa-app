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
    case "affiliate_lazada_health":
      return { icon: "📊", tone: "amber" };
    default:
      return { icon: "•", tone: "blue" };
  }
}

export function getDashboardToneTheme(tone: DashboardActivityItem["tone"], dark = false) {
  switch (tone) {
    case "amber":
      return {
        iconShell: "bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] text-white shadow-[0_12px_28px_rgba(245,158,11,0.24)]",
        rowSurface: dark
          ? "border-amber-500/20 bg-[linear-gradient(135deg,rgba(56,37,18,0.94),rgba(30,24,18,0.96))]"
          : "border-amber-100/90 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]",
        chip: dark ? "bg-amber-500/15 text-amber-200" : "bg-amber-100 text-amber-700",
        notificationSurface: dark
          ? "border-amber-500/20 bg-[linear-gradient(160deg,rgba(64,41,20,0.94),rgba(24,20,18,0.98))]"
          : "border-amber-200/80 bg-[linear-gradient(160deg,rgba(255,247,237,0.98),rgba(255,255,255,0.98))]",
        glow: "from-amber-300/15 via-amber-100/10 to-transparent",
      };
    case "blue":
      return {
        iconShell: "bg-[linear-gradient(135deg,#4f8cff,#2f80ff)] text-white shadow-[0_12px_28px_rgba(47,128,255,0.24)]",
        rowSurface: dark
          ? "border-blue-500/20 bg-[linear-gradient(135deg,rgba(18,38,64,0.94),rgba(15,23,42,0.98))]"
          : "border-blue-100/90 bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(255,255,255,0.98))]",
        chip: dark ? "bg-blue-500/15 text-blue-200" : "bg-blue-100 text-blue-700",
        notificationSurface: dark
          ? "border-blue-500/20 bg-[linear-gradient(160deg,rgba(20,44,74,0.94),rgba(15,23,42,0.98))]"
          : "border-blue-200/80 bg-[linear-gradient(160deg,rgba(239,246,255,0.98),rgba(255,255,255,0.98))]",
        glow: "from-blue-300/15 via-blue-100/10 to-transparent",
      };
    case "emerald":
      return {
        iconShell: "bg-[linear-gradient(135deg,#34d399,#10b981)] text-white shadow-[0_12px_28px_rgba(16,185,129,0.22)]",
        rowSurface: dark
          ? "border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,56,48,0.94),rgba(15,23,42,0.98))]"
          : "border-emerald-100/90 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))]",
        chip: dark ? "bg-emerald-500/15 text-emerald-200" : "bg-emerald-100 text-emerald-700",
        notificationSurface: dark
          ? "border-emerald-500/20 bg-[linear-gradient(160deg,rgba(18,62,52,0.94),rgba(15,23,42,0.98))]"
          : "border-emerald-200/80 bg-[linear-gradient(160deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))]",
        glow: "from-emerald-300/15 via-emerald-100/10 to-transparent",
      };
    case "rose":
      return {
        iconShell: "bg-[linear-gradient(135deg,#fb7185,#f43f5e)] text-white shadow-[0_12px_28px_rgba(244,63,94,0.22)]",
        rowSurface: dark
          ? "border-rose-500/20 bg-[linear-gradient(135deg,rgba(64,22,34,0.94),rgba(30,24,30,0.98))]"
          : "border-rose-100/90 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,255,255,0.98))]",
        chip: dark ? "bg-rose-500/15 text-rose-200" : "bg-rose-100 text-rose-700",
        notificationSurface: dark
          ? "border-rose-500/20 bg-[linear-gradient(160deg,rgba(72,24,38,0.94),rgba(30,24,30,0.98))]"
          : "border-rose-200/80 bg-[linear-gradient(160deg,rgba(255,241,242,0.98),rgba(255,255,255,0.98))]",
        glow: "from-rose-300/15 via-rose-100/10 to-transparent",
      };
    case "violet":
      return {
        iconShell: "bg-[linear-gradient(135deg,#a78bfa,#8b5cf6)] text-white shadow-[0_12px_28px_rgba(139,92,246,0.22)]",
        rowSurface: dark
          ? "border-violet-500/20 bg-[linear-gradient(135deg,rgba(44,28,70,0.94),rgba(20,24,40,0.98))]"
          : "border-violet-100/90 bg-[linear-gradient(135deg,rgba(245,243,255,0.98),rgba(255,255,255,0.98))]",
        chip: dark ? "bg-violet-500/15 text-violet-200" : "bg-violet-100 text-violet-700",
        notificationSurface: dark
          ? "border-violet-500/20 bg-[linear-gradient(160deg,rgba(50,32,78,0.94),rgba(20,24,40,0.98))]"
          : "border-violet-200/80 bg-[linear-gradient(160deg,rgba(245,243,255,0.98),rgba(255,255,255,0.98))]",
        glow: "from-violet-300/15 via-violet-100/10 to-transparent",
      };
    default:
      return {
        iconShell: "bg-[linear-gradient(135deg,#94a3b8,#64748b)] text-white shadow-[0_12px_28px_rgba(100,116,139,0.18)]",
        rowSurface: dark
          ? "border-slate-700/70 bg-[linear-gradient(135deg,rgba(30,41,59,0.94),rgba(15,23,42,0.98))]"
          : "border-slate-200/90 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))]",
        chip: dark ? "bg-slate-700/70 text-slate-100" : "bg-slate-100 text-slate-700",
        notificationSurface: dark
          ? "border-slate-700/70 bg-[linear-gradient(160deg,rgba(30,41,59,0.94),rgba(15,23,42,0.98))]"
          : "border-slate-200/80 bg-[linear-gradient(160deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))]",
        glow: "from-slate-300/15 via-slate-100/10 to-transparent",
      };
  }
}
