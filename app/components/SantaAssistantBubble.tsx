"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { SantaAssistantAnswer, SantaAssistantTip } from "@/lib/santaAssistantTips";

type SantaAssistantBubbleProps = {
  answer: SantaAssistantAnswer | null;
  onClose: () => void;
  onHide: () => void;
  onMinimize: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSubmitQuestion: (question: string) => void;
  tip: SantaAssistantTip;
  tipCount: number;
  tipIndex: number;
};

export function SantaAssistantBubble({
  answer,
  onClose,
  onHide,
  onMinimize,
  onNext,
  onPrevious,
  onSubmitQuestion,
  tip,
  tipCount,
  tipIndex,
}: SantaAssistantBubbleProps) {
  const [question, setQuestion] = useState("");
  const activeMessage = answer || tip;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitQuestion(question);
    setQuestion("");
  };

  return (
    <section
      role="dialog"
      aria-label="Secret Santa assistant tip"
      data-testid="santa-assistant-bubble"
      className="santa-assistant-bubble pointer-events-auto w-[min(calc(100vw-2rem),23rem)] rounded-[24px] border border-[rgba(72,102,78,.18)] bg-[#fffefa] p-4 text-left shadow-[0_24px_70px_rgba(46,52,50,.18)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a43c3f]">
            Santa Buddy
          </p>
          <h2 className="mt-1 text-[18px] font-black leading-tight text-[#2e3432]">
            {activeMessage.title}
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
        {activeMessage.body}
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

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor="santa-assistant-question">
          Ask Santa Buddy
        </label>
        <input
          id="santa-assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about gifts..."
          className="min-h-11 min-w-0 flex-1 rounded-full border border-[rgba(72,102,78,.16)] bg-white px-4 text-[13px] font-semibold text-[#2e3432] outline-none transition placeholder:text-[#94a3b8] focus:border-[#48664e] focus:ring-2 focus:ring-[rgba(72,102,78,.18)]"
        />
        <button
          type="submit"
          className="min-h-11 rounded-full bg-[#48664e] px-4 text-[12px] font-extrabold text-white transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e]"
        >
          Ask
        </button>
      </form>

      {activeMessage.href && activeMessage.actionLabel && (
        <Link
          href={activeMessage.href}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[#c71824] px-4 text-[12px] font-extrabold text-white no-underline transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a43c3f]"
        >
          {activeMessage.actionLabel}
        </Link>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[rgba(72,102,78,.12)] pt-3">
        <span className="text-[11px] font-semibold leading-4 text-[#64748b]">
          Prefer a quieter app?
        </span>
        <button
          type="button"
          onClick={onHide}
          className="rounded-full border border-[rgba(72,102,78,.16)] bg-white px-3 py-2 text-[11px] font-extrabold text-[#48664e] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e]"
        >
          Hide Santa Buddy
        </button>
      </div>
    </section>
  );
}
