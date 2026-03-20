"use client";

// ─── InviteCard Component ───
// Shows a pending group invitation with Accept and Decline buttons.
// When the user clicks a button, it calls the server action and
// updates the UI instantly (no page refresh needed).

import { useState } from "react";
import { acceptInvite, declineInvite } from "./actions";

type Props = {
  groupId: string;       // the group being invited to
  groupName: string;     // display name of the group
  eventDate: string;     // when the event is
  description?: string;  // optional group description
};

export default function InviteCard({
  groupId,
  groupName,
  eventDate,
  description,
}: Props) {
  // ─── State ───
  // "idle" = showing Accept/Decline buttons
  // "loading" = waiting for server response
  // "accepted" = user accepted the invite
  // "declined" = user declined the invite
  const [status, setStatus] = useState<"idle" | "loading" | "accepted" | "declined">("idle");

  // ─── Handle Accept ───
  const handleAccept = async () => {
    setStatus("loading");
    const result = await acceptInvite(groupId);
    if (result.message.startsWith("✅")) {
      setStatus("accepted");
    } else {
      // If it failed, go back to idle so they can try again
      setStatus("idle");
      alert(result.message);
    }
  };

  // ─── Handle Decline ───
  const handleDecline = async () => {
    setStatus("loading");
    const result = await declineInvite(groupId);
    if (result.message.startsWith("✅")) {
      setStatus("declined");
    } else {
      setStatus("idle");
      alert(result.message);
    }
  };

  // ─── Already responded — show result ───
  if (status === "accepted") {
    return (
      <div className="rounded-xl p-5 bg-gradient-to-r from-green-300 to-green-500 text-white shadow-lg">
        <p className="font-bold text-lg">✅ Joined: {groupName}</p>
        <p className="text-sm opacity-90 mt-1">
          You can now view this group from Your Groups below.
        </p>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="rounded-xl p-5 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-500 shadow-lg">
        <p className="font-bold text-lg">Declined: {groupName}</p>
        <p className="text-sm mt-1">This invitation has been removed.</p>
      </div>
    );
  }

  // ─── Pending — show invitation with buttons ───
  return (
    <div
      className="rounded-xl p-5 shadow-lg text-white relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #f97316, #ea580c)",
        boxShadow: "0 0 20px rgba(249, 115, 22, 0.5)",
      }}
    >
      {/* Group info */}
      <p className="font-bold text-lg mb-1">🎁 {groupName}</p>
      {description && (
        <p className="text-sm opacity-90 mb-1">{description}</p>
      )}
      <p className="text-sm opacity-80 mb-4">📅 Event: {eventDate}</p>

      {/* Accept / Decline buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleAccept}
          disabled={status === "loading"}
          className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${
            status === "loading"
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-white text-green-700 hover:bg-green-50 shadow"
          }`}
        >
          {status === "loading" ? "Processing..." : "✅ Accept"}
        </button>
        <button
          onClick={handleDecline}
          disabled={status === "loading"}
          className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${
            status === "loading"
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-white/20 text-white hover:bg-white/30"
          }`}
        >
          {status === "loading" ? "..." : "❌ Decline"}
        </button>
      </div>
    </div>
  );
}