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
      "Your exchange is ready. If this saved you time, an optional tip helps keep the app running.",
    eyebrow: "Support the cause",
    title: "Celebrate with a tiny tip.",
  },
  profile: {
    body:
      "The app stays free to use. Tips help cover hosting, email, and little improvements.",
    eyebrow: "Support the cause",
    title: "Tip the Santa jar.",
  },
  settings: {
    body:
      "If the app helped your exchange run smoother, an optional tip helps keep it maintained.",
    eyebrow: "Support the cause",
    title: "Keep the magic running.",
  },
};

function TipJarIcon({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center bg-[#fff7e2] text-[#812227] shadow-[inset_0_0_0_1px_rgba(123,89,2,.12),0_14px_26px_rgba(164,60,63,.08)] ${
        compact ? "h-9 w-9 rounded-[14px]" : "h-14 w-14 rounded-[22px]"
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className={compact ? "h-7 w-7" : "h-11 w-11"} fill="none">
        <ellipse cx="32" cy="55" rx="18" ry="4.5" fill="#2e3432" opacity=".12" />
        <path
          d="M19 23.5h26l-2.3 25.2A5.8 5.8 0 0 1 37 54H27a5.8 5.8 0 0 1-5.7-5.3L19 23.5Z"
          fill="#fffefa"
        />
        <path
          d="M21 24.5h22l-2.1 22.9A4.1 4.1 0 0 1 36.8 51H27.2a4.1 4.1 0 0 1-4.1-3.6L21 24.5Z"
          fill="#f9faf8"
        />
        <path
          d="M20.5 27.8c4.9 2.6 17.9 2.6 23 0M19 23.5h26l-2.3 25.2A5.8 5.8 0 0 1 37 54H27a5.8 5.8 0 0 1-5.7-5.3L19 23.5Z"
          stroke="#48664e"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.6"
        />
        <path
          d="M25 36.5c3.1-2.3 10.9-2.3 14 0"
          stroke="#d9ae56"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d="M28 41.2h8"
          stroke="#a43c3f"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d="M20 22.8C22.4 15 29 8.6 38.9 9.2c8.1.5 11.2 7.8 11.7 13.6H20Z"
          fill="#c71824"
        />
        <path
          d="M18.2 21.3h31.4"
          stroke="#fffefa"
          strokeLinecap="round"
          strokeWidth="5.5"
        />
        <circle cx="49" cy="22.7" r="5.2" fill="#fffefa" />
        <circle cx="24.5" cy="34.8" r="2.1" fill="#2e3432" />
        <circle cx="39.5" cy="34.8" r="2.1" fill="#2e3432" />
        <path
          d="M28.2 45.3c2.2 1.6 5.4 1.6 7.6 0"
          stroke="#48664e"
          strokeLinecap="round"
          strokeWidth="2.4"
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

export function TipJarFooterLink({ children }: { children?: ReactNode }) {
  const tipJarUrl = getSafeTipJarUrl();

  if (!tipJarUrl) {
    return null;
  }

  if (children) {
    return (
      <a href={tipJarUrl} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <a
      className="footer-tip-jar-link"
      href={tipJarUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      <TipJarIcon compact />
      <span className="footer-tip-jar-copy">
        <span className="footer-tip-jar-eyebrow">Support the cause</span>
        <span className="footer-tip-jar-label">Tip the Santa jar</span>
      </span>
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
    ? "border border-slate-700/60 bg-[linear-gradient(135deg,rgba(15,23,42,.9),rgba(30,41,59,.7))] text-slate-100"
    : "holiday-panel text-[#2e3432]";
  const mutedClass = isDarkTheme ? "text-slate-400" : "text-slate-600";
  const accentClass = isDarkTheme ? "text-[#fcce72]" : "text-[#a43c3f]";

  return (
    <section
      className={`${panelClass} ${className} relative overflow-hidden rounded-[28px] p-5 sm:p-6`}
      aria-label="Optional project support"
    >
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_70%_35%,rgba(252,206,114,.22),transparent_42%),linear-gradient(90deg,transparent,rgba(72,102,78,.08))] sm:block"
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <TipJarIcon />
          <div className="min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-[0.16em] ${accentClass}`}>
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
            className="gift-button gift-button-primary gift-button-compact text-sm"
            href={tipJarUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Tip the Santa jar
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
