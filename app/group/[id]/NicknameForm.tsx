"use client";

// ─── NicknameForm Component ───
// Shows a "Change Nickname" button on the logged-in user's own card.
// When clicked, opens an inline form to type a new alias.
// After saving, the name updates INSTANTLY — no page refresh needed.
// Uses the browser Supabase client so we can update the UI in real-time.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Props this component receives from the parent page:
type Props = {
  groupId: string;           // which group we're editing the nickname for
  currentNickname: string;   // the user's current nickname
};

export default function NicknameForm({ groupId, currentNickname }: Props) {
  // ─── Create Supabase browser client ───
  // We use the CLIENT (browser) version here, not the server version.
  // This lets us make database calls directly from the browser
  // and update the UI immediately without a page refresh.
  const supabase = createClient();

  // ─── State variables ───
  // isEditing: controls whether the edit form is open or closed
  // nickname: the text in the input field
  // displayName: what's shown on the card (updates instantly after save)
  // saving: true while we're waiting for the database to respond
  // message: success or error feedback message
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(currentNickname);
  const [displayName, setDisplayName] = useState(currentNickname);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ─── Handle Save ───
  // Called when the user clicks "Save" on the edit form.
  // 1. Validates the nickname
  // 2. Sends the update to the database
  // 3. Updates the displayed name INSTANTLY (no refresh)
  const handleSave = async () => {
    // Clear any previous messages
    setMessage("");

    // Validate: nickname can't be empty
    if (!nickname || nickname.trim().length === 0) {
      setMessage("❌ Nickname can't be empty.");
      return;
    }

    // Validate: nickname max 30 characters
    if (nickname.trim().length > 30) {
      setMessage("❌ Nickname must be 30 characters or less.");
      return;
    }

    // Show "Saving..." state on the button
    setSaving(true);

    // Get the logged-in user's ID so we can update only OUR row
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("❌ You must be logged in.");
      setSaving(false);
      return;
    }

    // ─── Update the nickname in the database ───
    // .update() changes existing data (like editing a cell in Excel)
    // .eq("group_id", groupId) → only in this specific group
    // .eq("user_id", user.id) → only YOUR row (security!)
    // This means you CAN'T change someone else's nickname.
    const { error } = await supabase
      .from("group_members")
      .update({ nickname: nickname.trim() })
      .eq("group_id", groupId)
      .eq("user_id", user.id);

    if (error) {
      setMessage(`❌ Error: ${error.message}`);
      setSaving(false);
      return;
    }

    // ─── Update the UI INSTANTLY ───
    // Instead of refreshing the whole page, we just update the
    // displayName variable. React re-renders the component
    // automatically when state changes — so the new name appears
    // on screen immediately.
    setDisplayName(nickname.trim());
    setMessage(`✅ Nickname updated to "${nickname.trim()}"!`);
    setSaving(false);

    // Close the edit form after a short delay so user sees the success message
    setTimeout(() => {
      setIsEditing(false);
      setMessage("");
    }, 1500);
  };

  return (
    <div>
      {/* ─── Display the current nickname ─── */}
      {/* This is the name shown on the member card.
          It updates INSTANTLY after saving — no page refresh needed.
          The parent component shows the initial name, but once
          the user edits it, this component takes over displaying it. */}

      {!isEditing ? (
        // ─── View Mode: show name + edit button ───
        <div className="flex items-center justify-between mt-2">
          {/* The displayName updates instantly after saving */}
          <span className="text-sm font-bold">
            {displayName || currentNickname}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs bg-white/50 hover:bg-white/80 text-gray-600 
                       px-3 py-1 rounded-full transition font-semibold"
          >
            ✏️ Change Nickname
          </button>
        </div>
      ) : (
        // ─── Edit Mode: show the form ───
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            {/* Text input for the new nickname */}
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your alias (e.g. GiftNinja)"
              maxLength={30}
              className="flex-1 px-3 py-2 rounded-lg text-sm text-black bg-white 
                         border border-gray-300 placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {/* Save button — disabled while saving to prevent double-clicks */}
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

            {/* Cancel button — closes the form without saving */}
            <button
              onClick={() => {
                setIsEditing(false);
                setNickname(displayName); // reset input to current name
                setMessage("");
              }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg 
                         text-sm font-bold hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          </div>

          {/* Success or error message */}
          {message && (
            <p
              className={`text-xs font-semibold ${
                message.startsWith("✅")
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