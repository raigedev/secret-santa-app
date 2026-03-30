"use client";

import { useState } from "react";
import { revokePendingInvite } from "./actions";

type Props = {
  groupId: string;
  membershipId: string;
};

export default function RevokeInviteButton({ groupId, membershipId }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "revoked">("idle");

  const handleRevoke = async () => {
    setStatus("loading");

    const result = await revokePendingInvite(groupId, membershipId);

    if (result.success) {
      setStatus("revoked");
      return;
    }

    alert(result.message);
    setStatus("idle");
  };

  if (status === "revoked") {
    return (
      <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold">
        ✅ Revoked
      </span>
    );
  }

  return (
    <button
      onClick={handleRevoke}
      disabled={status === "loading"}
      className={`text-xs px-3 py-1 rounded-full font-bold transition ${
        status === "loading"
          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
          : "bg-red-100 text-red-700 hover:bg-red-200"
      }`}
    >
      {status === "loading" ? "Revoking..." : "🛑 Revoke Invite"}
    </button>
  );
}
