"use client";

import type { ReactNode } from "react";
import { getSafeTipJarUrl } from "@/lib/support/tip-jar";

type TipJarContext = "footer" | "group-created" | "profile" | "settings";

type TipJarSupportCardProps = {
  className?: string;
  context?: Exclude<TipJarContext, "footer">;
  isDarkTheme?: boolean;
  onDismiss?: () => void;
};

type TipJarCopy = {
  body: string;
  eyebrow: string;
  title: string;
};

const TIP_JAR_COPY: Record<Exclude<TipJarContext, "footer">, TipJarCopy> = {
  "group-created": {
    body:
      "Your exchange is ready. If this made setup easier, you can leave an optional tip to help with hosting and future improvements.",
    eyebrow: "Optional support",
    title: "Nice, the group is created.",
  },
  profile: {
    body:
      "The app stays free to use. Tips are optional and help cover hosting, email, and ongoing polish.",
    eyebrow: "Support the project",
    title: "Enjoying the app?",
  },
  settings: {
    body:
      "If the app helped your exchange run smoother, an optional tip helps keep the project maintained.",
    eyebrow: "Optional support",
    title: "Support future improvements.",
  },
};

function TipJarIcon() {
  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] bg-[#fff3cf] text-[#7b5902] shadow-[inset_0_0_0_1px_rgba(123,89,2,.12)]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path
          d="M5.5 10.5h13v7.25a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V10.5Z"
          fill="currentColor"
          opacity=".16"
        />
        <path
          d="M4.75 8.25h14.5v3.25H4.75V8.25Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="M6.25 11.5v6.25a2 2 0 0 0 2 2h7.5a2 2 0 0 0 2-2V11.5M12 8.25v11.5M8 5.9c0-1.15.9-1.9 1.9-1.65 1.35.35 2.1 2.35 2.1 4h-1.4C9 8.25 8 7.1 8 5.9ZM16 5.9c0-1.15-.9-1.9-1.9-1.65-1.35.35-2.1 2.35-2.1 4h1.4c1.6 0 2.6-1.15 2.6-2.35Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    </span>
  );
}

function ExternalArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M5.25 4.25h6.5v6.5M11.25 4.75l-7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function TipJarFooterLink({ children = "Support the project" }: { children?: ReactNode }) {
  const tipJarUrl = getSafeTipJarUrl();

  if (!tipJarUrl) {
    return null;
  }

  return (
    <a href={tipJarUrl} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function TipJarSupportCard({
  className = "",
  context = "profile",
  isDarkTheme = false,
  onDismiss,
}: TipJarSupportCardProps) {
  const tipJarUrl = getSafeTipJarUrl();

  if (!tipJarUrl) {
    return null;
  }

  const copy = TIP_JAR_COPY[context];
  const panelClass = isDarkTheme
    ? "border border-slate-700/60 bg-slate-900/62 text-slate-100"
    : "holiday-panel text-[#2e3432]";
  const mutedClass = isDarkTheme ? "text-slate-400" : "text-slate-600";

  return (
    <section
      className={`${panelClass} ${className} rounded-[28px] p-5 sm:p-6`}
      aria-label="Optional project support"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <TipJarIcon />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7b5902]">
              {copy.eyebrow}
            </p>
            <h2 className="mt-1 font-[var(--app-display-font)] text-[23px] font-black leading-tight">
              {copy.title}
            </h2>
            <p className={`mt-2 max-w-2xl text-[13px] font-bold leading-6 ${mutedClass}`}>
              {copy.body}
            </p>
            <p className={`mt-1 text-[11px] font-semibold leading-5 ${mutedClass}`}>
              Tips are handled on the provider&apos;s secure page and never change app access.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <a
            className="gift-button gift-button-gold gift-button-compact text-sm"
            href={tipJarUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Leave a tip
            <span className="gift-button-icon" aria-hidden="true">
              <ExternalArrowIcon />
            </span>
          </a>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="gift-button gift-button-ghost gift-button-compact text-[12px]"
            >
              Not now
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
