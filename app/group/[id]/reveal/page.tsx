"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import FadeIn from "@/app/components/FadeIn";
import { getRevealPresentationData, triggerReveal } from "../actions";

type AliasEntry = {
  alias: string;
  avatarEmoji: string;
  realName: string;
};

type MatchEntry = {
  giverAlias: string;
  giverAvatarEmoji: string;
  giverName: string;
  receiverAlias: string;
  receiverAvatarEmoji: string;
  receiverName: string;
};

type RevealPresentation = {
  aliasEntries: AliasEntry[];
  canPreviewBeforeReveal: boolean;
  groupName: string;
  isOwner: boolean;
  matchEntries: MatchEntry[];
  revealed: boolean;
  revealedAt: string | null;
};

type RevealMode = "alias" | "match";

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
  const [mode, setMode] = useState<RevealMode>("alias");
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

  const activeItems = mode === "alias" ? presentation?.aliasEntries || [] : presentation?.matchEntries || [];
  const safeIndex = activeItems.length === 0 ? 0 : Math.min(currentIndex, activeItems.length - 1);
  const activeItem = activeItems[safeIndex];

  const handleSwitchMode = (nextMode: RevealMode) => {
    setMode(nextMode);
    setCurrentIndex(0);
    setRevealedCard(false);
  };

  const handleNext = () => {
    if (safeIndex >= activeItems.length - 1) {
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
        "Publish the reveal to the whole group now? Accepted members will be able to open the reveal after this."
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
      // Best-effort TV mode only.
    }
  };

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(180deg,#0f172a,#163b2f 65%,#11233a 100%)" }}
      >
        <p className="text-white text-lg font-semibold">Loading reveal screen...</p>
      </main>
    );
  }

  if (error || !presentation) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "linear-gradient(180deg,#0f172a,#163b2f 65%,#11233a 100%)" }}
      >
        <div
          className="max-w-[560px] rounded-[28px] p-8 text-center"
          style={{
            background: "rgba(15,23,42,.72)",
            border: "1px solid rgba(255,255,255,.08)",
            boxShadow: "0 20px 50px rgba(0,0,0,.28)",
          }}
        >
          <div className="text-[34px] mb-3">🎬</div>
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
          "radial-gradient(circle at top,rgba(34,197,94,.18),transparent 28%),linear-gradient(180deg,#0b1220 0%,#10223b 36%,#113227 72%,#0d1626 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka:wght@500;600;700&display=swap');
      `}</style>

      <FadeIn className="max-w-[1200px] mx-auto px-4 py-6">
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
            ← Back to Group
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
              🖥️ TV Mode
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
                {publishing ? "Publishing..." : "🎉 Publish Reveal"}
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
            className="px-6 py-6"
            style={{
              background:
                "linear-gradient(135deg,rgba(15,23,42,.88),rgba(17,50,39,.86),rgba(30,64,175,.76))",
            }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div
                  className="text-[34px] font-bold text-white"
                  style={{ fontFamily: "'Fredoka', sans-serif" }}
                >
                  🎬 {presentation.groupName} Reveal
                </div>
                <div className="text-[14px] font-semibold mt-2" style={{ color: "#cbd5e1" }}>
                  Preview both reveal styles on a TV-friendly screen before you decide how to run
                  the event.
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
                  ? `Reveal live • ${formatRevealTime(presentation.revealedAt)}`
                  : presentation.isOwner
                    ? "Preview mode before publishing"
                    : "Waiting for the owner to publish"}
              </div>
            </div>

            <div className="mt-5 flex gap-3 flex-wrap">
              {[
                {
                  id: "alias" as const,
                  title: "Alias Reveal",
                  description: "Reveal who owns each codename one by one.",
                },
                {
                  id: "match" as const,
                  title: "Match Reveal",
                  description: "Reveal who got who after the codename reveal.",
                },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSwitchMode(option.id)}
                  className="px-4 py-3 rounded-2xl text-left min-w-[220px]"
                  style={{
                    background:
                      mode === option.id ? "rgba(255,255,255,.16)" : "rgba(15,23,42,.28)",
                    border:
                      mode === option.id
                        ? "1px solid rgba(255,255,255,.18)"
                        : "1px solid rgba(255,255,255,.06)",
                    color: "#fff",
                  }}
                >
                  <div className="text-[15px] font-bold">{option.title}</div>
                  <div className="text-[12px] font-semibold mt-1" style={{ color: "#cbd5e1" }}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
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

            <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_.85fr] gap-6">
              <div
                className="rounded-[28px] p-6"
                style={{
                  background:
                    mode === "alias"
                      ? "linear-gradient(180deg,rgba(126,34,206,.16),rgba(15,23,42,.56))"
                      : "linear-gradient(180deg,rgba(22,163,74,.16),rgba(15,23,42,.56))",
                  border: "1px solid rgba(255,255,255,.08)",
                  minHeight: "520px",
                }}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                  <div>
                    <div className="text-[13px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "#cbd5e1" }}>
                      {mode === "alias" ? "Codename Reveal" : "Secret Santa Match Reveal"}
                    </div>
                    <div
                      className="text-[28px] font-bold mt-2 text-white"
                      style={{ fontFamily: "'Fredoka', sans-serif" }}
                    >
                      {mode === "alias"
                        ? "One codename flips into a real person"
                        : "One Secret Santa pairing at a time"}
                    </div>
                  </div>

                  <div
                    className="px-4 py-2 rounded-2xl text-[12px] font-extrabold"
                    style={{
                      background: "rgba(15,23,42,.48)",
                      color: "#e2e8f0",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    Item {activeItems.length === 0 ? 0 : safeIndex + 1} of {activeItems.length}
                  </div>
                </div>

                {mode === "alias" && activeItem && (
                  <div
                    className="rounded-[30px] p-8 h-[380px] flex flex-col justify-between"
                    style={{
                      background: revealedCard
                        ? "linear-gradient(135deg,rgba(34,197,94,.24),rgba(15,23,42,.72))"
                        : "linear-gradient(135deg,rgba(29,78,216,.18),rgba(15,23,42,.72))",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <div className="text-[14px] font-extrabold uppercase tracking-[0.18em]" style={{ color: "#bfdbfe" }}>
                      {revealedCard ? "Owner Revealed" : "Mystery Codename"}
                    </div>

                    <div className="text-center px-4">
                      <div className="text-[60px] mb-4">
                        {revealedCard ? (activeItem as AliasEntry).avatarEmoji : "🎭"}
                      </div>
                      <div
                        className="text-[54px] leading-none font-bold text-white"
                        style={{ fontFamily: "'Fredoka', sans-serif" }}
                      >
                        {revealedCard ? (activeItem as AliasEntry).realName : (activeItem as AliasEntry).alias}
                      </div>
                      <div className="text-[18px] font-semibold mt-4" style={{ color: "#cbd5e1" }}>
                        {revealedCard
                          ? `Codename: ${(activeItem as AliasEntry).alias}`
                          : "Build suspense, then flip this card to reveal the owner."}
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
                        {revealedCard ? "Flip Back to Alias" : "Reveal Owner"}
                      </button>
                    </div>
                  </div>
                )}

                {mode === "match" && activeItem && (
                  <div
                    className="rounded-[30px] p-8 h-[380px] flex flex-col justify-between"
                    style={{
                      background: revealedCard
                        ? "linear-gradient(135deg,rgba(34,197,94,.24),rgba(15,23,42,.72))"
                        : "linear-gradient(135deg,rgba(245,158,11,.18),rgba(15,23,42,.72))",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <div className="text-[14px] font-extrabold uppercase tracking-[0.18em]" style={{ color: "#fde68a" }}>
                      {revealedCard ? "Match Revealed" : "Who did this Secret Santa draw?"}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-6 px-2">
                      <div className="text-center">
                        <div className="text-[48px] mb-2">{(activeItem as MatchEntry).giverAvatarEmoji}</div>
                        <div
                          className="text-[24px] font-bold text-white"
                          style={{ fontFamily: "'Fredoka', sans-serif" }}
                        >
                          {(activeItem as MatchEntry).giverName}
                        </div>
                        <div className="text-[14px] font-semibold mt-2" style={{ color: "#cbd5e1" }}>
                          Alias: {(activeItem as MatchEntry).giverAlias}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-[48px] font-black" style={{ color: "#fbbf24" }}>
                          →
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-[48px] mb-2">
                          {revealedCard ? (activeItem as MatchEntry).receiverAvatarEmoji : "🎁"}
                        </div>
                        <div
                          className="text-[24px] font-bold text-white"
                          style={{ fontFamily: "'Fredoka', sans-serif" }}
                        >
                          {revealedCard ? (activeItem as MatchEntry).receiverName : (activeItem as MatchEntry).receiverAlias}
                        </div>
                        <div className="text-[14px] font-semibold mt-2" style={{ color: "#cbd5e1" }}>
                          {revealedCard
                            ? `Alias: ${(activeItem as MatchEntry).receiverAlias}`
                            : "Reveal the codename owner when you're ready."}
                        </div>
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
                            : "linear-gradient(135deg,#b45309,#f59e0b)",
                          border: "none",
                        }}
                      >
                        {revealedCard ? "Hide Receiver" : "Reveal Match"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 mt-5 flex-wrap">
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
                    ← Previous
                  </button>

                  <div className="text-[12px] font-semibold text-center" style={{ color: "#cbd5e1" }}>
                    {presentation.isOwner
                      ? "Use this as your event screen preview. Flip each card when the room is ready."
                      : "The owner is controlling the reveal order. This page shows the final presentation style."}
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={safeIndex >= activeItems.length - 1}
                    className="px-5 py-2.5 rounded-2xl text-sm font-extrabold"
                    style={{
                      color: safeIndex >= activeItems.length - 1 ? "#94a3b8" : "#fff",
                      background:
                        safeIndex >= activeItems.length - 1 ? "rgba(148,163,184,.16)" : "rgba(15,23,42,.48)",
                      border: "1px solid rgba(255,255,255,.08)",
                      cursor: safeIndex >= activeItems.length - 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                <div
                  className="rounded-[26px] p-5"
                  style={{
                    background: "rgba(15,23,42,.54)",
                    border: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  <div
                    className="text-[18px] font-bold text-white"
                    style={{ fontFamily: "'Fredoka', sans-serif" }}
                  >
                    Why this exists
                  </div>
                  <div className="text-[13px] font-semibold mt-3 space-y-3" style={{ color: "#cbd5e1" }}>
                    <p>Alias Reveal works for gifts labeled with codenames at the venue.</p>
                    <p>Match Reveal works when you also want to show who got whom after the alias reveal.</p>
                    <p>This page lets you compare both outputs before we build the full viral watch-party version.</p>
                  </div>
                </div>

                <div
                  className="rounded-[26px] p-5"
                  style={{
                    background: "rgba(15,23,42,.54)",
                    border: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  <div
                    className="text-[18px] font-bold text-white"
                    style={{ fontFamily: "'Fredoka', sans-serif" }}
                  >
                    {mode === "alias" ? "Alias Lineup" : "Match Lineup"}
                  </div>
                  <div className="flex flex-col gap-2 mt-4 max-h-[360px] overflow-auto pr-1">
                    {mode === "alias"
                      ? presentation.aliasEntries.map((entry, index) => (
                          <button
                            key={`${entry.alias}-${entry.realName}`}
                            type="button"
                            onClick={() => {
                              setCurrentIndex(index);
                              setRevealedCard(false);
                            }}
                            className="w-full text-left rounded-2xl px-4 py-3"
                            style={{
                              background: index === safeIndex ? "rgba(168,85,247,.18)" : "rgba(255,255,255,.04)",
                              border:
                                index === safeIndex
                                  ? "1px solid rgba(216,180,254,.3)"
                                  : "1px solid rgba(255,255,255,.05)",
                              color: "#fff",
                            }}
                          >
                            <div className="text-[14px] font-bold">{entry.alias}</div>
                            <div className="text-[12px] font-semibold mt-1" style={{ color: "#cbd5e1" }}>
                              {entry.realName}
                            </div>
                          </button>
                        ))
                      : presentation.matchEntries.map((entry, index) => (
                          <button
                            key={`${entry.giverAlias}-${entry.receiverAlias}`}
                            type="button"
                            onClick={() => {
                              setCurrentIndex(index);
                              setRevealedCard(false);
                            }}
                            className="w-full text-left rounded-2xl px-4 py-3"
                            style={{
                              background: index === safeIndex ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.04)",
                              border:
                                index === safeIndex
                                  ? "1px solid rgba(134,239,172,.25)"
                                  : "1px solid rgba(255,255,255,.05)",
                              color: "#fff",
                            }}
                          >
                            <div className="text-[14px] font-bold">
                              {entry.giverAlias} → {entry.receiverAlias}
                            </div>
                            <div className="text-[12px] font-semibold mt-1" style={{ color: "#cbd5e1" }}>
                              {entry.giverName} → {entry.receiverName}
                            </div>
                          </button>
                        ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </main>
  );
}
