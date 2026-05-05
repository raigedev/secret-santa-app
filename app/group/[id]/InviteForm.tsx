"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createInviteLink,
  getActiveInviteLink,
  inviteUser,
  revokeInviteLink,
} from "./actions";

type State = {
  message: string;
};

function isSuccessMessage(message: string): boolean {
  return Boolean(
    message &&
      !/(failed|invalid|expired|could not|try again|unavailable|not logged|only the group owner|no active)/i.test(
        message
      )
  );
}

export default function InviteForm({ groupId }: { groupId: string }) {
  const [state, formAction] = useActionState<State, FormData>(inviteUser, { message: "" });
  const [linkMessage, setLinkMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [linkLoading, setLinkLoading] = useState<"idle" | "creating" | "revoking">("idle");

  useEffect(() => {
    let isMounted = true;
    const storageKey = `group-invite-link:${groupId}`;

    const loadActiveLink = async () => {
      const result = await getActiveInviteLink(groupId);

      if (!isMounted || !result.success) {
        return;
      }

      setHasActiveLink(Boolean(result.hasActiveLink));
      if (result.message && result.hasActiveLink) {
        setLinkMessage(result.message);
      }
    };

    void loadActiveLink();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !isMounted) {
        return;
      }

      try {
        const payload = event.newValue ? JSON.parse(event.newValue) : null;
        setInviteLink(payload?.link || "");
        setHasActiveLink(Boolean(payload?.link));
      } catch {
        setInviteLink("");
        setHasActiveLink(false);
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, [groupId]);

  const handleCreateInviteLink = async () => {
    setLinkLoading("creating");
    setLinkMessage("");

    const result = await createInviteLink(groupId);

    if (!result.success || !result.token) {
      setLinkMessage(result.message);
      setLinkLoading("idle");
      return;
    }

    const nextLink = `${window.location.origin}/invite/${encodeURIComponent(result.token)}`;
    setInviteLink(nextLink);
    setHasActiveLink(true);
    localStorage.setItem(
      `group-invite-link:${groupId}`,
      JSON.stringify({ link: nextLink, updatedAt: Date.now() })
    );

    try {
      await navigator.clipboard.writeText(nextLink);
      setLinkMessage("Invite link copied. The previous link is now turned off.");
    } catch {
      setLinkMessage("Invite link is ready below. Copy it manually if your browser blocks clipboard access.");
    }

    setLinkLoading("idle");
  };

  const handleRevokeInviteLink = async () => {
    setLinkLoading("revoking");
    setLinkMessage("");

    const result = await revokeInviteLink(groupId);

    if (result.success) {
      setInviteLink("");
      setHasActiveLink(false);
      localStorage.setItem(
        `group-invite-link:${groupId}`,
        JSON.stringify({ link: "", updatedAt: Date.now() })
      );
    }

    setLinkMessage(result.message);
    setLinkLoading("idle");
  };

  return (
    <div className="mb-6 flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={groupId} />

        <div className="rounded-3xl bg-[#fffefa] p-4 shadow-[inset_0_0_0_1px_rgba(72,102,78,.11)]">
          <div className="mb-3">
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#48664e]">
              Invite by email
            </div>
            <p className="mt-1 text-xs font-bold leading-5 text-[#64748b]">
              Send a private invite to new members. Existing users also see the invite on their dashboard.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="sr-only" htmlFor="member-email">
              Member email address
            </label>
            <input
              id="member-email"
              type="email"
              name="email"
              placeholder="Enter an email address"
              className="min-h-11 min-w-0 rounded-2xl border border-[rgba(72,102,78,.14)] bg-white px-4 text-sm font-bold text-[#2e3432] outline-none placeholder:text-slate-400 focus:border-[#48664e] focus:ring-4 focus:ring-[#48664e]/12"
              required
            />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#48664e] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(72,102,78,.18)] transition hover:-translate-y-0.5 hover:bg-[#3c5a43]"
            >
              Invite
            </button>
          </div>

          {state.message && (
            <p
              className={`mt-3 rounded-2xl px-3 py-2 text-sm font-bold ${
                isSuccessMessage(state.message)
                  ? "bg-[#eef7ef] text-[#48664e]"
                  : "bg-[#fff7f6] text-[#a43c3f]"
              }`}
            >
              {state.message}
            </p>
          )}
        </div>
      </form>

      <div className="rounded-3xl bg-[#f8faf7] p-4 shadow-[inset_0_0_0_1px_rgba(72,102,78,.1)]">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7b5902]">
          Invite link
        </div>

        <p className="mb-3 mt-1 text-[12px] font-bold leading-5 text-[#64748b]">
          Create a link members can use to join before names are drawn.
          Creating a new link turns off the older one.
        </p>

        {inviteLink && (
          <input
            readOnly
            value={inviteLink}
            className="mb-3 w-full rounded-2xl border border-[rgba(72,102,78,.14)] bg-white px-4 py-3 text-[12px] font-bold text-[#2e3432]"
          />
        )}

        {!inviteLink && hasActiveLink && (
          <div className="mb-3 w-full rounded-2xl border border-[rgba(72,102,78,.14)] bg-white px-4 py-3 text-[12px] font-bold text-[#64748b]">
            An invite link is already active. Create a new one if you want to replace it.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreateInviteLink}
            disabled={linkLoading !== "idle"}
            className={`min-h-10 rounded-full px-4 text-sm font-black text-white transition ${
              linkLoading === "idle"
                ? "bg-[#48664e] hover:-translate-y-0.5 hover:bg-[#3c5a43]"
                : "cursor-not-allowed bg-slate-400"
            }`}
          >
            {linkLoading === "creating"
              ? "Creating..."
              : inviteLink || hasActiveLink
                ? "Create new link"
                : "Create invite link"}
          </button>

          <button
            type="button"
            onClick={handleRevokeInviteLink}
            disabled={linkLoading !== "idle"}
            className={`min-h-10 rounded-full px-4 text-sm font-black transition ${
              linkLoading === "idle"
                ? "bg-[#fff7f6] text-[#a43c3f] ring-1 ring-[#a43c3f]/15 hover:-translate-y-0.5"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            {linkLoading === "revoking" ? "Turning off..." : "Turn off link"}
          </button>
        </div>

        {linkMessage && (
          <p
            className={`mt-3 rounded-2xl px-3 py-2 text-sm font-bold ${
              isSuccessMessage(linkMessage)
                ? "bg-[#eef7ef] text-[#48664e]"
                : "bg-[#fff7f6] text-[#a43c3f]"
            }`}
          >
            {linkMessage}
          </p>
        )}
      </div>
    </div>
  );
}
