"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

type GroupRouteErrorVariant = "group" | "reveal";

const GROUP_ROUTE_ERROR_COPY: Record<
  GroupRouteErrorVariant,
  {
    background: string;
    cardBackground: string;
    border: string;
    boxShadow: string;
    fallbackMessage: string;
    heading: string;
    headingClassName: string;
    headingStyle?: CSSProperties;
    icon: string;
    messageColor: string;
    secondaryAction: "back" | "dashboard";
    secondaryButtonStyle: CSSProperties;
    secondaryLabel: string;
  }
> = {
  group: {
    background: "linear-gradient(180deg,#eef4fb 0%,#dce8f5 45%,#e8dce0 100%)",
    cardBackground: "rgba(255,255,255,.9)",
    border: "1px solid rgba(220,38,38,.12)",
    boxShadow: "0 20px 50px rgba(15,23,42,.08)",
    fallbackMessage: "Refresh the page, or go back to your dashboard and try again.",
    heading: "We could not load this group",
    headingClassName: "text-[28px] font-bold mb-3",
    headingStyle: { color: "#991b1b" },
    icon: "\u26A0\uFE0F",
    messageColor: "#64748b",
    secondaryAction: "dashboard",
    secondaryButtonStyle: {
      background: "rgba(15,23,42,.05)",
      color: "#1f2937",
      border: "1px solid rgba(15,23,42,.08)",
    },
    secondaryLabel: "Back to dashboard",
  },
  reveal: {
    background: "linear-gradient(180deg,#0b1220 0%,#10233b 45%,#112b23 100%)",
    cardBackground: "rgba(15,23,42,.76)",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow: "0 24px 60px rgba(0,0,0,.22)",
    fallbackMessage: "Refresh the page, or go back and try the reveal again.",
    heading: "We could not load the reveal",
    headingClassName: "text-[28px] font-bold mb-3 text-white",
    icon: "\uD83C\uDFAC",
    messageColor: "#cbd5e1",
    secondaryAction: "back",
    secondaryButtonStyle: {
      background: "rgba(255,255,255,.08)",
      color: "#e2e8f0",
      border: "1px solid rgba(255,255,255,.08)",
    },
    secondaryLabel: "Go back",
  },
};

export function GroupRouteError({
  error,
  reset,
  variant,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  variant: GroupRouteErrorVariant;
}) {
  const router = useRouter();
  const copy = GROUP_ROUTE_ERROR_COPY[variant];
  const handleSecondaryAction = () => {
    if (copy.secondaryAction === "dashboard") {
      router.push("/dashboard");
      return;
    }

    router.back();
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: copy.background,
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div
        className="w-full max-w-140 rounded-[28px] p-8 text-center"
        style={{
          background: copy.cardBackground,
          border: copy.border,
          boxShadow: copy.boxShadow,
        }}
      >
        <div className="text-[44px] mb-3">{copy.icon}</div>
        <h1
          className={copy.headingClassName}
          style={{ fontFamily: "'Fredoka', sans-serif", ...copy.headingStyle }}
        >
          {copy.heading}
        </h1>
        <p className="text-[14px] font-semibold leading-relaxed" style={{ color: copy.messageColor }}>
          {error.message || copy.fallbackMessage}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 rounded-xl text-sm font-extrabold text-white"
            style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)", border: "none" }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={handleSecondaryAction}
            className="px-5 py-2.5 rounded-xl text-sm font-extrabold"
            style={copy.secondaryButtonStyle}
          >
            {copy.secondaryLabel}
          </button>
        </div>
      </div>
    </main>
  );
}
