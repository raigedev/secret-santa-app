"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  user_id: string;
  nickname?: string;
  email?: string;
};

export default function GroupDetailsPage() {
  const { id } = useParams(); // group id from URL
  const supabase = createClient();

  const [members, setMembers] = useState<Member[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroup = async () => {
      // ✅ Get group info
      const { data: groupData } = await supabase
        .from("groups")
        .select("name")
        .eq("id", id)
        .single();

      if (groupData) setGroupName(groupData.name);

      // ✅ Get members (only user_id + nickname/email, not role)
      const { data: memberData } = await supabase
        .from("group_members")
        .select("user_id, nickname, email")
        .eq("group_id", id);

      setMembers(memberData || []);
      setLoading(false);
    };

    fetchGroup();
  }, [id, supabase]);

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
        <h1 className="text-3xl font-bold text-center mb-6 text-yellow-700 drop-shadow-lg">
          🎁 {groupName} Members
        </h1>

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
    </main>
  );
}