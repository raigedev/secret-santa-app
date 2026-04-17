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

function getDaysUntilEvent(value: string, now: number): number | null {
  const eventTime = new Date(value).getTime();

  if (Number.isNaN(eventTime)) {
    return null;
  }

  return Math.max(0, Math.ceil((eventTime - now) / 86_400_000));
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
    case "affiliate_lazada_health":
      return { icon: "📊", tone: "amber" };
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
    case "affiliate_lazada_health":
      return "Lazada health";
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
  const allDashboardGroups = [...ownedGroups, ...invitedGroups];
  const nextEventDays = allDashboardGroups
    .map((group) => getDaysUntilEvent(group.event_date, countdownNow))
    .filter((days): days is number => days !== null)
    .sort((a, b) => a - b)[0];
  const revealMessage =
    nextEventDays !== undefined
      ? `There are ${nextEventDays} day${nextEventDays === 1 ? "" : "s"} left until the big reveal.`
      : "Manage your groups, draws, and chats in one place.";
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
  const dashboardPanelHeadingClass = isDarkTheme ? "text-white" : "text-slate-900";
  const dashboardPanelTextClass = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const dashboardStatLabelClass = isDarkTheme ? "text-slate-500" : "text-slate-400";
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
    const daysUntilEvent = getDaysUntilEvent(group.event_date, countdownNow);
    const isOwnedGroup = type === "owned";
    const avatarShell = isDarkTheme
      ? "bg-slate-800 text-slate-100 ring-slate-900"
      : "bg-slate-100 text-slate-600 ring-white";
    const groupIconClass = isOwnedGroup
      ? isDarkTheme
        ? "bg-rose-500/15 text-rose-200"
        : "bg-red-100 text-red-600"
      : isDarkTheme
        ? "bg-sky-500/15 text-sky-200"
        : "bg-blue-100 text-blue-600";
    const datePillClass = isOwnedGroup
      ? isDarkTheme
        ? "bg-rose-500/15 text-rose-100"
        : "bg-red-50 text-red-700"
      : isDarkTheme
        ? "bg-sky-500/15 text-sky-100"
        : "bg-blue-50 text-blue-700";
    const topMembers = group.members.slice(0, 3);

    return (
      <article
        className={`group rounded-[24px] p-5 shadow-[0_8px_22px_rgba(45,51,55,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(45,51,55,0.07)] ${
          isDarkTheme ? "bg-slate-900/82 text-slate-100" : "bg-white text-slate-900"
        }`}
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
          <button
            type="button"
            onClick={() => router.push(`/group/${group.id}`)}
            className="flex min-w-0 items-center gap-4 text-left"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${groupIconClass}`}>
              {isOwnedGroup ? <GiftIcon className="h-5 w-5" /> : <UserOutlineIcon className="h-5 w-5" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[18px] font-extrabold leading-tight">
                {group.name}
              </span>
              <span className={`mt-1 block text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
                {budgetLabel ? `Budget: ${budgetLabel}` : "No budget set"} • {memberCountLabel}
              </span>
            </span>
          </button>

          <div className="flex -space-x-3 md:justify-center">
            {topMembers.map((member, index) => (
              <span
                key={`${group.id}-${member.email || member.nickname || index}-avatar`}
                className={`inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-[17px] font-bold ring-4 ${avatarShell}`}
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
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ring-4 ${avatarShell}`}>
                +{group.members.length - 3}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => router.push(`/group/${group.id}`)}
              className={`rounded-full px-4 py-2 text-sm font-extrabold ${datePillClass}`}
              title={`Event date: ${formatDashboardDate(group.event_date)}`}
            >
              {daysUntilEvent === null
                ? "Open"
                : `${daysUntilEvent} day${daysUntilEvent === 1 ? "" : "s"} left`}
            </button>
            {type === "owned" && (
              <button
                type="button"
                onClick={() => void handleDeleteGroup(group.id, group.name)}
                disabled={deletingGroupId === group.id}
                className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                  isDarkTheme
                    ? "bg-slate-800 text-slate-300 hover:bg-rose-500/15 hover:text-rose-200"
                    : "bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                }`}
              >
                {deletingGroupId === group.id ? "Deleting" : "Delete"}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const ActionCard = ({
    accent,
    title,
    description,
    onClick,
    icon,
  }: {
    accent: "rose" | "green" | "blue";
    title: string;
    description: string;
    onClick: () => void;
    icon: ReactNode;
  }) => {
    const theme =
      accent === "rose"
        ? {
            surface: isDarkTheme
              ? "bg-[linear-gradient(135deg,#451923,#2a1118)] text-rose-50"
              : "bg-[#ffaaa7] text-[#7f000c]",
            icon: isDarkTheme ? "text-rose-100" : "text-[#7f000c]",
            decoration: "gift",
          }
        : accent === "green"
        ? {
            surface: isDarkTheme
              ? "bg-[linear-gradient(135deg,#183f24,#102716)] text-emerald-50"
              : "bg-[#b3f7a6] text-[#065f18]",
            icon: isDarkTheme ? "text-emerald-100" : "text-[#065f18]",
            decoration: "chat",
          }
        : {
            surface: isDarkTheme
              ? "bg-[linear-gradient(135deg,#164569,#0d2d48)] text-sky-50"
              : "bg-[#76bfff] text-[#003a5c]",
            icon: isDarkTheme ? "text-sky-100" : "text-[#003a5c]",
            decoration: "snow",
          };

    return (
      <button
        type="button"
        onClick={onClick}
        className={`group relative min-h-[136px] overflow-hidden rounded-[28px] p-7 text-left shadow-[0_10px_26px_rgba(45,51,55,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(45,51,55,0.10)] active:scale-[0.99] ${theme.surface}`}
      >
        <div className="relative z-10">
          <div className={`mb-5 ${theme.icon}`}>{icon}</div>
          <h2 className="text-[1.45rem] font-extrabold leading-tight tracking-tight">{title}</h2>
          <p className="mt-1.5 max-w-[16rem] text-[15px] font-medium leading-6 opacity-80">
            {description}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="absolute -bottom-12 -right-8 text-[8.5rem] font-black leading-none opacity-[0.16] transition group-hover:scale-110"
        >
          {theme.decoration === "gift" ? "Gift" : theme.decoration === "chat" ? "..." : "*"}
        </div>
      </button>
    );
  };

  const GroupBucket = ({
    title,
    count,
    groups,
    type,
  }: {
    title: string;
    count: number;
    groups: Group[];
    type: "owned" | "invited";
  }) => {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 px-2">
          <h3 className={`text-xs font-black uppercase tracking-[0.22em] ${isDarkTheme ? "text-slate-500" : "text-slate-400"}`}>
            {title}
          </h3>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isDarkTheme ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-500"}`}>
            {count} group{count === 1 ? "" : "s"}
          </span>
        </div>
        <div className="space-y-4">
          {groups.map((group) => (
            <GroupCard key={`${type}-${group.id}`} group={group} type={type} />
          ))}
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

      <header className={`sticky top-0 z-[80] w-full backdrop-blur-xl shadow-[0_8px_24px_rgba(45,51,55,0.06)] ${
        isDarkTheme ? "bg-slate-950/70" : "bg-white/70"
      }`}>
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-8">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className={`shrink-0 text-[22px] font-black tracking-tight ${
                isDarkTheme ? "text-red-400" : "text-red-700"
              }`}
            >
              Secret Santa
            </button>
            <nav className="hidden items-center gap-6 md:flex">
              <button type="button" className={isDarkTheme ? "text-red-300 text-base font-bold" : "text-red-700 text-base font-bold"}>
                Home
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("dashboard-groups")?.scrollIntoView({ behavior: "smooth" })}
                className={isDarkTheme ? "text-slate-400 text-base font-semibold hover:text-red-300" : "text-slate-500 text-base font-semibold hover:text-red-600"}
              >
                Groups
              </button>
              <button
                type="button"
                onClick={() => router.push("/wishlist")}
                className={isDarkTheme ? "text-slate-400 text-base font-semibold hover:text-red-300" : "text-slate-500 text-base font-semibold hover:text-red-600"}
              >
                Wishlist
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("dashboard-activity")?.scrollIntoView({ behavior: "smooth" })}
                className={isDarkTheme ? "text-slate-400 text-base font-semibold hover:text-red-300" : "text-slate-500 text-base font-semibold hover:text-red-600"}
              >
                Activity
              </button>
              {canViewAffiliateReport && (
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/affiliate-report")}
                  className={isDarkTheme ? "text-slate-400 text-base font-semibold hover:text-red-300" : "text-slate-500 text-base font-semibold hover:text-red-600"}
                >
                  Report
                </button>
              )}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/notifications")}
              className="relative rounded-full p-2 transition hover:bg-red-50/80"
              aria-label={unreadNotificationCount > 0 ? `Open notifications, ${unreadNotificationCount} unread` : "Open notifications"}
              title="Open notifications"
            >
              <BellIcon className={`h-5 w-5 ${utilityIconClass}`} />
              {unreadNotificationCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setDashboardTheme((current) => (current === "midnight" ? "default" : "midnight"))}
              className="rounded-full p-2 transition hover:bg-red-50/80"
              aria-pressed={isDarkTheme}
              aria-label={isDarkTheme ? "Switch to default dashboard theme" : "Switch to midnight dashboard theme"}
              title={isDarkTheme ? "Switch to default dashboard theme" : "Switch to midnight dashboard theme"}
            >
              <ThemeIcon dark={isDarkTheme} className={`h-5 w-5 ${utilityIconClass}`} />
            </button>
            <div ref={profileMenuRef} className="relative z-[90]">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((current) => !current)}
                className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-2 ${
                  isDarkTheme ? "bg-slate-800 ring-red-400/40" : "bg-red-50 ring-red-100"
                }`}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-label="Open profile menu"
                title="Open profile menu"
              >
                <SantaMarkIcon size={26} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <FadeIn className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
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

        <div data-fade className="mb-9 text-left">
          <h1 className={`text-4xl font-extrabold tracking-tight sm:text-[3.35rem] ${heroTitleClass}`}>
            Welcome back, {displayFirstName}
          </h1>
          <p className={`mt-2 text-[19px] ${heroSubtitleClass}`}>
            {revealMessage} <span aria-hidden="true">🎄</span>
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

        <section data-fade className="mb-12 grid gap-6 md:grid-cols-3">
          <ActionCard
            accent="rose"
            title={hasAssignments ? "Open Assignment" : "No Assignment Yet"}
            description={
              hasAssignments
                ? "See who you're surprising this year!"
                : "Your recipient will appear after the draw."
            }
            onClick={() => router.push("/secret-santa")}
            icon={<GiftIcon className="h-8 w-8" />}
          />
          <ActionCard
            accent="green"
            title="Secret Santa Chat"
            description="Message your giftee or your Santa privately."
            onClick={() => router.push("/secret-santa-chat")}
            icon={<ChatIcon className="h-8 w-8" />}
          />
          <ActionCard
            accent="blue"
            title="New Group"
            description="Start a new exchange for friends."
            onClick={() => router.push("/create-group")}
            icon={<PlusIcon className="h-8 w-8" />}
          />
        </section>

        <section data-fade className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-12">
            <section id="dashboard-groups" className="scroll-mt-24">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className={`text-[1.85rem] font-black tracking-tight ${dashboardPanelHeadingClass}`}>Your Groups</h2>
                  <p className={`mt-1 text-[15px] ${dashboardPanelTextClass}`}>
                    Hosted and joined exchanges in one clean view.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/create-group")}
                  className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold transition hover:-translate-y-0.5 sm:inline-flex ${
                    isDarkTheme ? "bg-red-500/12 text-red-200" : "bg-red-50 text-red-700"
                  }`}
                >
                  New group
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>

              {totalDashboardGroupCount === 0 ? (
                <section className={`relative overflow-hidden rounded-[28px] p-7 shadow-[0_12px_30px_rgba(45,51,55,0.04)] ${
                  isDarkTheme ? "bg-slate-900/82 text-slate-100" : "bg-white text-slate-900"
                }`}>
                  <div className="absolute bottom-4 right-6 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,#dbeafe,transparent_70%)] opacity-80" />
                  <p className={`text-[12px] font-black uppercase tracking-[0.18em] ${dashboardStatLabelClass}`}>Start here</p>
                  <h3 className="mt-4 text-2xl font-black">Don&apos;t have a group yet?</h3>
                  <p className={`mt-3 max-w-md text-[15px] leading-7 ${dashboardPanelTextClass}`}>
                    Create a group and start your Secret Santa planning with a budget, date, and invite list already in place.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/create-group")}
                    className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#186be8] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_14px_30px_rgba(24,107,232,0.22)] transition hover:-translate-y-0.5"
                  >
                    Start new group
                    <ArrowRightIcon />
                  </button>
                </section>
              ) : (
                <div className="space-y-8">
                  {ownedGroups.length > 0 && (
                    <GroupBucket
                      title="Hosted by you"
                      count={ownedGroups.length}
                      groups={ownedGroups}
                      type="owned"
                    />
                  )}
                  {invitedGroups.length > 0 && (
                    <GroupBucket
                      title="Joined as participant"
                      count={invitedGroups.length}
                      groups={invitedGroups}
                      type="invited"
                    />
                  )}
                </div>
              )}
            </section>

            <section id="dashboard-activity" className="scroll-mt-24">
              <h2 className={`mb-5 text-[1.85rem] font-black tracking-tight ${dashboardPanelHeadingClass}`}>Activity Feed</h2>
              <div className={`rounded-[30px] p-3 shadow-[0_12px_30px_rgba(45,51,55,0.04)] ${
                isDarkTheme ? "bg-slate-900/82" : "bg-white/92"
              }`}>
                {activityFeedItems.length === 0 ? (
                  <div className={`rounded-[24px] border border-dashed px-6 py-10 text-[15px] ${
                    isDarkTheme ? "border-slate-700/70 bg-slate-950/45 text-slate-400" : "border-slate-200 bg-slate-50/80 text-slate-500"
                  }`}>
                    Once gift progress or group updates start happening, your recent activity will show up here.
                  </div>
                ) : (
                  <div className={isDarkTheme ? "divide-y divide-slate-700/70" : "divide-y divide-slate-200/70"}>
                    {activityFeedItems.slice(0, 5).map((item) => {
                      const theme = getDashboardToneTheme(item.tone, isDarkTheme);
                      const content = (
                        <div className="flex items-center gap-4 px-4 py-4 text-left">
                          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[16px] ${theme.iconShell}`}>
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-[15px] font-extrabold ${dashboardPanelHeadingClass}`}>
                              {item.title}
                            </span>
                            <span className={`mt-0.5 block truncate text-sm ${dashboardPanelTextClass}`}>
                              {item.subtitle}
                            </span>
                          </span>
                          <span className={`shrink-0 text-sm font-bold ${isDarkTheme ? "text-slate-500" : "text-slate-400"}`}>
                            {formatRelativeTime(item.createdAt)}
                          </span>
                          {item.href && <ArrowRightIcon className={`h-4 w-4 shrink-0 ${utilityIconClass}`} />}
                        </div>
                      );

                      return item.href ? (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => router.push(item.href as string)}
                          className="block w-full rounded-[20px] transition hover:bg-slate-500/5"
                        >
                          {content}
                        </button>
                      ) : (
                        <div key={item.id}>{content}</div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-8 lg:sticky lg:top-24">
            <section className={`relative overflow-hidden rounded-[32px] p-8 shadow-[0_14px_32px_rgba(45,51,55,0.05)] ${
              isDarkTheme ? "bg-slate-900/82 text-slate-100" : "bg-white text-slate-900"
            }`}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2">
                  <WishlistIcon className={isDarkTheme ? "h-5 w-5 text-rose-200" : "h-5 w-5 text-red-700"} />
                  <h3 className="text-lg font-black">My Wishlist</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${
                  isDarkTheme ? "bg-slate-800 text-slate-300" : "bg-blue-50 text-blue-500"
                }`}>
                  {wishlistItemCount} item{wishlistItemCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className={`text-[15px] leading-7 ${dashboardPanelTextClass}`}>
                Make it easy for your Santa to find the perfect gift. {wishlistGroupCount} group{wishlistGroupCount === 1 ? "" : "s"} already use your ideas.
              </p>
              <button
                type="button"
                onClick={() => router.push("/wishlist")}
                className="mt-7 flex w-full items-center justify-center rounded-full bg-[#c71824] px-5 py-4 text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(199,24,36,0.20)] transition hover:-translate-y-0.5"
              >
                Manage Wishlist
              </button>
            </section>

            <section className={`rounded-[32px] p-8 shadow-[0_14px_32px_rgba(45,51,55,0.05)] ${
              isDarkTheme ? "bg-slate-900/82 text-slate-100" : "bg-white text-slate-900"
            }`}>
              <h3 className="text-lg font-black">Gift Progress</h3>
              <div className="mt-5 space-y-4">
                {giftProgressSteps.map((step, index) => {
                  const count = giftProgressSummary?.countsByStep[step.key] ?? 0;
                  const isCurrent = giftProgressSummary ? index === currentGiftProgressIndex : index === 0;
                  const isDone = giftProgressSummary ? count > 0 && index <= currentGiftProgressIndex : false;

                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          isDone || isCurrent
                            ? "bg-green-600 text-white"
                            : isDarkTheme
                              ? "bg-slate-800 text-slate-500"
                              : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {isDone ? "✓" : ""}
                      </span>
                      <span className={`text-[15px] font-extrabold ${
                        isCurrent ? "text-green-600" : dashboardPanelHeadingClass
                      }`}>
                        {step.label}
                      </span>
                      {isCurrent && count > 0 && (
                        <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-black ${
                          isDarkTheme ? "bg-green-500/15 text-green-200" : "bg-green-50 text-green-700"
                        }`}>
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => router.push("/secret-santa")}
                className={`mt-7 flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-extrabold transition hover:-translate-y-0.5 ${
                  isDarkTheme ? "bg-slate-800 text-slate-100" : "bg-slate-50 text-slate-700"
                }`}
              >
                Open gift planning
              </button>
            </section>

            <section className={`rounded-[32px] p-8 shadow-[0_14px_32px_rgba(45,51,55,0.05)] ${
              isDarkTheme ? "bg-slate-900/82 text-slate-100" : "bg-white text-slate-900"
            }`}>
              <h3 className="text-lg font-black">Inbox Highlights</h3>
              <div className="mt-5 space-y-4">
                {notificationPreviewItems.length === 0 ? (
                  <div className={`rounded-[22px] border border-dashed px-4 py-7 text-sm ${
                    isDarkTheme ? "border-slate-700/70 text-slate-400" : "border-slate-200 text-slate-500"
                  }`}>
                    New invites, chat pings, and draw updates will show up here.
                  </div>
                ) : (
                  notificationPreviewItems.slice(0, 2).map((item) => {
                    const theme = getDashboardToneTheme(item.tone, isDarkTheme);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => router.push(item.href || "/notifications")}
                        className="flex w-full items-center gap-3 rounded-[20px] p-3 text-left transition hover:bg-slate-500/5"
                      >
                        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${theme.iconShell}`}>
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-extrabold ${dashboardPanelHeadingClass}`}>{item.title}</span>
                          <span className={`mt-0.5 block truncate text-xs ${dashboardPanelTextClass}`}>
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={() => router.push("/notifications")}
                className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold transition hover:-translate-y-0.5 ${
                  isDarkTheme ? "bg-slate-800 text-slate-100" : "bg-slate-50 text-slate-700"
                }`}
              >
                Go to Inbox
                {unreadNotificationCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] text-white">{unreadNotificationCount}</span>
                )}
              </button>
            </section>
          </aside>
        </section>

      </FadeIn>
    </main>
  );
}
