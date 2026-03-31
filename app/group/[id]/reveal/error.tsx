"use client";

import { useRouter } from "next/navigation";

export default function GroupRevealError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "linear-gradient(180deg,#0b1220 0%,#10233b 45%,#112b23 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div
        className="w-full max-w-[560px] rounded-[28px] p-8 text-center"
        style={{
          background: "rgba(15,23,42,.76)",
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 24px 60px rgba(0,0,0,.22)",
        }}
      >
        <div className="text-[44px] mb-3">🎬</div>
        <h1
          className="text-[28px] font-bold mb-3 text-white"
          style={{ fontFamily: "'Fredoka', sans-serif" }}
        >
          Reveal screen hit an error
        </h1>
        <p className="text-[14px] font-semibold leading-relaxed" style={{ color: "#cbd5e1" }}>
          {error.message || "Something went wrong while loading the live reveal."}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 rounded-xl text-sm font-extrabold text-white"
            style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)", border: "none" }}
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl text-sm font-extrabold"
            style={{
              background: "rgba(255,255,255,.08)",
              color: "#e2e8f0",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </main>
  );
}
