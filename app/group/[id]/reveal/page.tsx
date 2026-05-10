"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import FadeIn from "@/app/components/FadeIn";
import { GroupSkeleton } from "@/app/components/PageSkeleton";
import { createClient } from "@/lib/supabase/client";
import {
  getRevealPresentationData,
  startRevealCountdown,
  startRevealSession,
  triggerReveal,
  updateRevealSessionState,
} from "../actions";

type AliasEntry = {
  alias: string;
  avatarEmoji: string;
  realName: string | null;
};

type MatchEntry = {
  giver: string | null;
  receiver: string | null;
};

type RevealSession = {
  cardRevealed: boolean;
  countdownSeconds: number;
  countdownStartedAt: string | null;
  currentIndex: number;
  lastUpdatedAt: string | null;
  publishedAt: string | null;
  startedAt: string | null;
  status: "idle" | "waiting" | "countdown" | "live" | "published";
};

type RevealPresentation = {
  aliasEntries: AliasEntry[];
  matchEntries: MatchEntry[];
  canPreviewBeforeReveal: boolean;
  groupName: string;
  isOwner: boolean;
  revealed: boolean;
  revealedAt: string | null;
  session: RevealSession;
};

const REVEAL_PAGE_FALLBACK_POLL_MS = 5 * 60 * 1000;

function readGroupIdFromRoute(
  params: ReturnType<typeof useParams>,
  pathname: string | null
): string {
  const paramValue = params.id;

  if (typeof paramValue === "string" && paramValue.trim()) {
    return paramValue;
  }

  if (Array.isArray(paramValue) && typeof paramValue[0] === "string") {
    return paramValue[0];
  }

  for (const value of Object.values(params)) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
      return value[0];
    }
  }

  const pathnameCandidates = [
    pathname || "",
    typeof window === "undefined" ? "" : window.location.pathname,
  ];
  const pathnameMatch = pathnameCandidates
    .map((candidate) => /^\/group\/([^/]+)\/reveal(?:\/)?$/.exec(candidate))
    .find((match) => Boolean(match?.[1]));

  if (!pathnameMatch?.[1]) {
    return "";
  }

  try {
    return decodeURIComponent(pathnameMatch[1]);
  } catch {
    return pathnameMatch[1];
  }
}

