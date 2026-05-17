"use client";

import { useState } from "react";
import { SantaMarkIcon } from "@/app/dashboard/dashboard-icons";
import { quickSetup } from "@/app/profile/actions";

const DEFAULT_AVATAR = String.fromCodePoint(0x1f385);
const QUICK_AVATARS = [
  { icon: DEFAULT_AVATAR, label: "Santa" },
  { icon: String.fromCodePoint(0x1f9dd), label: "Helper" },
  { icon: String.fromCodePoint(0x1f98c), label: "Reindeer" },
  { icon: String.fromCodePoint(0x26c4), label: "Snow friend" },
  { icon: String.fromCodePoint(0x1f384), label: "Tree" },
  { icon: String.fromCodePoint(0x1f381), label: "Gift" },
] as const;

type Props = {
  defaultName: string;
  onComplete: () => void;
  onSkip: () => void;
};

export default function ProfileSetupModal({ defaultName, onComplete, onSkip }: Props) {
  const [name, setName] = useState(defaultName);
  const [emoji, setEmoji] = useState(DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    if (!name.trim()) {
      setError("Please enter a display name.");
      return;
    }

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
    <div className="gift-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <section
        aria-labelledby="profile-setup-title"
        className="gift-modal-panel gift-surface-strong w-full max-w-110 p-6 text-center text-[#2e3432] sm:p-8"
        role="dialog"
        aria-modal="true"
      >
        <p className="mb-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#a43c3f]">
          Welcome setup
        </p>

        <div className="mx-auto mb-4 flex h-18 w-18 items-center justify-center rounded-3xl bg-[#fff7f6] text-[#a43c3f] ring-1 ring-[#a43c3f]/10">
          <SantaMarkIcon size={58} />
        </div>

        <h2
          id="profile-setup-title"
          className="mb-1.5 text-[26px] font-black text-[#2e3432]"
          style={{ fontFamily: "'Fredoka', sans-serif" }}
        >
          Welcome to My Secret Santa!
        </h2>
        <p className="mb-7 text-[14px] font-semibold leading-relaxed text-[#64748b]">
          Add your display name so other members can recognize you in their groups.
        </p>

        <div className="gift-surface-muted mx-auto mb-3 flex h-25 w-25 items-center justify-center rounded-[30px] text-[46px]">
          {emoji}
        </div>

        <div className="mb-6 grid grid-cols-6 gap-2" aria-label="Choose an avatar">
          {QUICK_AVATARS.map((avatar) => (
            <button
              key={avatar.label}
              type="button"
              onClick={() => setEmoji(avatar.icon)}
              aria-label={`Use ${avatar.label} avatar`}
              aria-pressed={emoji === avatar.icon}
              className="gift-option gift-option-circle flex h-11 items-center justify-center p-0 text-[22px] aria-pressed:scale-105"
            >
              {avatar.icon}
            </button>
          ))}
        </div>

        <label htmlFor="profile-setup-display-name" className="sr-only">
          Display name
        </label>
        <input
          id="profile-setup-display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your display name..."
          maxLength={50}
          className="gift-field mb-2 w-full px-4 py-3.5 text-center text-[15px] font-bold"
        />

        {error && (
          <p className="gift-alert gift-alert-error mb-2 text-[12px]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="gift-button gift-button-red gift-button-full py-3.5 text-[15px]"
          >
            {saving ? "Saving..." : "Continue"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="gift-button gift-button-ghost gift-button-full gift-button-compact text-[13px]"
          >
            Skip for now
          </button>
        </div>
      </section>
    </div>
  );
}
