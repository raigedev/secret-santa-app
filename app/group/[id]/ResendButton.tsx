"use client";

import { useState } from "react";
import { resendInvite } from "./actions";

type Props = {
  groupId: string;
  membershipId: string;
  onResent: () => void;
};

export default function ResendButton({ groupId, membershipId, onResent }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  const handleResend = async () => {
    setStatus("loading");

    const result = await resendInvite(groupId, membershipId);

    if (result.success) {
      setStatus("sent");
      onResent();
      return;
    }

    alert(result.message);
    setStatus("idle");
  };

  if (status === "sent") {
    return (
      <span
        aria-live="polite"
        className="inline-flex min-h-8 items-center rounded-full bg-[#eef7ef] px-3 text-xs font-black text-[#48664e]"
      >
        Invite resent
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={status === "loading"}
      aria-busy={status === "loading"}
      className="gift-button gift-button-gold gift-button-compact text-xs"
    >
      {status === "loading" ? "Sending..." : "Resend invite"}
    </button>
  );
}
