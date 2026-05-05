"use client";

import { useState } from "react";
import { updateNickname } from "./actions";

type Props = {
  groupId: string;
  currentNickname: string;
};

export default function NicknameForm({ groupId, currentNickname }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(currentNickname);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const displayNickname = currentNickname || nickname || "Set your nickname";

  const handleSave = async () => {
    setMessage("");

    if (!nickname || nickname.trim().length === 0) {
      setMessage("Enter a nickname.");
      return;
    }

    if (nickname.trim().length > 30) {
      setMessage("Use 30 characters or fewer for your nickname.");
      return;
    }

    setSaving(true);
    const result = await updateNickname(groupId, nickname.trim());
    setSaving(false);

    if (!result.success) {
      setMessage(result.message);
      return;
    }

    setMessage(result.message);

    setTimeout(() => {
      setIsEditing(false);
      setMessage("");
    }, 1500);
  };

  return (
    <div className="w-full min-w-0 max-w-44">
      {!isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex min-h-8 w-full items-center justify-center rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,.14)] transition hover:bg-white"
          title={`Change nickname: ${displayNickname}`}
        >
          Change nickname
        </button>
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Enter a nickname, like GiftNinja"
              maxLength={30}
              className="col-span-2 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <button
              onClick={handleSave}
              disabled={saving}
              className={`rounded-lg px-2 py-2 text-xs font-bold shadow transition ${
                saving
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              onClick={() => {
                setIsEditing(false);
                setNickname(currentNickname);
                setMessage("");
              }}
              className="rounded-lg bg-gray-300 px-2 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>

          {message && (
            <p
              className={`text-xs font-semibold ${
                message.toLowerCase().includes("updated")
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
