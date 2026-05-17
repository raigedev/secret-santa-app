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
      className="gift-button gift-button-secondary gift-button-compact text-xs"
    >
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}
