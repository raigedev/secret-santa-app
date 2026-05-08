"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatSkeleton } from "@/app/components/PageSkeleton";
import { isGroupInHistory } from "@/lib/groups/history";
import {
  clearClientSnapshots,
  hasFreshClientSnapshotMetadata,
  readClientSnapshot,
  writeClientSnapshot,
  type ClientSnapshotMetadata,
} from "@/lib/client-snapshot";
import { isRecord, sanitizePlainText } from "@/lib/validation/common";
import { sendMessage } from "./chat-actions";

type Thread = {
  group_id: string;
  group_name: string;
  group_gift_date: string;
  giver_id: string;
  receiver_id: string;
  other_name: string;
  role: "giver" | "receiver";
  last_message: string;
  last_time: string;
  unread: number;
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type MembershipRow = {
  group_id: string;
};

type GroupRow = {
  id: string;
  name: string | null;
  event_date: string | null;
};

type AssignmentRow = {
  group_id: string;
  giver_id: string;
  receiver_id: string;
};

type MessageRow = {
  group_id: string;
  thread_giver_id: string;
  thread_receiver_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ThreadReadRow = {
  group_id: string;
  thread_giver_id: string;
  thread_receiver_id: string;
  last_read_at: string;
};

type MemberNicknameRow = {
  group_id: string;
  user_id: string;
  nickname: string | null;
};

type FestiveTone = "gold" | "green" | "neutral";
type ThreadFilter = "all" | "giver" | "receiver";
type ChatPageSnapshot = ClientSnapshotMetadata & {
  threads: Thread[];
};

const CHAT_PAGE_SNAPSHOT_STORAGE_PREFIX = "ss_chat_page_snapshot_v1:";
const CHAT_PAGE_BACKGROUND =
  "repeating-linear-gradient(135deg,rgba(72,102,78,.04) 0 1px,transparent 1px 38px),radial-gradient(circle at 15% 0%,rgba(252,206,114,.18),transparent 30%),radial-gradient(circle at 95% 15%,rgba(164,60,63,.10),transparent 28%),linear-gradient(180deg,#fffefa 0%,#f9faf8 46%,#eff5ef 100%)";
const CHAT_PANEL_BACKGROUND = "linear-gradient(145deg,rgba(255,255,255,.92),rgba(251,252,250,.96))";
const CHAT_SURFACE_STRONG = "linear-gradient(180deg,rgba(255,255,255,.96),rgba(249,250,248,.98))";
const CHAT_SURFACE_MUTED = "rgba(243,244,242,.9)";
const CHAT_BORDER = "1px solid rgba(72,102,78,.14)";
const CHAT_BORDER_SOFT = "1px solid rgba(72,102,78,.12)";
const CHAT_TEXT_MUTED = "#64748b";
const CHAT_TEXT_SUBTLE = "#6f7a74";
const CHAT_HEADER_TEXT = "#2e3432";
const CHAT_GREEN = "#48664e";
const CHAT_RED = "#a43c3f";
const WRAP_UP_DAYS = 7;
const CHAT_THREAD_MESSAGE_SCAN_LIMIT = 300;
const CHAT_ACTIVE_THREAD_MESSAGE_LIMIT = 100;
const CHAT_THREAD_FALLBACK_POLL_MS = 5 * 60 * 1000;
const CHAT_ACTIVE_THREAD_FALLBACK_POLL_MS = 5 * 60 * 1000;

function getChatPageSnapshotStorageKey(userId: string): string {
  return `${CHAT_PAGE_SNAPSHOT_STORAGE_PREFIX}${userId}`;
}

function isThreadRole(value: unknown): value is Thread["role"] {
  return value === "giver" || value === "receiver";
}

function isThreadSnapshot(value: unknown): value is Thread {
  return (
    isRecord(value) &&
    typeof value.group_id === "string" &&
    typeof value.group_name === "string" &&
    typeof value.group_gift_date === "string" &&
    typeof value.giver_id === "string" &&
    typeof value.receiver_id === "string" &&
    typeof value.other_name === "string" &&
    isThreadRole(value.role) &&
    typeof value.last_message === "string" &&
    typeof value.last_time === "string" &&
    typeof value.unread === "number"
  );
}

function isChatPageSnapshot(
  value: unknown,
  userId: string
): value is ChatPageSnapshot {
  return (
    hasFreshClientSnapshotMetadata(value, userId) &&
    Array.isArray(value.threads) &&
    value.threads.every(isThreadSnapshot)
  );
}

function ChatLineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5.5 6.75C5.5 5.78 6.28 5 7.25 5h9.5c.97 0 1.75.78 1.75 1.75v6.1c0 .97-.78 1.75-1.75 1.75h-5.6L7 18v-3.4h-.75c-.97 0-1.75-.78-1.75-1.75v-6.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 8.7h8M8 11.2h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 10h11M11 5.5 15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EnvelopeLineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.75" y="5.75" width="16.5" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m5.5 7.6 6.5 5.2 6.5-5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m5.7 16 4.1-3.4M18.3 16l-4.1-3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CalendarLineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 4v3M16 4v3M4.5 9.5h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function sanitize(input: string): string {
  return sanitizePlainText(input, 500);
}

function createThreadKey(groupId: string, giverId: string, receiverId: string): string {
  return `${groupId}:${giverId}:${receiverId}`;
}

function createGroupUserKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
}

function pickDefaultThread(availableThreads: Thread[]): Thread | null {
  return (
    availableThreads.find((thread) => thread.unread > 0) ||
    availableThreads.find((thread) => thread.role === "giver") ||
    availableThreads[0] ||
    null
  );
}

function isCurrentChatThread(thread: Thread): boolean {
  return !isGroupInHistory(thread.group_gift_date);
}

