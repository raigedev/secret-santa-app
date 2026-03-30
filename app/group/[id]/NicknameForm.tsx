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

  const handleSave = async () => {
    setMessage("");

    if (!nickname || nickname.trim().length === 0) {
      setMessage("Nickname cannot be empty.");
      return;
    }

    if (nickname.trim().length > 30) {
      setMessage("Nickname must be 30 characters or less.");
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
    <div>
      {!isEditing ? (
        <div className="flex items-center justify-between mt-2">
          <span
            className="text-sm font-bold"
            style={{ color: "#6b7280", fontWeight: 800 }}
          >
            {currentNickname || nickname || "Set your nickname"}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs bg-white/50 hover:bg-white/80 text-gray-600 px-3 py-1 rounded-full transition font-semibold"
          >
            Change Nickname
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Enter your alias (e.g. GiftNinja)"
              maxLength={30}
              className="flex-1 px-3 py-2 rounded-lg text-sm text-black bg-white border border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-bold shadow transition ${
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
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-400 transition"
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
