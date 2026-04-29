"use client";

import { SantaAssistantBubble } from "@/app/components/SantaAssistantBubble";
import { useSantaAssistant } from "@/app/hooks/useSantaAssistant";

function SantaBuddyCharacter({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-16 sm:h-32 sm:w-32"
      viewBox="0 0 150 170"
      fill="none"
    >
      <ellipse cx="75" cy="154" rx="34" ry="8" fill="rgba(46,52,50,.18)" />
      <g className="santa-assistant-staff">
        <path d="M119 60c10 26 8 61-7 91" stroke="#48664e" strokeWidth="6" strokeLinecap="round" />
        <path d="M111 55l6-12 6 12 12 6-12 6-6 12-6-12-12-6 12-6Z" fill="#fcce72" />
        <path d="M113 61h9M117 56v10" stroke="#a43c3f" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      <path
        d="M36 154c-3-34 4-70 24-91 8-8 23-8 31 0 19 21 28 57 24 91H36Z"
        fill="#48664e"
      />
      <path
        d="M48 151c1-22 8-53 28-77 20 24 28 55 29 77H48Z"
        fill="#3c5a43"
      />
      <path
        d="M53 91c11 6 35 6 46 0"
        stroke="#fcce72"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />
      <path d="M50 118h51" stroke="#f8f1e8" strokeWidth="5" strokeLinecap="round" strokeDasharray="8 10" />
      <path d="M67 74h18v78H67V74Z" fill="rgba(252,206,114,.18)" />
      <path d="M67 124h18" stroke="#fcce72" strokeWidth="4" strokeLinecap="round" />

      <g className="santa-assistant-wave-hand">
        <path d="M42 95c-11-6-16-16-12-25" stroke="#f1bba6" strokeWidth="10" strokeLinecap="round" />
        <path d="M30 69c-6-4-8-8-6-13" stroke="#f1bba6" strokeWidth="5" strokeLinecap="round" />
      </g>
      <path d="M108 96c8-6 13-16 10-28" stroke="#f1bba6" strokeWidth="10" strokeLinecap="round" />

      <path
        d="M43 61c0-22 14-38 33-38s33 16 33 38c0 24-14 42-33 42S43 85 43 61Z"
        fill="#f1bba6"
      />
      <path
        d="M42 61c5-19 20-28 36-28 17 0 29 10 34 28-8-7-20-11-35-11-14 0-27 4-35 11Z"
        fill="#c71824"
      />
      <path
        d="M43 58c11 6 55 6 67 0"
        stroke="#fffefa"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path d="M69 21c8-16 26-20 41-8-12 1-19 7-21 18" fill="#c71824" />
      <circle cx="110" cy="13" r="9" fill="#fffefa" />
      <g className="santa-assistant-eyes">
        <circle cx="65" cy="65" r="3.2" fill="#2e3432" />
        <circle cx="86" cy="65" r="3.2" fill="#2e3432" />
      </g>
      <path d="M70 77c4 3 9 3 13 0" stroke="#a43c3f" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M49 80c5 25 45 27 54 1-14 10-41 10-54-1Z"
        fill="#fffefa"
      />
      <path
        d="M57 84c8 15 30 16 39 1-10 5-29 5-39-1Z"
        fill="#f8f1e8"
      />

      <g className="santa-assistant-gift">
        <path d="M18 116h28v26H18v-26Z" fill="#a43c3f" />
        <path d="M31 116v26M18 128h28" stroke="#fcce72" strokeWidth="4" />
        <path d="M25 115c-6-8 4-15 7-2 4-13 14-6 7 2" stroke="#fcce72" strokeWidth="4" strokeLinecap="round" />
      </g>

      <circle className="santa-assistant-sparkle-one" cx="25" cy="45" r="3" fill="#fcce72" />
      <circle className="santa-assistant-sparkle-two" cx="128" cy="96" r="3" fill="#a43c3f" />
      {isOpen && (
        <path
          className="santa-assistant-open-spark"
          d="M125 31l3-7 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"
          fill="#fcce72"
        />
      )}
    </svg>
  );
}

