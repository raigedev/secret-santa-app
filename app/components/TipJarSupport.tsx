"use client";

import Image from "next/image";
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
    eyebrow: "Optional support",
    title: "Celebrate with a tiny tip.",
  },
  profile: {
    body:
      "The app stays free to use. Tips help cover hosting, email, and little improvements.",
    eyebrow: "Optional support",
    title: "Support My Secret Santa.",
  },
  settings: {
    body:
      "If the app helped your exchange run smoother, an optional tip helps keep it maintained.",
    eyebrow: "Optional support",
    title: "Keep the magic running.",
  },
};

function TipJarIcon({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center text-[#812227] ${
        compact ? "h-10 w-10" : "h-16 w-16"
      }`}
      aria-hidden="true"
    >
      <Image
        src="/santa-tip-jar.svg"
        alt=""
        width={compact ? 40 : 64}
        height={compact ? 40 : 64}
        className="h-full w-full object-contain"
        draggable={false}
        unoptimized
      />
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
        <span className="footer-tip-jar-eyebrow">Like the app?</span>
        <span className="footer-tip-jar-label">Support us</span>
      </span>
    </a>
  );
}

export function TipJarNavLink() {
  const tipJarUrl = getSafeTipJarUrl();

  if (!tipJarUrl) {
    return null;
  }

  return (
    <a
      className="nav-tip-jar-link"
      href={tipJarUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      <TipJarIcon compact />
      <span className="nav-tip-jar-copy">
        <span className="nav-tip-jar-eyebrow">Like the app?</span>
        <span className="nav-tip-jar-label">Support us</span>
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
            Support us
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
