"use client";

import { useState } from "react";
import { revokePendingInvite } from "./actions";

type Props = {
  groupId: string;
  membershipId: string;
  onRevoked?: () => void;
};

export default function RevokeInviteButton({
  groupId,
  membershipId,
  onRevoked,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "revoked">("idle");

  const handleRevoke = async () => {
    setStatus("loading");

    const result = await revokePendingInvite(groupId, membershipId);

    if (result.success) {
      setStatus("revoked");
      onRevoked?.();
      return;
    }

    alert(result.message);
    setStatus("idle");
  };

  if (status === "revoked") {
    return (
      <span className="inline-flex min-h-8 items-center rounded-full bg-red-100 px-3 text-xs font-bold text-red-700">
        Invite revoked
      </span>
    );
  }

  return (
    <button
      onClick={handleRevoke}
      disabled={status === "loading"}
      className={`inline-flex min-h-8 items-center justify-center rounded-full px-3 text-xs font-bold transition ${
        status === "loading"
          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
          : "bg-red-100 text-red-700 hover:bg-red-200"
      }`}
    >
      {status === "loading" ? "Revoking..." : "Revoke invite"}
    </button>
  );
}
