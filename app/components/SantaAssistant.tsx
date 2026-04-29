"use client";

import { SantaAssistantBubble } from "@/app/components/SantaAssistantBubble";
import { useSantaAssistant } from "@/app/hooks/useSantaAssistant";

function SantaBuddyAvatar({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-16 sm:h-[4.75rem] sm:w-[4.75rem]"
      viewBox="0 0 120 120"
      fill="none"
    >
      <circle cx="60" cy="64" r="48" fill="#fffefa" />
      <circle cx="60" cy="64" r="45" stroke="#48664e" strokeOpacity=".24" strokeWidth="2" />
      <path
        d="M35 87c7 13 42 14 50 0 7-12-1-30-25-30S28 75 35 87Z"
        fill="#f8f1e8"
      />
      <path
        d="M40 59c1-15 10-25 22-25 14 0 24 11 25 27 1 16-10 31-25 31S39 75 40 59Z"
        fill="#f6cbb9"
      />
      <path
        d="M37 49c13-23 36-28 53-9 4 5 1 11-6 11H43c-6 0-9-6-6-12Z"
        fill="#c71824"
      />
      <path
        d="M34 50c11 6 43 6 55 0"
        stroke="#fffefa"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="86" cy="32" r="9" fill="#fffefa" />
      <circle cx="86" cy="32" r="5" fill="#f4dfbd" />
      <g className="santa-assistant-eyes">
        <circle cx="52" cy="61" r="3" fill="#2e3432" />
        <circle cx="70" cy="61" r="3" fill="#2e3432" />
      </g>
      <path d="M55 72c4 3 10 3 14 0" stroke="#a43c3f" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M40 75c6 19 34 22 43 2-7 6-34 7-43-2Z"
        fill="#fffefa"
      />
      <path
        className="santa-assistant-wave-hand"
        d="M83 68c8-5 13-4 18 2"
        stroke="#f6cbb9"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        className="santa-assistant-staff"
        d="M28 73c-5 12-5 23 1 31"
        stroke="#48664e"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="28" cy="71" r="7" fill="#fcce72" />
      <path d="M24 71h8M28 67v8" stroke="#a43c3f" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M78 82h22v18H78V82Z"
        fill="#48664e"
      />
      <path d="M89 82v18M78 91h22" stroke="#fcce72" strokeWidth="3" />
      <circle
        className="santa-assistant-sparkle-one"
        cx="99"
        cy="52"
        r="3"
        fill="#fcce72"
      />
      <circle
        className="santa-assistant-sparkle-two"
        cx="24"
        cy="48"
        r="2.5"
        fill="#a43c3f"
      />
      {isOpen && (
        <path
          className="santa-assistant-smile-spark"
          d="M92 43l2-5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
          fill="#fcce72"
        />
      )}
    </svg>
  );
}

export function SantaAssistant() {
  const {
    close,
    isMinimized,
    isOpen,
    minimize,
    nextTip,
    open,
    previousTip,
    shouldRender,
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
      className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-[55] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3 sm:right-5 sm:bottom-5"
      aria-label="Santa Buddy assistant"
    >
      <style>{`
        .santa-assistant-avatar{animation:santa-assistant-float 4.8s cubic-bezier(.25,1,.5,1) infinite;}
        .santa-assistant-button:hover .santa-assistant-wave-hand,
        .santa-assistant-button:focus-visible .santa-assistant-wave-hand{animation:santa-assistant-wave .9s cubic-bezier(.25,1,.5,1) infinite;transform-origin:84px 68px;}
        .santa-assistant-eyes{animation:santa-assistant-blink 4.6s ease-in-out infinite;transform-origin:60px 61px;}
        .santa-assistant-staff{animation:santa-assistant-staff 3.4s ease-in-out infinite;transform-origin:28px 101px;}
        .santa-assistant-sparkle-one,.santa-assistant-sparkle-two,.santa-assistant-smile-spark{animation:santa-assistant-sparkle 1.4s ease-in-out infinite;transform-origin:center;}
        .santa-assistant-sparkle-two{animation-delay:.45s;}
        .santa-assistant-bubble{animation:santa-assistant-bubble-in .22s cubic-bezier(.22,1,.36,1);}
        @keyframes santa-assistant-float{0%,100%{transform:translate3d(0,0,0) rotate(-1deg);}50%{transform:translate3d(0,-7px,0) rotate(1deg);}}
        @keyframes santa-assistant-wave{0%,100%{transform:rotate(0deg);}50%{transform:rotate(14deg);}}
        @keyframes santa-assistant-blink{0%,92%,100%{transform:scaleY(1);}95%{transform:scaleY(.12);}}
        @keyframes santa-assistant-staff{0%,100%{transform:rotate(-2deg);}50%{transform:rotate(3deg);}}
        @keyframes santa-assistant-sparkle{0%,100%{opacity:.54;transform:scale(.8);}50%{opacity:1;transform:scale(1.18);}}
        @keyframes santa-assistant-bubble-in{from{opacity:0;transform:translate3d(0,10px,0) scale(.98);}to{opacity:1;transform:translate3d(0,0,0) scale(1);}}
        @media (prefers-reduced-motion: reduce){
          .santa-assistant-avatar,
          .santa-assistant-button:hover .santa-assistant-wave-hand,
          .santa-assistant-button:focus-visible .santa-assistant-wave-hand,
          .santa-assistant-eyes,
          .santa-assistant-staff,
          .santa-assistant-sparkle-one,
          .santa-assistant-sparkle-two,
          .santa-assistant-smile-spark,
          .santa-assistant-bubble{animation:none!important;transition:none!important;}
        }
      `}</style>

      {isOpen && (
        <SantaAssistantBubble
          onClose={close}
          onMinimize={minimize}
          onNext={nextTip}
          onPrevious={previousTip}
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
        className="santa-assistant-button pointer-events-auto rounded-full border border-[rgba(72,102,78,.24)] bg-[#fffefa] p-1.5 shadow-[0_18px_44px_rgba(46,52,50,.2)] transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e] sm:p-2"
      >
        <span className="santa-assistant-avatar block">
          <SantaBuddyAvatar isOpen={isOpen} />
        </span>
      </button>
    </aside>
  );
}
