"use client";

// ─── Create Group Page ───
// This page lets a logged-in user create a new Secret Santa group.
// After creating, it:
// 1. Saves the group to the database
// 2. Adds the owner to group_members
// 3. Adds each invited email to group_members
// 4. Sends invite emails to each person (NEW!)
// 5. Redirects to the dashboard

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendInviteEmails } from "./actions"; // server action for emails

export default function CreateGroupPage() {
  const router = useRouter();

  // ─── Create a browser-side Supabase client ───
  // This talks to the database directly from the browser.
  const supabase = createClient();

  // ─── Form state variables ───
  // Each useState holds one piece of form data.
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");

  // ─── UI state ───
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState(""); // shows invite email progress

  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent the browser from refreshing the page on form submit
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setStatusMsg("");

    // ── Step 1: Get the logged-in user ──
    // We need their ID to set them as the group owner.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMsg("You must be logged in to create a group.");
      setLoading(false);
      return;
    }

    // ── Step 2: Clean up the email list ──
    // Split by comma, trim whitespace, remove empty strings,
    // and convert to lowercase for consistent matching.
    const emailList = inviteEmails
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0);

    // ── Step 3: Insert the group into the "groups" table ──
    // .insert() adds a new row to the table.
    // .select() returns the new row so we can read its auto-generated ID.
    // .single() means we expect exactly one row back.
    const { data: newGroup, error } = await supabase
      .from("groups")
      .insert({
        name: groupName,
        description,
        event_date: eventDate,
        owner_id: user.id,
        invites: emailList,
      })
      .select()
      .single();

    if (error || !newGroup) {
      setErrorMsg(error?.message || "Failed to create group.");
      setLoading(false);
      return;
    }

    // ── Step 4: Add the OWNER to group_members ──
    // The owner is a participant too — they appear in the members list.
    const { error: ownerError } = await supabase
      .from("group_members")
      .insert({
        group_id: newGroup.id,
        user_id: user.id,
        email: user.email,
        nickname: user.email?.split("@")[0],
        role: "owner",
      });

    if (ownerError) {
      console.error("Failed to insert owner:", ownerError.message);
    }

    // ── Step 5: Add each INVITED EMAIL to group_members ──
    // These people haven't signed up yet, so user_id is null.
    // When they register later, linkUserToGroup fills in their user_id.
    if (emailList.length > 0) {
      const memberRows = emailList.map((email) => ({
        group_id: newGroup.id,
        user_id: null,
        email: email,
        nickname: email.split("@")[0],
        role: "member",
      }));

      const { error: membersError } = await supabase
        .from("group_members")
        .insert(memberRows);

      if (membersError) {
        console.error("Failed to insert members:", membersError.message);
      }

      // ── Step 6: Send invite emails (runs on the server) ──
      // This calls our server action which uses the admin key
      // to send "You've been invited" emails to each person.
      setStatusMsg("📧 Sending invite emails...");
      const { sent, failed } = await sendInviteEmails(emailList);

      if (failed.length > 0) {
        setStatusMsg(`📧 Sent ${sent} emails. Failed: ${failed.join(", ")}`);
        // Wait 2 seconds so the user can read the message before redirecting
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // ── Step 7: Redirect to dashboard ──
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-100 via-white to-green-200 relative">
      {/* Snowflake background overlay */}
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 w-full max-w-lg p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-green-700 drop-shadow-lg">
          🎄 Create Your Secret Santa Group 🎁
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group name input */}
          <input
            type="text"
            placeholder="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-green-400 focus:border-green-400"
            required
          />

          {/* Description input */}
          <textarea
            placeholder="Description / Rules"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-green-400 focus:border-green-400"
            rows={3}
          />

          {/* Event date input */}
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-400 bg-white text-gray-900 focus:ring-2 focus:ring-green-400 focus:border-green-400"
            required
          />

          {/* Invite emails input */}
          <input
            type="text"
            placeholder="Invite emails (comma separated)"
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-green-400 focus:border-green-400"
          />

          {/* Error message */}
          {errorMsg && (
            <p className="text-red-600 font-semibold text-center">{errorMsg}</p>
          )}

          {/* Status message (shows email sending progress) */}
          {statusMsg && (
            <p className="text-blue-600 font-semibold text-center">{statusMsg}</p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-full font-bold text-white transition transform shadow-lg ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-green-400 to-green-600 hover:scale-105"
            }`}
          >
            {loading ? "Creating Group..." : "🎁 Create Group"}
          </button>
        </form>
      </div>
    </main>
  );
}