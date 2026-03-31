"use client";

import { useMemo, useState } from "react";

type ShareResultsCardProps = {
  codename: string;
  eventDate: string;
  groupName: string;
  recipientName: string;
};

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 1500;

function formatEventDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Event day";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fitCardFontSize(value: string, variant: "hero" | "detail"): number {
  const length = value.trim().length || 1;

  if (variant === "hero") {
    if (length <= 10) return 92;
    if (length <= 14) return 78;
    if (length <= 18) return 64;
    return 54;
  }

  if (length <= 12) return 56;
  if (length <= 18) return 48;
  return 40;
}

function getPreviewNameTextStyle(value: string, variant: "hero" | "detail") {
  const length = value.trim().length || 1;
  let fontSizeRem: number;

  if (variant === "hero") {
    if (length <= 8) {
      fontSizeRem = 3.2;
    } else if (length <= 11) {
      fontSizeRem = 2.6;
    } else if (length <= 14) {
      fontSizeRem = 2.15;
    } else {
      fontSizeRem = 1.8;
    }
  } else if (length <= 8) {
    fontSizeRem = 2.7;
  } else if (length <= 11) {
    fontSizeRem = 2.2;
  } else if (length <= 15) {
    fontSizeRem = 1.85;
  } else {
    fontSizeRem = 1.55;
  }

  return {
    fontSize: `${fontSizeRem}rem`,
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "clip" as const,
    maxWidth: "100%",
    letterSpacing: length >= 12 ? "-0.03em" : "-0.01em",
    lineHeight: 1.08,
  };
}

function buildShareCaption(groupName: string, codename: string, recipientName: string): string {
  return `I was ${recipientName}'s Secret Santa in ${groupName}. My codename was ${codename}.`;
}

