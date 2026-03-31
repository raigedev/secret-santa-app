"use client";

import { useRouter } from "next/navigation";

export default function GroupError({
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
        background: "linear-gradient(180deg,#eef4fb 0%,#dce8f5 45%,#e8dce0 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div
        className="w-full max-w-[560px] rounded-[28px] p-8 text-center"
        style={{
          background: "rgba(255,255,255,.9)",
          border: "1px solid rgba(220,38,38,.12)",
          boxShadow: "0 20px 50px rgba(15,23,42,.08)",
        }}
      >
        <div className="text-[44px] mb-3">⚠️</div>
        <h1
          className="text-[28px] font-bold mb-3"
          style={{ fontFamily: "'Fredoka', sans-serif", color: "#991b1b" }}
        >
          Group page hit an error
        </h1>
        <p className="text-[14px] font-semibold leading-relaxed" style={{ color: "#64748b" }}>
          {error.message || "Something went wrong while loading this group."}
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
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 rounded-xl text-sm font-extrabold"
            style={{
              background: "rgba(15,23,42,.05)",
              color: "#1f2937",
              border: "1px solid rgba(15,23,42,.08)",
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}
