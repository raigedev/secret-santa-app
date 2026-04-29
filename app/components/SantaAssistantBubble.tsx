"use client";

import Link from "next/link";
import type { SantaAssistantTip } from "@/lib/santaAssistantTips";

type SantaAssistantBubbleProps = {
  onClose: () => void;
  onMinimize: () => void;
  onNext: () => void;
  onPrevious: () => void;
  tip: SantaAssistantTip;
  tipCount: number;
  tipIndex: number;
};

export function SantaAssistantBubble({
  onClose,
  onMinimize,
  onNext,
  onPrevious,
  tip,
  tipCount,
  tipIndex,
}: SantaAssistantBubbleProps) {
  return (
    <section
      role="dialog"
      aria-label="Secret Santa assistant tip"
      data-testid="santa-assistant-bubble"
      className="santa-assistant-bubble w-[min(calc(100vw-2rem),22rem)] rounded-[26px] border border-[rgba(72,102,78,.18)] bg-[#fffefa] p-4 text-left shadow-[0_24px_70px_rgba(46,52,50,.18)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a43c3f]">
            Santa Buddy
          </p>
          <h2 className="mt-1 text-[18px] font-black leading-tight text-[#2e3432]">
            {tip.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onMinimize}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(72,102,78,.14)] bg-white text-[15px] font-black text-[#48664e] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e]"
            aria-label="Minimize Santa Buddy"
            title="Minimize"
          >
            -
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(72,102,78,.14)] bg-white text-[15px] font-black text-[#48664e] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e]"
            aria-label="Close Santa Buddy tip"
            title="Close"
          >
            x
          </button>
        </div>
      </div>

      <p className="mt-3 text-[13px] font-semibold leading-relaxed text-[#64748b]">
        {tip.body}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            className="min-h-10 rounded-full border border-[rgba(72,102,78,.14)] bg-white px-4 text-[12px] font-extrabold text-[#48664e] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e]"
            aria-label="Show previous Santa Buddy tip"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            className="min-h-10 rounded-full bg-[#48664e] px-4 text-[12px] font-extrabold text-white transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e]"
            aria-label="Show next Santa Buddy tip"
          >
            Next
          </button>
        </div>
        <span className="text-[11px] font-extrabold text-[#94a3b8]">
          {tipIndex + 1} of {tipCount}
        </span>
      </div>

      {tip.href && tip.actionLabel && (
        <Link
          href={tip.href}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[#c71824] px-4 text-[12px] font-extrabold text-white no-underline transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a43c3f]"
        >
          {tip.actionLabel}
        </Link>
      )}
    </section>
  );
}
