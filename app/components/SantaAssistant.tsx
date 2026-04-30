"use client";

import { SantaAssistantBubble } from "@/app/components/SantaAssistantBubble";
import { useSantaAssistant } from "@/app/hooks/useSantaAssistant";
import { usePathname } from "next/navigation";

function SantaBuddyCharacter({
  compactOnDesktop = false,
  isOpen,
}: {
  compactOnDesktop?: boolean;
  isOpen: boolean;
}) {
  const sizeClass = compactOnDesktop
    ? "h-12 w-12 min-[420px]:h-16 min-[420px]:w-16 sm:h-24 sm:w-24 xl:h-20 xl:w-20"
    : "h-12 w-12 min-[420px]:h-16 min-[420px]:w-16 sm:h-32 sm:w-32";

  return (
    <svg
      aria-hidden="true"
      className={sizeClass}
      data-testid="santa-assistant-character"
      viewBox="0 0 160 170"
      fill="none"
    >
      <defs>
        <linearGradient id="santa-assistant-hat-gradient" x1="80" x2="80" y1="9" y2="58">
          <stop offset="0%" stopColor="#e74c3c" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
      </defs>
      <ellipse cx="82" cy="154" rx="38" ry="8" fill="rgba(46,52,50,.16)" />
      <g className="santa-assistant-gift-bag">
        <path d="M61 121h43l7 31H54l7-31Z" fill="#48664e" />
        <path d="M70 121c4-11 21-11 25 0" stroke="#fcce72" strokeWidth="5" strokeLinecap="round" />
        <path d="M76 126h14v26H76z" fill="rgba(252,206,114,.22)" />
        <path d="M61 137h50" stroke="#f8f1e8" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 9" />
      </g>
      <g className="santa-assistant-wave-hand">
        <path d="M111 106c14-4 23-14 24-28" stroke="#f1bba6" strokeWidth="9" strokeLinecap="round" />
        <path d="M135 76c7-5 10-11 8-18" stroke="#f1bba6" strokeWidth="5" strokeLinecap="round" />
        <circle cx="137" cy="74" r="8" fill="#fffefa" />
      </g>
      <g className="santa-assistant-side-hand">
        <path d="M49 110c-10-8-14-18-10-29" stroke="#f1bba6" strokeWidth="9" strokeLinecap="round" />
        <circle cx="39" cy="82" r="7" fill="#fffefa" />
      </g>
      <g
        className="santa-assistant-logo-face"
        data-testid="santa-assistant-logo-face"
      >
        <circle cx="80" cy="79" r="50" fill="#fde8e8" />
        <path
          className="santa-assistant-hat"
          d="M31 56C36 42 49 15 80 10c33-5 48 25 51 46H31Z"
          fill="url(#santa-assistant-hat-gradient)"
        />
        <rect x="27" y="52" width="108" height="12" rx="6" fill="#fffefa" />
        <circle className="santa-assistant-pom" cx="87" cy="10" r="9" fill="#fffefa" />
        <ellipse className="santa-assistant-beard-back" cx="80" cy="110" rx="39" ry="25" fill="#fffefa" />
        <ellipse cx="80" cy="102" rx="33" ry="17" fill="#fffefa" />
        <ellipse cx="66" cy="86" rx="12" ry="6" fill="#fffefa" />
        <ellipse cx="94" cy="86" rx="12" ry="6" fill="#fffefa" />
        <circle cx="80" cy="76" r="5" fill="#e8a8a8" />
        <g className="santa-assistant-open-eye">
          <ellipse cx="64" cy="66" rx="5.5" ry="6.5" fill="#fffefa" />
          <ellipse cx="64" cy="67" rx="4.1" ry="5.2" fill="#2c1810" />
          <circle cx="62" cy="65" r="1.8" fill="#fffefa" />
        </g>
        <path
          className="santa-assistant-wink"
          d="M90 66Q97 59 104 66"
          fill="none"
          stroke="#2c1810"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <path d="M54 58Q64 51 74 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M86 58Q96 51 106 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse className="santa-assistant-cheek" cx="52" cy="78" rx="7" ry="5" fill="#f0a0a0" opacity=".34" />
        <ellipse className="santa-assistant-cheek santa-assistant-cheek-two" cx="108" cy="78" rx="7" ry="5" fill="#f0a0a0" opacity=".34" />
        <rect x="76" y="84" width="9" height="26" rx="4.5" fill="#f8d0d0" stroke="#e8b8b8" strokeWidth=".8" />
        <path
          className="santa-assistant-smile"
          d="M68 105Q80 113 93 105"
          fill="none"
          stroke="#c4a090"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      <circle className="santa-assistant-sparkle-one" cx="23" cy="54" r="3" fill="#fcce72" />
      <circle className="santa-assistant-sparkle-two" cx="129" cy="103" r="3" fill="#a43c3f" />
      <path
        className="santa-assistant-sparkle-three"
        d="M34 26l2-5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
        fill="#fcce72"
      />
      {isOpen && (
        <path
          className="santa-assistant-open-spark"
          d="M128 31l3-7 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"
          fill="#fcce72"
        />
      )}
    </svg>
  );
}

