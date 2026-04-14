"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getAnonymousGroupDisplayName } from "@/lib/groups/nickname";
import { createClient } from "@/lib/supabase/client";
import InviteCard from "./InviteCard";
import ProfileSetupModal from "./ProfileSetupModal";
import { getProfile } from "@/app/profile/actions";
import { claimInvitedMemberships } from "./actions";
import { deleteGroup } from "@/app/group/[id]/actions";
import { DashboardSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";

type GroupMember = {
  nickname: string | null;
  email: string | null;
  role: string;
  displayName: string | null;
  avatarEmoji: string | null;
  avatarUrl: string | null;
};

type Group = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  budget: number | null;
  currency: string | null;
  owner_id: string;
  created_at: string;
  require_anonymous_nickname: boolean;
  members: GroupMember[];
  isOwner: boolean;
  hasDrawn: boolean;
};

type PendingInvite = {
  group_id: string;
  group_name: string;
  group_description: string;
  group_event_date: string;
  require_anonymous_nickname: boolean;
};

type ActionMessage = {
  type: "success" | "error";
  text: string;
} | null;

type ProfileMenuPosition = {
  top: number;
  left: number;
  width: number;
} | null;

type GroupRow = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  budget: number | null;
  currency: string | null;
  owner_id: string;
  created_at: string;
  require_anonymous_nickname: boolean;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string | null;
  nickname: string;
  email: string;
  role: string;
};

type MembershipRow = {
  id: string;
  group_id: string;
  status: string;
  role: string;
};

type AssignmentRow = {
  group_id: string;
};

type MyAssignmentRow = {
  group_id: string;
  receiver_id: string;
  gift_prep_status: string | null;
  gift_prep_updated_at: string | null;
};

type PendingGroupRow = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  require_anonymous_nickname: boolean;
};

type WishlistSummaryRow = {
  group_id: string;
};

type NotificationFeedRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_path: string | null;
  created_at: string;
};

type DashboardActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  href: string | null;
  icon: string;
  tone: "amber" | "blue" | "emerald" | "rose" | "violet";
};

type DashboardNotificationPreviewItem = {
  id: string;
  title: string;
  href: string | null;
  icon: string;
  tone: DashboardActivityItem["tone"];
  createdAt: string;
};

type DashboardTheme = "default" | "midnight";
type GiftProgressStep = "planning" | "purchased" | "wrapped" | "ready_to_give";

type GiftProgressSummary = {
  focusStep: GiftProgressStep;
  focusCount: number;
  countsByStep: Record<GiftProgressStep, number>;
  totalAssignments: number;
  readyToGiveCount: number;
  recipientName: string | null;
  groupName: string | null;
};

type PeerProfileRow = {
  user_id: string | null;
  display_name: string | null;
  avatar_emoji: string | null;
  avatar_url: string | null;
};

function createGroupUserKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
}

function createEmptyQueryResult<T>(data: T[] = []): Promise<{ data: T[]; error: null }> {
  return Promise.resolve({ data, error: null });
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: "A$",
  CAD: "C$",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  PHP: "PHP",
  USD: "$",
};

function formatDashboardDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDashboardBudget(budget: number | null, currency: string | null): string | null {
  if (budget === null) {
    return null;
  }

  const code = (currency || "PHP").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] || code;
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });

  if (code === "PHP") {
    return `P ${formatter.format(budget)}`;
  }

  return `${symbol} ${formatter.format(budget)}`;
}

function getDashboardMemberLabel(member: GroupMember, requireAnonymousNickname: boolean): string {
  if (requireAnonymousNickname) {
    return getAnonymousGroupDisplayName(member.nickname, "Participant");
  }

  return member.displayName || member.nickname || member.email || "Participant";
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

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

function formatGiftPrepStatusLabel(status: string | null): string {
  switch (status) {
    case "planning":
      return "planning";
    case "purchased":
      return "purchased";
    case "wrapped":
      return "wrapped";
    case "ready_to_give":
      return "ready to give";
    default:
      return "updated";
  }
}

function normalizeGiftProgressStep(status: string | null): GiftProgressStep {
  switch (status) {
    case "purchased":
      return "purchased";
    case "wrapped":
      return "wrapped";
    case "ready_to_give":
      return "ready_to_give";
    case "planning":
    default:
      return "planning";
  }
}

function getGiftProgressStepIndex(step: GiftProgressStep): number {
  switch (step) {
    case "planning":
      return 0;
    case "purchased":
      return 1;
    case "wrapped":
      return 2;
    case "ready_to_give":
      return 3;
    default:
      return 0;
  }
}

function getActivityFeedVisual(type: string): Pick<DashboardActivityItem, "icon" | "tone"> {
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
    default:
      return { icon: "•", tone: "blue" };
  }
}

function getDashboardToneTheme(tone: DashboardActivityItem["tone"], dark = false) {
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

function getNotificationPreviewTitle(type: string, title: string): string {
  switch (type) {
    case "gift_received":
      return "Gift update";
    case "chat":
      return "Chat ping";
    case "draw":
      return "Draw ready";
    case "reveal":
      return "Reveal time";
    case "invite":
      return "Invite";
    default:
      return title;
  }
}

function getDisplayFirstName(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    return "friend";
  }

  const [first] = trimmed.split(/\s+/);

  return first.charAt(0).toUpperCase() + first.slice(1);
}

function getAvatarLabel(value: string | null): string {
  if (!value) {
    return "?";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "?";
  }

  return trimmed.charAt(0).toUpperCase();
}

function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 10h12M11.5 5.5 16 10l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 3.5a3 3 0 0 0-3 3v1.1c0 .8-.2 1.6-.6 2.3l-1 1.7a1 1 0 0 0 .9 1.5h7.4a1 1 0 0 0 .9-1.5l-1-1.7a4.5 4.5 0 0 1-.6-2.3V6.5a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.5 15a1.8 1.8 0 0 0 3 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GiftIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10v10M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M9.2 10c-1.6 0-2.7-1-2.7-2.3 0-1.1.8-2 1.9-2 1.7 0 2.9 2.1 3.6 4.3H9.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14.8 10c1.6 0 2.7-1 2.7-2.3 0-1.1-.8-2-1.9-2-1.7 0-2.9 2.1-3.6 4.3h2.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 4.5h8A1.5 1.5 0 0 1 15.5 6v8A1.5 1.5 0 0 1 14 15.5H6A1.5 1.5 0 0 1 4.5 14V6A1.5 1.5 0 0 1 6 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M7.5 8h5M7.5 10.5h5M7.5 13h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UserOutlineIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 10a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 10 10ZM5.5 15.5c.7-2.1 2.45-3.25 4.5-3.25s3.8 1.15 4.5 3.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="m5.5 7.75 4.5 4.5 4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThemeIcon({
  className = "h-4 w-4",
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return dark ? (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M12.6 4.4a6.4 6.4 0 1 0 2.9 11.5 7.1 7.1 0 0 1-2.9-11.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="3.3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.5v1.9M10 15.6v1.9M17.5 10h-1.9M4.4 10H2.5M15.3 4.7l-1.3 1.3M6 14l-1.3 1.3M15.3 15.3 14 14M6 6 4.7 4.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SantaMarkIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="10 5 140 145" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`dashboard-santa-hat-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e74c3c" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="82" r="50" fill="#fde8e8" />
      <ellipse cx="80" cy="108" rx="38" ry="24" fill="#fff" />
      <ellipse cx="80" cy="102" rx="32" ry="16" fill="#fff" />
      <ellipse cx="66" cy="86" rx="12" ry="6" fill="#fff" />
      <ellipse cx="94" cy="86" rx="12" ry="6" fill="#fff" />
      <circle cx="80" cy="76" r="5" fill="#e8a8a8" />
      <ellipse cx="64" cy="66" rx="5" ry="6" fill="#fff" />
      <ellipse cx="64" cy="67" rx="4" ry="5" fill="#2c1810" />
      <circle cx="62" cy="65" r="1.8" fill="#fff" />
      <path d="M90 66 Q96 60 102 66" fill="none" stroke="#2c1810" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M54 58 Q64 51 74 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M86 58 Q96 51 106 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="52" cy="78" rx="7" ry="5" fill="#f0a0a0" opacity=".3" />
      <ellipse cx="108" cy="78" rx="7" ry="5" fill="#f0a0a0" opacity=".3" />
      <rect x="76" y="84" width="9" height="26" rx="4.5" fill="#f8d0d0" stroke="#e8b8b8" strokeWidth=".8" />
      <path d="M32 58 C32 58 50 14 82 10 C114 6 128 58 128 58" fill={`url(#dashboard-santa-hat-${size})`} />
      <rect x="26" y="54" width="108" height="10" rx="5" fill="#fff" />
      <circle cx="86" cy="10" r="8" fill="#fff" />
    </svg>
  );
}

function SantaBrandLockup({ dark = false }: { dark?: boolean }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span
        className={`inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full shadow-[0_12px_28px_rgba(148,163,184,0.18)] ring-1 ${
          dark ? "bg-slate-900/70 ring-white/10" : "bg-white/85 ring-white/70"
        }`}
      >
        <SantaMarkIcon size={28} />
      </span>
      <span className="flex flex-col items-start leading-[0.94]">
        <span className={`text-[13px] font-extrabold tracking-[-0.01em] ${dark ? "text-[#ff9b86]" : "text-[#c0392b]"}`}>
          My Secret
        </span>
        <span className={`mt-0.5 text-[26px] font-black tracking-[-0.045em] ${dark ? "text-white" : "text-slate-950"}`}>
          Santa
        </span>
        <span
          className={`mt-1 text-[10px] font-semibold italic tracking-[-0.01em] ${
            dark ? "text-[#ffb4a3]/80" : "text-[#c0392b]/85"
          }`}
        >
          shhh... it&apos;s a secret!
        </span>
      </span>
    </div>
  );
}

function WishlistIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 18.5 4.5 20V7a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 7v7a2.5 2.5 0 0 1-2.5 2.5H7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EventCountdownBadge({ eventDate, now }: { eventDate: string; now: number }) {
  const DAY_MS = 1000 * 60 * 60 * 24;
  const HOUR_MS = 1000 * 60 * 60;
  const MINUTE_MS = 1000 * 60;

  const eventTime = new Date(eventDate).getTime();

  if (Number.isNaN(eventTime)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        Event date: {formatDashboardDate(eventDate)}
      </span>
    );
  }

  const remaining = Math.max(0, eventTime - now);

  if (remaining === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Event in progress!
      </span>
    );
  }

  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);
  const isUrgent = remaining <= DAY_MS;
  const isSoon = remaining <= DAY_MS * 3;

  const containerStyle = isUrgent
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : isSoon
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  const dotStyle = isUrgent ? "bg-rose-500" : isSoon ? "bg-amber-500" : "bg-blue-500";
  const unitStyle = isUrgent
    ? "bg-white/90 text-rose-900"
    : isSoon
      ? "bg-white/90 text-amber-900"
      : "bg-white/90 text-blue-900";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-[0_6px_18px_rgba(15,23,42,0.06)] ${containerStyle}`}
      title={`Event date: ${formatDashboardDate(eventDate)}`}
    >
      <span className={`h-2 w-2 rounded-full animate-pulse ${dotStyle}`} />
      <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] opacity-80">Starts in</span>
      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${unitStyle}`}>
        {days}d
      </span>
      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${unitStyle}`}>
        {hours}h
      </span>
      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${unitStyle}`}>
        {minutes}m
      </span>
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [canViewAffiliateReport, setCanViewAffiliateReport] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("ss_ara") === "1"
  );
  const [userName, setUserName] = useState(
    () => (typeof sessionStorage !== "undefined" ? (sessionStorage.getItem("ss_un") ?? "") : "")
  );
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [recipientNames, setRecipientNames] = useState<string[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [wishlistItemCount, setWishlistItemCount] = useState(0);
  const [wishlistGroupCount, setWishlistGroupCount] = useState(0);
  const [giftProgressSummary, setGiftProgressSummary] = useState<GiftProgressSummary | null>(null);
  const [activityFeedItems, setActivityFeedItems] = useState<DashboardActivityItem[]>([]);
  const [notificationPreviewItems, setNotificationPreviewItems] = useState<
    DashboardNotificationPreviewItem[]
  >([]);
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(() => {
    if (typeof window === "undefined") {
      return "default";
    }

    return localStorage.getItem("ss_dashboard_theme") === "midnight" ? "midnight" : "default";
  });
  const [loading, setLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState<ProfileMenuPosition>(null);
  const loadDashboardDataRef = useRef<
    ((user: { id: string; email?: string | null }) => Promise<void>) | null
  >(null);
  const loadProfileDataRef = useRef<(() => Promise<void>) | null>(null);
  const loadNotificationCountRef = useRef<((userId: string) => Promise<void>) | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem("ss_dashboard_theme", dashboardTheme);
  }, [dashboardTheme]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !profileMenuRef.current?.contains(target) &&
        !profileMenuPanelRef.current?.contains(target)
      ) {
        setProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) {
      setProfileMenuPosition(null);
      return;
    }

    const updateProfileMenuPosition = () => {
      const trigger = profileMenuRef.current;
      if (!trigger || typeof window === "undefined") {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const width = window.innerWidth < 640
        ? Math.min(220, Math.max(188, window.innerWidth - 28))
        : Math.min(248, Math.max(224, window.innerWidth - 32));
      const left = Math.min(
        Math.max(16, rect.right - width),
        Math.max(16, window.innerWidth - width - 16)
      );

      setProfileMenuPosition({
        top: rect.bottom + 8,
        left,
        width,
      });
    };

    updateProfileMenuPosition();
    window.addEventListener("resize", updateProfileMenuPosition);
    window.addEventListener("scroll", updateProfileMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateProfileMenuPosition);
      window.removeEventListener("scroll", updateProfileMenuPosition, true);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncCountdownClock = () => {
      setCountdownNow(Date.now());
    };

    const timeoutId = setTimeout(() => {
      syncCountdownClock();
      intervalId = setInterval(syncCountdownClock, 60_000);
    }, Math.max(1_000, 60_000 - (Date.now() % 60_000)));

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let dashboardReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let profileReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let notificationPollInterval: ReturnType<typeof setInterval> | null = null;
    let sessionUser:
      | {
          id: string;
          email?: string | null;
        }
      | null = null;

    // Reload the dashboard cards and lists without repeating one-time setup like
    // profile bootstrap or invited-membership claiming on every realtime event.
    const loadDashboardData = async (user: { id: string; email?: string | null }) => {
      try {
        const email = (user.email || "guest@example.com").toLowerCase();

        // Group membership rows drive most of the dashboard, but owned groups
        // should still show up even if a legacy membership row is missing.
        const [membershipRes, ownedGroupLookupRes] = await Promise.all([
          supabase
            .from("group_members")
            .select("id, group_id, status, role")
            .or(`user_id.eq.${user.id},email.eq.${email}`),
          supabase.from("groups").select("id").eq("owner_id", user.id),
        ]);

        if (membershipRes.error) {
          throw membershipRes.error;
        }

        if (ownedGroupLookupRes.error) {
          throw ownedGroupLookupRes.error;
        }

        const memberRows = (membershipRes.data || []) as MembershipRow[];
        const ownedGroupIds = [...new Set((ownedGroupLookupRes.data || []).map((group) => group.id))];

        if (!isMounted) {
          return;
        }

        if ((!memberRows || memberRows.length === 0) && ownedGroupIds.length === 0) {
          setOwnedGroups([]);
          setInvitedGroups([]);
          setPendingInvites([]);
          setRecipientNames([]);
          setWishlistItemCount(0);
          setWishlistGroupCount(0);
          setGiftProgressSummary(null);
          setActivityFeedItems([]);
          setNotificationPreviewItems([]);
          setLoading(false);
          return;
        }

        const acceptedRows = memberRows.filter((row) => row.status === "accepted");
        const pendingRows = memberRows.filter((row) => row.status === "pending");
        const acceptedGroupIds = [...new Set([...acceptedRows.map((row) => row.group_id), ...ownedGroupIds])];
        const pendingGroupIds = [...new Set(pendingRows.map((row) => row.group_id))];
        const roleMap: Record<string, string> = {};

        for (const ownedGroupId of ownedGroupIds) {
          roleMap[ownedGroupId] = "owner";
        }

        for (const row of acceptedRows) {
          roleMap[row.group_id] = row.role;
        }

        const [
          groupsRes,
          membersRes,
          assignmentsRes,
          myAssignRes,
          pendingRes,
          wishlistSummaryRes,
          activityNotificationsRes,
          peerProfilesByGroup,
        ] =
          await Promise.all([
            acceptedGroupIds.length > 0
              ? supabase
                  .from("groups")
                  .select("id, name, description, event_date, budget, currency, owner_id, created_at, require_anonymous_nickname")
                  .in("id", acceptedGroupIds)
              : createEmptyQueryResult<GroupRow>(),
            acceptedGroupIds.length > 0
              ? supabase
                  .from("group_members")
                  .select("group_id, user_id, nickname, email, role")
                  .in("group_id", acceptedGroupIds)
                  .eq("status", "accepted")
              : createEmptyQueryResult<GroupMemberRow>(),
            acceptedGroupIds.length > 0
              ? supabase.from("assignments").select("group_id").in("group_id", acceptedGroupIds)
              : createEmptyQueryResult<AssignmentRow>(),
            acceptedGroupIds.length > 0
              ? supabase
                  .from("assignments")
                  .select(
                    "group_id, receiver_id, gift_prep_status, gift_prep_updated_at"
                  )
                  .eq("giver_id", user.id)
                  .in("group_id", acceptedGroupIds)
              : createEmptyQueryResult<MyAssignmentRow>(),
            pendingGroupIds.length > 0
              ? supabase
                  .from("groups")
                  .select("id, name, description, event_date, require_anonymous_nickname")
                  .in("id", pendingGroupIds)
              : createEmptyQueryResult<PendingGroupRow>(),
            acceptedGroupIds.length > 0
              ? supabase
                  .from("wishlists")
                  .select("group_id")
                  .eq("user_id", user.id)
                  .in("group_id", acceptedGroupIds)
              : createEmptyQueryResult<WishlistSummaryRow>(),
            supabase
              .from("notifications")
              .select("id, type, title, body, link_path, created_at")
              .eq("user_id", user.id)
              .in("type", ["invite", "chat", "draw", "reveal", "gift_received"])
              .order("created_at", { ascending: false })
              .limit(8),
            acceptedGroupIds.length > 0
              ? Promise.all(
                  acceptedGroupIds.map(async (groupId) => {
                    const result = await supabase.rpc("list_group_peer_profiles", {
                      p_group_id: groupId,
                    });

                    return {
                      groupId,
                      // Avatar strips are a visual enhancement. If the profile helper
                      // fails for one group, keep the dashboard working and fall back
                      // to initials instead of failing the whole page.
                      profiles: result.error ? [] : ((result.data || []) as PeerProfileRow[]),
                    };
                  })
                )
              : Promise.resolve([] as { groupId: string; profiles: PeerProfileRow[] }[]),
          ]);

        if (groupsRes.error) {
          throw groupsRes.error;
        }

        if (membersRes.error) {
          throw membersRes.error;
        }

        if (assignmentsRes.error) {
          throw assignmentsRes.error;
        }

        if (myAssignRes.error) {
          throw myAssignRes.error;
        }

        if (pendingRes.error) {
          throw pendingRes.error;
        }

        if (wishlistSummaryRes.error) {
          throw wishlistSummaryRes.error;
        }

        if (activityNotificationsRes.error) {
          throw activityNotificationsRes.error;
        }

        const groupsData = groupsRes.data || [];
        const allMembers = membersRes.data || [];
        const allAssignments = assignmentsRes.data || [];
        const myAssignments = myAssignRes.data || [];
        const pendingGroups = pendingRes.data || [];
        const wishlistSummary = (wishlistSummaryRes.data || []) as WishlistSummaryRow[];
        const recentNotifications =
          (activityNotificationsRes.data || []) as NotificationFeedRow[];
        const drawnGroupIds = new Set(allAssignments.map((assignment) => assignment.group_id));

        const profileMapByGroup = new Map<
          string,
          Map<string, { avatarEmoji: string | null; displayName: string | null; avatarUrl: string | null }>
        >();

        for (const entry of peerProfilesByGroup) {
          const profileMap = new Map<
            string,
            { avatarEmoji: string | null; displayName: string | null; avatarUrl: string | null }
          >();

          for (const profile of entry.profiles) {
            if (profile.user_id) {
              profileMap.set(profile.user_id, {
                avatarEmoji: profile.avatar_emoji || null,
                displayName: profile.display_name || null,
                avatarUrl: profile.avatar_url || null,
              });
            }
          }

          profileMapByGroup.set(entry.groupId, profileMap);
        }

        const groupsWithMembers: Group[] = groupsData.map((group) => {
          const groupProfileMap = profileMapByGroup.get(group.id) || new Map();

          return {
            ...group,
            isOwner: roleMap[group.id] === "owner",
            hasDrawn: drawnGroupIds.has(group.id),
            members: allMembers
              .filter((member) => member.group_id === group.id)
              .map((member) => {
                const profile = member.user_id ? groupProfileMap.get(member.user_id) : null;

                return {
                  nickname: member.nickname,
                  email: member.email,
                  role: member.role,
                  displayName: group.require_anonymous_nickname ? null : profile?.displayName || null,
                  avatarEmoji: profile?.avatarEmoji || null,
                  avatarUrl: group.require_anonymous_nickname ? null : profile?.avatarUrl || null,
                };
              }),
          };
        });

        if (!isMounted) {
          return;
        }

        setOwnedGroups(groupsWithMembers.filter((group) => group.isOwner));
        setInvitedGroups(groupsWithMembers.filter((group) => !group.isOwner));

        const receiverNameByGroupUser = new Map<string, string>();
        const groupNameById = new Map(groupsData.map((group) => [group.id, group.name]));

        for (const member of allMembers) {
          if (!member.user_id) {
            continue;
          }

          receiverNameByGroupUser.set(
            createGroupUserKey(member.group_id, member.user_id),
            member.nickname || "Secret Participant"
          );
        }

        setRecipientNames(
          myAssignments.map((assignment) => {
            return (
              receiverNameByGroupUser.get(
                createGroupUserKey(assignment.group_id, assignment.receiver_id)
              ) || "Secret Participant"
            );
          })
        );

        setWishlistItemCount(wishlistSummary.length);
        setWishlistGroupCount(new Set(wishlistSummary.map((row) => row.group_id)).size);
        if (myAssignments.length > 0) {
          const normalizedAssignments = myAssignments.map((assignment) => ({
            step: normalizeGiftProgressStep(assignment.gift_prep_status),
            recipientName:
              receiverNameByGroupUser.get(
                createGroupUserKey(assignment.group_id, assignment.receiver_id)
              ) || "your recipient",
            groupName: groupNameById.get(assignment.group_id) || "your group",
            updatedAt: assignment.gift_prep_updated_at
              ? new Date(assignment.gift_prep_updated_at).getTime()
              : 0,
          }));

          const countsByStep: Record<GiftProgressStep, number> = {
            planning: 0,
            purchased: 0,
            wrapped: 0,
            ready_to_give: 0,
          };

          for (const assignment of normalizedAssignments) {
            countsByStep[assignment.step] += 1;
          }

          const focusStep =
            countsByStep.planning > 0
              ? "planning"
              : countsByStep.purchased > 0
                ? "purchased"
                : countsByStep.wrapped > 0
                  ? "wrapped"
                  : "ready_to_give";

          const primaryAssignment = [...normalizedAssignments].sort((a, b) => b.updatedAt - a.updatedAt)[0];

          setGiftProgressSummary({
            focusStep,
            focusCount: countsByStep[focusStep],
            countsByStep,
            totalAssignments: normalizedAssignments.length,
            readyToGiveCount: countsByStep.ready_to_give,
            recipientName: normalizedAssignments.length === 1 ? primaryAssignment.recipientName : null,
            groupName: normalizedAssignments.length === 1 ? primaryAssignment.groupName : null,
          });
        } else {
          setGiftProgressSummary(null);
        }

        // The dashboard feed combines "what changed around me" notifications
        // with the user's own gift-progress actions so the home page feels alive
        // without inventing a separate activity table.
        const feedItems: DashboardActivityItem[] = [
          ...myAssignments
            .filter(
              (assignment) => assignment.gift_prep_status && assignment.gift_prep_updated_at
            )
            .map((assignment) => {
              const receiverName =
                receiverNameByGroupUser.get(
                  createGroupUserKey(assignment.group_id, assignment.receiver_id)
                ) || "your recipient";
              const groupName = groupNameById.get(assignment.group_id) || "your group";
              const statusLabel = formatGiftPrepStatusLabel(assignment.gift_prep_status);
              const visual = getActivityFeedVisual("gift_progress");

              return {
                id: `gift-progress-${assignment.group_id}`,
                title: `You marked your gift as ${statusLabel}`,
                subtitle: `For ${receiverName} in ${groupName}`,
                createdAt: assignment.gift_prep_updated_at as string,
                href: "/secret-santa",
                ...visual,
              };
            }),
          ...recentNotifications.map((notification) => {
            const visual = getActivityFeedVisual(notification.type);

            return {
              id: notification.id,
              title: notification.title,
              subtitle: notification.body || "Open the notification center for details.",
              createdAt: notification.created_at,
              href: notification.link_path,
              ...visual,
            };
          }),
        ]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        setActivityFeedItems(feedItems);
        setNotificationPreviewItems(
          recentNotifications.slice(0, 3).map((notification) => {
            const visual = getActivityFeedVisual(notification.type);

            return {
              id: notification.id,
              title: getNotificationPreviewTitle(notification.type, notification.title),
              href: notification.link_path,
              createdAt: notification.created_at,
              ...visual,
            };
          })
        );

        setPendingInvites(
          pendingGroups.map((group) => ({
            group_id: group.id,
            group_name: group.name,
            group_description: group.description || "",
            group_event_date: group.event_date,
            require_anonymous_nickname: Boolean(group.require_anonymous_nickname),
          }))
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setActionMessage({
          type: "error",
          text: "Failed to load the dashboard. Please refresh and try again.",
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const loadAffiliateReportAccess = async () => {
      try {
        const response = await fetch("/api/affiliate/report-access", {
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (isMounted) {
            setCanViewAffiliateReport(false);
          }
          return;
        }

        const payload = (await response.json()) as { allowed?: boolean };
        const allowed = Boolean(payload.allowed);

        if (typeof sessionStorage !== "undefined") {
          if (allowed) {
            sessionStorage.setItem("ss_ara", "1");
          } else {
            sessionStorage.removeItem("ss_ara");
          }
        }

        if (isMounted) {
          setCanViewAffiliateReport(allowed);
        }
      } catch {
        if (isMounted) {
          setCanViewAffiliateReport(false);
        }
      }
    };

    loadDashboardDataRef.current = loadDashboardData;

    const loadProfileData = async () => {
      const profileData = await getProfile();

      if (!isMounted || !sessionUser) {
        return;
      }

      const defaultName = (sessionUser.email || "guest@example.com").split("@")[0];

      if (profileData) {
        const resolvedName = profileData.display_name || defaultName;
        setShowProfileSetup(!profileData.profile_setup_complete);
        setUserName(resolvedName);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("ss_un", resolvedName);
        }
      }
    };

    loadProfileDataRef.current = loadProfileData;

    const loadNotificationCount = async (targetUserId: string) => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", targetUserId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!isMounted) {
        return;
      }

      if (error) {
        return;
      }

      setUnreadNotificationCount((data || []).length);
    };

    loadNotificationCountRef.current = loadNotificationCount;

    const scheduleDashboardReload = () => {
      if (!sessionUser) {
        return;
      }

      if (dashboardReloadTimer) {
        clearTimeout(dashboardReloadTimer);
      }

      // Group actions often touch several related rows. Debouncing the reload
      // keeps the dashboard from flashing through multiple intermediate states.
      dashboardReloadTimer = setTimeout(() => {
        if (sessionUser && loadDashboardDataRef.current) {
          void loadDashboardDataRef.current(sessionUser);
        }
      }, 120);
    };

    const scheduleProfileReload = () => {
      if (profileReloadTimer) {
        clearTimeout(profileReloadTimer);
      }

      profileReloadTimer = setTimeout(() => {
        if (loadProfileDataRef.current) {
          void loadProfileDataRef.current();
        }
      }, 120);
    };

    const scheduleNotificationsReload = () => {
      if (!sessionUser) {
        return;
      }

      if (loadNotificationCountRef.current) {
        void loadNotificationCountRef.current(sessionUser.id);
      }
    };

    const refreshNotificationsIfVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      scheduleNotificationsReload();
    };

    const bootstrapDashboard = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        sessionUser = session.user;

        const email = (session.user.email || "guest@example.com").toLowerCase();
        const defaultName = email.split("@")[0];

        if (!isMounted) {
          return;
        }

        setUserName(defaultName);

        // claimInvitedMemberships only needs to run once per browser session.
        // Email-linked invites don't change between visits; realtime will trigger
        // a data reload automatically when a brand-new invite arrives.
        const CLAIM_KEY = "ss_mc";
        const alreadyClaimed =
          typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem(CLAIM_KEY) === "1";

        const claimAction = alreadyClaimed
          ? Promise.resolve()
          : claimInvitedMemberships().then(() => {
              if (typeof sessionStorage !== "undefined") {
                sessionStorage.setItem(CLAIM_KEY, "1");
              }
            });

        // The main dashboard content should not wait on secondary polish like
        // the affiliate-report pill or the unread bell count. Kick those off in
        // the background so the cards can render as soon as the core data is ready.
        void loadProfileData();
        void loadAffiliateReportAccess();
        void loadNotificationCount(session.user.id);

        await Promise.all([claimAction, loadDashboardData(session.user)]);

        if (!isMounted) {
          return;
        }

        if (notificationPollInterval) {
          clearInterval(notificationPollInterval);
        }

        // Realtime is the primary path, but a light polling fallback keeps the
        // bell accurate if the browser misses a websocket event or resumes from sleep.
        notificationPollInterval = setInterval(() => {
          refreshNotificationsIfVisible();
        }, 30000);
      } catch {
        if (!isMounted) {
          return;
        }

        setActionMessage({
          type: "error",
          text: "Failed to load the dashboard. Please refresh and try again.",
        });
        setLoading(false);
      }
    };

    void bootstrapDashboard();

    window.addEventListener("focus", refreshNotificationsIfVisible);
    document.addEventListener("visibilitychange", refreshNotificationsIfVisible);

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => scheduleDashboardReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => scheduleDashboardReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        () => scheduleDashboardReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          const changedUserId =
            (payload.new as { user_id?: string } | null)?.user_id ||
            (payload.old as { user_id?: string } | null)?.user_id;

          if (sessionUser && changedUserId === sessionUser.id) {
            scheduleProfileReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          const changedUserId =
            (payload.new as { user_id?: string } | null)?.user_id ||
            (payload.old as { user_id?: string } | null)?.user_id;

          if (sessionUser && changedUserId === sessionUser.id) {
            scheduleNotificationsReload();
            scheduleDashboardReload();
          }
        }
      )
      .subscribe();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      }
    });

    return () => {
      isMounted = false;
      if (dashboardReloadTimer) {
        clearTimeout(dashboardReloadTimer);
      }
      if (profileReloadTimer) {
        clearTimeout(profileReloadTimer);
      }
      if (notificationPollInterval) {
        clearInterval(notificationPollInterval);
      }
      window.removeEventListener("focus", refreshNotificationsIfVisible);
      document.removeEventListener("visibilitychange", refreshNotificationsIfVisible);
      void supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  useEffect(() => {
    const prefetchOnce = (route: string) => {
      if (prefetchedRoutesRef.current.has(route)) {
        return;
      }

      prefetchedRoutesRef.current.add(route);
      router.prefetch(route);
    };

    const routesToPrefetch = ["/secret-santa", "/wishlist", "/notifications"];
    if (canViewAffiliateReport) {
      routesToPrefetch.push("/dashboard/affiliate-report");
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const prefetchCoreRoutes = () => {
      for (const route of routesToPrefetch) {
        prefetchOnce(route);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(prefetchCoreRoutes, { timeout: 1500 });
    } else if (typeof window !== "undefined") {
      timeoutId = setTimeout(prefetchCoreRoutes, 1200);
    } else {
      prefetchCoreRoutes();
    }

    return () => {
      if (typeof window !== "undefined" && idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [router, canViewAffiliateReport]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Only the owner can delete a group.
  // Requiring the exact group name adds another deliberate confirmation step.
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const confirmed = confirm(
      `Delete "${groupName}"?\n\nThis will permanently remove the group.`
    );

    if (!confirmed) {
      return;
    }

    const typedName = prompt(
      `Type the group name exactly to confirm deletion:\n\n${groupName}`,
      ""
    );

    if (typedName === null) {
      return;
    }

    setDeletingGroupId(groupId);
    setActionMessage(null);

    try {
      const result = await deleteGroup(groupId, typedName);
      setActionMessage({
        type: result.success ? "success" : "error",
        text: result.message,
      });
    } catch {
      setActionMessage({
        type: "error",
        text: "Failed to delete the group. Please try again.",
      });
    } finally {
      setDeletingGroupId(null);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const hasAssignments = recipientNames.length > 0;
  const displayFirstName = getDisplayFirstName(userName);
  const isDarkTheme = dashboardTheme === "midnight";
  const totalDashboardGroupCount = ownedGroups.length + invitedGroups.length;
  const utilityButtonClass = isDarkTheme
    ? "relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/78 px-3 text-[12px] font-semibold text-slate-100 shadow-[0_16px_40px_rgba(2,8,23,0.30)] backdrop-blur-md transition hover:-translate-y-0.5"
    : "relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-3 text-[12px] font-semibold text-slate-700 shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-md transition hover:-translate-y-0.5";
  const profileUtilityButtonClass = isDarkTheme
    ? "relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/78 px-3 text-[12px] font-semibold text-slate-100 shadow-[0_16px_40px_rgba(2,8,23,0.30)] backdrop-blur-md transition hover:-translate-y-0.5"
    : "relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-3 text-[12px] font-semibold text-slate-700 shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-md transition hover:-translate-y-0.5";
  const utilityIconClass = isDarkTheme ? "text-slate-300" : "text-slate-500";
  const dashboardShellClass = isDarkTheme
    ? "relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#08111f_0%,#0f172a_38%,#111827_100%)] text-slate-100"
    : "relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#edf6ff_0%,#f8fbff_45%,#eef5ff_100%)] text-slate-900";
  const dashboardOverlayClass = isDarkTheme
    ? "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.20),transparent_24%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.92),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_34%)]"
    : "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,180,255,0.26),transparent_25%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(191,219,254,0.35),transparent_32%)]";
  const sparkleClass = isDarkTheme
    ? "h-2.5 w-2.5 rounded-full bg-sky-200/55 shadow-[0_0_18px_rgba(125,211,252,0.36)]"
    : "h-3 w-3 rounded-full bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.85)]";
  const heroTitleClass = isDarkTheme ? "text-white" : "text-sky-900";
  const heroSubtitleClass = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const dashboardCardShellClass = isDarkTheme
    ? "overflow-hidden rounded-[22px] border border-slate-700/70 bg-slate-900/66 p-4 shadow-[0_22px_44px_rgba(2,8,23,0.30)] backdrop-blur-md"
    : "overflow-hidden rounded-[22px] border border-white/70 bg-white/92 p-4 shadow-[0_18px_40px_rgba(148,163,184,0.12)] backdrop-blur-md";
  const dashboardInnerPanelClass = isDarkTheme
    ? "rounded-[22px] border border-slate-700/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(30,41,59,0.82))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "rounded-[22px] border border-slate-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(241,245,249,0.88))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]";
  const dashboardPanelHeadingClass = isDarkTheme ? "text-white" : "text-slate-900";
  const dashboardPanelTextClass = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const dashboardStatChipClass = isDarkTheme
    ? "rounded-full bg-slate-900/78 px-3 py-2 shadow-[0_10px_24px_rgba(2,8,23,0.24)] ring-1 ring-slate-700/70"
    : "rounded-full bg-white/90 px-3 py-2 shadow-[0_10px_24px_rgba(148,163,184,0.12)] ring-1 ring-slate-100";
  const dashboardStatLabelClass = isDarkTheme ? "text-slate-500" : "text-slate-400";
  const dashboardStatValueClass = isDarkTheme ? "text-slate-100" : "text-slate-900";
  const dashboardSubtleSurfaceClass = isDarkTheme
    ? "border-slate-700/70 bg-slate-950/50"
    : "border-slate-200/80 bg-white/90";
  const giftProgressSteps: Array<{
    key: GiftProgressStep;
    label: string;
    icon: string;
    accent: string;
    rowTone: string;
  }> = [
    {
      key: "planning",
      label: "Planning",
      icon: "↗",
      accent: "bg-[#7ccd4c]",
      rowTone: isDarkTheme ? "bg-emerald-500/10 text-emerald-200" : "bg-emerald-50 text-emerald-700",
    },
    {
      key: "purchased",
      label: "Purchased",
      icon: "✓",
      accent: "bg-[#8fd644]",
      rowTone: isDarkTheme ? "bg-lime-500/10 text-lime-200" : "bg-lime-50 text-lime-700",
    },
    {
      key: "wrapped",
      label: "Wrapped",
      icon: "◫",
      accent: "bg-[#f2b24b]",
      rowTone: isDarkTheme ? "bg-amber-500/10 text-amber-200" : "bg-amber-50 text-amber-700",
    },
    {
      key: "ready_to_give",
      label: "Gift Sent",
      icon: "🎁",
      accent: "bg-[#b8a0e8]",
      rowTone: isDarkTheme ? "bg-violet-500/10 text-violet-200" : "bg-violet-50 text-violet-700",
    },
  ];
  const currentGiftProgressIndex = giftProgressSummary
    ? getGiftProgressStepIndex(giftProgressSummary.focusStep)
    : -1;

  const GroupCard = ({
    group,
    type,
  }: {
    group: Group;
    type: "owned" | "invited";
  }) => {
    const budgetLabel = formatDashboardBudget(group.budget, group.currency);
    const memberCountLabel = `${group.members.length} member${group.members.length === 1 ? "" : "s"}`;
    const theme =
      type === "owned"
        ? {
            accent: "from-blue-400 via-sky-400 to-blue-600",
            surface: isDarkTheme ? "bg-slate-900/80" : "bg-white/96",
            shadow: isDarkTheme
              ? "shadow-[0_22px_40px_rgba(2,8,23,0.30)]"
              : "shadow-[0_18px_40px_rgba(148,163,184,0.14)]",
            eyebrow: isDarkTheme ? "bg-blue-500/15 text-blue-200" : "bg-blue-100 text-blue-700",
            drawPillDone: isDarkTheme ? "bg-emerald-500/15 text-emerald-200" : "bg-emerald-100 text-emerald-700",
            drawPillPending: isDarkTheme ? "bg-sky-500/15 text-sky-200" : "bg-sky-100 text-sky-700",
            primaryButton:
              "bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] shadow-[0_14px_35px_rgba(37,99,235,0.20)]",
            secondaryButton: isDarkTheme
              ? "bg-blue-500/12 text-blue-200 hover:bg-blue-500/20"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100",
            avatarShell: isDarkTheme
              ? "bg-[linear-gradient(145deg,#1e293b,#0f172a)] text-slate-100"
              : "bg-[linear-gradient(145deg,#f8fbff,#e8f1ff)] text-slate-700",
          }
        : {
            accent: "from-amber-300 via-orange-300 to-amber-500",
            surface: isDarkTheme ? "bg-slate-900/80" : "bg-white/96",
            shadow: isDarkTheme
              ? "shadow-[0_22px_40px_rgba(2,8,23,0.30)]"
              : "shadow-[0_18px_40px_rgba(148,163,184,0.14)]",
            eyebrow: isDarkTheme ? "bg-amber-500/15 text-amber-200" : "bg-amber-100 text-amber-700",
            drawPillDone: isDarkTheme ? "bg-emerald-500/15 text-emerald-200" : "bg-emerald-100 text-emerald-700",
            drawPillPending: isDarkTheme ? "bg-amber-500/15 text-amber-200" : "bg-amber-100 text-amber-700",
            primaryButton:
              "bg-[linear-gradient(135deg,#c26d18,#8b4513)] shadow-[0_14px_35px_rgba(120,53,15,0.20)]",
            secondaryButton: isDarkTheme
              ? "bg-amber-500/12 text-amber-200 hover:bg-amber-500/20"
              : "bg-amber-50 text-amber-700 hover:bg-amber-100",
            avatarShell: isDarkTheme
              ? "bg-[linear-gradient(145deg,#3b2a18,#1f2937)] text-slate-100"
              : "bg-[linear-gradient(145deg,#fffaf2,#fff1d6)] text-slate-700",
        };

    const topMembers = group.members.slice(0, 3);

    return (
      <article
        className={`relative overflow-hidden rounded-[22px] border ${isDarkTheme ? "border-slate-700/70" : "border-white/75"} px-3.5 py-3 ${theme.surface} ${theme.shadow}`}
      >
        <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${theme.accent}`} />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <h3 className={`text-[1.15rem] font-extrabold leading-tight sm:text-[1.22rem] ${isDarkTheme ? "text-white" : "text-slate-900"}`}>
                {group.name}
              </h3>
            </div>
            <div className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${isDarkTheme ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-600"}`}>
              {type === "owned" ? "Hosted by you" : "Shared group"}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${theme.eyebrow}`}>
                {type === "owned" ? "My group" : "Invited group"}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${
                  group.hasDrawn ? theme.drawPillDone : theme.drawPillPending
                }`}
              >
                {group.hasDrawn ? "Draw completed" : "Awaiting draw"}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2 pl-2">
              <span
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${
                  isDarkTheme
                    ? "bg-slate-800/90 text-slate-300 ring-1 ring-slate-700/80"
                    : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                <UserOutlineIcon className="h-3.5 w-3.5" />
                {memberCountLabel}
              </span>
              <div className="flex -space-x-2">
                {topMembers.map((member, index) => (
                  <span
                    key={`${group.id}-${member.email || member.nickname || index}-avatar`}
                    className={`inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[18px] font-semibold shadow-[0_8px_18px_rgba(15,23,42,0.10)] ${theme.avatarShell}`}
                    title={getDashboardMemberLabel(member, group.require_anonymous_nickname)}
                  >
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      member.avatarEmoji ||
                      getAvatarLabel(
                        getDashboardMemberLabel(member, group.require_anonymous_nickname)
                      )
                    )}
                  </span>
                ))}
                {group.members.length > 3 && (
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-[12px] font-bold shadow-[0_8px_18px_rgba(15,23,42,0.10)] ${isDarkTheme ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-600"}`}>
                    +{group.members.length - 3}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={`mt-2.5 rounded-[18px] border px-2.5 py-2 ${isDarkTheme ? "border-slate-700/70 bg-slate-950/55" : "border-slate-200/80 bg-slate-50/95"}`}>
            <div className={`flex flex-col gap-2 text-sm sm:mx-auto sm:w-[94%] sm:flex-row sm:items-center sm:gap-4 ${isDarkTheme ? "text-slate-200" : "text-slate-700"}`}>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <EventCountdownBadge eventDate={group.event_date} now={countdownNow} />
              </div>
              <div
                aria-hidden="true"
                className={`hidden sm:block sm:h-px sm:min-w-6 sm:flex-1 sm:rounded-full ${
                  isDarkTheme
                    ? "bg-gradient-to-r from-slate-700/0 via-slate-500/60 to-slate-700/0"
                    : "bg-gradient-to-r from-slate-200/0 via-slate-300/90 to-slate-200/0"
                }`}
              />
              {budgetLabel && (
                <div className="flex items-center sm:shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-[15px] font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-700"}`}>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Budget: {budgetLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={`mt-2.5 border-t pt-2.5 ${isDarkTheme ? "border-slate-700/70" : "border-slate-200/80"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(`/group/${group.id}`)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[16px] font-semibold text-white transition hover:-translate-y-0.5 ${theme.primaryButton}`}
              >
                <span>{type === "owned" ? "View Group" : "Open Group"}</span>
                <ArrowRightIcon />
              </button>
              {type === "owned" && (
                <button
                  type="button"
                  onClick={() => void handleDeleteGroup(group.id, group.name)}
                  disabled={deletingGroupId === group.id}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[15px] font-semibold transition ${
                    deletingGroupId === group.id
                      ? "cursor-wait bg-rose-100 text-rose-500"
                      : theme.secondaryButton
                  }`}
                >
                  {deletingGroupId === group.id ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  };

  const ActionCard = ({
    accent,
    subtitle,
    title,
    description,
    buttonLabel,
    onClick,
    icon,
    meta,
  }: {
    accent: "rose" | "green" | "amber";
    subtitle: string;
    title: string;
    description: string;
    buttonLabel: string;
    onClick: () => void;
    icon: ReactNode;
    meta?: ReactNode;
  }) => {
    const theme =
      accent === "rose"
        ? {
            border: "border-rose-200/80",
            surface: isDarkTheme
              ? "bg-[linear-gradient(180deg,#1f1620,#111827)]"
              : "bg-[linear-gradient(180deg,#ffffff,#fff5f7)]",
            iconShell: "bg-rose-100 text-rose-600",
            subtitle: "text-rose-600",
            button: "bg-[linear-gradient(135deg,#e25d67,#b9384c)] text-white shadow-[0_14px_35px_rgba(185,56,76,0.20)]",
            badge: isDarkTheme ? "bg-rose-500/15 text-rose-200" : "bg-rose-100 text-rose-700",
          }
        : accent === "green"
        ? {
            border: "border-emerald-200/80",
            surface: isDarkTheme
              ? "bg-[linear-gradient(180deg,#13221d,#111827)]"
              : "bg-[linear-gradient(180deg,#ffffff,#f3fff7)]",
            iconShell: "bg-emerald-100 text-emerald-600",
            subtitle: "text-emerald-600",
            button: "bg-[linear-gradient(135deg,#5aa57c,#2f6b56)] text-white shadow-[0_14px_35px_rgba(47,107,86,0.20)]",
            badge: isDarkTheme ? "bg-emerald-500/15 text-emerald-200" : "bg-emerald-100 text-emerald-700",
          }
        : {
            border: "border-amber-200/80",
            surface: isDarkTheme
              ? "bg-[linear-gradient(180deg,#271d12,#111827)]"
              : "bg-[linear-gradient(180deg,#ffffff,#fff9f0)]",
            iconShell: "bg-amber-100 text-amber-600",
            subtitle: "text-amber-600",
            button: "bg-[linear-gradient(135deg,#f3b548,#d68619)] text-white shadow-[0_14px_35px_rgba(214,134,25,0.20)]",
            badge: isDarkTheme ? "bg-amber-500/15 text-amber-200" : "bg-amber-100 text-amber-700",
          };

    return (
      <article
        className={`relative overflow-hidden rounded-[22px] border p-4 transition hover:-translate-y-0.5 ${isDarkTheme ? "shadow-[0_20px_42px_rgba(2,8,23,0.28)]" : "shadow-[0_18px_40px_rgba(148,163,184,0.12)]"} ${isDarkTheme ? "border-slate-700/70" : theme.border} ${theme.surface}`}
      >
        <div className="absolute inset-y-0 right-0 w-16 bg-[radial-gradient(circle_at_center,rgba(191,219,254,0.25),transparent_68%)]" />
        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${theme.badge}`}>
                {subtitle}
              </div>
              <h2 className={`mt-2.5 text-[1.3rem] font-extrabold leading-tight ${isDarkTheme ? "text-white" : "text-slate-900"}`}>{title}</h2>
              <p className={`mt-1.5 text-[15px] leading-6 ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>{description}</p>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.iconShell}`}>
              {icon}
            </div>
          </div>

          {meta ? <div className="mt-3">{meta}</div> : null}

          <div className={`mt-4 border-t pt-3 ${isDarkTheme ? "border-slate-700/70" : "border-slate-200"}`}>
            <button
              type="button"
              onClick={onClick}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[15px] font-semibold transition hover:-translate-y-0.5 ${theme.button}`}
            >
              <span>{buttonLabel}</span>
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </article>
    );
  };

  const GroupBucket = ({
      title,
      subtitle,
      count,
    groups,
    type,
    }: {
      title: string;
      subtitle: string;
      count: number;
      groups: Group[];
      type: "owned" | "invited";
    }) => {
      const bucketTheme =
        type === "owned"
          ? {
              badge: isDarkTheme ? "bg-blue-500/15 text-blue-200" : "bg-blue-100 text-blue-700",
              countChip: isDarkTheme ? "bg-slate-900/75 text-slate-200 ring-slate-700/70" : "bg-white/92 text-slate-600 ring-slate-200/80",
            }
          : {
              badge: isDarkTheme ? "bg-amber-500/15 text-amber-200" : "bg-amber-100 text-amber-700",
              countChip: isDarkTheme ? "bg-slate-900/75 text-slate-200 ring-slate-700/70" : "bg-white/92 text-slate-600 ring-slate-200/80",
            };

      return (
        <section className="space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ${bucketTheme.badge}`}>
                {type === "owned" ? "Hosted groups" : "Joined groups"}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ring-1 ${bucketTheme.countChip}`}>
                {count} group{count === 1 ? "" : "s"}
              </span>
            </div>
            <h3 className={`mt-2.5 text-[1.24rem] font-bold ${dashboardPanelHeadingClass}`}>{title}</h3>
            <p className={`mt-1 text-[15px] leading-6 ${dashboardPanelTextClass}`}>{subtitle}</p>
          </div>
          <div className={count > 1 ? "grid gap-3 lg:grid-cols-2" : "grid gap-3"}>
            {count > 1 ? (
              groups.map((group) => (
                <GroupCard key={`${type}-${group.id}`} group={group} type={type} />
              ))
            ) : (
              <GroupCard key={`${type}-${groups[0]?.id ?? "single"}`} group={groups[0]} type={type} />
            )}
          </div>
        </section>
      );
  };

  const profileMenuStyle: CSSProperties | undefined = profileMenuPosition
    ? {
        position: "fixed",
        top: profileMenuPosition.top,
        left: profileMenuPosition.left,
        width: profileMenuPosition.width,
      }
    : undefined;

  return (
    <main className={dashboardShellClass}>
      {showProfileSetup && (
        <ProfileSetupModal
          defaultName={userName}
          onComplete={() => setShowProfileSetup(false)}
          onSkip={() => setShowProfileSetup(false)}
        />
      )}

      <div className={dashboardOverlayClass} />
      <div className="pointer-events-none absolute inset-0 opacity-60">
        {[
          "left-[8%] top-[12%]",
          "left-[22%] top-[18%]",
          "left-[70%] top-[15%]",
          "left-[84%] top-[24%]",
          "left-[11%] top-[58%]",
          "left-[60%] top-[66%]",
          "left-[88%] top-[72%]",
        ].map((position) => (
          <span
            key={position}
            className={`absolute ${position} ${sparkleClass}`}
          />
        ))}
      </div>
      {profileMenuOpen && profileMenuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={profileMenuPanelRef}
              role="menu"
              aria-label="Profile options"
              style={profileMenuStyle}
              className={`z-[200] overflow-hidden rounded-[20px] border p-1.5 shadow-[0_22px_44px_rgba(15,23,42,0.20)] backdrop-blur-md ${
                isDarkTheme
                  ? "border-slate-700/80 bg-slate-900/94"
                  : "border-white/80 bg-white/96"
              }`}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  router.push("/profile");
                }}
                className={`flex w-full items-center justify-between rounded-[18px] px-3 py-2.5 text-left transition ${
                  isDarkTheme
                    ? "text-slate-100 hover:bg-slate-800/80"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div>
                  <div className="text-sm font-semibold">Edit profile</div>
                  <div className={`mt-0.5 hidden text-[11px] leading-4 sm:block ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    Update your festive avatar and account details.
                  </div>
                </div>
                <ArrowRightIcon className={`h-4 w-4 shrink-0 ${utilityIconClass}`} />
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  void handleLogout();
                }}
                className={`mt-1.5 flex w-full items-center justify-between rounded-[18px] px-3 py-2.5 text-left transition ${
                  isDarkTheme
                    ? "text-rose-200 hover:bg-rose-500/10"
                    : "text-rose-600 hover:bg-rose-50"
                }`}
              >
                <div>
                  <div className="text-sm font-semibold">Logout</div>
                  <div className={`mt-0.5 hidden text-[11px] leading-4 sm:block ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    Sign out and return to the login screen.
                  </div>
                </div>
                <ArrowRightIcon className="h-4 w-4 shrink-0" />
              </button>
            </div>,
            document.body
          )
        : null}

      <FadeIn className="relative z-10 mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {actionMessage && (
          <div
            data-fade
            role="status"
            aria-live="polite"
            className={`mb-6 rounded-3xl px-4 py-3 text-sm font-semibold ${
              actionMessage.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {actionMessage.text}
          </div>
        )}

        <div data-fade className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="text-left">
            <SantaBrandLockup dark={isDarkTheme} />
          </div>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 self-start">
            <button
              type="button"
              onClick={() => setDashboardTheme((current) => (current === "midnight" ? "default" : "midnight"))}
              className={utilityButtonClass}
              aria-pressed={isDarkTheme}
              aria-label={isDarkTheme ? "Switch to default dashboard theme" : "Switch to midnight dashboard theme"}
              title={isDarkTheme ? "Switch to default dashboard theme" : "Switch to midnight dashboard theme"}
            >
              <ThemeIcon dark={isDarkTheme} className={`h-4 w-4 ${utilityIconClass}`} />
              <span>Theme</span>
            </button>
            {canViewAffiliateReport && (
              <button
                type="button"
                onClick={() => router.push("/dashboard/affiliate-report")}
                className={utilityButtonClass}
                aria-label="Open affiliate report"
                title="Open affiliate report"
              >
                <ReportIcon className={`h-4 w-4 ${utilityIconClass}`} />
                <span>Report</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/notifications")}
              className={utilityButtonClass}
              aria-label={unreadNotificationCount > 0 ? `Open notifications, ${unreadNotificationCount} unread` : "Open notifications"}
              title="Open notifications"
            >
              <BellIcon className={`h-4 w-4 ${utilityIconClass}`} />
              <span>Alerts</span>
              {unreadNotificationCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-[0_8px_18px_rgba(244,63,94,0.28)]">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </button>
            <div ref={profileMenuRef} className="relative z-[70]">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((current) => !current)}
                className={profileUtilityButtonClass}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-label="Open profile menu"
                title="Open profile menu"
              >
                <UserOutlineIcon className={`h-4 w-4 ${utilityIconClass}`} />
                <span>Profile</span>
                <ChevronDownIcon
                  className={`h-3 w-3 transition ${utilityIconClass} ${
                    profileMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

            </div>
          </div>
        </div>

        <div data-fade className="mb-8 text-center lg:text-left">
          <h1 className={`text-4xl font-bold tracking-tight sm:text-[3.35rem] ${heroTitleClass}`}>
            Welcome back, {displayFirstName}
          </h1>
          <p className={`mt-2 text-[17px] ${heroSubtitleClass}`}>
            Manage your groups, draws, and chats in one place.
          </p>
        </div>

        {pendingInvites.length > 0 && (
          <section data-fade className="mb-10">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
                  Invitations
                </p>
                <h2 className="mt-1 text-3xl font-bold text-slate-900">Pending invites</h2>
              </div>
              <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
                {pendingInvites.length} waiting
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pendingInvites.map((invite) => (
                <InviteCard
                  key={invite.group_id}
                  groupId={invite.group_id}
                  groupName={invite.group_name}
                  eventDate={invite.group_event_date}
                  description={invite.group_description}
                  requiresAnonymousNickname={invite.require_anonymous_nickname}
                />
              ))}
            </div>
          </section>
        )}

        <section data-fade className="mb-8 grid gap-3 lg:grid-cols-3">
          <ActionCard
            accent="rose"
            subtitle={hasAssignments ? "Your draw is ready" : "Waiting for draw"}
            title={hasAssignments ? "Open your assignment" : "No recipient yet"}
            description={
              hasAssignments
                ? `You currently have ${recipientNames.length} recipient${recipientNames.length === 1 ? "" : "s"} ready for gift planning.`
                : "Once your organizer finishes the draw, your Secret Santa recipient will show up here."
            }
            buttonLabel={hasAssignments ? "View assignment" : "Open Secret Santa"}
            onClick={() => router.push("/secret-santa")}
            icon={<GiftIcon className="h-6 w-6" />}
            meta={
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  {hasAssignments
                    ? `${recipientNames.length} recipient${recipientNames.length === 1 ? "" : "s"}`
                    : "Waiting for organizer"}
                </span>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {hasAssignments ? "Gift planning" : "Draw pending"}
                </span>
              </div>
            }
          />
          <ActionCard
            accent="green"
            subtitle="Secret Santa chat"
            title="Chat with your group"
            description="Send anonymous hints, keep the mystery fun, and plan without spoiling the surprise."
            buttonLabel="Open chat"
            onClick={() => router.push("/secret-santa-chat")}
            icon={<ChatIcon className="h-6 w-6" />}
            meta={
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Anonymous chat
                </span>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Hint-friendly
                </span>
              </div>
            }
          />
          <ActionCard
            accent="amber"
            subtitle="Create group"
            title="Start a new event"
            description="Create a new Secret Santa event, invite your friends, and get the draw ready fast."
            buttonLabel="New group"
            onClick={() => router.push("/create-group")}
            icon={<PlusIcon className="h-6 w-6" />}
            meta={
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  Plan
                </span>
                <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  Invite
                </span>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Draw
                </span>
              </div>
            }
          />
        </section>

        <section data-fade className="mb-0 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <div className="space-y-2">
            <div className={`${dashboardCardShellClass} self-start`}>
            <div className={dashboardInnerPanelClass}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-[13px] font-semibold text-rose-700">
                    <WishlistIcon className="h-4 w-4" />
                    My Wishlist
                  </div>
                  <h3 className={`mt-2.5 text-[1.3rem] font-bold ${dashboardPanelHeadingClass}`}>Your own gift ideas</h3>
                  <p className={`mt-1.5 max-w-xl text-[15px] leading-6 ${dashboardPanelTextClass}`}>
                    Keep this separate from gift planning so your Secret Santa can always see what you want.
                  </p>
                </div>
                <div className={dashboardStatChipClass}>
                  <div className={`text-[11px] font-extrabold uppercase tracking-[0.16em] ${dashboardStatLabelClass}`}>
                    Ready now
                  </div>
                  <div className={`mt-0.5 text-[16px] font-bold ${dashboardStatValueClass}`}>
                    {wishlistItemCount} item{wishlistItemCount === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                <div className={`rounded-[18px] border px-4 py-3 ${isDarkTheme ? "border-rose-500/20 bg-slate-950/45" : "border-rose-100 bg-white/92"}`}>
                  <div className={`text-[12px] font-extrabold uppercase tracking-[0.14em] ${dashboardStatLabelClass}`}>
                    Total items
                  </div>
                  <div className={`mt-1 text-[24px] font-black ${dashboardStatValueClass}`}>{wishlistItemCount}</div>
                  <div className={`mt-1 text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    Visible to your Secret Santa.
                  </div>
                </div>
                <div className={`rounded-[18px] border px-4 py-3 ${isDarkTheme ? "border-rose-500/20 bg-slate-950/45" : "border-rose-100 bg-white/92"}`}>
                  <div className={`text-[12px] font-extrabold uppercase tracking-[0.14em] ${dashboardStatLabelClass}`}>
                    Active groups
                  </div>
                  <div className={`mt-1 text-[24px] font-black ${dashboardStatValueClass}`}>{wishlistGroupCount}</div>
                  <div className={`mt-1 text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    Groups with wishlist ideas.
                  </div>
                </div>
              </div>

              <div className={`mt-4 flex flex-col gap-3 border-t pt-3 ${isDarkTheme ? "border-slate-700/70" : "border-slate-200/80"} sm:flex-row sm:items-center sm:justify-between`}>
                <p className={`text-sm font-medium ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  Manage the full list from your dedicated wishlist page.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/wishlist")}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#e25d67,#b9384c)] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_14px_35px_rgba(185,56,76,0.24)] transition hover:-translate-y-0.5"
                >
                  <span>Open My Wishlist</span>
                  <ArrowRightIcon />
                </button>
              </div>
            </div>
            </div>

            <div className={dashboardCardShellClass}>
              <div className={`flex flex-col gap-4 ${dashboardInnerPanelClass}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-[14px] font-bold text-blue-700 shadow-[0_10px_22px_rgba(59,130,246,0.14)]">
                      Activity feed
                    </div>
                    <h3 className={`mt-2.5 text-[1.42rem] font-bold ${dashboardPanelHeadingClass}`}>Recent moments that matter</h3>
                    <p className={`mt-1.5 max-w-xl text-[15px] leading-6 ${dashboardPanelTextClass}`}>
                      Your live pulse for gift prep, chat updates, and draw milestones.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {activityFeedItems.length === 0 ? (
                    <div className={`rounded-[22px] border border-dashed px-5 py-8 text-sm ${isDarkTheme ? "border-slate-700/70 bg-slate-950/45 text-slate-400" : "border-slate-200 bg-white/90 text-slate-500"}`}>
                      Once gift progress or group updates start happening, your recent activity will show up here.
                    </div>
                  ) : (
                    activityFeedItems.map((item) => {
                      const theme = getDashboardToneTheme(item.tone, isDarkTheme);

                      const row = (
                        <div
                          className={`group relative overflow-hidden rounded-[22px] border px-4 py-4 text-left shadow-[0_12px_30px_rgba(148,163,184,0.08)] transition ${
                            item.href ? "hover:-translate-y-0.5" : ""
                          } ${theme.rowSurface}`}
                        >
                          <div className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r ${theme.glow}`} />
                          <div className="relative flex items-start gap-4">
                            <div
                              className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[18px] ${theme.iconShell}`}
                            >
                              <span aria-hidden="true">{item.icon}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${theme.chip}`}>
                                  {item.href ? "Open update" : "Latest update"}
                                </span>
                                <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  {formatRelativeTime(item.createdAt)}
                                </span>
                              </div>
                              <div className={`mt-2 text-[16px] font-bold leading-6 ${isDarkTheme ? "text-white" : "text-slate-900"}`}>{item.title}</div>
                              <div className={`mt-1.5 text-[15px] leading-6 ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>{item.subtitle}</div>
                            </div>
                            {item.href ? (
                              <div className={`mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition group-hover:text-sky-400 ${isDarkTheme ? "bg-slate-900/85 text-slate-300 shadow-[0_8px_20px_rgba(2,8,23,0.24)] ring-1 ring-slate-700/70" : "bg-white/90 text-slate-500 shadow-[0_8px_20px_rgba(148,163,184,0.14)] ring-1 ring-white/80 group-hover:text-sky-600"}`}>
                                <ArrowRightIcon className="h-4 w-4" />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );

                      if (!item.href) {
                        return <div key={item.id}>{row}</div>;
                      }

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => router.push(item.href as string)}
                          className="block w-full"
                        >
                          {row}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">

            <div className={dashboardCardShellClass}>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[13px] font-semibold text-emerald-700">
              Gift planning
            </div>
            <h3 className={`mt-2.5 text-[1.42rem] font-bold ${dashboardPanelHeadingClass}`}>Track your gift progress</h3>
            <p className={`mt-1.5 text-[15px] leading-6 ${dashboardPanelTextClass}`}>
              {giftProgressSummary
                ? giftProgressSummary.totalAssignments === 1 &&
                  giftProgressSummary.recipientName &&
                  giftProgressSummary.groupName
                  ? `Stay on top of ${giftProgressSummary.recipientName} in ${giftProgressSummary.groupName}.`
                  : `${giftProgressSummary.focusCount} of ${giftProgressSummary.totalAssignments} gifts are currently in ${giftProgressSteps[currentGiftProgressIndex]?.label.toLowerCase()}.`
                : "Once your draw is ready, your gift planning steps will show up here."}
            </p>

            {giftProgressSummary ? (
              <>
                <div className={`mt-4 overflow-hidden rounded-[20px] border ${isDarkTheme ? "border-slate-700/70 bg-slate-950/50" : "border-slate-200/80 bg-slate-100/95"}`}>
                  <div className="grid grid-cols-4">
                    {giftProgressSteps.map((step, index) => {
                      const isCurrent = index === currentGiftProgressIndex;
                      const count = giftProgressSummary.countsByStep[step.key];
                      const isActive = count > 0;

                      return (
                        <div
                          key={step.key}
                          className={`flex min-h-[52px] items-center justify-center border-r px-2 text-center text-sm font-semibold last:border-r-0 ${
                            isActive
                              ? `${step.accent} text-white`
                              : isDarkTheme
                                ? "border-slate-700/70 bg-slate-800/85 text-slate-400"
                                : "border-white/60 bg-[#6fa0cf] text-white/90"
                          }`}
                        >
                          {isCurrent ? step.label : count > 0 ? `${count}` : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {giftProgressSteps.map((step, index) => {
                    const isCurrent = index === currentGiftProgressIndex;
                    const count = giftProgressSummary.countsByStep[step.key];
                    const hasAny = count > 0;

                    return (
                      <div
                        key={step.key}
                        className={`flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3 ${
                          isCurrent
                            ? isDarkTheme
                              ? "border-emerald-500/35 bg-emerald-500/8"
                              : "border-emerald-200 bg-emerald-50/80"
                            : isDarkTheme
                              ? "border-slate-700/70 bg-slate-950/45"
                              : "border-slate-200/80 bg-white/92"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${
                              hasAny || isCurrent
                                ? step.rowTone
                                : isDarkTheme
                                  ? "bg-slate-800 text-slate-400"
                                  : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {count > 0 && !isCurrent ? "✓" : step.icon}
                          </div>
                          <span className={`text-[16px] font-semibold ${dashboardPanelHeadingClass}`}>{step.label}</span>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] ${
                            isCurrent
                              ? isDarkTheme
                                ? "bg-emerald-500/18 text-emerald-100"
                                : "bg-emerald-500 text-white"
                              : hasAny
                                ? isDarkTheme
                                  ? "bg-slate-800 text-slate-200"
                                  : "bg-lime-100 text-lime-700"
                                : isDarkTheme
                                  ? "bg-slate-800 text-slate-400"
                                  : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {isCurrent
                            ? `${count} gift${count === 1 ? "" : "s"}`
                            : hasAny
                              ? `${count} gift${count === 1 ? "" : "s"}`
                              : "Next"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className={`mt-4 flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3.5 ${dashboardSubtleSurfaceClass} ${isDarkTheme ? "shadow-[0_10px_24px_rgba(2,8,23,0.18)]" : "shadow-[0_10px_24px_rgba(148,163,184,0.08)]"}`}>
                  <div>
                    <div className={`text-[12px] font-extrabold uppercase tracking-[0.14em] ${dashboardStatLabelClass}`}>
                      Progress snapshot
                    </div>
                    <div className={`mt-1 text-[15px] font-semibold ${isDarkTheme ? "text-slate-200" : "text-slate-700"}`}>
                      {giftProgressSummary.totalAssignments} recipient
                      {giftProgressSummary.totalAssignments === 1 ? "" : "s"} • {giftProgressSummary.readyToGiveCount} ready to give
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/secret-santa")}
                    className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5"
                  >
                    <span>Open gift planning</span>
                    <ArrowRightIcon />
                  </button>
                </div>
              </>
            ) : (
              <div className={`mt-4 rounded-[22px] border border-dashed px-5 py-8 text-sm ${isDarkTheme ? "border-slate-700/70 bg-slate-950/45 text-slate-400" : "border-slate-200 bg-white/90 text-slate-500"}`}>
                You&apos;ll see your planning steps here after the organizer runs the draw and your assignment is ready.
              </div>
            )}
          </div>
          
          <div className={dashboardCardShellClass}>
            <div className={dashboardInnerPanelClass}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[13px] font-semibold text-blue-700">
                    <BellIcon className="h-4 w-4" />
                    Notifications
                  </div>
                  <h3 className={`mt-2.5 text-[1.42rem] font-bold ${dashboardPanelHeadingClass}`}>Inbox highlights</h3>
                  <p className={`mt-1.5 text-[15px] leading-6 ${dashboardPanelTextClass}`}>
                    Your newest alerts, distilled into the fastest things to open next.
                  </p>
                </div>
                <div className={dashboardStatChipClass}>
                  <div className={`text-[11px] font-extrabold uppercase tracking-[0.16em] ${dashboardStatLabelClass}`}>
                    Unread
                  </div>
                  <div className={`mt-0.5 text-[16px] font-bold ${dashboardStatValueClass}`}>{unreadNotificationCount}</div>
                </div>
              </div>

              {notificationPreviewItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {notificationPreviewItems.slice(0, 1).map((item) => {
                    const theme = getDashboardToneTheme(item.tone, isDarkTheme);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.href) {
                            router.push(item.href);
                            return;
                          }

                          router.push("/notifications");
                        }}
                        className={`group relative block w-full overflow-hidden rounded-[24px] border p-4 text-left shadow-[0_16px_32px_rgba(148,163,184,0.14)] transition hover:-translate-y-0.5 ${theme.notificationSurface}`}
                      >
                        <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${theme.glow}`} />
                        <div className="relative flex items-start justify-between gap-3">
                          <div>
                            <div className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${theme.chip}`}>
                              Latest alert
                            </div>
                            <div className={`mt-2 text-base font-bold leading-6 ${isDarkTheme ? "text-white" : "text-slate-900"}`}>{item.title}</div>
                            <div className={`mt-1.5 text-[15px] font-medium ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                              Inbox alert • {formatRelativeTime(item.createdAt)}
                            </div>
                          </div>
                          <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] text-[24px] ${theme.iconShell}`}>
                            <span aria-hidden="true">{item.icon}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {notificationPreviewItems.slice(1, 3).map((item) => {
                      const theme = getDashboardToneTheme(item.tone, isDarkTheme);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.href) {
                              router.push(item.href);
                              return;
                            }

                            router.push("/notifications");
                          }}
                          className={`group relative overflow-hidden rounded-[20px] border p-3 text-left shadow-[0_12px_24px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5 ${theme.notificationSurface}`}
                        >
                          <div className={`pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-r ${theme.glow}`} />
                          <div className="relative">
                            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-[20px] ${theme.iconShell}`}>
                              <span aria-hidden="true">{item.icon}</span>
                            </div>
                            <div className={`mt-3 text-[15px] font-bold leading-6 ${isDarkTheme ? "text-white" : "text-slate-900"}`}>{item.title}</div>
                            <div className={`mt-1 text-sm font-medium ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                              {formatRelativeTime(item.createdAt)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className={`mt-4 rounded-[22px] border border-dashed px-5 py-8 text-sm ${isDarkTheme ? "border-slate-700/70 bg-slate-950/45 text-slate-400" : "border-slate-200 bg-white/90 text-slate-500"}`}>
                  Once invites, chat pings, and gift updates arrive, your inbox highlights will show up here.
                </div>
              )}

              <div className={`mt-4 flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3.5 ${dashboardSubtleSurfaceClass} ${isDarkTheme ? "shadow-[0_10px_24px_rgba(2,8,23,0.18)]" : "shadow-[0_10px_24px_rgba(148,163,184,0.08)]"}`}>
                <div>
                  <div className={`text-[12px] font-extrabold uppercase tracking-[0.14em] ${dashboardStatLabelClass}`}>
                    Inbox status
                  </div>
                  <div className={`mt-1 text-[15px] font-semibold ${isDarkTheme ? "text-slate-200" : "text-slate-700"}`}>
                    {unreadNotificationCount} unread • {pendingInvites.length} pending invite
                    {pendingInvites.length === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/notifications")}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5"
                >
                  <span>Open</span>
                  <ArrowRightIcon />
                </button>
              </div>
            </div>
            </div>
          </div>
        </section>

        <section data-fade className="-mt-4 mb-8">
          <div className="mb-1">
            <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${isDarkTheme ? "text-sky-300" : "text-sky-600"}`}>
              Groups
            </p>
            <h2 className={`mt-1 text-3xl font-bold ${dashboardPanelHeadingClass}`}>Your groups</h2>
          </div>
          {totalDashboardGroupCount === 0 ? (
            <div className="grid gap-5">
              <section className={`relative overflow-hidden rounded-[24px] border p-5 backdrop-blur-md ${isDarkTheme ? "border-slate-700/70 bg-slate-900/70 shadow-[0_18px_40px_rgba(2,8,23,0.24)]" : "border-white/70 bg-white/90 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"}`}>
                <div className="absolute bottom-4 right-5 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,#dbeafe,transparent_70%)]" />
                <p className={`text-sm font-semibold uppercase tracking-[0.16em] ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  Start here
                </p>
                <h3 className={`mt-3 text-2xl font-bold ${dashboardPanelHeadingClass}`}>
                  Don&apos;t have a group yet?
                </h3>
                <p className={`mt-3 max-w-md text-sm leading-6 ${dashboardPanelTextClass}`}>
                  Create a group and start your Secret Santa planning with a budget, date, and invite list already in place.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/create-group")}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5"
                >
                  <span>Start new group</span>
                  <ArrowRightIcon />
                </button>
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              {ownedGroups.length > 0 && (
                <GroupBucket
                  title="Hosted by you"
                  subtitle="Groups you created and manage as the organizer."
                  count={ownedGroups.length}
                  groups={ownedGroups}
                  type="owned"
                />
              )}
              {invitedGroups.length > 0 && (
                <GroupBucket
                  title="Joined as participant"
                  subtitle="Groups where someone else is hosting and you joined the exchange."
                  count={invitedGroups.length}
                  groups={invitedGroups}
                  type="invited"
                />
              )}
            </div>
          )}
        </section>

      </FadeIn>
    </main>
  );
}
