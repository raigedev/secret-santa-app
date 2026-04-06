"use client";

import { useState } from "react";
import { quickSetup } from "@/app/profile/actions";

const QUICK_AVATARS = ["🎅", "🧝", "🦌", "⛄", "🎄", "🎁"];

type Props = {
  defaultName: string;
  onComplete: () => void;
  onSkip: () => void;
};

export default function ProfileSetupModal({ defaultName, onComplete, onSkip }: Props) {
  const [name, setName] = useState(defaultName);
  const [emoji, setEmoji] = useState("🎅");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    if (!name.trim()) { setError("Please enter a display name."); return; }
    setSaving(true);
    setError("");
    const result = await quickSetup(name.trim(), emoji);
    setSaving(false);
    if (result.success) {
      onComplete();
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)" }}>
      <style>{`
        @keyframes modalIn{0%{opacity:0;transform:scale(.95) translateY(10px);}100%{opacity:1;transform:scale(1) translateY(0);}}
      `}</style>

      <div className="rounded-3xl p-10 max-w-110 w-full text-center"
        style={{ background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,.15)", animation: "modalIn .4s ease", fontFamily: "'Nunito', sans-serif" }}>

        <p className="text-[11px] font-bold mb-4" style={{ color: "#c0392b" }}>Welcome — Set up your profile</p>

        <div className="text-[64px] mb-3">🎅</div>

        <h2 className="text-[26px] font-bold mb-1.5" style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}>
          Welcome to My Secret Santa!
        </h2>
        <p className="text-[14px] mb-7 leading-relaxed" style={{ color: "#6b7280" }}>
          Let&apos;s set up your profile so your friends can recognize you in their groups.
        </p>

        {/* Avatar preview */}
        <div className="w-25 h-25 rounded-full mx-auto mb-3 flex items-center justify-center text-[48px]"
          style={{ background: "linear-gradient(135deg,#fef2f2,#fee2e2)", border: "3px solid #fff", boxShadow: "0 4px 16px rgba(192,57,43,.1)" }}>
          {emoji}
        </div>

        {/* Quick avatar picker */}
        <div className="flex justify-center gap-2 mb-6">
          {QUICK_AVATARS.map((e) => (
            <button key={e} onClick={() => setEmoji(e)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-[22px] transition"
              style={{
                background: emoji === e ? "#fef2f2" : "rgba(0,0,0,.02)",
                border: `2px solid ${emoji === e ? "#c0392b" : "transparent"}`,
                cursor: "pointer", fontFamily: "inherit",
                transform: emoji === e ? "scale(1.1)" : "scale(1)",
              }}>
              {e}
            </button>
          ))}
        </div>

        {/* Name input */}
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Your display name..."
          maxLength={50}
          className="w-full px-4 py-3.5 rounded-xl text-[15px] text-center outline-none transition mb-2"
          style={{ border: "2px solid #e5e7eb", fontFamily: "inherit", color: "#1f2937" }}
          onFocus={(e) => (e.target.style.borderColor = "#c0392b")}
          onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")} />

        {error && <p className="text-[12px] font-bold text-red-500 mb-2">{error}</p>}

        {/* Buttons */}
        <div className="flex flex-col gap-2 mt-5">
          <button onClick={handleContinue} disabled={saving}
            className="w-full py-3.5 rounded-xl text-[15px] font-extrabold text-white transition"
            style={{
              background: saving ? "#9ca3af" : "linear-gradient(135deg,#c0392b,#e74c3c)",
              border: "none", cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: saving ? "none" : "0 4px 16px rgba(192,57,43,.25)",
            }}>
            {saving ? "Saving..." : "Continue →"}
          </button>
          <button onClick={onSkip}
            className="text-[13px] font-bold py-2 transition"
            style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>
            Skip for now — I&apos;ll do it later
          </button>
        </div>
      </div>
    </div>
  );
}