function buildCardSvg({
  groupName,
  eventDate,
  codename,
  recipientName,
}: ShareResultsCardProps): string {
  const safeGroupName = escapeXml(groupName);
  const safeEventDate = escapeXml(formatEventDate(eventDate));
  const safeCodename = escapeXml(codename);
  const safeRecipient = escapeXml(recipientName);
  const heroFontSize = fitCardFontSize(codename, "hero");
  const detailFontSize = fitCardFontSize(recipientName, "detail");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f2f35" />
          <stop offset="52%" stop-color="#124647" />
          <stop offset="100%" stop-color="#1f5b45" />
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,.18)" />
          <stop offset="100%" stop-color="rgba(255,255,255,.08)" />
        </linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f7c948" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="22" stdDeviation="30" flood-color="rgba(7,20,24,.32)" />
        </filter>
      </defs>

      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)" />
      <circle cx="160" cy="150" r="120" fill="rgba(255,255,255,.05)" />
      <circle cx="1030" cy="1260" r="160" fill="rgba(255,255,255,.05)" />
      <rect x="58" y="58" width="${CARD_WIDTH - 116}" height="${CARD_HEIGHT - 116}" rx="56" fill="none" stroke="rgba(247,201,72,.28)" stroke-width="4" />

      <g filter="url(#shadow)">
        <rect x="110" y="120" width="980" height="1260" rx="56" fill="rgba(7,20,24,.18)" stroke="rgba(255,255,255,.12)" stroke-width="3" />
      </g>

      <text x="600" y="238" text-anchor="middle" fill="#f8fafc" font-size="52" font-weight="700" font-family="'Trebuchet MS', 'Arial Rounded MT Bold', Arial, sans-serif">
        My Secret Santa Result
      </text>
      <text x="600" y="298" text-anchor="middle" fill="#dbeafe" font-size="28" font-weight="600" font-family="Arial, sans-serif">
        ${safeGroupName}
      </text>
      <text x="600" y="338" text-anchor="middle" fill="#cbd5e1" font-size="23" font-weight="600" font-family="Arial, sans-serif">
        ${safeEventDate}
      </text>

      <rect x="170" y="410" width="860" height="330" rx="42" fill="rgba(10,26,31,.24)" stroke="rgba(255,255,255,.12)" stroke-width="2" />
      <text x="600" y="495" text-anchor="middle" fill="#bbf7d0" font-size="24" font-weight="700" letter-spacing="6" font-family="Arial, sans-serif">
        MY CODENAME
      </text>
      <text x="600" y="622" text-anchor="middle" fill="#ffffff" font-size="${heroFontSize}" font-weight="700" font-family="'Trebuchet MS', 'Arial Rounded MT Bold', Arial, sans-serif">
        ${safeCodename}
      </text>
      <text x="600" y="682" text-anchor="middle" fill="#dbeafe" font-size="28" font-weight="600" font-family="Arial, sans-serif">
        The name everyone saw on the draw board
      </text>

      <rect x="170" y="800" width="860" height="330" rx="42" fill="rgba(10,26,31,.24)" stroke="rgba(255,255,255,.12)" stroke-width="2" />
      <text x="600" y="885" text-anchor="middle" fill="url(#gold)" font-size="24" font-weight="700" letter-spacing="6" font-family="Arial, sans-serif">
        I WAS SECRET SANTA FOR
      </text>
      <text x="600" y="1012" text-anchor="middle" fill="#ffffff" font-size="${detailFontSize}" font-weight="700" font-family="'Trebuchet MS', 'Arial Rounded MT Bold', Arial, sans-serif">
        ${safeRecipient}
      </text>
      <text x="600" y="1072" text-anchor="middle" fill="#dbeafe" font-size="28" font-weight="600" font-family="Arial, sans-serif">
        I was ${safeRecipient}'s Secret Santa
      </text>

      <text x="600" y="1265" text-anchor="middle" fill="#cbd5e1" font-size="24" font-weight="600" font-family="Arial, sans-serif">
        Shared from My Secret Santa
      </text>
    </svg>
  `.trim();
}

async function svgToPngFile(svgMarkup: string, fileName: string): Promise<File> {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Failed to render the share card image."));
      nextImage.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Failed to prepare the share card canvas.");
    }

    context.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Failed to export the share card image."));
        }
      }, "image/png");
    });

    return new File([blob], fileName, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function ShareResultsCard(props: ShareResultsCardProps) {
  const [busyAction, setBusyAction] = useState<"download" | "share" | "copy" | null>(null);
  const [message, setMessage] = useState("");
  const cardCaption = useMemo(
    () => buildShareCaption(props.groupName, props.codename, props.recipientName),
    [props.codename, props.groupName, props.recipientName]
  );

  const handleDownload = async () => {
    setBusyAction("download");
    setMessage("");

    try {
      const file = await svgToPngFile(
        buildCardSvg(props),
        `${props.groupName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-result-card.png`
      );
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");

      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Result card downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to download the result card.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleShare = async () => {
    setBusyAction("share");
    setMessage("");

    try {
      const file = await svgToPngFile(
        buildCardSvg(props),
        `${props.groupName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-result-card.png`
      );

      if (
        navigator.canShare &&
        navigator.canShare({
          files: [file],
        })
      ) {
        await navigator.share({
          files: [file],
          title: `${props.groupName} Result Card`,
          text: cardCaption,
        });
        setMessage("Result card shared.");
      } else if (navigator.share) {
        await navigator.share({
          title: `${props.groupName} Result Card`,
          text: cardCaption,
        });
        setMessage("Share sheet opened.");
      } else {
        await navigator.clipboard.writeText(cardCaption);
        setMessage("Sharing is not available here. Caption copied instead.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessage("");
      } else {
        setMessage(error instanceof Error ? error.message : "Failed to share the result card.");
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyCaption = async () => {
    setBusyAction("copy");
    setMessage("");

    try {
      await navigator.clipboard.writeText(cardCaption);
      setMessage("Caption copied.");
    } catch {
      setMessage("Failed to copy the caption.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="rounded-[22px] p-5 mt-5"
      style={{
        background: "rgba(255,255,255,.82)",
        border: "1px solid rgba(15,23,42,.08)",
        boxShadow: "0 14px 32px rgba(15,23,42,.06)",
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Fredoka', sans-serif", color: "#14532d" }}
          >
            Shareable Result Card
          </div>
          <div className="text-[12px] font-semibold mt-1" style={{ color: "#64748b" }}>
            Save or share your own result after the group reveal is public.
          </div>
        </div>

        <div
          className="px-3 py-1.5 rounded-full text-[11px] font-extrabold"
          style={{ background: "rgba(21,128,61,.1)", color: "#166534" }}
        >
          Your result
        </div>
      </div>

      {/* The on-page preview mirrors the downloadable card closely enough for quick checks,
          but the exported image is generated separately so the final asset stays consistent. */}
      <div
        className="mt-4 rounded-[28px] overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at top,rgba(59,130,246,.14),transparent 26%),linear-gradient(145deg,#0f2f35,#124647 52%,#1f5b45)",
          border: "1px solid rgba(247,201,72,.18)",
          boxShadow: "0 20px 40px rgba(15,23,42,.12)",
        }}
      >
        <div className="px-5 py-6 md:px-7 md:py-8">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.22em]" style={{ color: "#bbf7d0" }}>
            My Secret Santa Result
          </div>
          <div
            className="text-[24px] md:text-[30px] font-bold mt-3 text-white"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            {props.groupName}
          </div>
          <div className="text-[12px] font-semibold mt-1" style={{ color: "#dbeafe" }}>
            {formatEventDate(props.eventDate)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <div
              className="rounded-[22px] px-4 py-4 min-w-0"
              style={{
                background: "rgba(7,20,24,.2)",
                border: "1px solid rgba(255,255,255,.08)",
              }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: "#bbf7d0" }}>
                My Codename
              </div>
              <div
                className="mt-3 font-bold text-white min-w-0 pb-1"
                style={{
                  fontFamily: "'Fredoka', sans-serif",
                  ...getPreviewNameTextStyle(props.codename, "hero"),
                }}
                title={props.codename}
              >
                {props.codename}
              </div>
            </div>

            <div
              className="rounded-[22px] px-4 py-4 min-w-0"
              style={{
                background: "rgba(7,20,24,.2)",
                border: "1px solid rgba(255,255,255,.08)",
              }}
            >
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: "#fcd34d" }}>
                  I Was Secret Santa For
                </div>
              <div
                className="mt-3 font-bold text-white min-w-0 pb-1"
                style={{
                  fontFamily: "'Fredoka', sans-serif",
                  ...getPreviewNameTextStyle(props.recipientName, "detail"),
                }}
                title={props.recipientName}
              >
                {props.recipientName}
              </div>
            </div>
          </div>

          <div
            className="mt-5 rounded-[18px] px-4 py-3 text-[14px] md:text-[15px] font-bold"
            style={{
              background: "rgba(7,20,24,.18)",
              color: "#f8fafc",
            }}
          >
            {cardCaption}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busyAction !== null}
          className="px-5 py-2.5 rounded-xl text-sm font-extrabold text-white"
          style={{
            background: busyAction === "download" ? "#94a3b8" : "linear-gradient(135deg,#1d4ed8,#3b82f6)",
            border: "none",
            cursor: busyAction !== null ? "not-allowed" : "pointer",
          }}
        >
          {busyAction === "download" ? "Preparing..." : "Download Card"}
        </button>

        <button
          type="button"
          onClick={handleShare}
          disabled={busyAction !== null}
          className="px-5 py-2.5 rounded-xl text-sm font-extrabold text-white"
          style={{
            background: busyAction === "share" ? "#94a3b8" : "linear-gradient(135deg,#15803d,#22c55e)",
            border: "none",
            cursor: busyAction !== null ? "not-allowed" : "pointer",
          }}
        >
          {busyAction === "share" ? "Preparing..." : "Share Card"}
        </button>

        <button
          type="button"
          onClick={handleCopyCaption}
          disabled={busyAction !== null}
          className="px-5 py-2.5 rounded-xl text-sm font-extrabold"
          style={{
            background: "rgba(15,23,42,.05)",
            color: "#14532d",
            border: "1px solid rgba(21,128,61,.16)",
            cursor: busyAction !== null ? "not-allowed" : "pointer",
          }}
        >
          {busyAction === "copy" ? "Copying..." : "Copy Caption"}
        </button>

        {message && (
          <span className="text-[12px] font-bold" style={{ color: message.includes("Failed") ? "#b91c1c" : "#166534" }}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
