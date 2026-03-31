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

export default function InviteForm({ groupId }: { groupId: string }) {
  const [state, formAction] = useActionState<State, FormData>(inviteUser, { message: "" });
  const [linkMessage, setLinkMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [linkLoading, setLinkLoading] = useState<"idle" | "creating" | "revoking">("idle");

  useEffect(() => {
    let isMounted = true;
    const storageKey = `group-invite-link:${groupId}`;

    const loadActiveLink = async () => {
      const result = await getActiveInviteLink(groupId);

      if (!isMounted || !result.success || !result.token) {
        return;
      }

      setInviteLink(`${window.location.origin}/invite/${encodeURIComponent(result.token)}`);
    };

    void loadActiveLink();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !isMounted) {
        return;
      }

      try {
        const payload = event.newValue ? JSON.parse(event.newValue) : null;
        setInviteLink(payload?.link || "");
      } catch {
        setInviteLink("");
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
    localStorage.setItem(
      `group-invite-link:${groupId}`,
      JSON.stringify({ link: nextLink, updatedAt: Date.now() })
    );

    try {
      await navigator.clipboard.writeText(nextLink);
      setLinkMessage("✅ Invite link copied. Sharing a fresh link disables the previous one.");
    } catch {
      setLinkMessage("✅ Invite link ready below. Copy it manually if your browser blocks clipboard access.");
    }

    setLinkLoading("idle");
  };

  const handleRevokeInviteLink = async () => {
    setLinkLoading("revoking");
    setLinkMessage("");

    const result = await revokeInviteLink(groupId);

    if (result.success) {
      setInviteLink("");
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

        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.9)" }}>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-emerald-700 mb-2">
            Invite By Email
          </div>

          <div className="flex gap-2">
            <input
              type="email"
              name="email"
              placeholder="Enter email to invite"
              className="flex-1 px-3 py-2 border rounded-lg text-black bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
            >
              Invite
            </button>
          </div>

          {state.message && (
            <p
              className={`text-sm mt-2 ${
                state.message.startsWith("✅") ? "text-green-600" : "text-red-600"
              }`}
            >
              {state.message}
            </p>
          )}
        </div>
      </form>

      <div
        className="rounded-xl p-4"
        style={{
          background: "rgba(219,234,254,.45)",
          border: "1px solid rgba(59,130,246,.16)",
        }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-blue-700 mb-1">
          Invite Link
        </div>

        <p className="text-[12px] text-slate-600 leading-relaxed mb-3">
          Generate a shareable link anyone can use to join this group before the draw.
          Creating a fresh link automatically disables the older one.
        </p>

        {inviteLink && (
          <input
            readOnly
            value={inviteLink}
            className="w-full px-3 py-2 rounded-lg text-[12px] text-slate-700 bg-white border mb-3"
            style={{ borderColor: "rgba(59,130,246,.18)" }}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreateInviteLink}
            disabled={linkLoading !== "idle"}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition"
            style={{
              background:
                linkLoading === "idle"
                  ? "linear-gradient(135deg,#2563eb,#3b82f6)"
                  : "#94a3b8",
              cursor: linkLoading === "idle" ? "pointer" : "not-allowed",
            }}
          >
            {linkLoading === "creating"
              ? "Generating..."
              : inviteLink
                ? "Copy Fresh Link"
                : "Generate Invite Link"}
          </button>

          <button
            type="button"
            onClick={handleRevokeInviteLink}
            disabled={linkLoading !== "idle"}
            className="px-4 py-2 rounded-lg text-sm font-bold transition"
            style={{
              background: "rgba(220,38,38,.08)",
              color: linkLoading === "idle" ? "#dc2626" : "#94a3b8",
              border: "1px solid rgba(220,38,38,.15)",
              cursor: linkLoading === "idle" ? "pointer" : "not-allowed",
            }}
          >
            {linkLoading === "revoking" ? "Revoking..." : "Revoke Link"}
          </button>
        </div>

        {linkMessage && (
          <p
            className={`text-sm mt-3 ${
              linkMessage.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {linkMessage}
          </p>
        )}
      </div>
    </div>
  );
}
