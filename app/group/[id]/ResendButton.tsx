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
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-black transition ${
        status === "loading"
          ? "cursor-not-allowed bg-slate-100 text-slate-400"
          : "bg-[#fff4df] text-[#7b5902] hover:-translate-y-0.5 hover:bg-[#ffedc1]"
      }`}
    >
      {status === "loading" ? "Sending..." : "Resend invite"}
    </button>
  );
}
