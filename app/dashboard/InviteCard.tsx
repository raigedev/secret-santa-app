"use client";

import { useState } from "react";
import { sanitizeGroupNickname, validateAnonymousGroupNickname } from "@/lib/groups/nickname";
import { acceptInvite, declineInvite } from "./actions";

type Props = {
  groupId: string;
  groupName: string;
  eventDate: string;
  description?: string;
  requiresAnonymousNickname?: boolean;
};

function EnvelopeIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m5.5 8 5.7 4.5a1.3 1.3 0 0 0 1.6 0L18.5 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function InviteCard({
  groupId,
  groupName,
  eventDate,
  description,
  requiresAnonymousNickname = false,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "accepted" | "declined">(
    "idle"
  );
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");

  const handleAccept = async () => {
    setMessage("");

    if (requiresAnonymousNickname) {
      const nicknameMessage = validateAnonymousGroupNickname({
        nickname,
      });

      if (nicknameMessage) {
        setMessage(nicknameMessage);
        return;
      }
    }

    setStatus("loading");
    const result = await acceptInvite(
      groupId,
      requiresAnonymousNickname ? sanitizeGroupNickname(nickname) : undefined
    );

    if (result.success) {
      setStatus("accepted");
      return;
    }

    setStatus("idle");
    setMessage(result.message);
  };

  const handleDecline = async () => {
    setMessage("");
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
      <div className="holiday-panel rounded-[28px] p-5">
        <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          Invitation accepted
        </div>
        <h3 className="mt-3 text-xl font-bold text-slate-900">{groupName}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {requiresAnonymousNickname
            ? `You joined the group. Members will see you as ${sanitizeGroupNickname(nickname)} inside this group.`
            : "You joined the group. It now appears in your dashboard."}
        </p>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="holiday-panel rounded-[28px] p-5">
        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Invitation declined
        </div>
        <h3 className="mt-3 text-xl font-bold text-slate-900">{groupName}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This invite has been removed from your dashboard.
        </p>
      </div>
    );
  }

  return (
    <article className="holiday-panel-strong relative overflow-hidden rounded-[30px] p-5">
      <div className="absolute inset-y-0 right-0 w-32 bg-[radial-gradient(circle_at_center,rgba(147,197,253,0.28),transparent_66%)]" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            Pending invitation
          </div>
          <h3 className="mt-3 text-xl font-bold text-slate-900">{groupName}</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">Event date: {eventDate}</p>
        </div>
        <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#eff6ff,#dbeafe)] text-sky-600 shadow-[0_14px_34px_rgba(59,130,246,0.15)] sm:flex">
          <EnvelopeIcon />
        </div>
      </div>

      {description ? (
        <p className="relative z-10 mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      ) : (
        <p className="relative z-10 mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Join this Secret Santa group to see the group details and add your wishlist ideas.
        </p>
      )}

      {requiresAnonymousNickname && (
        <div className="relative z-10 mt-4 rounded-[22px] border border-sky-100 bg-sky-50/80 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              Nickname required
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Private-name group
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This group asks members to join with a nickname instead of using their real
            name or email.
          </p>
          <input
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={30}
            placeholder="Pick a nickname, like GiftFox"
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
          <p className="mt-2 text-xs font-medium text-slate-500">
            Keep it playful and anonymous. You can change it again later inside the group.
          </p>
        </div>
      )}

      <div className="relative z-10 mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={status === "loading"}
          className={`inline-flex min-w-35 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            status === "loading"
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
              : "bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] hover:-translate-y-0.5"
          }`}
        >
          {status === "loading"
            ? "Processing..."
            : requiresAnonymousNickname
              ? "Accept with nickname"
              : "Accept invite"}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={status === "loading"}
          className={`inline-flex min-w-35 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            status === "loading"
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Decline invite
        </button>
      </div>

      {message && (
        <p className="relative z-10 mt-3 text-sm font-semibold text-rose-600">{message}</p>
      )}
    </article>
  );
}