function formatRevealTime(value: string | null): string {
  if (!value) {
    return "Not revealed yet";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRevealNameTextStyle(value: string, variant: "alias" | "match") {
  const length = value.trim().length || 1;

  // The reveal screen should keep names fully visible in one clean line.
  // Instead of wrapping or truncating, we size the text down more aggressively
  // as names get longer so the venue screen still looks deliberate.
  if (variant === "alias") {
    if (length <= 8) {
      return {
        fontSize: "clamp(2.75rem, 8vw, 4.5rem)",
        whiteSpace: "nowrap" as const,
        overflow: "visible" as const,
        letterSpacing: "-0.01em",
      };
    }

    if (length <= 11) {
      return {
        fontSize: "clamp(2.25rem, 6vw, 3.35rem)",
        whiteSpace: "nowrap" as const,
        overflow: "visible" as const,
        letterSpacing: "-0.02em",
      };
    }

    if (length <= 14) {
      return {
        fontSize: "clamp(1.9rem, 4.8vw, 2.65rem)",
        whiteSpace: "nowrap" as const,
        overflow: "visible" as const,
        letterSpacing: "-0.03em",
      };
    }

    return {
      fontSize: "clamp(1.45rem, 4vw, 2.1rem)",
      whiteSpace: "nowrap" as const,
      overflow: "visible" as const,
      letterSpacing: "-0.04em",
    };
  }

  if (length <= 8) {
    return {
      fontSize: "clamp(2.2rem, 5vw, 3.1rem)",
      whiteSpace: "nowrap" as const,
      overflow: "visible" as const,
      letterSpacing: "-0.01em",
    };
  }

  if (length <= 10) {
    return {
      fontSize: "clamp(1.9rem, 4vw, 2.45rem)",
      whiteSpace: "nowrap" as const,
      overflow: "visible" as const,
      letterSpacing: "-0.02em",
    };
  }

  if (length <= 12) {
    return {
      fontSize: "clamp(1.55rem, 3.25vw, 1.95rem)",
      whiteSpace: "nowrap" as const,
      overflow: "visible" as const,
      letterSpacing: "-0.03em",
    };
  }

  if (length <= 15) {
    return {
      fontSize: "clamp(1.28rem, 2.7vw, 1.65rem)",
      whiteSpace: "nowrap" as const,
      overflow: "visible" as const,
      letterSpacing: "-0.04em",
    };
  }

  return {
    fontSize: "clamp(1.05rem, 2.35vw, 1.35rem)",
    whiteSpace: "nowrap" as const,
    overflow: "visible" as const,
    letterSpacing: "-0.05em",
  };
}

export default function GroupRevealPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const id = readGroupIdFromRoute(params, pathname);

  const [supabase] = useState(() => createClient());
  const [presentation, setPresentation] = useState<RevealPresentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [localPreviewIndex, setLocalPreviewIndex] = useState(0);
  const [localPreviewRevealed, setLocalPreviewRevealed] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const loadPresentationRef = useRef<
    ((options?: { blocking?: boolean }) => Promise<void>) | null
  >(null);
  const hasLoadedPresentationRef = useRef(false);

  useEffect(() => {
    if (!id) {
      setError("");
      setLoading(true);
      return;
    }

    let isMounted = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const loadPresentation = async (options?: { blocking?: boolean }) => {
      const shouldBlock = options?.blocking ?? !hasLoadedPresentationRef.current;

      if (shouldBlock) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const result = await getRevealPresentationData(id);

      if (!isMounted) {
        return;
      }

      if (!result.success || !result.data) {
        // Only replace the whole screen with an error if the first blocking load fails.
        // Once the reveal is on screen, background sync should preserve the current
        // presentation and fail softly instead of flashing users back to a loader.
        if (!hasLoadedPresentationRef.current) {
          setError(result.message || "Failed to load the reveal screen.");
          setLoading(false);
        } else {
          setActionMessage(result.message || "Failed to refresh the reveal screen.");
          setRefreshing(false);
        }
        return;
      }

      setPresentation(result.data);
      setError("");
      hasLoadedPresentationRef.current = true;

      if (shouldBlock) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    };

    loadPresentationRef.current = loadPresentation;
    void loadPresentation({ blocking: true });

    const scheduleReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        if (loadPresentationRef.current) {
          void loadPresentationRef.current({ blocking: false });
        }
      }, 120);
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleReload();
      }
    };

    const channel = supabase
      .channel(`group-reveal-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_reveal_sessions", filter: `group_id=eq.${id}` },
        () => {
          scheduleReload();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups", filter: `id=eq.${id}` },
        () => {
          scheduleReload();
        }
      )
      .subscribe();

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    pollInterval = setInterval(refreshIfVisible, REVEAL_PAGE_FALLBACK_POLL_MS);

    return () => {
      isMounted = false;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      supabase.removeChannel(channel);
    };
  }, [id, supabase]);

  useEffect(() => {
    if (!id) {
      return;
    }

    router.prefetch(`/group/${id}`);
  }, [id, router]);

  useEffect(() => {
    if (presentation?.session.status !== "countdown" || !presentation.session.countdownStartedAt) {
      return;
    }

    // Recompute the remaining time locally from the shared session timestamp so
    // all viewers stay visually in sync during the short countdown window.
    const timer = setInterval(() => {
      setCountdownNow(Date.now());
    }, 250);

    return () => clearInterval(timer);
  }, [presentation?.session.countdownStartedAt, presentation?.session.status]);

  const aliasEntries = presentation?.aliasEntries || [];
  const matchEntries = presentation?.matchEntries || [];
  const totalRevealSteps = aliasEntries.length + matchEntries.length;
  const usesSharedSession = presentation ? presentation.session.status !== "idle" : false;
  const activeIndex = usesSharedSession
    ? presentation?.session.currentIndex || 0
    : localPreviewIndex;
  const revealedCard = usesSharedSession
    ? Boolean(presentation?.session.cardRevealed)
    : localPreviewRevealed;
  const safeIndex =
    totalRevealSteps === 0 ? 0 : Math.min(activeIndex, totalRevealSteps - 1);
  const isMatchPhase = safeIndex >= aliasEntries.length && matchEntries.length > 0;
  const matchPhaseIndex = isMatchPhase ? safeIndex - aliasEntries.length : -1;
  const activeAliasEntry = !isMatchPhase ? aliasEntries[safeIndex] || null : null;
  const activeMatchEntry = isMatchPhase ? matchEntries[matchPhaseIndex] || null : null;
  const isWaitingRoom = Boolean(
    presentation && !presentation.isOwner && !usesSharedSession && !presentation.revealed
  );
  const countdownEndsAt =
    presentation?.session.countdownStartedAt && presentation.session.countdownSeconds > 0
      ? new Date(presentation.session.countdownStartedAt).getTime() +
        presentation.session.countdownSeconds * 1000
      : null;
  const countdownRemaining = countdownEndsAt
    ? Math.max(Math.ceil((countdownEndsAt - countdownNow) / 1000), 0)
    : 0;
  const showCountdown = presentation?.session.status === "countdown" && countdownRemaining > 0;
  const isSharedWaitingRoom = Boolean(
    presentation && presentation.session.status === "waiting" && !presentation.revealed
  );
  const isPublishedPresentation = Boolean(
    presentation && (presentation.revealed || presentation.session.status === "published")
  );
  const ownerCanStartCountdown = Boolean(
    presentation?.isOwner &&
      presentation.session.status === "waiting" &&
      !presentation.revealed &&
      !sessionLoading
  );
  const ownerCanStartOrRestartLiveReveal = Boolean(
    presentation?.isOwner &&
      !presentation.revealed &&
      presentation.session.status !== "countdown" &&
      !sessionLoading
  );
  // A live session can persist from an earlier event run. Let the owner reset it
  // back to the neutral waiting room so the TV does not stay stuck on an old card.
  const liveRevealButtonLabel =
    presentation?.session.status === "idle"
      ? "Start Live Reveal"
      : presentation?.session.status === "waiting"
        ? "Reset Live Room"
        : "Restart Live Reveal";
  const sessionBadgeLabel =
    presentation?.session.status === "published"
      ? `Published - ${formatRevealTime(presentation.revealedAt || presentation.session.publishedAt)}`
      : presentation?.session.status === "countdown"
        ? showCountdown
          ? `Countdown: ${countdownRemaining}`
          : "Live reveal in progress"
        : presentation?.session.status === "live"
          ? "Live reveal in progress"
          : presentation?.session.status === "waiting"
            ? presentation.isOwner
              ? "Live room ready"
              : "Waiting for countdown"
            : presentation?.isOwner
              ? "Private preview mode"
              : "Waiting room";
  const sessionBadgeStyles =
    presentation?.session.status === "published"
      ? { background: "rgba(34,197,94,.14)", color: "#86efac" }
      : presentation?.session.status === "countdown"
        ? { background: "rgba(249,115,22,.16)", color: "#fdba74" }
        : presentation?.session.status === "live"
          ? { background: "rgba(168,85,247,.16)", color: "#e9d5ff" }
          : presentation?.session.status === "waiting"
            ? { background: "rgba(59,130,246,.16)", color: "#bfdbfe" }
            : { background: "rgba(251,191,36,.16)", color: "#fde68a" };

  const progressLabel = useMemo(() => {
    if (totalRevealSteps === 0) {
      return "0 of 0";
    }

    return `${safeIndex + 1} of ${totalRevealSteps}`;
  }, [safeIndex, totalRevealSteps]);
  const activeCardHeading = isMatchPhase
    ? revealedCard
      ? "Match revealed"
      : "Secret Santa match"
    : revealedCard
      ? "Identity revealed"
      : "Mystery nickname";
  const activeCardIcon = isMatchPhase
    ? revealedCard
      ? "🎁"
      : "🎲"
    : revealedCard
      ? activeAliasEntry?.avatarEmoji || "🎁"
      : "🎭";
  const activeCardTitle = isMatchPhase
    ? revealedCard
      ? `${activeMatchEntry?.giver || "Member"} → ${activeMatchEntry?.receiver || "Member"}`
      : "Who gets who?"
    : revealedCard
      ? activeAliasEntry?.realName || activeAliasEntry?.alias || "Member"
      : activeAliasEntry?.alias || "Mystery nickname";
  const activeCardDescription = isMatchPhase
    ? revealedCard
      ? `${activeMatchEntry?.giver || "Member"} is giving to ${activeMatchEntry?.receiver || "Member"}.`
      : "Reveal the next Secret Santa pairing when the room is ready."
    : revealedCard
      ? `Nickname: ${activeAliasEntry?.alias || "Unknown"}`
      : "Keep the nickname on screen first, then flip when the room is ready.";
  const revealToggleLabel = revealedCard
    ? isMatchPhase
      ? "Hide Match"
      : "Show Nickname Again"
    : isMatchPhase
      ? "Reveal Match"
      : "Reveal Owner";
  const activeVisibilityBadgeLabel = revealedCard
    ? isMatchPhase
      ? "Match revealed"
      : "Owner revealed"
    : isMatchPhase
      ? "Match hidden"
      : "Nickname hidden";
  const activeMatchGiver = activeMatchEntry?.giver || "Member";
  const activeMatchReceiver = activeMatchEntry?.receiver || "Member";
  const activeMatchGiverLabel = revealedCard ? activeMatchGiver : "???";
  const activeMatchReceiverLabel = revealedCard ? activeMatchReceiver : "???";
  const activeAliasTitleStyle = getRevealNameTextStyle(activeCardTitle, "alias");
  const activeMatchGiverStyle = getRevealNameTextStyle(activeMatchGiverLabel, "match");
  const activeMatchReceiverStyle = getRevealNameTextStyle(activeMatchReceiverLabel, "match");

  const applySharedSession = (nextSession: RevealSession | undefined) => {
    if (!nextSession) {
      return;
    }

    setPresentation((currentPresentation) =>
      currentPresentation
        ? {
            ...currentPresentation,
            session: nextSession,
          }
        : currentPresentation
    );
  };

  const handleStartLiveReveal = async () => {
    if (!presentation?.isOwner) {
      return;
    }

    setSessionLoading(true);
    setActionMessage("");

    try {
      const result = await startRevealSession(id, localPreviewIndex);
      setActionMessage(result.message);

      if (result.success && result.session) {
        applySharedSession(result.session);
      }
    } finally {
      setSessionLoading(false);
    }
  };

  const handleStartCountdown = async () => {
    if (!presentation?.isOwner) {
      return;
    }

    setSessionLoading(true);
    setActionMessage("");

    try {
      const result = await startRevealCountdown(id, safeIndex);
      setActionMessage(result.message);

      if (result.success && result.session) {
        setCountdownNow(Date.now());
        applySharedSession(result.session);
      }
    } finally {
      setSessionLoading(false);
    }
  };

  const handleRestartPublishedPresentation = async () => {
    if (!presentation?.isOwner || totalRevealSteps === 0) {
      return;
    }

    setSessionLoading(true);
    setActionMessage("");

    try {
      // After the full group reveal is public, we still allow the owner to replay
      // the event presentation on the venue screen without undoing publication.
      const result = await updateRevealSessionState(id, 0, false);
      setActionMessage(
        result.success ? "Event presentation reset to the first hidden card." : result.message
      );

      if (result.success && result.session) {
        applySharedSession(result.session);
      }
    } finally {
      setSessionLoading(false);
    }
  };

  const updateLiveSession = async (nextIndex: number, nextCardRevealed: boolean) => {
    setSessionLoading(true);
    setActionMessage("");

    try {
      const result = await updateRevealSessionState(id, nextIndex, nextCardRevealed);
      setActionMessage(result.success ? "" : result.message);

      if (result.success && result.session) {
        applySharedSession(result.session);
      }
    } finally {
      setSessionLoading(false);
    }
  };

  const handleNext = async () => {
    if (safeIndex >= totalRevealSteps - 1) {
      return;
    }

    if (presentation?.isOwner && usesSharedSession) {
      await updateLiveSession(safeIndex + 1, false);
      return;
    }

    setLocalPreviewIndex((current) => current + 1);
    setLocalPreviewRevealed(false);
  };

  const handlePrevious = async () => {
    if (safeIndex === 0) {
      return;
    }

    if (presentation?.isOwner && usesSharedSession) {
      await updateLiveSession(safeIndex - 1, false);
      return;
    }

    setLocalPreviewIndex((current) => current - 1);
    setLocalPreviewRevealed(false);
  };

  const handleToggleReveal = async () => {
    if (presentation?.isOwner && usesSharedSession) {
      await updateLiveSession(safeIndex, !revealedCard);
      return;
    }

    setLocalPreviewRevealed((current) => !current);
  };

  const handlePublishReveal = async () => {
    if (!presentation?.isOwner) {
      return;
    }

    if (
      !confirm(
        "Publish the full group reveal now? Accepted members will be able to open the final reveal board after this."
      )
    ) {
      return;
    }

    setPublishing(true);
    setActionMessage("");

    try {
      const result = await triggerReveal(id);
      setActionMessage(result.message);

      if (result.success) {
        const publishedAt = new Date().toISOString();
        setPresentation((currentPresentation) =>
          currentPresentation
            ? {
                ...currentPresentation,
                revealed: true,
                revealedAt: publishedAt,
                session: {
                  ...currentPresentation.session,
                  status: "published",
                  currentIndex: safeIndex,
                  cardRevealed: true,
                  publishedAt,
                  lastUpdatedAt: publishedAt,
                },
              }
            : currentPresentation
        );
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen is a best-effort presentation helper only.
    }
  };

  if (loading && !presentation) {
    return <GroupSkeleton />;
  }

  if (error || !presentation) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "linear-gradient(180deg,#0f172a,#15384d 55%,#123226 100%)" }}
      >
        <div
          className="max-w-140 rounded-[28px] p-8 text-center"
          style={{
            background: "rgba(15,23,42,.72)",
            border: "1px solid rgba(255,255,255,.08)",
            boxShadow: "0 20px 50px rgba(0,0,0,.28)",
          }}
        >
          <div className="text-[24px] font-bold text-white mb-2">Reveal Screen Unavailable</div>
          <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,.72)" }}>
            {error || "The reveal screen could not be loaded."}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/group/${id}`)}
            className="mt-5 px-5 py-2.5 rounded-xl text-sm font-extrabold text-white"
            style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)", border: "none" }}
          >
            Back to Group
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top,rgba(59,130,246,.14),transparent 26%),radial-gradient(circle at bottom,rgba(34,197,94,.12),transparent 30%),linear-gradient(180deg,#0b1220 0%,#10233b 44%,#112b23 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka:wght@500;600;700&display=swap');
      `}</style>

      <FadeIn className="max-w-245 mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <button
            type="button"
            onClick={() => router.push(`/group/${id}`)}
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{
              color: "#e2e8f0",
              background: "rgba(15,23,42,.42)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            Back to Group
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {refreshing && (
              <div
                className="px-4 py-2 rounded-2xl text-[12px] font-extrabold"
                style={{
                  background: "rgba(14,116,144,.18)",
                  color: "#bae6fd",
                  border: "1px solid rgba(56,189,248,.16)",
                }}
              >
                Syncing...
              </div>
            )}

            <button
              type="button"
              onClick={handleFullscreen}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{
                color: "#dbeafe",
                background: "rgba(29,78,216,.24)",
                border: "1px solid rgba(96,165,250,.18)",
              }}
            >
              TV Mode
            </button>

            {ownerCanStartOrRestartLiveReveal && (
              <button
                type="button"
                onClick={handleStartLiveReveal}
                disabled={sessionLoading}
                className="px-5 py-2 rounded-xl text-sm font-extrabold text-white"
                style={{
                  background: sessionLoading
                    ? "#64748b"
                    : "linear-gradient(135deg,#7e22ce,#a855f7)",
                  border: "none",
                  cursor: sessionLoading ? "not-allowed" : "pointer",
                }}
              >
                {sessionLoading ? "Starting..." : liveRevealButtonLabel}
              </button>
            )}

            {ownerCanStartCountdown && (
              <button
                type="button"
                onClick={handleStartCountdown}
                disabled={sessionLoading}
                className="px-5 py-2 rounded-xl text-sm font-extrabold text-white"
                style={{
                  background: sessionLoading
                    ? "#64748b"
                    : "linear-gradient(135deg,#f59e0b,#f97316)",
                  border: "none",
                  cursor: sessionLoading ? "not-allowed" : "pointer",
                }}
              >
                {sessionLoading ? "Starting..." : "Start Countdown"}
              </button>
            )}

            {presentation.isOwner && isPublishedPresentation && (
              <button
                type="button"
                onClick={handleRestartPublishedPresentation}
                disabled={sessionLoading}
                className="px-5 py-2 rounded-xl text-sm font-extrabold text-white"
                style={{
                  background: sessionLoading
                    ? "#64748b"
                    : "linear-gradient(135deg,#0f766e,#14b8a6)",
                  border: "none",
                  cursor: sessionLoading ? "not-allowed" : "pointer",
                }}
              >
                {sessionLoading ? "Resetting..." : "Restart Event Presentation"}
              </button>
            )}

            {presentation.isOwner && !presentation.revealed && (
              <button
                type="button"
                onClick={handlePublishReveal}
                disabled={publishing}
                className="px-5 py-2 rounded-xl text-sm font-extrabold text-white"
                style={{
                  background: publishing
                    ? "#64748b"
                    : "linear-gradient(135deg,#16a34a,#22c55e)",
                  border: "none",
                  cursor: publishing ? "not-allowed" : "pointer",
                }}
              >
                {publishing ? "Publishing..." : "Publish Group Reveal"}
              </button>
            )}
          </div>
        </div>

        <div
          className="rounded-4xl overflow-hidden"
          style={{
            background: "rgba(15,23,42,.56)",
            border: "1px solid rgba(255,255,255,.08)",
            boxShadow: "0 30px 80px rgba(0,0,0,.28)",
          }}
        >
          <div
            className="px-6 py-6 md:px-8 md:py-7"
            style={{
              background:
                "linear-gradient(135deg,rgba(15,23,42,.88),rgba(17,50,39,.86),rgba(30,64,175,.76))",
            }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div
                  className="text-[30px] md:text-[36px] font-bold text-white"
                  style={{ fontFamily: "'Fredoka', sans-serif" }}
                >
                  {presentation.groupName} Live Reveal
                </div>
                <div className="text-[14px] font-semibold mt-2" style={{ color: "#cbd5e1" }}>
                  The TV can stay on this page while the owner controls the reveal from another
                  device. Guests on phones can join this same screen if they want to follow along.
                </div>
              </div>

              <div
                className="px-4 py-2 rounded-2xl text-[12px] font-extrabold"
                style={sessionBadgeStyles}
              >
                {sessionBadgeLabel}
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {actionMessage && (
              <div
                className="rounded-2xl px-4 py-3 text-sm font-bold mb-5"
                style={{
                  background:
                    actionMessage.toLowerCase().includes("started") ||
                    actionMessage.toLowerCase().includes("triggered") ||
                    actionMessage.toLowerCase().includes("countdown")
                      ? "rgba(34,197,94,.12)"
                      : "rgba(239,68,68,.12)",
                  color:
                    actionMessage.toLowerCase().includes("started") ||
                    actionMessage.toLowerCase().includes("triggered") ||
                    actionMessage.toLowerCase().includes("countdown")
                      ? "#86efac"
                      : "#fecaca",
                  border:
                    actionMessage.toLowerCase().includes("started") ||
                    actionMessage.toLowerCase().includes("triggered") ||
                    actionMessage.toLowerCase().includes("countdown")
                      ? "1px solid rgba(34,197,94,.18)"
                      : "1px solid rgba(239,68,68,.2)",
                }}
              >
                {actionMessage}
              </div>
            )}

            {isPublishedPresentation && (
              <div
                className="rounded-2xl px-4 py-3 text-sm font-semibold mb-5"
                style={{
                  background: "rgba(16,185,129,.1)",
                  color: "#d1fae5",
                  border: "1px solid rgba(52,211,153,.18)",
                }}
              >
                The full Secret Santa pairings are already public for this group. This screen now
                behaves like an event presentation/replay view for the venue display.
              </div>
            )}

            <div className="grid grid-cols-1 gap-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div
                    className="text-[12px] font-extrabold uppercase tracking-[0.18em]"
                    style={{ color: "#93c5fd" }}
                  >
                    Event Screen
                  </div>
                  <div
                    className="text-[26px] md:text-[32px] font-bold mt-2 text-white"
                    style={{ fontFamily: "'Fredoka', sans-serif" }}
                  >
                    One event. Two reveal moments.
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="px-4 py-2 rounded-2xl text-[12px] font-extrabold"
                    style={{
                      background: "rgba(15,23,42,.48)",
                      color: "#e2e8f0",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    {progressLabel}
                  </div>

                  {!isWaitingRoom && !isSharedWaitingRoom && !showCountdown && (
                    <div
                      className="px-4 py-2 rounded-2xl text-[12px] font-extrabold"
                      style={{
                        background: revealedCard ? "rgba(34,197,94,.16)" : "rgba(59,130,246,.18)",
                        color: revealedCard ? "#86efac" : "#bfdbfe",
                        border: revealedCard
                          ? "1px solid rgba(34,197,94,.18)"
                          : "1px solid rgba(96,165,250,.16)",
                      }}
                    >
                      {activeVisibilityBadgeLabel}
                    </div>
                  )}
                </div>
              </div>

              {isWaitingRoom || isSharedWaitingRoom ? (
                <div
                  className="rounded-4xl px-6 py-8 md:px-10 md:py-10 min-h-105 flex flex-col items-center justify-center text-center"
                  style={{
                    background: "linear-gradient(145deg,rgba(29,78,216,.18),rgba(15,23,42,.76))",
                    border: "1px solid rgba(255,255,255,.08)",
                    boxShadow: "0 18px 40px rgba(0,0,0,.16)",
                  }}
                >
                  <div className="text-[72px] mb-5">🎬</div>
                  <div
                    className="text-[34px] md:text-[46px] leading-tight font-bold text-white"
                    style={{ fontFamily: "'Fredoka', sans-serif" }}
                  >
                    {isSharedWaitingRoom
                      ? presentation.isOwner
                        ? "Live reveal room is ready"
                        : "Reveal room is ready"
                      : "Waiting for the owner to start the live reveal"}
                  </div>
                  <div
                    className="text-[16px] md:text-[20px] font-semibold mt-5 max-w-155"
                    style={{ color: "#dbeafe" }}
                  >
                    {isSharedWaitingRoom
                      ? presentation.isOwner
                        ? "The room is open for joined phones and the TV. Start the countdown when everyone is ready to watch."
                        : "Keep this page open on your phone. Everyone here will see the same countdown as soon as the owner starts it."
                      : "Keep this page open on your phone if you want to follow along. The event reveal cards will begin updating here automatically as soon as the owner opens the live room."}
                  </div>
                </div>
              ) : showCountdown ? (
                <div
                  className="rounded-4xl px-6 py-8 md:px-10 md:py-10 min-h-130 flex flex-col items-center justify-center text-center"
                  style={{
                    background: "linear-gradient(145deg,rgba(249,115,22,.22),rgba(15,23,42,.76))",
                    border: "1px solid rgba(255,255,255,.08)",
                    boxShadow: "0 18px 40px rgba(0,0,0,.16)",
                  }}
                >
                  <div className="text-[14px] font-extrabold uppercase tracking-[0.22em]" style={{ color: "#fdba74" }}>
                    Countdown
                  </div>
                  <div
                    className="text-[120px] md:text-[180px] leading-none font-bold text-white mt-6"
                    style={{ fontFamily: "'Fredoka', sans-serif" }}
                  >
                    {countdownRemaining}
                  </div>
                  <div
                    className="text-[18px] md:text-[24px] font-semibold mt-6 max-w-160"
                    style={{ color: "#ffedd5" }}
                  >
                    The first event reveal card will appear on every joined screen as soon as the
                    countdown finishes.
                  </div>
                </div>
              ) : activeAliasEntry || activeMatchEntry ? (
                <div
                  className="rounded-4xl px-6 py-8 md:px-10 md:py-10 min-h-130 flex flex-col justify-between"
                  style={{
                    background: revealedCard
                      ? "linear-gradient(145deg,rgba(34,197,94,.24),rgba(15,23,42,.74))"
                      : "linear-gradient(145deg,rgba(29,78,216,.22),rgba(15,23,42,.76))",
                    border: "1px solid rgba(255,255,255,.08)",
                    boxShadow: "0 18px 40px rgba(0,0,0,.16)",
                  }}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div
                      className="text-[14px] font-extrabold uppercase tracking-[0.18em]"
                      style={{ color: revealedCard ? "#bbf7d0" : "#bfdbfe" }}
                    >
                    {activeCardHeading}
                    </div>

                    <div
                      className="px-4 py-2 rounded-2xl text-[12px] font-extrabold"
                      style={{
                        background: "rgba(15,23,42,.42)",
                        color: "#dbeafe",
                        border: "1px solid rgba(255,255,255,.08)",
                      }}
                    >
                      {presentation.isOwner
                        ? isPublishedPresentation
                          ? "Published presentation controls"
                          : usesSharedSession
                            ? "Live owner controls"
                            : "Private owner preview"
                        : "Audience view"}
                    </div>
                  </div>

                  <div className="text-center px-2 md:px-8">
                    {isMatchPhase ? (
                      <div className="max-w-210 mx-auto">
                        <div className="text-[64px] md:text-[82px] mb-6">{activeCardIcon}</div>

                        {/* Match reveals need a structured layout so long names wrap cleanly
                            inside their own panels instead of fighting for one oversized title line. */}
                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 md:gap-4">
                          <div
                            className="px-2 py-3 md:px-3 md:py-4 text-center"
                          >
                            <div
                              className="text-[11px] md:text-[12px] font-extrabold uppercase tracking-[0.18em]"
                              style={{ color: revealedCard ? "#bbf7d0" : "#bfdbfe" }}
                            >
                              Giver
                            </div>
                            <div
                              className="mt-3 leading-[0.95] font-bold text-white max-w-full"
                              style={{
                                fontFamily: "'Fredoka', sans-serif",
                                ...activeMatchGiverStyle,
                              }}
                              title={activeMatchGiverLabel}
                            >
                              {activeMatchGiverLabel}
                            </div>
                          </div>

                          <div
                            className="text-[42px] md:text-[66px] leading-none font-bold"
                            style={{ color: revealedCard ? "#fcd34d" : "#bfdbfe" }}
                          >
                            →
                          </div>

                          <div
                            className="px-2 py-3 md:px-3 md:py-4 text-center"
                          >
                            <div
                              className="text-[11px] md:text-[12px] font-extrabold uppercase tracking-[0.18em]"
                              style={{ color: revealedCard ? "#bbf7d0" : "#bfdbfe" }}
                            >
                              Receiver
                            </div>
                            <div
                              className="mt-3 leading-[0.95] font-bold text-white max-w-full"
                              style={{
                                fontFamily: "'Fredoka', sans-serif",
                                ...activeMatchReceiverStyle,
                              }}
                              title={activeMatchReceiverLabel}
                            >
                              {activeMatchReceiverLabel}
                            </div>
                          </div>
                        </div>

                        <div
                          className="text-[16px] md:text-[22px] font-semibold mt-6"
                          style={{ color: "#dbeafe" }}
                        >
                          {activeCardDescription}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-[64px] md:text-[82px] mb-6">
                          {activeCardIcon}
                        </div>
                        <div
                          className="leading-[0.95] font-bold text-white max-w-full"
                          style={{
                            fontFamily: "'Fredoka', sans-serif",
                            ...activeAliasTitleStyle,
                          }}
                          title={activeCardTitle}
                        >
                          {activeCardTitle}
                        </div>
                        <div
                          className="text-[16px] md:text-[22px] font-semibold mt-5"
                          style={{ color: "#dbeafe" }}
                        >
                          {activeCardDescription}
                        </div>
                      </>
                    )}
                  </div>

                  {presentation.isOwner && (
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={handleToggleReveal}
                        disabled={sessionLoading || showCountdown}
                        className="px-6 py-3 rounded-2xl text-sm font-extrabold text-white"
                        style={{
                          background: revealedCard
                            ? "linear-gradient(135deg,#1d4ed8,#3b82f6)"
                            : "linear-gradient(135deg,#7e22ce,#a855f7)",
                          border: "none",
                          cursor: sessionLoading || showCountdown ? "not-allowed" : "pointer",
                          opacity: sessionLoading || showCountdown ? 0.7 : 1,
                        }}
                      >
                        {revealToggleLabel}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="rounded-[28px] p-8 text-center"
                  style={{
                    background: "rgba(15,23,42,.54)",
                    border: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  <div className="text-[22px] font-bold text-white mb-2">No reveal data yet</div>
                  <p className="text-[14px] font-semibold" style={{ color: "#cbd5e1" }}>
                    Accepted members need nicknames and a completed draw before this reveal screen can be used.
                  </p>
                </div>
              )}

              {presentation.isOwner ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handlePrevious()}
                    disabled={safeIndex === 0 || sessionLoading || showCountdown}
                    className="px-5 py-2.5 rounded-2xl text-sm font-extrabold"
                    style={{
                      color: safeIndex === 0 || sessionLoading || showCountdown ? "#94a3b8" : "#fff",
                      background:
                        safeIndex === 0 || sessionLoading || showCountdown
                          ? "rgba(148,163,184,.16)"
                          : "rgba(15,23,42,.48)",
                      border: "1px solid rgba(255,255,255,.08)",
                      cursor: safeIndex === 0 || sessionLoading || showCountdown ? "not-allowed" : "pointer",
                    }}
                  >
                    Previous
                  </button>

                  <div
                    className="text-[12px] md:text-[13px] font-semibold text-center max-w-115"
                    style={{ color: "#cbd5e1" }}
                  >
                    {isPublishedPresentation
                      ? "The full reveal is already public. These controls now replay both nickname reveals and final matches for the room."
                      : presentation.session.status === "waiting"
                      ? "The room is open. Start the countdown when everyone is looking at the screen."
                      : showCountdown
                        ? "The countdown is live now. Controls unlock again as soon as it finishes."
                        : usesSharedSession
                          ? "The TV and any joined phones stay in sync while you move from nickname reveals into the final matches."
                          : "You are still in private preview mode. Start the live reveal when you want other devices to follow along."}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleNext()}
                    disabled={safeIndex >= totalRevealSteps - 1 || sessionLoading || showCountdown}
                    className="px-5 py-2.5 rounded-2xl text-sm font-extrabold"
                    style={{
                      color:
                        safeIndex >= totalRevealSteps - 1 || sessionLoading || showCountdown ? "#94a3b8" : "#fff",
                      background:
                        safeIndex >= totalRevealSteps - 1 || sessionLoading || showCountdown
                          ? "rgba(148,163,184,.16)"
                          : "rgba(15,23,42,.48)",
                      border: "1px solid rgba(255,255,255,.08)",
                      cursor:
                        safeIndex >= totalRevealSteps - 1 || sessionLoading || showCountdown
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              ) : (
                <div
                  className="text-[12px] md:text-[13px] font-semibold text-center"
                  style={{ color: "#cbd5e1" }}
                >
                  {presentation.session.status === "waiting"
                    ? "The live room is open. This page will switch into the shared countdown automatically."
                    : showCountdown
                      ? "Countdown is running. Stay on this page and the first event reveal card will appear here automatically."
                      : usesSharedSession
                        ? "The owner is controlling the live reveal. This page will keep updating automatically through both nickname and match phases."
                        : "You can leave this page open on your phone. It will change automatically once the owner starts the live reveal."}
                </div>
              )}
            </div>
          </div>
        </div>
      </FadeIn>
    </main>
  );
}
