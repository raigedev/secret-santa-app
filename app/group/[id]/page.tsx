"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  user_id: string;
  nickname?: string;
  email?: string;
};

export default function GroupDetailsPage() {
  const { id } = useParams(); // group id from URL
  const router = useRouter();
  const supabase = createClient();

  const [members, setMembers] = useState<Member[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const fetchGroup = async () => {
      const { data: groupData } = await supabase
        .from("groups")
        .select("name")
        .eq("id", id)
        .single();

      if (groupData) setGroupName(groupData.name);

      const { data: memberData } = await supabase
        .from("group_members")
        .select("user_id, nickname, email")
        .eq("group_id", id);

      setMembers(memberData || []);
      setLoading(false);
    };

    fetchGroup();
  }, [id, supabase]);

  const handleDelete = async () => {
    setErrorMsg("");
    const { error } = await supabase.from("groups").delete().eq("id", id);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // ✅ Show success message before redirect
    setSuccessMsg("Group deleted successfully!");
    setTimeout(() => {
      router.push("/dashboard");
    }, 1500); // wait 1.5s so user sees the toast
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg font-semibold text-blue-700">Loading group...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 via-white to-yellow-200 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 max-w-2xl w-full p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-yellow-700 drop-shadow-lg">
            🎁 {groupName} Members
          </h1>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-md bg-red-500 text-white font-semibold hover:bg-red-600 transition"
          >
            Delete Group
          </button>
        </div>

        {errorMsg && (
          <p className="text-red-600 font-semibold text-center mb-4">{errorMsg}</p>
        )}
        {successMsg && (
          <p className="text-green-600 font-semibold text-center mb-4">
            {successMsg}
          </p>
        )}

        {members.length === 0 ? (
          <p className="text-gray-600 text-center">No members yet.</p>
        ) : (
          <ul className="space-y-3">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="rounded-lg p-4 shadow-md bg-gradient-to-r from-yellow-300 to-yellow-500 text-white font-semibold hover:scale-105 transition transform"
              >
                {m.nickname || m.email || m.user_id}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ✅ Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-red-600">Confirm Delete</h2>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete <strong>{groupName}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-md bg-gray-300 hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-md bg-red-500 text-white font-semibold hover:bg-red-600 transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}