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
  const { id } = useParams(); // dynamic group id
  const router = useRouter();
  const supabase = createClient();

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroup = async () => {
      // ✅ Get group info
      const { data: groupData } = await supabase
        .from("groups")
        .select("name, description, event_date, invites")
        .eq("id", id)
        .single();

      if (groupData) {
        setGroupName(groupData.name);
        setDescription(groupData.description || "");
        setEventDate(groupData.event_date);
        setInvited(groupData.invites || []);
      }

      // ✅ Get members
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
      <div className="relative z-10 max-w-2xl w-full p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-yellow-700 drop-shadow-lg">
          🎁 {groupName}
        </h1>
        <p className="text-gray-700 mb-2">{description}</p>
        <p className="text-gray-600 mb-6">📅 Event Date: {eventDate}</p>

        {/* Members */}
        <h2 className="text-xl font-bold mb-4 text-blue-700">✅ Members</h2>
        {members.length === 0 ? (
          <p className="text-gray-600">No members yet.</p>
        ) : (
          <ul className="space-y-2 mb-6">
            {members.map((m) => (
              <li key={m.user_id} className="p-3 rounded-lg bg-yellow-200">
                {m.nickname || m.email || m.user_id}
              </li>
            ))}
          </ul>
        )}

        {/* Invited Members */}
        <h2 className="text-xl font-bold mb-4 text-green-700">📩 Invited Members</h2>
        {invited.length === 0 ? (
          <p className="text-gray-600">No pending invites.</p>
        ) : (
          <ul className="space-y-2">
            {invited.map((email) => (
              <li key={email} className="p-3 rounded-lg bg-green-200">
                {email}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}