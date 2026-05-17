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
      className="santa-assistant-bubble holiday-panel pointer-events-auto w-[min(calc(100vw-2rem),23rem)] p-4 text-left"
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
            className="gift-shell-control h-9 w-9 rounded-full text-[#48664e]"
            aria-label="Minimize Santa Buddy"
            title="Minimize"
          >
            <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-current" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="gift-shell-control relative h-9 w-9 rounded-full text-[#48664e]"
            aria-label="Close Santa Buddy tip"
            title="Close"
          >
            <span aria-hidden="true" className="absolute h-0.5 w-3.5 rotate-45 rounded-full bg-current" />
            <span aria-hidden="true" className="absolute h-0.5 w-3.5 -rotate-45 rounded-full bg-current" />
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
            className="gift-button gift-button-secondary gift-button-compact text-[12px]"
            aria-label="Show previous Santa Buddy tip"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            className="gift-button gift-button-primary gift-button-compact text-[12px]"
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
          className="gift-field gift-field-pill min-w-0 flex-1 px-4 text-[13px] font-semibold"
        />
        <button
          type="submit"
          className="gift-button gift-button-primary gift-button-compact text-[12px]"
        >
          Ask
        </button>
      </form>

      {activeMessage.href && activeMessage.actionLabel && (
        <Link
          href={activeMessage.href}
          className="gift-button gift-button-red gift-button-full gift-button-compact mt-3 text-[12px]"
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
          className="gift-button gift-button-secondary gift-button-compact text-[11px]"
        >
          Hide Santa Buddy
        </button>
      </div>
    </section>
  );
}
