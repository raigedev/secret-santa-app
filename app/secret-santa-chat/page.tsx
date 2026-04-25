"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatSkeleton } from "@/app/components/PageSkeleton";
import { sendMessage } from "./chat-actions";

type Thread = {
  group_id: string;
  group_name: string;
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

const CHAT_PAGE_BACKGROUND =
  "radial-gradient(circle at 14% 8%,rgba(252,206,114,.3),transparent 24%),radial-gradient(circle at 88% 18%,rgba(164,60,63,.28),transparent 30%),radial-gradient(circle at 78% 84%,rgba(72,102,78,.32),transparent 34%),linear-gradient(180deg,#13160d 0%,#261214 50%,#10150f 100%)";
const CHAT_PANEL_BACKGROUND = "linear-gradient(145deg,rgba(255,248,240,.16),rgba(46,52,50,.74) 58%,rgba(72,102,78,.34))";
const CHAT_SURFACE_STRONG = "linear-gradient(180deg,rgba(255,248,240,.11),rgba(46,52,50,.66))";
const CHAT_SURFACE_MUTED = "rgba(46,52,50,.58)";
const CHAT_BORDER = "1px solid rgba(252,206,114,.2)";
const CHAT_BORDER_SOFT = "1px solid rgba(255,248,240,.14)";
const CHAT_TEXT_MUTED = "#d8ddd6";
const CHAT_TEXT_SUBTLE = "#aeb8ae";

function SantaMarkIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="10 5 140 145" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="80" cy="82" r="50" fill="#fde8e8" />
      <ellipse cx="80" cy="108" rx="38" ry="24" fill="#fff" />
      <ellipse cx="80" cy="102" rx="32" ry="16" fill="#fff" />
      <ellipse cx="66" cy="86" rx="12" ry="6" fill="#fff" />
      <ellipse cx="94" cy="86" rx="12" ry="6" fill="#fff" />
      <circle cx="80" cy="76" r="5" fill="#e8a8a8" />
      <ellipse cx="64" cy="66" rx="5" ry="6" fill="#2c1810" />
      <path d="M90 66 Q96 60 102 66" fill="none" stroke="#2c1810" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 58 C32 58 50 14 82 10 C114 6 128 58 128 58" fill="#c0392b" />
      <rect x="26" y="54" width="108" height="10" rx="5" fill="#fff" />
      <circle cx="86" cy="10" r="8" fill="#fff" />
    </svg>
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

function LockLineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="5.5" y="10" width="13" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13.4v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function DashboardIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M3.5 8.4 10 3.2l6.5 5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.4 8.2v7.1h9.2V8.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.4 15.3v-4.1h3.2v4.1" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, 500);
}

function createThreadKey(groupId: string, giverId: string, receiverId: string): string {
  return `${groupId}:${giverId}:${receiverId}`;
}

function createGroupUserKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
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
  const [msgInput, setMsgInput] = useState("");
  const [threadListMessage, setThreadListMessage] = useState<string | null>(null);
  const [threadMessage, setThreadMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeThreadRef = useRef<Thread | null>(null);
  const userIdRef = useRef<string | null>(null);
  const loadThreadsRef = useRef<() => Promise<void>>(null);

  useEffect(() => {
    router.prefetch("/dashboard");
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

  // â”€â”€â”€ Load threads on mount + real-time â”€â”€â”€
  useEffect(() => {
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const loadThreads = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const user = session.user;
      setUserId(user.id);

      const { data: memberRows, error: membershipsError } = await supabase
        .from("group_members").select("group_id")
        .eq("user_id", user.id).eq("status", "accepted");

      if (membershipsError) {
        setThreadListMessage("We could not load your chats. Please refresh the page.");
        setThreads([]);
        setLoading(false);
        return;
      }

      const memberships = (memberRows || []) as MembershipRow[];
      const groupIds = [...new Set(memberships.map((row) => row.group_id))];
      if (groupIds.length === 0) {
        setThreadListMessage(null);
        setThreads([]);
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
        supabase.from("groups").select("id, name").in("id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("giver_id", user.id).in("group_id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("receiver_id", user.id).in("group_id", groupIds),
        supabase.from("messages").select("group_id, thread_giver_id, thread_receiver_id, sender_id, content, created_at").in("group_id", groupIds).order("created_at", { ascending: false }),
        supabase.from("thread_reads").select("group_id, thread_giver_id, thread_receiver_id, last_read_at").eq("user_id", user.id),
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
        const name =
          receiverNameByGroupUser.get(createGroupUserKey(a.group_id, a.receiver_id)) ||
            "Member";
        const threadMeta = threadMetaByKey.get(
          createThreadKey(a.group_id, a.giver_id, a.receiver_id)
        );
        buildThreads.push({
          group_id: a.group_id,
          group_name: groupNameById.get(a.group_id) || "Unknown",
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
        const threadMeta = threadMetaByKey.get(
          createThreadKey(a.group_id, a.giver_id, a.receiver_id)
        );
        buildThreads.push({
          group_id: a.group_id,
          group_name: groupNameById.get(a.group_id) || "Unknown",
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

      if (currentActiveThread && !nextActiveThread) {
        setActiveThread(null);
        setMessages([]);
      } else if (nextActiveThread) {
        setActiveThread(nextActiveThread);
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

    const channel = supabase
      .channel("chat-threads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const currentUserId = userIdRef.current;

          if (!currentUserId) {
            return;
          }

          if (payload.eventType !== "INSERT") {
            scheduleThreadsReload();
            return;
          }

          const newMessage = payload.new as MessageRow;

          if (
            newMessage.thread_giver_id !== currentUserId &&
            newMessage.thread_receiver_id !== currentUserId
          ) {
            return;
          }

          let matchedExistingThread = false;

          setThreads((currentThreads) => {
            const result = applyMessageToThreads(
              currentThreads,
              newMessage,
              currentUserId,
              activeThreadRef.current
            );

            matchedExistingThread = result.matched;
            return result.threads;
          });

          if (!matchedExistingThread) {
            void loadThreadsRef.current?.();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        () => scheduleThreadsReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => scheduleThreadsReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => scheduleThreadsReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "thread_reads" },
        () => scheduleThreadsReload()
      )
      .subscribe();

    return () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  // â”€â”€â”€ Load messages + real-time for active thread â”€â”€â”€
  useEffect(() => {
    if (!activeThread) return;

    let isMounted = true;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("group_id", activeThread.group_id)
        .eq("thread_giver_id", activeThread.giver_id)
        .eq("thread_receiver_id", activeThread.receiver_id)
        .order("created_at", { ascending: true });

      if (error) {
        // Keep the chat open and explain the failure in the UI instead of
        // sending users to the browser console for basic load issues.
        setThreadMessage("We could not load messages. Try reopening this chat.");
        return;
      }

      if (isMounted) {
        setThreadMessage(null);
        setMessages((data || []) as Message[]);
        setTimeout(scrollToBottom, 50);
      }
    };

    void loadMessages();

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
            const withoutOptimisticCopy = currentMessages.filter(
              (message) =>
                !(message.id.startsWith("temp-") && message.sender_id === nextMessage.sender_id)
            );

            if (withoutOptimisticCopy.find((message) => message.id === nextMessage.id)) {
              return withoutOptimisticCopy;
            }

            return [
              ...withoutOptimisticCopy,
              {
                id: nextMessage.id,
                sender_id: nextMessage.sender_id,
                content: nextMessage.content,
                created_at: nextMessage.created_at,
              },
            ];
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

    return () => { isMounted = false; supabase.removeChannel(channel); };
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
  };

  const giverThreads = useMemo(() => threads.filter((t) => t.role === "giver"), [threads]);
  const receiverThreads = useMemo(() => threads.filter((t) => t.role === "receiver"), [threads]);
  const totalUnread = useMemo(
    () => threads.reduce((total, thread) => total + thread.unread, 0),
    [threads]
  );
  const uniqueGroupCount = useMemo(
    () => new Set(threads.map((thread) => thread.group_id)).size,
    [threads]
  );

  if (loading) return <ChatSkeleton />;

  if (activeThread) {
    const isGiver = activeThread.role === "giver";
    const accent = isGiver ? "#fcce72" : "#d7fadb";
    const accentDark = isGiver ? "#a43c3f" : "#48664e";
    const roleLabel = isGiver ? "You are gifting" : "Your mystery Santa";
    const recipientLabel = isGiver ? activeThread.other_name : "Secret Santa";
    const privacyCopy = isGiver
      ? `${activeThread.other_name} sees these messages from their Secret Santa, not your name.`
      : "Your Santa can message you here, but their name stays hidden.";
    const activeThreadDetails = [
      {
        label: isGiver ? "Recipient" : "Sender",
        value: isGiver ? activeThread.other_name : "Anonymous Santa",
      },
      {
        label: "Group",
        value: activeThread.group_name,
      },
      {
        label: "Visibility",
        value: isGiver ? "Your name stays hidden" : "Their name stays hidden",
      },
    ];
    const promptChips = isGiver
      ? ["Size", "Color", "Delivery", "Already owns"]
      : ["Wishlist", "Preference", "Timing", "Thank you"];

    return (
      <main
        className="relative min-h-screen overflow-hidden"
        style={{
          background: CHAT_PAGE_BACKGROUND,
          color: "#f8fafc",
          fontFamily: "'Be Vietnam Pro','Nunito',sans-serif",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.09),transparent_30%)]" />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-[1180px] flex-col px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={async () => {
                if (activeThread && userId) {
                  await markAsRead(activeThread, userId);
                  setThreads((currentThreads) =>
                    currentThreads.map((thread) =>
                      thread.group_id === activeThread.group_id &&
                      thread.giver_id === activeThread.giver_id &&
                      thread.receiver_id === activeThread.receiver_id
                        ? { ...thread, unread: 0 }
                        : thread
                    )
                  );
                }
                setActiveThread(null);
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold transition hover:-translate-y-0.5 sm:w-auto"
              style={{
                background: "linear-gradient(135deg,rgba(252,206,114,.18),rgba(46,52,50,.62))",
                border: "1px solid rgba(252,206,114,.24)",
                color: "#f3eee8",
                boxShadow: "0 14px 30px rgba(10,14,10,.18)",
              }}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "rgba(252,206,114,.18)", color: "#fcce72" }}>
                <ArrowRightIcon className="h-4 w-4 rotate-180" />
              </span>
              Back to chats
            </button>
            <div
              className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em]"
              style={{
                background: isGiver ? "rgba(252,206,114,.14)" : "rgba(215,250,219,.12)",
                border: isGiver ? "1px solid rgba(252,206,114,.2)" : "1px solid rgba(215,250,219,.16)",
                color: accent,
              }}
            >
              <LockLineIcon className="h-4 w-4" />
              {roleLabel}
            </div>
          </div>

          <section className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div
              className="flex min-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-[34px]"
              style={{
                background: CHAT_SURFACE_STRONG,
                border: CHAT_BORDER,
                boxShadow: "0 24px 60px rgba(46,52,50,.2)",
                backdropFilter: "blur(18px)",
              }}
            >
              <div className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px]"
                    style={{
                      background: `linear-gradient(135deg,${accent},${accentDark})`,
                      boxShadow: `0 14px 28px ${isGiver ? "rgba(252,206,114,.22)" : "rgba(215,250,219,.16)"}`,
                    }}
                  >
                    {isGiver ? <SantaMarkIcon className="h-9 w-9" /> : <ChatLineIcon className="h-6 w-6 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="mb-1 inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]"
                      style={{
                        background: isGiver ? "rgba(252,206,114,.16)" : "rgba(215,250,219,.12)",
                        color: accent,
                      }}
                    >
                      {roleLabel}
                    </div>
                    <h1 className="truncate text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                      {recipientLabel}
                    </h1>
                    <p className="mt-1 text-sm font-semibold text-slate-300">
                      {activeThread.group_name}
                    </p>
                  </div>
                </div>
                <div
                  className="rounded-[22px] px-4 py-3 text-sm font-bold leading-6 text-slate-200"
                  style={{
                    background: CHAT_SURFACE_MUTED,
                    border: CHAT_BORDER_SOFT,
                  }}
                >
                  {privacyCopy}
                </div>
              </div>

              <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                <div
                  className="flex min-h-[46vh] flex-col gap-3 overflow-y-auto rounded-[28px] p-4 sm:min-h-[54vh] sm:p-5"
                  style={{
                    background:
                      "linear-gradient(180deg,rgba(24,31,25,.58),rgba(20,24,21,.88))",
                    border: "1px solid rgba(252,206,114,.1)",
                  }}
                >
                  {threadMessage && (
                    <div
                      className="rounded-2xl px-4 py-3 text-sm font-bold"
                      style={{
                        background: "rgba(170,55,28,.16)",
                        border: "1px solid rgba(250,113,80,.22)",
                        color: "#fecaca",
                      }}
                    >
                      {threadMessage}
                    </div>
                  )}

                  {messages.length === 0 ? (
                    <div className="m-auto max-w-sm text-center">
                      <div
                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px]"
                        style={{
                          background: "rgba(255,255,255,.08)",
                          border: "1px solid rgba(255,255,255,.1)",
                        }}
                      >
                        <ChatLineIcon className="h-8 w-8 text-[#d8ddd6]" />
                      </div>
                      <p className="text-xl font-black tracking-[-0.03em]">No messages yet</p>
                      <p className="mt-2 text-sm leading-6" style={{ color: CHAT_TEXT_SUBTLE }}>
                        Start with a simple hint, size question, or delivery note.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender_id === userId;
                      const isTemp = msg.id.startsWith("temp-");
                      const messageAuthor = isMine
                        ? isGiver
                          ? "You as Secret Santa"
                          : "You"
                        : isGiver
                          ? activeThread.other_name
                          : "Secret Santa";

                      return (
                        <div
                          key={msg.id}
                          className={`flex max-w-[88%] flex-col rounded-[24px] px-4 py-3 text-[15px] leading-7 shadow-sm sm:max-w-[74%] ${
                            isMine ? "self-end rounded-br-md" : "self-start rounded-bl-md"
                          }`}
                          style={{
                            background: isMine
                              ? `linear-gradient(135deg,${accentDark},${accent})`
                              : "rgba(255,248,240,.1)",
                            border: isMine ? "1px solid rgba(255,255,255,.12)" : "1px solid rgba(255,255,255,.1)",
                            color: "#fff",
                            opacity: isTemp ? 0.72 : 1,
                          }}
                        >
                          <span className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] opacity-75">
                            {messageAuthor}
                          </span>
                          <span style={{ wordBreak: "break-word" }}>{msg.content}</span>
                          <span className="mt-2 text-[11px] font-bold opacity-60">
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
              </div>

              <div
                className="mt-auto flex flex-col gap-3 p-4 sm:flex-row sm:p-6"
                style={{
                  background: "rgba(255,248,240,.04)",
                  borderTop: "1px solid rgba(252,206,114,.1)",
                }}
              >
                <input
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isGiver ? `Ask ${activeThread.other_name} a private gift question...` : "Reply to your Santa..."}
                  maxLength={500}
                  className="min-h-12 w-full rounded-full px-5 text-[15px] font-semibold outline-none sm:flex-1"
                  style={{
                    background: "rgba(249,250,248,.11)",
                    border: "1px solid rgba(252,206,114,.16)",
                    color: "#fff",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!msgInput.trim()}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-black transition sm:w-auto"
                  style={{
                    background: msgInput.trim()
                      ? `linear-gradient(135deg,${accentDark},${accent})`
                      : "rgba(255,255,255,.08)",
                    color: msgInput.trim() ? "#fff" : "rgba(255,255,255,.36)",
                    cursor: msgInput.trim() ? "pointer" : "not-allowed",
                    border: "1px solid rgba(255,255,255,.1)",
                    fontFamily: "inherit",
                    boxShadow: msgInput.trim() ? `0 18px 34px ${isGiver ? "rgba(252,206,114,.26)" : "rgba(215,250,219,.18)"}` : "none",
                  }}
                >
                  Send
                  <ArrowRightIcon />
                </button>
              </div>
            </div>

            <aside className="grid gap-4 lg:content-start">
              <div
                className="rounded-[30px] p-5"
                style={{
                  background: CHAT_PANEL_BACKGROUND,
                  border: CHAT_BORDER,
                  backdropFilter: "blur(18px)",
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <SantaMarkIcon className="h-12 w-12" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
                      Identity rules
                    </p>
                    <h2 className="text-xl font-black tracking-[-0.04em]">Keep it secret</h2>
                  </div>
                </div>
                <div className="space-y-3 text-sm leading-6" style={{ color: CHAT_TEXT_MUTED }}>
                  <p>
                    <strong className="text-white">You -&gt; Giftee:</strong> ask questions without showing your name.
                  </p>
                  <p>
                    <strong className="text-white">Santa -&gt; You:</strong> reply while their name stays hidden.
                  </p>
                </div>
                <div className="mt-5 grid gap-2">
                  {activeThreadDetails.map((detail) => (
                    <div
                      key={detail.label}
                      className="rounded-[18px] px-4 py-3"
                      style={{
                        background: "rgba(20,24,21,.42)",
                        border: "1px solid rgba(252,206,114,.1)",
                      }}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: CHAT_TEXT_SUBTLE }}>
                        {detail.label}
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-white">{detail.value}</p>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-5 rounded-[22px] px-4 py-3 text-sm leading-6 text-slate-300"
                  style={{
                    background: "rgba(46,52,50,.46)",
                    border: "1px solid rgba(252,206,114,.12)",
                  }}
                >
                  Ask about size, color, delivery timing, or what they already own. Short questions are easier to answer.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {promptChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full px-3 py-1.5 text-xs font-black"
                      style={{
                        background: isGiver ? "rgba(252,206,114,.13)" : "rgba(215,250,219,.11)",
                        border: isGiver ? "1px solid rgba(252,206,114,.18)" : "1px solid rgba(215,250,219,.16)",
                        color: accent,
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>
    );
  }

  if (!activeThread) {
    const chatGroups = [
      {
        eyebrow: "You gift them",
        title: "People you gift",
        description: "Ask gift questions without showing your name.",
        threads: giverThreads,
        accent: "#fcce72",
        empty: "No recipient chat yet. After names are drawn, your private recipient chat appears here.",
      },
      {
        eyebrow: "They gift you",
        title: "Your mystery Santa",
        description: "Reply to the person assigned to you while their name stays hidden.",
        threads: receiverThreads,
        accent: "#d7fadb",
        empty: "No Santa chat yet. Your Santa can start a private thread after names are drawn.",
      },
    ];

    const stats = [
      { label: "Chats", value: threads.length },
      { label: "Unread", value: totalUnread },
      { label: "Groups", value: uniqueGroupCount },
    ];
    const privacyHighlights = [
      { label: "Giftee thread", value: "You ask without showing your name." },
      { label: "Santa thread", value: "They can reply while their name stays hidden." },
      { label: "Private scope", value: "Each chat stays tied to one match." },
    ];
    const privacyBadges = ["Identity hidden", "Match-only", "No group thread"];

    return (
      <main
        className="relative min-h-screen overflow-x-hidden"
        style={{
          background: CHAT_PAGE_BACKGROUND,
          color: "#f8fafc",
          fontFamily: "'Be Vietnam Pro','Nunito',sans-serif",
        }}
      >
        <div
          id="snowWrap"
          className="pointer-events-none fixed inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%,rgba(255,255,255,.22) 0 2px,transparent 3px),radial-gradient(circle at 70% 20%,rgba(255,255,255,.14) 0 2px,transparent 3px),radial-gradient(circle at 80% 80%,rgba(255,255,255,.12) 0 3px,transparent 4px)",
            backgroundSize: "260px 260px, 340px 340px, 420px 420px",
          }}
        />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
          .chat-scrollbar::-webkit-scrollbar { width: 8px; }
          .chat-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,.04); border-radius: 999px; }
          .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(252,206,114,.5); border-radius: 999px; }
          @media (max-width: 640px) { #snowWrap { opacity: .35; } }
        `}</style>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-[32px] sm:flex-row sm:items-start sm:justify-between">
            <button
              onClick={() => router.push("/dashboard")}
              className="group inline-flex w-fit items-center gap-2 rounded-full py-2 pl-2 pr-4 text-sm font-black text-[#f9faf8] transition hover:-translate-y-0.5 hover:text-white"
              style={{
                background: "linear-gradient(135deg,rgba(164,60,63,.34),rgba(46,52,50,.68))",
                border: "1px solid rgba(252,206,114,.24)",
                boxShadow: "0 18px 36px rgba(10,14,10,.22)",
              }}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "rgba(252,206,114,.2)", color: "#fcce72" }}>
                <DashboardIcon className="h-4 w-4" />
              </span>
              Dashboard
            </button>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white/95 shadow-xl shadow-black/15">
                <SantaMarkIcon className="h-9 w-9" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#fcce72" }}>
                  My Secret Santa
                </p>
                <h1 className="font-[Plus_Jakarta_Sans] text-[2rem] font-black tracking-[-0.05em] sm:text-[2.35rem]">
                  Private gift whispers
                </h1>
              </div>
            </div>
          </header>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_360px]">
            <div
              className="rounded-[34px] p-6 sm:p-7"
              style={{
                background: CHAT_PANEL_BACKGROUND,
                border: CHAT_BORDER,
                boxShadow: "0 22px 54px rgba(46,52,50,.18)",
              }}
            >
              <div className="max-w-3xl">
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "#d7fadb" }}>
                  Not a group chat
                </p>
                <h2 className="font-[Plus_Jakarta_Sans] text-[2.25rem] font-black tracking-[-0.06em] sm:text-[3.4rem]">
                  One private thread for each Secret Santa match.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8" style={{ color: CHAT_TEXT_MUTED }}>
                  Use this page for your recipient and the person gifting you. Names stay hidden so hints help without spoiling the surprise.
                </p>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[22px] px-4 py-3.5"
                    style={{ background: "rgba(46,52,50,.42)", border: "1px solid rgba(252,206,114,.1)" }}
                  >
                    <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: CHAT_TEXT_SUBTLE }}>{stat.label}</p>
                    <p className="mt-2 text-[2rem] font-black leading-none">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside
              className="self-start rounded-[34px] p-6 sm:p-7"
              style={{
                background: "linear-gradient(145deg,rgba(164,60,63,.18),rgba(46,52,50,.72) 52%,rgba(72,102,78,.5))",
                border: "1px solid rgba(252,206,114,.24)",
                boxShadow: "0 22px 54px rgba(10,14,10,.18)",
                backdropFilter: "blur(18px)",
              }}
            >
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "rgba(252,206,114,.2)", color: "#fcce72" }}>
                  <LockLineIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: CHAT_TEXT_SUBTLE }}>How privacy works</p>
                  <div className="mt-4 space-y-3 text-sm leading-6" style={{ color: CHAT_TEXT_MUTED }}>
                    <p>
                      <strong className="text-white">You -&gt; Giftee:</strong> ask questions as their Secret Santa.
                    </p>
                    <p>
                      <strong className="text-white">Santa -&gt; You:</strong> reply while their name stays hidden.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                {privacyHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[20px] px-4 py-3"
                    style={{
                      background: "rgba(20,24,21,.42)",
                      border: "1px solid rgba(252,206,114,.12)",
                    }}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "#fcce72" }}>
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm leading-6" style={{ color: CHAT_TEXT_MUTED }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {privacyBadges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full px-3 py-1.5 text-xs font-black"
                    style={{
                      background: "rgba(215,250,219,.11)",
                      border: "1px solid rgba(215,250,219,.16)",
                      color: "#d7fadb",
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </aside>
          </section>

          {threadListMessage && (
            <section
              className="rounded-[24px] px-5 py-4 text-sm font-bold text-rose-100"
              style={{
                background: "rgba(190,18,60,.14)",
                border: "1px solid rgba(251,113,133,.22)",
              }}
            >
              {threadListMessage}
            </section>
          )}

          {threads.length === 0 ? (
            <section
              className="rounded-[34px] p-8 text-center"
              style={{ background: "rgba(255,248,240,.08)", border: "1px dashed rgba(252,206,114,.2)" }}
            >
              <ChatLineIcon className="mx-auto h-10 w-10 text-[#aeb8ae]" />
              <h2 className="mt-4 text-2xl font-black">No private chats yet</h2>
              <p className="mx-auto mt-3 max-w-xl" style={{ color: CHAT_TEXT_MUTED }}>
                After a group draws names, your private Secret Santa conversations will appear here automatically.
              </p>
            </section>
          ) : (
            <section className="grid gap-5 lg:grid-cols-2">
              {chatGroups.map((group) => (
                <div
                  key={group.title}
                  className="relative rounded-[32px] p-4 pt-9 sm:p-5 sm:pt-10"
                  style={{
                    background: CHAT_PANEL_BACKGROUND,
                    border: CHAT_BORDER,
                    boxShadow: "0 18px 44px rgba(46,52,50,.16)",
                  }}
                >
                  <FestiveTrim tone={group.title === "People you gift" ? "gold" : "green"} compact />
                  <div className="relative mb-4 flex items-start justify-between gap-3 px-2">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: group.accent }}>
                        {group.eyebrow}
                      </p>
                      <h2 className="mt-1 text-[1.85rem] font-black tracking-[-0.04em]">{group.title}</h2>
                      <p className="mt-2 max-w-md text-sm leading-6" style={{ color: CHAT_TEXT_MUTED }}>{group.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-3 py-1 text-xs font-black text-slate-100" style={{ background: "rgba(46,52,50,.5)" }}>
                      {group.threads.length}
                    </span>
                  </div>

                  <div className="relative space-y-3">
                    {group.threads.length === 0 ? (
                      <div className="rounded-[26px] p-5 text-sm leading-6" style={{ background: "rgba(46,52,50,.4)", border: "1px solid rgba(252,206,114,.1)", color: CHAT_TEXT_MUTED }}>
                        {group.empty}
                      </div>
                    ) : (
                      group.threads.map((thread) => (
                        <button
                          key={createThreadKey(thread.group_id, thread.giver_id, thread.receiver_id)}
                          onClick={() => openThread(thread)}
                          className="group w-full rounded-[26px] p-4 text-left transition duration-200 hover:-translate-y-0.5"
                          style={{
                            background: "linear-gradient(135deg,rgba(255,248,240,.11),rgba(236,239,236,.055))",
                            border: thread.unread > 0 ? `1px solid ${group.accent}` : "1px solid rgba(252,206,114,.1)",
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="grid h-11 w-11 place-items-center rounded-2xl text-lg font-black" style={{ background: `${group.accent}20`, color: group.accent }}>
                              {thread.role === "giver" ? <ChatLineIcon className="h-6 w-6" /> : <SantaMarkIcon className="h-10 w-10" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: group.accent }}>
                                {group.title === "People you gift" ? "Giftee thread" : "Anonymous Santa"}
                              </p>
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-lg font-black">{thread.other_name}</p>
                                <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: CHAT_TEXT_SUBTLE }}>
                                  {formatThreadTime(thread.last_time)}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-sm" style={{ color: CHAT_TEXT_MUTED }}>{thread.group_name}</p>
                              <p className="mt-2 truncate text-sm" style={{ color: CHAT_TEXT_SUBTLE }}>{thread.last_message}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {thread.unread > 0 && (
                                <span className="grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-black text-slate-950" style={{ background: group.accent }}>
                                  {thread.unread}
                                </span>
                              )}
                              <span className="grid h-10 w-10 place-items-center rounded-full text-slate-200 transition group-hover:translate-x-1" style={{ background: "rgba(46,52,50,.5)" }}>
                                <ArrowRightIcon className="h-5 w-5" />
                              </span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </main>
    );
  }

  return null;
}

