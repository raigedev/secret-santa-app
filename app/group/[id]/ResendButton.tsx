"use client";

// ─── ResendButton Component ───
// Shows a "Resend Invite" button on declined member cards.
// Calls a SERVER ACTION (not client-side update) because
// RLS only lets you edit your own row — the owner needs
// server-side permission to update someone else's row.

import { useState } from "react";
import { resendInvite } from "./actions";

type Props = {
  groupId: string;
  memberEmail: string;
};

export default function ResendButton({ groupId, memberEmail }: Props) {
  // "idle" = showing the button
  // "loading" = waiting for server response
  // "sent" = successfully resent
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  const handleResend = async () => {
    setStatus("loading");

    // Call the server action — it verifies ownership
    // and uses the admin client to update the row
    const result = await resendInvite(groupId, memberEmail);

    if (result.message.startsWith("✅")) {
      setStatus("sent");
    } else {
      alert(result.message);
      setStatus("idle");
    }
  };

  // Already resent — show confirmation
  if (status === "sent") {
    return (
      <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">
        ✅ Invite resent
      </span>
    );
  }

  return (
    <button
      onClick={handleResend}
      disabled={status === "loading"}
      className={`text-xs px-3 py-1 rounded-full font-bold transition ${
        status === "loading"
          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
          : "bg-orange-100 text-orange-700 hover:bg-orange-200"
      }`}
    >
      {status === "loading" ? "Sending..." : "🔄 Resend invite"}
    </button>
  );
}
