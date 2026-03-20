"use client";

// ─── ResendButton Component ───
// Shows a "Resend Invite" button on declined member cards.
// Only visible to the group owner.
// When clicked, resets the member's status to "pending"
// so the invitation reappears on their dashboard.
// Updates instantly — no page refresh needed.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  groupId: string;
  memberEmail: string;
};

export default function ResendButton({ groupId, memberEmail }: Props) {
  const supabase = createClient();

  // ─── State ───
  // "idle" = showing the button
  // "loading" = waiting for database response
  // "sent" = successfully resent
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  const handleResend = async () => {
    setStatus("loading");

    // Get the logged-in user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in.");
      setStatus("idle");
      return;
    }

    // Reset the declined member's status back to "pending".
    // We match by group_id + email + status="declined" to be safe.
    const { error } = await supabase
      .from("group_members")
      .update({ status: "pending" })
      .eq("group_id", groupId)
      .eq("email", memberEmail)
      .eq("status", "declined");

    if (error) {
      alert(`Error: ${error.message}`);
      setStatus("idle");
      return;
    }

    // Show success — the button changes to "Resent ✓"
    setStatus("sent");
  };

  // Already resent — show confirmation
  if (status === "sent") {
    return (
      <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">
        ✅ Resent
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
      {status === "loading" ? "Sending..." : "🔄 Resend Invite"}
    </button>
  );
}