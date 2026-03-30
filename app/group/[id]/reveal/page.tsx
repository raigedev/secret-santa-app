"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import FadeIn from "@/app/components/FadeIn";
import { getRevealPresentationData, triggerReveal } from "../actions";

type AliasEntry = {
  alias: string;
  avatarEmoji: string;
  realName: string;
};

type RevealPresentation = {
  aliasEntries: AliasEntry[];
  canPreviewBeforeReveal: boolean;
  groupName: string;
  isOwner: boolean;
  revealed: boolean;
  revealedAt: string | null;
};

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

export default function GroupRevealPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [presentation, setPresentation] = useState<RevealPresentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedCard, setRevealedCard] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPresentation = async () => {
      setLoading(true);
      const result = await getRevealPresentationData(id);

      if (!isMounted) {
        return;
      }

      if (!result.success || !result.data) {
        setError(result.message || "Failed to load the reveal screen.");
        setLoading(false);
        return;
      }

      setPresentation(result.data);
      setError("");
      setLoading(false);
    };

    void loadPresentation();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    router.prefetch(`/group/${id}`);
  }, [id, router]);

  const aliasEntries = presentation?.aliasEntries || [];
  const safeIndex =
    aliasEntries.length === 0 ? 0 : Math.min(currentIndex, aliasEntries.length - 1);
  const activeEntry = aliasEntries[safeIndex] || null;

  const progressLabel = useMemo(() => {
    if (aliasEntries.length === 0) {
      return "0 of 0";
    }

    return `${safeIndex + 1} of ${aliasEntries.length}`;
  }, [aliasEntries.length, safeIndex]);

  const handleNext = () => {
    if (safeIndex >= aliasEntries.length - 1) {
      return;
    }

    setCurrentIndex((current) => current + 1);
    setRevealedCard(false);
  };

  const handlePrevious = () => {
    if (safeIndex === 0) {
      return;
    }

    setCurrentIndex((current) => current - 1);
    setRevealedCard(false);
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
        setPresentation((currentPresentation) =>
          currentPresentation
            ? {
                ...currentPresentation,
                revealed: true,
                revealedAt: new Date().toISOString(),
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

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(180deg,#0f172a,#15384d 55%,#123226 100%)" }}
      >
        <p className="text-white text-lg font-semibold">Loading reveal screen...</p>
      </main>
    );
  }

  if (error || !presentation) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "linear-gradient(180deg,#0f172a,#15384d 55%,#123226 100%)" }}
      >
        <div
          className="max-w-[560px] rounded-[28px] p-8 text-center"
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

      <FadeIn className="max-w-[980px] mx-auto px-4 py-6 md:py-8">
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
          className="rounded-[32px] overflow-hidden"
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
                  {presentation.groupName} Codename Reveal
                </div>
                <div className="text-[14px] font-semibold mt-2" style={{ color: "#cbd5e1" }}>
                  This screen is meant for the venue display. Show one codename at a time, then
                  flip it to reveal the real person when the room is ready.
                </div>
              </div>

              <div
                className="px-4 py-2 rounded-2xl text-[12px] font-extrabold"
                style={{
                  background: presentation.revealed
                    ? "rgba(34,197,94,.14)"
                    : "rgba(251,191,36,.16)",
                  color: presentation.revealed ? "#86efac" : "#fde68a",
                }}
              >
                {presentation.revealed
                  ? `Reveal live - ${formatRevealTime(presentation.revealedAt)}`
                  : presentation.isOwner
                    ? "Private presentation mode"
                    : "Waiting for the owner to publish"}
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {actionMessage && (
              <div
                className="rounded-2xl px-4 py-3 text-sm font-bold mb-5"
                style={{
                  background: actionMessage.toLowerCase().includes("triggered")
                    ? "rgba(34,197,94,.12)"
                    : "rgba(239,68,68,.12)",
                  color: actionMessage.toLowerCase().includes("triggered") ? "#86efac" : "#fecaca",
                  border: actionMessage.toLowerCase().includes("triggered")
                    ? "1px solid rgba(34,197,94,.18)"
                    : "1px solid rgba(239,68,68,.2)",
                }}
              >
                {actionMessage}
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
                    One codename. One reveal moment.
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
                    {revealedCard ? "Owner revealed" : "Codename hidden"}
                  </div>
                </div>
              </div>

              {activeEntry ? (
                <div
                  className="rounded-[32px] px-6 py-8 md:px-10 md:py-10 min-h-[520px] flex flex-col justify-between"
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
                      {revealedCard ? "Identity revealed" : "Mystery codename"}
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
                        ? "Owner controls the reveal pace"
                        : "Audience view"}
                    </div>
                  </div>

                  <div className="text-center px-2 md:px-8">
                    <div className="text-[64px] md:text-[82px] mb-6">
                      {revealedCard ? activeEntry.avatarEmoji : "🎭"}
                    </div>
                    <div
                      className="text-[44px] md:text-[72px] leading-none font-bold text-white"
                      style={{ fontFamily: "'Fredoka', sans-serif" }}
                    >
                      {revealedCard ? activeEntry.realName : activeEntry.alias}
                    </div>
                    <div
                      className="text-[16px] md:text-[22px] font-semibold mt-5"
                      style={{ color: "#dbeafe" }}
                    >
                      {revealedCard
                        ? `Codename: ${activeEntry.alias}`
                        : "Keep the codename on screen first, then flip when everyone is ready."}
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setRevealedCard((current) => !current)}
                      className="px-6 py-3 rounded-2xl text-sm font-extrabold text-white"
                      style={{
                        background: revealedCard
                          ? "linear-gradient(135deg,#1d4ed8,#3b82f6)"
                          : "linear-gradient(135deg,#7e22ce,#a855f7)",
                        border: "none",
                      }}
                    >
                      {revealedCard ? "Show Codename Again" : "Reveal Owner"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-[28px] p-8 text-center"
                  style={{
                    background: "rgba(15,23,42,.54)",
                    border: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  <div className="text-[22px] font-bold text-white mb-2">No codenames yet</div>
                  <p className="text-[14px] font-semibold" style={{ color: "#cbd5e1" }}>
                    Accepted members need nicknames before this reveal screen can be used.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={safeIndex === 0}
                  className="px-5 py-2.5 rounded-2xl text-sm font-extrabold"
                  style={{
                    color: safeIndex === 0 ? "#94a3b8" : "#fff",
                    background: safeIndex === 0 ? "rgba(148,163,184,.16)" : "rgba(15,23,42,.48)",
                    border: "1px solid rgba(255,255,255,.08)",
                    cursor: safeIndex === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Previous
                </button>

                <div
                  className="text-[12px] md:text-[13px] font-semibold text-center max-w-[460px]"
                  style={{ color: "#cbd5e1" }}
                >
                  This screen stays spoiler-free on purpose. It only shows the current codename so
                  the audience does not accidentally see the rest of the reveal early.
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={safeIndex >= aliasEntries.length - 1}
                  className="px-5 py-2.5 rounded-2xl text-sm font-extrabold"
                  style={{
                    color: safeIndex >= aliasEntries.length - 1 ? "#94a3b8" : "#fff",
                    background:
                      safeIndex >= aliasEntries.length - 1
                        ? "rgba(148,163,184,.16)"
                        : "rgba(15,23,42,.48)",
                    border: "1px solid rgba(255,255,255,.08)",
                    cursor: safeIndex >= aliasEntries.length - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </main>
  );
}