function formatThreadTime(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "New";
  }

  const date = new Date(trimmedValue);

  if (Number.isNaN(date.getTime())) {
    return trimmedValue;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createPreviewText(
  senderId: string,
  currentUserId: string,
  otherName: string,
  content: string
): string {
  const prefix =
    senderId === currentUserId
      ? "You: "
      : otherName === "Secret Santa"
        ? "Secret Santa: "
        : `${otherName}: `;

  return prefix + content.slice(0, 60);
}

function formatGroupDate(value: string): string {
  if (!value.trim()) return "Date not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not set";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStartOfLocalDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function getGiftTimingInfo(value: string): {
  label: string;
  detail: string;
  chip: string;
  phase: "planning" | "gift-day" | "wrap-up" | "history" | "unknown";
  highlightedDay: number;
} {
  const now = new Date();
  const fallbackDay = Math.min(Math.max(now.getDate(), 1), 28);

  if (!value.trim()) {
    return {
      label: "Gift day not set",
      detail: "Set a group gift day to show whether this chat is in planning, gift day, or wrap-up.",
      chip: "Date needed",
      phase: "unknown",
      highlightedDay: fallbackDay,
    };
  }

  const giftDate = new Date(value);
  if (Number.isNaN(giftDate.getTime())) {
    return {
      label: "Gift day not set",
      detail: "Set a group gift day to show whether this chat is in planning, gift day, or wrap-up.",
      chip: "Date needed",
      phase: "unknown",
      highlightedDay: fallbackDay,
    };
  }

  const daysUntil = Math.round(
    (getStartOfLocalDay(giftDate) - getStartOfLocalDay(now)) / 86400000
  );
  const highlightedDay = Math.min(Math.max(giftDate.getDate(), 1), 28);

  if (daysUntil > 0) {
    return {
      label: "Planning time",
      detail: "Ask about sizes, colors, delivery details, or hints while identities stay protected.",
      chip: daysUntil === 1 ? "1d left" : `${daysUntil}d left`,
      phase: "planning",
      highlightedDay,
    };
  }

  if (daysUntil === 0) {
    return {
      label: "Gift day",
      detail: "It is gift day. Use this thread for delivery updates, quick replies, or thank-you notes.",
      chip: "Gift day",
      phase: "gift-day",
      highlightedDay,
    };
  }

  const daysPast = Math.abs(daysUntil);
  const wrapUpDaysLeft = Math.max(WRAP_UP_DAYS - daysPast, 0);

  if (wrapUpDaysLeft > 0) {
    return {
      label: "Wrap-up time",
      detail: "Gift day has passed, but final thank-yous and delivery notes can still be sent.",
      chip: wrapUpDaysLeft === 1 ? "1d left" : `${wrapUpDaysLeft}d left`,
      phase: "wrap-up",
      highlightedDay,
    };
  }

  return {
    label: "Ready for History",
    detail: "This exchange has wrapped up. Save what you need, then keep the memories in History.",
    chip: "History",
    phase: "history",
    highlightedDay,
  };
}

function FestiveTrim({
  tone,
  withBells = false,
  compact = false,
}: {
  tone: FestiveTone;
  withBells?: boolean;
  compact?: boolean;
}) {
  const palette =
    tone === "gold"
      ? {
          rope: "#d8a93a",
          ropeLight: "#f3d16a",
          pine: "#327347",
          pineLight: "#4d9760",
          pineDark: "#1d4c2f",
          berry: "#d44338",
          berryDark: "#8e211a",
          bell: "#dca730",
          bellLight: "#f7db79",
          bellDark: "#94630f",
          bow: "#d03a34",
          bowDark: "#8f1f24",
          sparkle: "#fff1bf",
          glow: "rgba(251,191,36,.32)",
        }
      : tone === "green"
        ? {
            rope: "#cea13a",
            ropeLight: "#efcc6a",
            pine: "#2d8950",
            pineLight: "#48b16e",
            pineDark: "#175333",
            berry: "#d34139",
            berryDark: "#8f1f1d",
            bell: "#d8aa42",
            bellLight: "#f4df89",
            bellDark: "#8f6514",
            bow: "#c23a33",
            bowDark: "#8c2126",
            sparkle: "#f0ffde",
            glow: "rgba(34,197,94,.26)",
          }
        : {
            rope: "#cca043",
            ropeLight: "#f0d58a",
            pine: "#386f4f",
            pineLight: "#5ca27b",
            pineDark: "#1d4533",
            berry: "#c43c37",
            berryDark: "#8d2620",
            bell: "#d1a23c",
            bellLight: "#f4dc8f",
            bellDark: "#8b6216",
            bow: "#bf3934",
            bowDark: "#882127",
            sparkle: "#fff6d5",
            glow: "rgba(255,255,255,.18)",
          };

  const ids = {
    rope: useId().replace(/:/g, ""),
    pine: useId().replace(/:/g, ""),
    pineAlt: useId().replace(/:/g, ""),
    berry: useId().replace(/:/g, ""),
    bow: useId().replace(/:/g, ""),
    bell: useId().replace(/:/g, ""),
    bellShine: useId().replace(/:/g, ""),
  };

  if (compact) {
    return (
      <div className="pointer-events-none absolute inset-x-4 top-0 h-10 overflow-visible" aria-hidden="true">
        <div
          className="absolute inset-x-4 top-5 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${palette.ropeLight}, ${palette.rope}, ${palette.ropeLight}, transparent)`,
            opacity: 0.9,
          }}
        />
        {[0, 1, 2, 3, 4].map((index) => {
          const left = `${8 + index * 22}%`;
          const scale = index === 2 ? 1.05 : 0.9;

          return (
            <div
              key={index}
              className="absolute top-1"
              style={{
                left,
                transform: `translateX(-50%) scale(${scale})`,
                color: palette.ropeLight,
              }}
            >
              <svg viewBox="0 0 48 20" className="h-7 w-12 drop-shadow-[0_6px_12px_rgba(0,0,0,.18)]">
                <path
                  d="M2 9.5 C10 4, 18 4.2, 24 9.5 C30 14.4, 38 14.8, 46 9.5"
                  fill="none"
                  stroke={palette.rope}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="10" r="2.4" fill={palette.berry} />
                <circle cx="24" cy="9" r="2.8" fill={palette.berryDark} />
                <circle cx="35" cy="10" r="2.4" fill={palette.berry} />
                <path
                  d="M21 6.6 C22.5 4.4 25.5 4.4 27 6.6 C25 7.6 23 7.6 21 6.6 Z"
                  fill={palette.pine}
                />
              </svg>
            </div>
          );
        })}
      </div>
    );
  }

  const topHeight = compact ? 56 : 78;
  const topOffset = compact ? -22 : -34;
  const cornerSize = compact ? 62 : 84;
  const bottomCornerSize = compact ? 38 : 48;
  const frameInset = compact ? 4 : 6;
  const frameRadius = compact ? 16 : 20;
  const frameColor =
    tone === "gold"
      ? "rgba(251,191,36,.18)"
      : tone === "green"
        ? "rgba(34,197,94,.18)"
        : "rgba(255,255,255,.14)";
  const crestWidth = compact ? 104 : 144;
  const crestHeight = compact ? 48 : 64;
  const crestTop = compact ? -18 : -28;

  const renderCornerCluster = (side: "left" | "right", bottom = false) => {
    const flipX = side === "right" ? -1 : 1;
    const flipY = bottom ? -1 : 1;

    return (
      <svg
        className="absolute"
        style={{
          [side]: bottom ? -2 : -8,
          [bottom ? "bottom" : "top"]: bottom ? -6 : compact ? -8 : -10,
          width: bottom ? bottomCornerSize : cornerSize,
          height: bottom ? bottomCornerSize : cornerSize,
          transform: `scale(${flipX}, ${flipY})`,
          transformOrigin: "center",
          filter: `drop-shadow(0 4px 12px ${palette.glow})`,
        }}
        viewBox="0 0 96 96"
      >
        <defs>
          <linearGradient id={`${ids.pine}-corner-${side}-${bottom ? "b" : "t"}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.pineLight} />
            <stop offset="55%" stopColor={palette.pine} />
            <stop offset="100%" stopColor={palette.pineDark} />
          </linearGradient>
          <radialGradient id={`${ids.berry}-corner-${side}-${bottom ? "b" : "t"}`} cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#ffb0a5" />
            <stop offset="30%" stopColor={palette.berry} />
            <stop offset="100%" stopColor={palette.berryDark} />
          </radialGradient>
          <linearGradient id={`${ids.bell}-corner-${side}-${bottom ? "b" : "t"}`} x1="0%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor={palette.bellLight} />
            <stop offset="55%" stopColor={palette.bell} />
            <stop offset="100%" stopColor={palette.bellDark} />
          </linearGradient>
        </defs>
        <ellipse cx="30" cy="28" rx="31" ry="11" fill={`url(#${ids.pine}-corner-${side}-${bottom ? "b" : "t"})`} transform="rotate(-28 30 28)" />
        <ellipse cx="50" cy="22" rx="29" ry="10" fill={`url(#${ids.pine}-corner-${side}-${bottom ? "b" : "t"})`} transform="rotate(14 50 22)" />
        <ellipse cx="26" cy="48" rx="23" ry="9" fill={`url(#${ids.pine}-corner-${side}-${bottom ? "b" : "t"})`} transform="rotate(42 26 48)" />
        <ellipse cx="54" cy="44" rx="19" ry="7" fill={palette.pineDark} transform="rotate(-22 54 44)" opacity="0.9" />
        <circle cx="40" cy="42" r="6.5" fill={`url(#${ids.berry}-corner-${side}-${bottom ? "b" : "t"})`} />
        <circle cx="28" cy="50" r="5.5" fill={`url(#${ids.berry}-corner-${side}-${bottom ? "b" : "t"})`} />
        <circle cx="54" cy="52" r="5.5" fill={`url(#${ids.berry}-corner-${side}-${bottom ? "b" : "t"})`} />
        {!bottom && (
          <>
            <path
              d="M58 34 C 65 33, 72 38, 72 46 C 72 54, 66 60, 58 60 C 50 60, 44 54, 44 46 C 44 39, 50 34, 58 34 Z"
              fill={`url(#${ids.bell}-corner-${side}-${bottom ? "b" : "t"})`}
            />
            <path d="M48 40 Q58 46 68 40" stroke={palette.bellDark} strokeWidth="2.6" fill="none" opacity="0.5" />
            <circle cx="58" cy="53" r="4.2" fill={palette.bellDark} />
            <circle cx="54" cy="40" r="2.2" fill="rgba(255,255,255,.45)" />
          </>
        )}
      </svg>
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      <div
        className="absolute"
        style={{
          inset: frameInset,
          borderRadius: frameRadius,
          border: `1px solid ${frameColor}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,.025), 0 0 0 1px ${palette.glow}`,
        }}
      />

      <svg
        className="absolute"
        style={{
          left: 18,
          right: 18,
          top: topOffset,
          width: "calc(100% - 36px)",
          height: topHeight,
          filter: `drop-shadow(0 4px 10px ${palette.glow})`,
        }}
        viewBox="0 0 1000 120"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`${ids.rope}-main`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.ropeLight} />
            <stop offset="50%" stopColor={palette.rope} />
            <stop offset="100%" stopColor={palette.ropeLight} />
          </linearGradient>
          <linearGradient id={`${ids.pine}-main`} x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor={palette.pineLight} />
            <stop offset="45%" stopColor={palette.pine} />
            <stop offset="100%" stopColor={palette.pineDark} />
          </linearGradient>
          <linearGradient id={`${ids.pineAlt}-main`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.pineDark} />
            <stop offset="100%" stopColor={palette.pineLight} />
          </linearGradient>
          <radialGradient id={`${ids.berry}-main`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffd2ca" />
            <stop offset="28%" stopColor={palette.berry} />
            <stop offset="100%" stopColor={palette.berryDark} />
          </radialGradient>
          <linearGradient id={`${ids.bow}-main`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.bow} />
            <stop offset="55%" stopColor="#e04a44" />
            <stop offset="100%" stopColor={palette.bowDark} />
          </linearGradient>
          <linearGradient id={`${ids.bell}-main`} x1="0%" y1="0%" x2="40%" y2="100%">
            <stop offset="0%" stopColor={palette.bellLight} />
            <stop offset="45%" stopColor={palette.bell} />
            <stop offset="100%" stopColor={palette.bellDark} />
          </linearGradient>
          <radialGradient id={`${ids.bellShine}-main`} cx="30%" cy="25%" r="75%">
            <stop offset="0%" stopColor="rgba(255,255,255,.72)" />
            <stop offset="25%" stopColor="rgba(255,255,255,.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <path
          d="M78 56 C 210 16, 352 16, 500 56 C 648 96, 790 96, 922 56"
          fill="none"
          stroke={`url(#${ids.rope}-main)`}
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M94 59 C 224 28, 355 28, 500 59 C 645 90, 776 90, 906 59"
          fill="none"
          stroke={`url(#${ids.pine}-main)`}
          strokeWidth="18"
          strokeLinecap="round"
          opacity="0.98"
        />
        <path
          d="M112 48 C 246 24, 366 24, 500 48 C 634 72, 754 72, 888 48"
          fill="none"
          stroke={`url(#${ids.pineAlt}-main)`}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.8"
        />

        {[180, 320, 680, 820].map((x, index) => (
          <g key={x} transform={`translate(${x} ${index % 2 === 0 ? 44 : 52})`}>
            <ellipse cx="-16" cy="0" rx="24" ry="8" fill={`url(#${ids.pine}-main)`} transform="rotate(-26)" />
            <ellipse cx="2" cy="-4" rx="22" ry="8" fill={`url(#${ids.pine}-main)`} transform="rotate(12)" />
            <ellipse cx="-2" cy="12" rx="18" ry="7" fill={`url(#${ids.pineAlt}-main)`} transform="rotate(38)" />
            <circle cx="10" cy="14" r="5" fill={`url(#${ids.berry}-main)`} />
            <circle cx="-6" cy="18" r="4" fill={`url(#${ids.berry}-main)`} />
          </g>
        ))}

        <g transform="translate(120 42)">
          <ellipse cx="0" cy="0" rx="27" ry="10" fill={`url(#${ids.pine}-main)`} transform="rotate(-28)" />
          <ellipse cx="20" cy="1" rx="25" ry="10" fill={`url(#${ids.pineAlt}-main)`} transform="rotate(14)" />
          <ellipse cx="-18" cy="12" rx="20" ry="8" fill={`url(#${ids.pine}-main)`} transform="rotate(42)" />
          <ellipse cx="22" cy="20" rx="17" ry="7" fill={`url(#${ids.pineAlt}-main)`} transform="rotate(-18)" />
          <circle cx="10" cy="18" r="6" fill={`url(#${ids.berry}-main)`} />
          <circle cx="-4" cy="22" r="5" fill={`url(#${ids.berry}-main)`} />
          <circle cx="22" cy="24" r="5" fill={`url(#${ids.berry}-main)`} />
        </g>
        <g transform="translate(880 42)">
          <ellipse cx="0" cy="0" rx="27" ry="10" fill={`url(#${ids.pine}-main)`} transform="rotate(28)" />
          <ellipse cx="-20" cy="1" rx="25" ry="10" fill={`url(#${ids.pineAlt}-main)`} transform="rotate(-14)" />
          <ellipse cx="18" cy="12" rx="20" ry="8" fill={`url(#${ids.pine}-main)`} transform="rotate(-42)" />
          <ellipse cx="-22" cy="20" rx="17" ry="7" fill={`url(#${ids.pineAlt}-main)`} transform="rotate(18)" />
          <circle cx="-10" cy="18" r="6" fill={`url(#${ids.berry}-main)`} />
          <circle cx="4" cy="22" r="5" fill={`url(#${ids.berry}-main)`} />
          <circle cx="-22" cy="24" r="5" fill={`url(#${ids.berry}-main)`} />
        </g>

        <g transform={`translate(500 ${withBells ? 36 : 32})`}>
          <ellipse cx="0" cy="12" rx="72" ry="10" fill="rgba(0,0,0,.12)" />
          <path
            d="M-42 -6 C -28 -26, -8 -22, 0 -2 C 8 -22, 28 -26, 42 -6 L 22 12 L 0 -2 L -22 12 Z"
            fill={`url(#${ids.bow}-main)`}
          />
          <path d="M-10 12 L -18 28" stroke={palette.rope} strokeWidth="4" strokeLinecap="round" />
          <path d="M10 12 L 18 28" stroke={palette.rope} strokeWidth="4" strokeLinecap="round" />
          <circle cx="0" cy="8" r="7" fill={`url(#${ids.berry}-main)`} />
          <ellipse cx="-24" cy="18" rx="17" ry="7" fill={`url(#${ids.pine}-main)`} transform="rotate(-18)" />
          <ellipse cx="24" cy="18" rx="17" ry="7" fill={`url(#${ids.pine}-main)`} transform="rotate(18)" />
          <ellipse cx="-14" cy="26" rx="14" ry="6" fill={`url(#${ids.pineAlt}-main)`} transform="rotate(22)" />
          <ellipse cx="14" cy="26" rx="14" ry="6" fill={`url(#${ids.pineAlt}-main)`} transform="rotate(-22)" />
          {withBells ? (
            <g transform="translate(0 12)">
              <path
                d="M-26 14 C -36 14, -44 24, -44 36 C -44 49, -34 58, -22 58 C -10 58, -2 48, -2 36 C -2 24, -12 14, -22 14 Z"
                fill={`url(#${ids.bell}-main)`}
              />
              <path
                d="M26 14 C 36 14, 44 24, 44 36 C 44 49, 34 58, 22 58 C 10 58, 2 48, 2 36 C 2 24, 12 14, 22 14 Z"
                fill={`url(#${ids.bell}-main)`}
              />
              <path d="M-30 22 Q-22 28 -14 22" stroke={palette.bellDark} strokeWidth="3" fill="none" opacity="0.55" />
              <path d="M14 22 Q22 28 30 22" stroke={palette.bellDark} strokeWidth="3" fill="none" opacity="0.55" />
              <circle cx="-22" cy="49" r="4.5" fill={palette.bellDark} />
              <circle cx="22" cy="49" r="4.5" fill={palette.bellDark} />
              <ellipse cx="-28" cy="24" rx="10" ry="12" fill={`url(#${ids.bellShine}-main)`} />
              <ellipse cx="16" cy="24" rx="10" ry="12" fill={`url(#${ids.bellShine}-main)`} />
            </g>
          ) : (
            <g transform="translate(0 30)">
              <ellipse cx="-14" cy="0" rx="16" ry="7" fill={`url(#${ids.pine}-main)`} transform="rotate(18)" />
              <ellipse cx="14" cy="0" rx="16" ry="7" fill={`url(#${ids.pine}-main)`} transform="rotate(-18)" />
              <circle cx="-4" cy="2" r="4.5" fill={`url(#${ids.berry}-main)`} />
              <circle cx="6" cy="2" r="4.5" fill={`url(#${ids.berry}-main)`} />
            </g>
          )}
          <circle cx="-32" cy="-6" r="2.2" fill={palette.sparkle} opacity="0.8" />
          <circle cx="36" cy="-2" r="1.8" fill={palette.sparkle} opacity="0.7" />
        </g>
      </svg>

      <svg
        className="absolute"
        style={{
          left: "50%",
          top: crestTop,
          width: crestWidth,
          height: crestHeight,
          transform: "translateX(-50%)",
          filter: `drop-shadow(0 6px 16px ${palette.glow})`,
        }}
        viewBox="0 0 180 84"
      >
        <ellipse cx="90" cy="68" rx="44" ry="8" fill="rgba(0,0,0,.12)" />
        <path d="M58 24 C 68 4, 84 6, 90 20 C 96 6, 112 4, 122 24 L 104 38 L 90 24 L 76 38 Z" fill={`url(#${ids.bow}-main)`} />
        <circle cx="90" cy="29" r="7" fill={`url(#${ids.berry}-main)`} />
        {withBells ? (
          <>
            <path
              d="M72 38 C 60 38, 50 48, 50 60 C 50 73, 60 82, 74 82 C 88 82, 98 72, 98 60 C 98 48, 88 38, 76 38 Z"
              fill={`url(#${ids.bell}-main)`}
            />
            <path
              d="M108 38 C 120 38, 130 48, 130 60 C 130 73, 120 82, 106 82 C 92 82, 82 72, 82 60 C 82 48, 92 38, 104 38 Z"
              fill={`url(#${ids.bell}-main)`}
            />
            <path d="M58 48 Q74 58 90 48" stroke={palette.bellDark} strokeWidth="3" fill="none" opacity="0.52" />
            <path d="M90 48 Q106 58 122 48" stroke={palette.bellDark} strokeWidth="3" fill="none" opacity="0.52" />
            <circle cx="74" cy="72" r="4.8" fill={palette.bellDark} />
            <circle cx="106" cy="72" r="4.8" fill={palette.bellDark} />
            <ellipse cx="68" cy="50" rx="10" ry="12" fill={`url(#${ids.bellShine}-main)`} />
            <ellipse cx="98" cy="50" rx="10" ry="12" fill={`url(#${ids.bellShine}-main)`} />
          </>
        ) : (
          <>
            <ellipse cx="72" cy="53" rx="18" ry="7" fill={`url(#${ids.pine}-main)`} transform="rotate(16 72 53)" />
            <ellipse cx="108" cy="53" rx="18" ry="7" fill={`url(#${ids.pine}-main)`} transform="rotate(-16 108 53)" />
            <circle cx="86" cy="56" r="5" fill={`url(#${ids.berry}-main)`} />
            <circle cx="96" cy="56" r="5" fill={`url(#${ids.berry}-main)`} />
          </>
        )}
      </svg>

      {renderCornerCluster("left")}
      {renderCornerCluster("right")}
      {renderCornerCluster("left", true)}
      {renderCornerCluster("right", true)}
    </div>
  );
}

function buildThreadMetaMap(
  messages: MessageRow[],
  readRows: ThreadReadRow[],
  currentUserId: string
): Map<
  string,
  {
    lastSenderId: string;
    lastContent: string;
    lastTime: string;
    unread: number;
  }
> {
  const lastReadByThread = new Map<string, number>();

  for (const row of readRows) {
    lastReadByThread.set(
      createThreadKey(row.group_id, row.thread_giver_id, row.thread_receiver_id),
      new Date(row.last_read_at).getTime()
    );
  }

  const metaByThread = new Map<
    string,
    {
      lastSenderId: string;
      lastContent: string;
      lastTime: string;
      unread: number;
    }
  >();

  for (const message of messages) {
    const threadKey = createThreadKey(
      message.group_id,
      message.thread_giver_id,
      message.thread_receiver_id
    );
    const lastReadAt = lastReadByThread.get(threadKey) ?? 0;
    const messageTime = new Date(message.created_at).getTime();
    const isUnread = message.sender_id !== currentUserId && messageTime > lastReadAt;
    const existingMeta = metaByThread.get(threadKey);

    // Messages are loaded newest-first, so the first entry becomes the preview.
    if (!existingMeta) {
      metaByThread.set(threadKey, {
        lastSenderId: message.sender_id,
        lastContent: message.content,
        lastTime: formatThreadTime(message.created_at),
        unread: isUnread ? 1 : 0,
      });
      continue;
    }

    if (isUnread) {
      existingMeta.unread = Math.min(existingMeta.unread + 1, 9);
    }
  }

  return metaByThread;
}

function applyMessageToThreads(
  currentThreads: Thread[],
  message: MessageRow,
  currentUserId: string,
  activeThread: Thread | null
): { matched: boolean; threads: Thread[] } {
  const targetKey = createThreadKey(
    message.group_id,
    message.thread_giver_id,
    message.thread_receiver_id
  );
  const activeThreadKey = activeThread
    ? createThreadKey(activeThread.group_id, activeThread.giver_id, activeThread.receiver_id)
    : null;

  let matched = false;

  const threads = currentThreads.map((thread) => {
    const threadKey = createThreadKey(thread.group_id, thread.giver_id, thread.receiver_id);

    if (threadKey !== targetKey) {
      return thread;
    }

    matched = true;

    return {
      ...thread,
      last_message: createPreviewText(
        message.sender_id,
        currentUserId,
        thread.other_name,
        message.content
      ),
      last_time: formatThreadTime(message.created_at),
      unread:
        activeThreadKey === targetKey || message.sender_id === currentUserId
          ? 0
          : Math.min(thread.unread + 1, 9),
    };
  });

  return { matched, threads };
}

export default function SecretSantaChatPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("all");
  const [threadListMessage, setThreadListMessage] = useState<string | null>(null);
  const [threadMessage, setThreadMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLElement | null>(null);
  const activeThreadRef = useRef<Thread | null>(null);
  const userIdRef = useRef<string | null>(null);
  const loadThreadsRef = useRef<() => Promise<void>>(null);
  const hasLoadedThreadsRef = useRef(false);

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/secret-santa");
    router.prefetch("/wishlist");
  }, [router]);

  useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const markAsRead = useCallback(
    async (thread: Thread, uid: string) => {
      await supabase.from("thread_reads").upsert(
        {
          user_id: uid,
          group_id: thread.group_id,
          thread_giver_id: thread.giver_id,
          thread_receiver_id: thread.receiver_id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "user_id,group_id,thread_giver_id,thread_receiver_id" }
      );
    },
    [supabase]
  );

  // Load threads on mount and subscribe to live updates.
  useEffect(() => {
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const loadThreads = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        clearClientSnapshots(CHAT_PAGE_SNAPSHOT_STORAGE_PREFIX);
        router.push("/login");
        return;
      }
      const user = session.user;
      setUserId(user.id);

      if (!hasLoadedThreadsRef.current) {
        const cachedChat = readClientSnapshot(
          getChatPageSnapshotStorageKey(user.id),
          user.id,
          isChatPageSnapshot
        );

        if (cachedChat) {
          const cachedCurrentThreads = cachedChat.threads.filter(isCurrentChatThread);
          setThreads(cachedCurrentThreads);
          if (!activeThreadRef.current) {
            setActiveThread(pickDefaultThread(cachedCurrentThreads));
          }
          setThreadListMessage(null);
          hasLoadedThreadsRef.current = true;
          setLoading(false);
        }
      }

      const { data: memberRows, error: membershipsError } = await supabase
        .from("group_members").select("group_id")
        .eq("user_id", user.id).eq("status", "accepted");

      if (membershipsError) {
        setThreadListMessage("We could not load your chats. Please refresh the page.");
        setThreads([]);
        hasLoadedThreadsRef.current = true;
        setLoading(false);
        return;
      }

      const memberships = (memberRows || []) as MembershipRow[];
      const groupIds = [...new Set(memberships.map((row) => row.group_id))];
      if (groupIds.length === 0) {
        setThreadListMessage(null);
        setThreads([]);
        writeClientSnapshot(getChatPageSnapshotStorageKey(user.id), {
          createdAt: Date.now(),
          threads: [],
          userId: user.id,
        });
        hasLoadedThreadsRef.current = true;
        setLoading(false);
        return;
      }

      const [
        { data: groupsData, error: groupsError },
        { data: giverAssignments, error: giverAssignmentsError },
        { data: receiverAssignments, error: receiverAssignmentsError },
        { data: allMessages, error: messagesError },
        { data: readTimestamps, error: readTimestampsError },
      ] = await Promise.all([
        supabase.from("groups").select("id, name, event_date").in("id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("giver_id", user.id).in("group_id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("receiver_id", user.id).in("group_id", groupIds),
        supabase
          .from("messages")
          .select("group_id, thread_giver_id, thread_receiver_id, sender_id, content, created_at")
          .in("group_id", groupIds)
          .order("created_at", { ascending: false })
          .limit(CHAT_THREAD_MESSAGE_SCAN_LIMIT),
        supabase
          .from("thread_reads")
          .select("group_id, thread_giver_id, thread_receiver_id, last_read_at")
          .eq("user_id", user.id)
          .in("group_id", groupIds),
      ]);

      if (
        groupsError ||
        giverAssignmentsError ||
        receiverAssignmentsError ||
        messagesError ||
        readTimestampsError
      ) {
        setThreadListMessage("We could not load your chats. Please refresh the page.");
        setThreads([]);
        hasLoadedThreadsRef.current = true;
        setLoading(false);
        return;
      }

      const giverRows = (giverAssignments || []) as AssignmentRow[];
      const receiverRows = (receiverAssignments || []) as AssignmentRow[];
      const receiverUserIds = giverRows.map((assignment) => assignment.receiver_id).filter(Boolean);
      const allUserIds = [...new Set(receiverUserIds)];

      let memberNicknames: MemberNicknameRow[] = [];
      if (allUserIds.length > 0) {
        const { data, error: nicknamesError } = await supabase.from("group_members").select("group_id, user_id, nickname")
          .in("user_id", allUserIds).in("group_id", groupIds).eq("status", "accepted");

        if (!nicknamesError) {
          memberNicknames = (data || []) as MemberNicknameRow[];
        }
      }

      const groupNameById = new Map(
        ((groupsData || []) as GroupRow[]).map((group) => [group.id, group.name || "Unknown"])
      );
      const groupGiftDateById = new Map(
        ((groupsData || []) as GroupRow[]).map((group) => [group.id, group.event_date || ""])
      );
      const currentChatGroupIds = new Set(
        ((groupsData || []) as GroupRow[])
          .filter((group) => !isGroupInHistory(group.event_date))
          .map((group) => group.id)
      );
      const receiverNameByGroupUser = new Map(
        memberNicknames.map((member) => [
          createGroupUserKey(member.group_id, member.user_id),
            member.nickname || "Member",
        ])
      );
      const threadMetaByKey = buildThreadMetaMap(
        ((allMessages || []) as MessageRow[]),
        ((readTimestamps || []) as ThreadReadRow[]),
        user.id
      );

      const buildThreads: Thread[] = [];

      for (const a of giverRows) {
        if (!currentChatGroupIds.has(a.group_id)) {
          continue;
        }

        const name =
          receiverNameByGroupUser.get(createGroupUserKey(a.group_id, a.receiver_id)) ||
            "Member";
        const threadMeta = threadMetaByKey.get(
          createThreadKey(a.group_id, a.giver_id, a.receiver_id)
        );
        buildThreads.push({
          group_id: a.group_id,
          group_name: groupNameById.get(a.group_id) || "Unknown",
          group_gift_date: groupGiftDateById.get(a.group_id) || "",
          giver_id: a.giver_id,
          receiver_id: a.receiver_id,
          other_name: name,
          role: "giver",
          last_message: threadMeta
            ? createPreviewText(threadMeta.lastSenderId, user.id, name, threadMeta.lastContent)
            : "No messages yet - say hi!",
          last_time: threadMeta?.lastTime || "",
          unread: threadMeta?.unread || 0,
        });
      }

      for (const a of receiverRows) {
        if (!currentChatGroupIds.has(a.group_id)) {
          continue;
        }

        const threadMeta = threadMetaByKey.get(
          createThreadKey(a.group_id, a.giver_id, a.receiver_id)
        );
        buildThreads.push({
          group_id: a.group_id,
          group_name: groupNameById.get(a.group_id) || "Unknown",
          group_gift_date: groupGiftDateById.get(a.group_id) || "",
          giver_id: a.giver_id,
          receiver_id: a.receiver_id,
          other_name: "Secret Santa",
          role: "receiver",
          last_message: threadMeta
            ? createPreviewText(
                threadMeta.lastSenderId,
                user.id,
                "Secret Santa",
                threadMeta.lastContent
              )
            : "No messages yet",
          last_time: threadMeta?.lastTime || "",
          unread: threadMeta?.unread || 0,
        });
      }

      const currentActiveThread = activeThreadRef.current;
      const nextActiveThread = currentActiveThread
        ? buildThreads.find(
            (thread) =>
              thread.group_id === currentActiveThread.group_id &&
              thread.giver_id === currentActiveThread.giver_id &&
              thread.receiver_id === currentActiveThread.receiver_id
          ) || null
        : null;

      setThreads(buildThreads);
      setThreadListMessage(null);
      hasLoadedThreadsRef.current = true;
      writeClientSnapshot(getChatPageSnapshotStorageKey(user.id), {
        createdAt: Date.now(),
        threads: buildThreads,
        userId: user.id,
      });

      if (currentActiveThread && !nextActiveThread) {
        setActiveThread(pickDefaultThread(buildThreads));
        setMessages([]);
      } else if (nextActiveThread) {
        setActiveThread(nextActiveThread);
      } else if (!currentActiveThread) {
        setActiveThread(pickDefaultThread(buildThreads));
      }

      setLoading(false);
    };

    loadThreadsRef.current = loadThreads;

    void loadThreads();

    const scheduleThreadsReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      // Reset-draw and membership updates can emit several row events in one
      // burst. A short debounce keeps the list synced without overfetching.
      reloadTimer = setTimeout(() => {
        void loadThreadsRef.current?.();
      }, 120);
    };

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const refreshThreadsIfVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleThreadsReload();
      }
    };

    window.addEventListener("focus", refreshThreadsIfVisible);
    document.addEventListener("visibilitychange", refreshThreadsIfVisible);
    pollInterval = setInterval(refreshThreadsIfVisible, CHAT_THREAD_FALLBACK_POLL_MS);

    return () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      window.removeEventListener("focus", refreshThreadsIfVisible);
      document.removeEventListener("visibilitychange", refreshThreadsIfVisible);
    };
  }, [supabase, router]);

  // Load messages and subscribe to live updates for the active thread.
  useEffect(() => {
    if (!activeThread) return;

    let isMounted = true;

    const loadMessages = async () => {
      setMessagesLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("group_id", activeThread.group_id)
        .eq("thread_giver_id", activeThread.giver_id)
        .eq("thread_receiver_id", activeThread.receiver_id)
        .order("created_at", { ascending: false })
        .limit(CHAT_ACTIVE_THREAD_MESSAGE_LIMIT);

      if (error) {
        // Keep the chat open and explain the failure in the UI instead of
        // sending users to the browser console for basic load issues.
        if (isMounted) {
          setThreadMessage("We could not load messages. Try reopening this chat.");
          setMessagesLoading(false);
        }
        return;
      }

      if (isMounted) {
        setThreadMessage(null);
        setMessages([...(data || [])].reverse() as Message[]);
        setMessagesLoading(false);
        setTimeout(scrollToBottom, 50);
      }
    };

    void loadMessages();

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const refreshMessagesIfVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadMessages();
    };

    const channel = supabase
      .channel(`chat-live-${activeThread.group_id}-${activeThread.giver_id}-${activeThread.receiver_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${activeThread.group_id}`,
        },
        (payload) => {
          if (!isMounted) return;

          const currentThread = activeThreadRef.current;
          const changedMessage =
            payload.eventType === "DELETE"
              ? (payload.old as Partial<MessageRow>)
              : (payload.new as Partial<MessageRow>);

          if (
            !currentThread ||
            changedMessage.thread_giver_id !== currentThread.giver_id ||
            changedMessage.thread_receiver_id !== currentThread.receiver_id
          ) {
            return;
          }

          if (payload.eventType !== "INSERT") {
            void loadMessages();
            void loadThreadsRef.current?.();
            return;
          }

          const nextMessage = payload.new as MessageRow & { id: string };

          setMessages((currentMessages) => {
            let removedOptimisticCopy = false;
            const withoutOptimisticCopy = currentMessages.filter((message) => {
              if (
                !removedOptimisticCopy &&
                message.id.startsWith("temp-") &&
                message.sender_id === nextMessage.sender_id &&
                message.content === nextMessage.content
              ) {
                removedOptimisticCopy = true;
                return false;
              }

              return true;
            });

            if (withoutOptimisticCopy.find((message) => message.id === nextMessage.id)) {
              return withoutOptimisticCopy;
            }

            const nextMessages = [
              ...withoutOptimisticCopy,
              {
                id: nextMessage.id,
                sender_id: nextMessage.sender_id,
                content: nextMessage.content,
                created_at: nextMessage.created_at,
              },
            ];

            return nextMessages.slice(-CHAT_ACTIVE_THREAD_MESSAGE_LIMIT);
          });
          setThreads((currentThreads) => {
            const currentUserId = userIdRef.current;

            if (!currentUserId) {
              return currentThreads;
            }

            return applyMessageToThreads(
              currentThreads,
              nextMessage,
              currentUserId,
              currentThread
            ).threads;
          });
          setTimeout(scrollToBottom, 50);

          if (userId) {
            void markAsRead(currentThread, userId);
          }
        }
      )
      .subscribe();

    window.addEventListener("focus", refreshMessagesIfVisible);
    document.addEventListener("visibilitychange", refreshMessagesIfVisible);
    pollInterval = setInterval(refreshMessagesIfVisible, CHAT_ACTIVE_THREAD_FALLBACK_POLL_MS);

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      window.removeEventListener("focus", refreshMessagesIfVisible);
      document.removeEventListener("visibilitychange", refreshMessagesIfVisible);
      supabase.removeChannel(channel);
    };
  }, [activeThread, supabase, scrollToBottom, markAsRead, userId]);

  const handleSend = async () => {
    if (!activeThread || !msgInput.trim() || !userId) return;
    const content = sanitize(msgInput);
    if (!content) return;

    setMsgInput("");
    const tempId = `temp-${Date.now()}`;
    const optimisticCreatedAt = new Date().toISOString();

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: userId,
        content,
        created_at: optimisticCreatedAt,
      },
    ]);
    setThreads((currentThreads) =>
      applyMessageToThreads(
        currentThreads,
        {
          group_id: activeThread.group_id,
          thread_giver_id: activeThread.giver_id,
          thread_receiver_id: activeThread.receiver_id,
          sender_id: userId,
          content,
          created_at: optimisticCreatedAt,
        },
        userId,
        activeThreadRef.current
      ).threads
    );
    setTimeout(scrollToBottom, 30);

    const result = await sendMessage(
      activeThread.group_id,
      activeThread.giver_id,
      activeThread.receiver_id,
      content
    );

    if (!result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setThreadMessage(result.message || "We could not send your message. Please try again.");
      void loadThreadsRef.current?.();
      return;
    }

    setThreadMessage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const openThread = (t: Thread) => {
    // Clear the previous thread immediately so we do not flash stale messages
    // while the next conversation history is loading.
    setMessages([]);
    setMessagesLoading(true);
    setThreadMessage(null);
    setActiveThread(t);
    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.group_id === t.group_id &&
        thread.giver_id === t.giver_id &&
        thread.receiver_id === t.receiver_id
          ? { ...thread, unread: 0 }
          : thread
      )
    );

    if (userId) {
      void markAsRead(t, userId);
    }

    if (window.innerWidth < 1280) {
      window.setTimeout(() => {
        chatPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  const giverThreads = useMemo(() => threads.filter((t) => t.role === "giver"), [threads]);
  const receiverThreads = useMemo(() => threads.filter((t) => t.role === "receiver"), [threads]);
  if (loading) return <ChatSkeleton />;

  const selectedThread = activeThread;
  const selectedIsGiver = selectedThread?.role === "giver";
  const selectedTiming = getGiftTimingInfo(selectedThread?.group_gift_date || "");
  const selectedThreadKey = selectedThread
    ? createThreadKey(selectedThread.group_id, selectedThread.giver_id, selectedThread.receiver_id)
    : "";
  const showGiverThreads = threadFilter === "all" || threadFilter === "giver";
  const showReceiverThreads = threadFilter === "all" || threadFilter === "receiver";
  const promptChips = selectedIsGiver
    ? ["Ask about size", "Ask about color", "Check delivery timing"]
    : ["Share a preference", "Send thanks", "Clarify timing"];
  const filterOptions: { label: string; value: ThreadFilter }[] = [
    { label: "All", value: "all" },
    { label: "My giftees", value: "giver" },
    { label: "My Santa", value: "receiver" },
  ];
  const statusSteps = [
    { label: "Planning", active: selectedTiming.phase === "planning" },
    { label: "Gift day", active: selectedTiming.phase === "gift-day" },
    { label: "Wrap-up", active: selectedTiming.phase === "wrap-up" },
    { label: "History", active: selectedTiming.phase === "history" },
  ];

  const applyPromptChip = (chip: string) => {
    setMsgInput((current) => {
      const next = current.trim() ? `${current.trim()} ${chip.toLowerCase()}: ` : `${chip}: `;
      return next.slice(0, 500);
    });
  };

  const renderThreadButton = (thread: Thread) => {
    const threadKey = createThreadKey(thread.group_id, thread.giver_id, thread.receiver_id);
    const isActive = threadKey === selectedThreadKey;
    const isGiverThread = thread.role === "giver";
    const accent = isGiverThread ? CHAT_GREEN : CHAT_RED;
    const threadTitle = isGiverThread ? `To ${thread.other_name}` : "From your Secret Santa";
    const threadLabel = isGiverThread ? "You are their Santa" : "Your Santa";

    return (
      <button
        key={threadKey}
        type="button"
        onClick={() => openThread(thread)}
        className="group w-full rounded-2xl p-3 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          background: isActive
            ? "linear-gradient(135deg,rgba(72,102,78,.12),rgba(255,255,255,.94))"
            : "rgba(255,255,255,.78)",
          border: isActive ? `1px solid ${accent}` : CHAT_BORDER_SOFT,
          boxShadow: isActive ? "0 12px 28px rgba(72,102,78,.10)" : "0 8px 18px rgba(46,52,50,.035)",
          color: CHAT_HEADER_TEXT,
          outlineColor: accent,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black"
            style={{
              background: isGiverThread ? "rgba(252,206,114,.26)" : "rgba(164,60,63,.10)",
              color: accent,
            }}
          >
            {isGiverThread ? thread.other_name.slice(0, 1).toUpperCase() : "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-black">{threadTitle}</span>
              {thread.unread > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-black text-white" style={{ background: CHAT_RED }}>
                  {thread.unread}
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-extrabold" style={{ color: CHAT_TEXT_SUBTLE }}>
              Group: {thread.group_name}
            </span>
            <span className="mt-1 block truncate text-[11px] font-bold" style={{ color: CHAT_TEXT_MUTED }}>
              {thread.last_message}
            </span>
            <span className="mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black" style={{ background: `${accent}18`, color: accent }}>
              {threadLabel}
            </span>
          </span>
        </div>
      </button>
    );
  };

  return (
    <main
      data-testid="secret-santa-chat-page"
      className="relative overflow-x-hidden rounded-none"
      style={{
        color: CHAT_HEADER_TEXT,
        fontFamily: "'Be Vietnam Pro','Nunito',sans-serif",
      }}
    >
      <style>{`
        .chat-scrollbar::-webkit-scrollbar { width: 8px; }
        .chat-scrollbar::-webkit-scrollbar-track { background: rgba(72,102,78,.08); border-radius: 999px; }
        .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(72,102,78,.35); border-radius: 999px; }
      `}</style>

      <div className="relative mx-auto flex w-full max-w-376 flex-col gap-4">
        <section
          className="relative overflow-hidden rounded-4xl p-5 sm:p-6"
          style={{
            background: CHAT_SURFACE_STRONG,
            border: CHAT_BORDER,
            boxShadow: "0 24px 70px rgba(72,102,78,.10)",
          }}
        >
          <FestiveTrim tone="neutral" compact />
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: CHAT_PAGE_BACKGROUND }}
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "#7285a1" }}>
                Private gift chats
              </p>
              <h2 className="mt-2 text-[2.3rem] font-black leading-none tracking-normal sm:text-[3.1rem]" style={{ color: CHAT_GREEN, fontFamily: "'Fredoka','Nunito',sans-serif" }}>
                Secret Messages
              </h2>
              <p className="mt-2 text-sm font-extrabold" style={{ color: "#526174" }}>
                Each thread shows the group and whether you are writing to your giftee or your Secret Santa.
              </p>
            </div>
          </div>
        </section>

        {threadListMessage && (
          <section className="rounded-3xl px-5 py-4 text-sm font-bold" style={{ background: "rgba(164,60,63,.10)", border: "1px solid rgba(164,60,63,.18)", color: CHAT_RED }}>
            {threadListMessage}
          </section>
        )}

        <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_270px]">
            <aside className="rounded-4xl p-4" style={{ background: CHAT_PANEL_BACKGROUND, border: CHAT_BORDER, boxShadow: "0 18px 44px rgba(46,52,50,.06)" }}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "#7285a1" }}>
                Mystery mailbox
              </p>
              <div className="mt-2 flex items-start gap-3">
                <EnvelopeLineIcon className="mt-1 h-6 w-6 shrink-0" />
                <div>
                  <h2 className="text-xl font-black">Gift chats</h2>
                  <p className="mt-1 text-xs font-bold leading-5" style={{ color: CHAT_TEXT_MUTED }}>
                    Pick a thread and keep the group context visible while you chat.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {filterOptions.map((option) => {
                  const active = threadFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setThreadFilter(option.value)}
                      className="rounded-full px-3 py-2 text-[11px] font-black transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{
                        background: active ? CHAT_GREEN : "rgba(252,206,114,.20)",
                        border: active ? "1px solid rgba(72,102,78,.22)" : "1px solid rgba(123,89,2,.12)",
                        color: active ? "#fffefa" : "#7b5902",
                        outlineColor: CHAT_GREEN,
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="chat-scrollbar mt-5 max-h-145 space-y-5 overflow-y-auto pr-1">
                {showGiverThreads && (
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: CHAT_GREEN }}>
                        My giftees
                      </p>
                      <span className="text-xs font-black">{giverThreads.length}</span>
                    </div>
                    <div className="space-y-2">
                      {giverThreads.length > 0 ? (
                        giverThreads.map(renderThreadButton)
                      ) : (
                        <p className="rounded-2xl px-3 py-3 text-xs font-bold leading-5" style={{ background: CHAT_SURFACE_MUTED, color: CHAT_TEXT_MUTED }}>
                          Giftee chats appear after names are drawn.
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {showReceiverThreads && (
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: CHAT_RED }}>
                        My Santa
                      </p>
                      <span className="text-xs font-black">{receiverThreads.length}</span>
                    </div>
                    <div className="space-y-2">
                      {receiverThreads.length > 0 ? (
                        receiverThreads.map(renderThreadButton)
                      ) : (
                        <p className="rounded-2xl px-3 py-3 text-xs font-bold leading-5" style={{ background: CHAT_SURFACE_MUTED, color: CHAT_TEXT_MUTED }}>
                          Messages from your Santa appear here when they start a private thread.
                        </p>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </aside>

            <section ref={chatPanelRef} className="flex min-h-162.5 flex-col overflow-hidden rounded-4xl" style={{ background: CHAT_PANEL_BACKGROUND, border: CHAT_BORDER, boxShadow: "0 18px 44px rgba(46,52,50,.06)" }}>
              <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: "rgba(72,102,78,.12)" }}>
                <div className="flex min-w-0 gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: "rgba(252,206,114,.28)", color: CHAT_RED }}>
                    <EnvelopeLineIcon className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black" style={{ color: CHAT_GREEN, fontFamily: "'Fredoka','Nunito',sans-serif" }}>
                      {selectedThread
                        ? selectedIsGiver
                          ? `To ${selectedThread.other_name}`
                          : "From your Secret Santa"
                        : "Choose a chat"}
                    </h2>
                    <p className="mt-1 text-xs font-black" style={{ color: CHAT_TEXT_MUTED }}>
                      Group: {selectedThread?.group_name || "Select a gift chat"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full px-3 py-1.5 text-[11px] font-black text-white" style={{ background: selectedIsGiver ? CHAT_GREEN : CHAT_RED }}>
                        {selectedIsGiver ? "You are their Secret Santa" : "Replying to your Secret Santa"}
                      </span>
                      <span className="rounded-full px-3 py-1.5 text-[11px] font-black" style={{ background: "rgba(72,102,78,.10)", color: CHAT_GREEN }}>
                        Identity protected
                      </span>
                      <span className="rounded-full px-3 py-1.5 text-[11px] font-black" style={{ background: "rgba(164,60,63,.10)", color: CHAT_RED }}>
                        {selectedTiming.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl px-4 py-3 text-xs font-extrabold leading-5" style={{ background: "rgba(252,206,114,.24)", color: "#7b5902", border: "1px solid rgba(123,89,2,.12)" }}>
                  {selectedTiming.detail}
                </div>
              </div>

              <div className="chat-scrollbar flex min-h-105 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-5" style={{ background: "linear-gradient(180deg,rgba(249,250,248,.78),rgba(255,255,255,.94))" }}>
                {threadMessage && (
                  <div className="rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: "rgba(164,60,63,.10)", border: "1px solid rgba(164,60,63,.18)", color: CHAT_RED }}>
                    {threadMessage}
                  </div>
                )}

                {messagesLoading ? (
                  <div className="m-auto w-full max-w-md space-y-3" aria-live="polite">
                    <p className="text-center text-sm font-black" style={{ color: CHAT_TEXT_MUTED }}>
                      Loading messages for {selectedThread?.group_name || "this thread"}...
                    </p>
                    <div className="h-16 rounded-3xl" style={{ background: "rgba(72,102,78,.08)" }} />
                    <div className="ml-auto h-20 w-4/5 rounded-3xl" style={{ background: "rgba(72,102,78,.14)" }} />
                    <div className="h-16 w-3/4 rounded-3xl" style={{ background: "rgba(72,102,78,.08)" }} />
                  </div>
                ) : !selectedThread ? (
                  <div className="m-auto max-w-sm text-center">
                    <ChatLineIcon className="mx-auto h-10 w-10" />
                    <p className="mt-4 text-xl font-black">Choose a gift chat</p>
                    <p className="mt-2 text-sm font-semibold leading-6" style={{ color: CHAT_TEXT_MUTED }}>
                      Pick a giftee chat or Santa thread to start messaging.
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="m-auto max-w-sm text-center">
                    <EnvelopeLineIcon className="mx-auto h-12 w-12" />
                    <p className="mt-4 text-xl font-black">No messages yet</p>
                    <p className="mt-2 text-sm font-semibold leading-6" style={{ color: CHAT_TEXT_MUTED }}>
                      {selectedIsGiver
                        ? "Ask about sizes, colors, delivery, or hints while staying anonymous."
                        : "Share preferences, answer questions, or send a thank-you note."}
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === userId;
                    const isTemp = msg.id.startsWith("temp-");
                    const messageAuthor = isMine
                      ? selectedIsGiver
                        ? "You as their Santa"
                        : "You"
                      : selectedIsGiver
                        ? selectedThread.other_name
                        : "Your Secret Santa";

                    return (
                      <div
                        key={msg.id}
                        className={`flex max-w-[78%] flex-col rounded-3xl px-4 py-3 text-[14px] font-semibold leading-6 shadow-sm ${
                          isMine ? "self-end rounded-br-md" : "self-start rounded-bl-md"
                        }`}
                        style={{
                          background: isMine
                            ? `linear-gradient(135deg,${CHAT_GREEN},#315741)`
                            : "rgba(255,255,255,.95)",
                          border: isMine ? "1px solid rgba(72,102,78,.18)" : CHAT_BORDER_SOFT,
                          color: isMine ? "#fffefa" : CHAT_HEADER_TEXT,
                          opacity: isTemp ? 0.72 : 1,
                        }}
                      >
                        <span className="mb-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: isMine ? "rgba(255,255,255,.78)" : CHAT_TEXT_SUBTLE }}>
                          {messageAuthor} - Group: {selectedThread.group_name}
                        </span>
                        <span style={{ wordBreak: "break-word" }}>{msg.content}</span>
                        <span className="mt-2 text-[11px] font-bold" style={{ color: isMine ? "rgba(255,255,255,.65)" : CHAT_TEXT_MUTED }}>
                          {isTemp
                            ? "Sending..."
                            : new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t p-4 sm:p-5" style={{ background: "rgba(255,255,255,.82)", borderColor: "rgba(72,102,78,.12)" }}>
                <div className="mb-3 flex flex-wrap gap-2">
                  {promptChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      disabled={!selectedThread}
                      onClick={() => applyPromptChip(chip)}
                      className="rounded-full px-3 py-1.5 text-[11px] font-black transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                      style={{ background: "rgba(72,102,78,.08)", color: CHAT_GREEN, border: "1px solid rgba(72,102,78,.10)", outlineColor: CHAT_GREEN }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!selectedThread}
                    aria-label={
                      selectedThread
                        ? `Message composer for ${selectedThread.group_name}`
                        : "Message composer"
                    }
                    placeholder={
                      selectedThread
                        ? selectedIsGiver
                          ? `Ask ${selectedThread.other_name} about their gift...`
                          : `Reply to your Santa in ${selectedThread.group_name}...`
                        : "Choose a chat first..."
                    }
                    maxLength={500}
                    className="min-h-12 w-full rounded-full px-5 text-[15px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
                    style={{
                      background: "#f9faf8",
                      border: CHAT_BORDER_SOFT,
                      color: CHAT_HEADER_TEXT,
                      fontFamily: "inherit",
                      outlineColor: CHAT_GREEN,
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!selectedThread || !msgInput.trim()}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-black transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
                    style={{
                      background: msgInput.trim() && selectedThread ? CHAT_GREEN : "rgba(72,102,78,.12)",
                      color: msgInput.trim() && selectedThread ? "#fffefa" : "rgba(46,52,50,.48)",
                      border: "1px solid rgba(72,102,78,.12)",
                      fontFamily: "inherit",
                      boxShadow: msgInput.trim() && selectedThread ? "0 16px 28px rgba(72,102,78,.18)" : "none",
                      outlineColor: CHAT_GREEN,
                    }}
                  >
                    Send
                    <ArrowRightIcon />
                  </button>
                </div>
              </div>
            </section>

            <aside className="rounded-4xl p-4 xl:sticky xl:top-24 xl:self-start" style={{ background: CHAT_PANEL_BACKGROUND, border: CHAT_BORDER, boxShadow: "0 18px 44px rgba(46,52,50,.06)" }}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "#7285a1" }}>
                Gift timing
              </p>
              <div className="mt-2 flex items-start gap-3">
                <CalendarLineIcon className="mt-1 h-6 w-6 shrink-0" />
                <div>
                  <h2 className="text-xl font-black" style={{ color: CHAT_GREEN }}>
                    Chat timing
                  </h2>
                  <p className="mt-1 text-xs font-bold leading-5" style={{ color: CHAT_TEXT_MUTED }}>
                    See whether this thread is before gift day, on gift day, or in wrap-up.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-7 gap-2">
                {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => {
                  const active = day === selectedTiming.highlightedDay;
                  return (
                    <span
                      key={day}
                      className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-black"
                      style={{
                        background: active ? CHAT_RED : "rgba(72,102,78,.08)",
                        color: active ? "#fffefa" : "#61736a",
                      }}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>

              <div className="mt-5 rounded-3xl p-4" style={{ background: CHAT_SURFACE_MUTED, border: CHAT_BORDER_SOFT }}>
                <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: selectedTiming.phase === "wrap-up" ? CHAT_RED : CHAT_GREEN }}>
                  {selectedTiming.chip}
                </p>
                <p className="mt-2 text-sm font-black">{selectedTiming.label}</p>
                <p className="mt-1 text-xs font-bold leading-5" style={{ color: CHAT_TEXT_MUTED }}>
                  Gift date: {formatGroupDate(selectedThread?.group_gift_date || "")}
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {statusSteps.map((step) => (
                  <div key={step.label} className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ background: step.active ? "rgba(72,102,78,.10)" : "transparent" }}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: step.active ? CHAT_GREEN : "rgba(72,102,78,.20)" }} />
                    <span className="text-xs font-black" style={{ color: step.active ? CHAT_GREEN : CHAT_TEXT_MUTED }}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </aside>
        </section>
      </div>
    </main>
  );
}

