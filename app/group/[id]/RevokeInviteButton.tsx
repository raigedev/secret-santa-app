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
      type="button"
      onClick={handleRevoke}
      disabled={status === "loading"}
      className="gift-button gift-button-danger gift-button-compact text-xs"
    >
      {status === "loading" ? "Revoking..." : "Revoke invite"}
    </button>
  );
}