export function SantaAssistant() {
  const {
    close,
    hide,
    isMinimized,
    isOpen,
    lastAnswer,
    minimize,
    nextTip,
    open,
    previousTip,
    shouldRender,
    submitQuestion,
    tip,
    tipCount,
    tipIndex,
  } = useSantaAssistant();

  if (!shouldRender) {
    return null;
  }

  return (
    <aside
      data-testid="santa-assistant"
      className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+.75rem)] right-2 z-[55] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-2 sm:right-5 sm:bottom-4"
      aria-label="Santa Buddy assistant"
    >
      <style>{`
        .santa-assistant-avatar{filter:drop-shadow(0 18px 24px rgba(46,52,50,.22));animation:santa-assistant-float 4.8s cubic-bezier(.25,1,.5,1) infinite;}
        .santa-assistant-button:hover .santa-assistant-wave-hand,
        .santa-assistant-button:focus-visible .santa-assistant-wave-hand{animation:santa-assistant-wave .75s cubic-bezier(.25,1,.5,1) infinite;transform-origin:42px 95px;}
        .santa-assistant-button:hover .santa-assistant-gift,
        .santa-assistant-button:focus-visible .santa-assistant-gift{animation:santa-assistant-gift-hop .75s cubic-bezier(.25,1,.5,1) infinite;}
        .santa-assistant-eyes{animation:santa-assistant-blink 4.6s ease-in-out infinite;transform-origin:75px 65px;}
        .santa-assistant-staff{animation:santa-assistant-staff 3.4s ease-in-out infinite;transform-origin:114px 151px;}
        .santa-assistant-sparkle-one,.santa-assistant-sparkle-two,.santa-assistant-open-spark{animation:santa-assistant-sparkle 1.4s ease-in-out infinite;transform-origin:center;}
        .santa-assistant-sparkle-two{animation-delay:.45s;}
        .santa-assistant-bubble{animation:santa-assistant-panel-in .2s cubic-bezier(.22,1,.36,1);}
        @keyframes santa-assistant-float{0%,100%{transform:translate3d(0,0,0) rotate(-1deg);}50%{transform:translate3d(0,-8px,0) rotate(1deg);}}
        @keyframes santa-assistant-wave{0%,100%{transform:rotate(0deg);}50%{transform:rotate(-15deg);}}
        @keyframes santa-assistant-gift-hop{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}
        @keyframes santa-assistant-blink{0%,92%,100%{transform:scaleY(1);}95%{transform:scaleY(.14);}}
        @keyframes santa-assistant-staff{0%,100%{transform:rotate(-2deg);}50%{transform:rotate(3deg);}}
        @keyframes santa-assistant-sparkle{0%,100%{opacity:.48;transform:scale(.78);}50%{opacity:1;transform:scale(1.18);}}
        @keyframes santa-assistant-panel-in{from{opacity:0;transform:translate3d(0,10px,0) scale(.98);}to{opacity:1;transform:translate3d(0,0,0) scale(1);}}
        @media (prefers-reduced-motion: reduce){
          .santa-assistant-avatar,
          .santa-assistant-button:hover .santa-assistant-wave-hand,
          .santa-assistant-button:focus-visible .santa-assistant-wave-hand,
          .santa-assistant-button:hover .santa-assistant-gift,
          .santa-assistant-button:focus-visible .santa-assistant-gift,
          .santa-assistant-eyes,
          .santa-assistant-staff,
          .santa-assistant-sparkle-one,
          .santa-assistant-sparkle-two,
          .santa-assistant-open-spark,
          .santa-assistant-bubble{animation:none!important;transition:none!important;}
        }
      `}</style>

      {isOpen && (
        <SantaAssistantBubble
          answer={lastAnswer}
          onClose={close}
          onHide={hide}
          onMinimize={minimize}
          onNext={nextTip}
          onPrevious={previousTip}
          onSubmitQuestion={submitQuestion}
          tip={tip}
          tipCount={tipCount}
          tipIndex={tipIndex}
        />
      )}

      <button
        type="button"
        data-testid="santa-assistant-toggle"
        onClick={open}
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? "Santa Buddy assistant is open"
            : isMinimized
              ? "Open minimized Santa Buddy assistant"
              : "Open Santa Buddy assistant"
        }
        className="santa-assistant-button pointer-events-auto rounded-[28px] bg-transparent p-0 transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#48664e]"
      >
        <span className="santa-assistant-avatar block">
          <SantaBuddyCharacter isOpen={isOpen} />
        </span>
      </button>
    </aside>
  );
}
