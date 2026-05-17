"use client";

import { useState } from "react";
import { resendInvite } from "./actions";

type Props = {
  groupId: string;
  memberEmail: string;
};

export default function ResendButton({ groupId, memberEmail }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  const handleResend = async () => {
    setStatus("loading");

    const result = await resendInvite(groupId, memberEmail);

    if (/invite resent/i.test(result.message)) {
      setStatus("sent");
      return;
    }

    alert(result.message);
    setStatus("idle");
  };

  if (status === "sent") {
    return (
      <span className="inline-flex min-h-8 items-center rounded-full bg-[#eef7ef] px-3 text-xs font-black text-[#48664e]">
        Invite resent
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={status === "loading"}
      className="gift-button gift-button-gold gift-button-compact text-xs"
    >
      {status === "loading" ? "Sending..." : "Resend invite"}
    </button>
  );
}
