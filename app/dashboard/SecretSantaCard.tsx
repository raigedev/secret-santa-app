"use client";

// ═══════════════════════════════════════
// SECRET SANTA CARD — Dashboard
// ═══════════════════════════════════════
// Simple clickable card that navigates to /secret-santa page.
// Shows placeholder before draw, recipient preview after draw.

import { useRouter } from "next/navigation";

type Props = {
  recipientNames: string[];
};

export default function SecretSantaCard({ recipientNames }: Props) {
  const router = useRouter();
  const hasAssignments = recipientNames.length > 0;

  // ═══ NO ASSIGNMENTS — Placeholder ═══
  if (!hasAssignments) {
    return (
      <div className="text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #F87171, #EF4444)", boxShadow: "0 0 20px rgba(239, 68, 68, 0.7)" }}>
        <div className="bg-white text-red-700 font-bold py-2 text-center rounded-t-[2rem]">🎅 Your Secret Santa</div>
        <div className="p-4 text-center">
          <p className="text-sm" style={{ color: "#334155" }}>Assignments will appear here</p>
          <div className="mt-4 flex justify-center gap-2 text-xl">🎁 🌲 🍬</div>
        </div>
      </div>
    );
  }

  // ═══ HAS ASSIGNMENTS — Clickable card ═══
  return (
    <div onClick={() => router.push("/secret-santa")}
      className="cursor-pointer rounded-[16px] overflow-hidden transition hover:scale-[1.04]"
      style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 4px 20px rgba(220,38,38,.3)" }}>
      <div className="bg-white py-2.5 px-4 text-center font-extrabold text-[14px] rounded-t-[16px] relative" style={{ color: "#dc2626" }}>
        🎅 Your Secret Santa
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full"
          style={{ background: "rgba(220,38,38,.1)", color: "#dc2626" }}>
          {recipientNames.length} recipient{recipientNames.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="p-4 text-center text-white">
        <p className="text-[13px] font-bold opacity-90 mb-2">You have assignments!</p>
        <div className="flex justify-center gap-1.5 flex-wrap">
          {recipientNames.map((name, i) => (
            <span key={i} className="text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,.2)" }}>
              🎁 {name}
            </span>
          ))}
        </div>
        <p className="text-[11px] opacity-60 font-bold mt-3">Tap to view →</p>
      </div>
    </div>
  );
}