"use client";

// ─── NicknameForm Component ───
// This shows a small form where the current user can change
// their own nickname/alias in this group.
// It appears ONLY next to the logged-in user's own row.

import { useFormState } from "react-dom";
import { updateNickname } from "./actions";
import { useState } from "react";

// "State" is the shape of what our server action returns.
type State = {
  message: string;
};

// Props this component receives from the parent page:
// - groupId: which group we're editing the nickname for
// - currentNickname: what the user's nickname is right now
type Props = {
  groupId: string;
  currentNickname: string;
};

export default function NicknameForm({ groupId, currentNickname }: Props) {
  // ─── State: is the edit form open or closed? ───
  // Starts closed — user sees their name + an "Edit" button.
  // When they click "Edit", the form opens.
  const [isEditing, setIsEditing] = useState(false);

  // ─── useFormState connects our form to the server action ───
  // "state" holds the response message (success or error).
  // "formAction" is what the form calls when submitted.
  const [state, formAction] = useFormState<State, FormData>(updateNickname, {
    message: "",
  });

  return (
    <div className="mt-2">
      {/* ─── Toggle between "Edit" button and the edit form ─── */}
      {!isEditing ? (
        // Show a small "Edit Nickname" button
        <button
          onClick={() => setIsEditing(true)}
          className="text-xs bg-white/50 hover:bg-white/80 text-gray-600 
                     px-3 py-1 rounded-full transition font-semibold"
        >
          ✏️ Change Nickname
        </button>
      ) : (
        // Show the edit form
        <form action={formAction} className="flex flex-col gap-2">
          {/* Hidden input: tells the server which group this is for */}
          <input type="hidden" name="groupId" value={groupId} />

          <div className="flex gap-2">
            {/* Nickname text input — starts with their current nickname */}
            <input
              type="text"
              name="nickname"
              defaultValue={currentNickname}
              placeholder="Enter your alias (e.g. GiftNinja)"
              maxLength={30}
              className="flex-1 px-3 py-2 rounded-lg text-sm text-black bg-white 
                         border border-gray-300 placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />

            {/* Save button — submits the form */}
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded-lg 
                         text-sm font-bold shadow hover:bg-green-700 transition"
            >
              Save
            </button>

            {/* Cancel button — closes the form without saving */}
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg 
                         text-sm font-bold hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          </div>

          {/* Show success or error message from the server */}
          {state.message && (
            <p
              className={`text-xs font-semibold ${
                state.message.startsWith("✅")
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {state.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}