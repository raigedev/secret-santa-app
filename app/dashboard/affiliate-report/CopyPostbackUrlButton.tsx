"use client";

import { useState } from "react";

export function CopyPostbackUrlButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5"
    >
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}
