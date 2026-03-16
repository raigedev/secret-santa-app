"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateGroupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg("You must be logged in to create a group.");
      setLoading(false);
      return;
    }

    // Insert group into Supabase
    const { error } = await supabase.from("groups").insert({
      name: groupName,
      description,
      event_date: eventDate,
      owner_id: user.id,
      invites: inviteEmails.split(",").map(email => email.trim()),
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    // Redirect back to dashboard
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-100 via-white to-green-200 relative">
      {/* snowflake overlay */}
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 w-full max-w-lg p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-green-700 drop-shadow-lg">
          🎄 Create Your Secret Santa Group 🎁
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-green-400 focus:border-green-400"
            required
          />

          <textarea
            placeholder="Description / Rules"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-green-400 focus:border-green-400"
            rows={3}
          />

          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-400 bg-white text-gray-900 focus:ring-2 focus:ring-green-400 focus:border-green-400"
            required
          />

          <input
            type="text"
            placeholder="Invite emails (comma separated)"
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-400 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-green-400 focus:border-green-400"
          />

          {errorMsg && (
            <p className="text-red-600 font-semibold text-center">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full font-bold text-white bg-gradient-to-r from-green-400 to-green-600 hover:scale-105 transition transform shadow-lg"
          >
            {loading ? "Creating Group..." : "🎁 Create Group"}
          </button>
        </form>
      </div>
    </main>
  );
}