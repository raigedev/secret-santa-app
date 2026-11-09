"use client";

import { useId, useState } from "react";
import { acceptInvite, declineInvite } from "@/app/dashboard/actions";
import { formatExchangeDate } from "@/lib/exchange-date.mjs";
import { sanitizeGroupNickname, validateAnonymousGroupNickname } from "@/lib/groups/nickname";
import type { PendingInvite } from "@/lib/groups/pending-invites";

export function InviteCard({
  invite,
  onRespond,
}: {
  invite: PendingInvite;
  onRespond: (groupId: string, message: string) => void;
}) {
  const nicknameId = useId();
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const requiresNickname = invite.require_anonymous_nickname;

  const respond = async (response: "accept" | "decline") => {
    if (busy) return;

    setMessage("");
    if (response === "accept" && requiresNickname) {
      const error = validateAnonymousGroupNickname({ nickname });
      if (error) {
        setMessage(error);
        return;
      }
    }

    setBusy(response);
    try {
      const result = response === "accept"
        ? await acceptInvite(invite.group_id, requiresNickname ? sanitizeGroupNickname(nickname) : undefined)
        : await declineInvite(invite.group_id);
      if (result.success) {
        onRespond(invite.group_id, result.message);
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("Could not respond to the invitation. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="holiday-panel-strong min-w-0 rounded-lg p-4 sm:p-5">
      <h3 className="wrap-break-word text-lg font-black text-[#2e3432]">{invite.group_name}</h3>
      <p className="mt-1 text-sm font-medium text-slate-600">
        Gift day: {formatExchangeDate(invite.group_event_date)}
      </p>
      {invite.group_description && (
        <p className="mt-2 wrap-break-word text-sm leading-6 text-slate-600">
          {invite.group_description}
        </p>
      )}
      <form className="mt-4" onSubmit={(event) => {
        event.preventDefault();
        void respond("accept");
      }}>
        {requiresNickname && (
          <div className="mb-4">
            <label htmlFor={nicknameId} className="block text-sm font-bold text-[#2e3432]">
              Group nickname
            </label>
            <input
              id={nicknameId}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              disabled={busy !== null}
              maxLength={30}
              placeholder="e.g. GiftFox"
              aria-describedby={`${nicknameId}-hint`}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-[#48664e]/20 bg-white px-3 text-sm text-[#2e3432] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e]"
            />
            <p id={`${nicknameId}-hint`} className="mt-1.5 text-xs text-slate-600">
              Group members will see your nickname instead of your name or email.
            </p>
          </div>
        )}
        {message && <p role="alert" className="mb-3 text-sm font-semibold text-rose-700">{message}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy !== null} className="gift-button gift-button-primary gift-button-compact">
            {busy === "accept" ? "Accepting..." : "Accept invite"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void respond("decline")}
            className="gift-button gift-button-secondary gift-button-compact"
          >
            {busy === "decline" ? "Declining..." : "Decline"}
          </button>
        </div>
      </form>
    </article>
  );
}
