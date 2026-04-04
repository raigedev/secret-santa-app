"use client";

import { useState } from "react";
import { acceptInvite, declineInvite } from "./actions";

type Props = {
  groupId: string;
  groupName: string;
  eventDate: string;
  description?: string;
};

export default function InviteCard({
  groupId,
  groupName,
  eventDate,
  description,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "accepted" | "declined">(
    "idle"
  );

  const handleAccept = async () => {
    setStatus("loading");
    const result = await acceptInvite(groupId);

    if (result.success) {
      setStatus("accepted");
      return;
    }

    setStatus("idle");
    alert(result.message);
  };

  const handleDecline = async () => {
    setStatus("loading");
    const result = await declineInvite(groupId);

    if (result.success) {
      setStatus("declined");
      return;
    }

    setStatus("idle");
    alert(result.message);
  };

  if (status === "accepted") {
    return (
      <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#effcf5)] p-5 shadow-[0_20px_55px_rgba(16,185,129,0.12)]">
        <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          Invitation accepted
        </div>
        <h3 className="mt-3 text-xl font-bold text-slate-900">{groupName}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          You are in. This group now appears in your dashboard so you can jump in whenever you are ready.
        </p>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(148,163,184,0.12)]">
        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Invitation declined
        </div>
        <h3 className="mt-3 text-xl font-bold text-slate-900">{groupName}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This invite has been removed from your queue.
        </p>
      </div>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_28px_80px_rgba(148,163,184,0.18)] backdrop-blur-md">
      <div className="absolute inset-y-0 right-0 w-32 bg-[radial-gradient(circle_at_center,rgba(147,197,253,0.28),transparent_66%)]" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            Pending invitation
          </div>
          <h3 className="mt-3 text-xl font-bold text-slate-900">{groupName}</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">Event date: {eventDate}</p>
        </div>
        <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#eff6ff,#dbeafe)] text-2xl shadow-[0_14px_34px_rgba(59,130,246,0.15)] sm:flex">
          ✉️
        </div>
      </div>

      {description ? (
        <p className="relative z-10 mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      ) : (
        <p className="relative z-10 mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Join this Secret Santa group to see the draw details and start planning your gift.
        </p>
      )}

      <div className="relative z-10 mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={status === "loading"}
          className={`inline-flex min-w-[140px] items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            status === "loading"
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
              : "bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] hover:-translate-y-0.5"
          }`}
        >
          {status === "loading" ? "Processing..." : "Accept invite"}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={status === "loading"}
          className={`inline-flex min-w-[140px] items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            status === "loading"
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Decline
        </button>
      </div>
    </article>
  );
}