export function SantaAssistant() {
  const pathname = usePathname();
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
  const useShoppingIdeasOffset = pathname === "/secret-santa";

  const handleToggle = () => {
    const hasShoppingHelperRail =
      useShoppingIdeasOffset &&
      window.matchMedia("(min-width: 1280px)").matches;

    if (hasShoppingHelperRail) {
      close();
      return;
    }

    if (isOpen) {
      close();
      return;
    }

    open();
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <aside
      data-testid="santa-assistant"
      className={`pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-2 z-[55] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-2 sm:right-5 sm:bottom-4 ${
        useShoppingIdeasOffset ? "xl:right-1 2xl:right-1" : ""
      }`}
      aria-label="Secret Santa assistant"
    >
      <style>{`
        .santa-assistant-avatar{filter:drop-shadow(0 18px 24px rgba(46,52,50,.22));animation:santa-assistant-float 4.8s cubic-bezier(.25,1,.5,1) infinite;}
        .santa-assistant-logo-face{animation:santa-assistant-face-breathe 3.8s ease-in-out infinite;transform-origin:80px 80px;}
        .santa-assistant-hat{animation:santa-assistant-hat-tip 4.6s ease-in-out infinite;transform-origin:78px 55px;}
        .santa-assistant-pom{animation:santa-assistant-pom-bounce 1.8s ease-in-out infinite;transform-origin:center;}
        .santa-assistant-beard-back{animation:santa-assistant-beard-bob 2.8s ease-in-out infinite;transform-origin:80px 110px;}
        .santa-assistant-open-eye{animation:santa-assistant-blink 4.6s ease-in-out infinite;transform-origin:64px 67px;}
        .santa-assistant-wink{animation:santa-assistant-wink 5.2s ease-in-out infinite;transform-origin:97px 66px;}
        .santa-assistant-cheek{animation:santa-assistant-cheek-glow 3.2s ease-in-out infinite;transform-origin:center;}
        .santa-assistant-cheek-two{animation-delay:.35s;}
        .santa-assistant-smile{animation:santa-assistant-smile 3.2s ease-in-out infinite;}
        .santa-assistant-wave-hand{animation:santa-assistant-wave-idle 5.4s ease-in-out infinite;transform-origin:112px 104px;}
        .santa-assistant-button:hover .santa-assistant-wave-hand,
        .santa-assistant-button:focus-visible .santa-assistant-wave-hand{animation:santa-assistant-wave .75s cubic-bezier(.25,1,.5,1) infinite;transform-origin:112px 104px;}
        .santa-assistant-gift-bag{animation:santa-assistant-gift-hop 2.9s cubic-bezier(.25,1,.5,1) infinite;transform-origin:82px 150px;}
        .santa-assistant-side-hand{animation:santa-assistant-side-hand 3.4s ease-in-out infinite;transform-origin:48px 110px;}
        .santa-assistant-sparkle-one,.santa-assistant-sparkle-two,.santa-assistant-sparkle-three,.santa-assistant-open-spark{animation:santa-assistant-sparkle 1.4s ease-in-out infinite;transform-origin:center;}
        .santa-assistant-sparkle-two{animation-delay:.45s;}
        .santa-assistant-sparkle-three{animation-delay:.8s;}
        .santa-assistant-bubble{animation:santa-assistant-panel-in .2s cubic-bezier(.22,1,.36,1);}
        @keyframes santa-assistant-float{0%,100%{transform:translate3d(0,0,0) rotate(-1deg);}50%{transform:translate3d(0,-8px,0) rotate(1deg);}}
        @keyframes santa-assistant-face-breathe{0%,100%{transform:scale(1);}50%{transform:scale(1.015);}}
        @keyframes santa-assistant-hat-tip{0%,100%{transform:rotate(0deg);}50%{transform:rotate(-1.8deg);}}
        @keyframes santa-assistant-pom-bounce{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}
        @keyframes santa-assistant-beard-bob{0%,100%{transform:translateY(0);}50%{transform:translateY(2px);}}
        @keyframes santa-assistant-wave-idle{0%,72%,100%{transform:rotate(0deg);}78%{transform:rotate(-12deg);}84%{transform:rotate(9deg);}90%{transform:rotate(-7deg);}}
        @keyframes santa-assistant-wave{0%,100%{transform:rotate(0deg);}50%{transform:rotate(-15deg);}}
        @keyframes santa-assistant-side-hand{0%,100%{transform:rotate(0deg);}50%{transform:rotate(5deg);}}
        @keyframes santa-assistant-gift-hop{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-3px) rotate(.8deg);}}
        @keyframes santa-assistant-blink{0%,91%,100%{transform:scaleY(1);}94%{transform:scaleY(.12);}}
        @keyframes santa-assistant-wink{0%,86%,100%{transform:scaleX(1);}90%{transform:scaleX(.82);}}
        @keyframes santa-assistant-cheek-glow{0%,100%{opacity:.28;}50%{opacity:.52;}}
        @keyframes santa-assistant-smile{0%,100%{transform:translateY(0);}50%{transform:translateY(1px);}}
        @keyframes santa-assistant-sparkle{0%,100%{opacity:.48;transform:scale(.78);}50%{opacity:1;transform:scale(1.18);}}
        @keyframes santa-assistant-panel-in{from{opacity:0;transform:translate3d(0,10px,0) scale(.98);}to{opacity:1;transform:translate3d(0,0,0) scale(1);}}
        @media (prefers-reduced-motion: reduce){
          .santa-assistant-avatar,
          .santa-assistant-logo-face,
          .santa-assistant-hat,
          .santa-assistant-pom,
          .santa-assistant-beard-back,
          .santa-assistant-open-eye,
          .santa-assistant-wink,
          .santa-assistant-cheek,
          .santa-assistant-smile,
          .santa-assistant-wave-hand,
          .santa-assistant-button:hover .santa-assistant-wave-hand,
          .santa-assistant-button:focus-visible .santa-assistant-wave-hand,
          .santa-assistant-gift-bag,
          .santa-assistant-side-hand,
          .santa-assistant-sparkle-one,
          .santa-assistant-sparkle-two,
          .santa-assistant-sparkle-three,
          .santa-assistant-open-spark,
          .santa-assistant-bubble,
          .santa-assistant-button{animation:none!important;transition:none!important;}
          .santa-assistant-button:hover,
          .santa-assistant-button:focus-visible{transform:none!important;}
        }
      `}</style>

      {isOpen && (
        <div className={useShoppingIdeasOffset ? "xl:hidden" : undefined}>
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
        </div>
      )}

      <button
        type="button"
        data-testid="santa-assistant-toggle"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? "Close Secret Santa assistant"
            : isMinimized
              ? "Open minimized Secret Santa assistant"
              : "Open Secret Santa assistant"
        }
        className="santa-assistant-button pointer-events-auto rounded-[28px] bg-transparent p-0 transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#48664e]"
      >
        <span className="santa-assistant-avatar block">
          <SantaBuddyCharacter compactOnDesktop={useShoppingIdeasOffset} isOpen={isOpen} />
        </span>
      </button>
    </aside>
  );
}
