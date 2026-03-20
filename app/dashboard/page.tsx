"use client";

// ─── Dashboard Page ───
// Shows:
// 1. Pending invitations (Accept/Decline)
// 2. Your accepted groups
// 3. Quick action cards (Secret Santa, Gift Ideas, Create Group)

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InviteCard from "./InviteCard";

// ─── Types ───
type GroupMember = {
  nickname: string | null;
  email: string | null;
  role: string;
};

type Group = {
  id: string;
  name: string;
  description?: string;
  event_date: string;
  owner_id: string;
  created_at: string;
  members: GroupMember[];
};

type PendingInvite = {
  group_id: string;
  group_name: string;
  group_description: string;
  group_event_date: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userName, setUserName] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      // ─── 1. Check if user is logged in ───
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const user = session.user;
      const email = user.email || "Guest";
      setUserName(email.split("@")[0]);

      // ─── Link this user to any groups they were invited to ───
      // Invited users have user_id = null in group_members.
      // Now that they're logged in, fill in their user_id
      // so the system knows this email = this account.
      await supabase
        .from("group_members")
        .update({ user_id: user.id })
        .eq("email", email.toLowerCase())
        .is("user_id", null);

      // ─── 2. Find all group_members rows for this user ───
      const { data: memberRows, error: memberError } = await supabase
        .from("group_members")
        .select("group_id, status")
        .or(`user_id.eq.${user.id},email.eq.${email}`);

      if (memberError) {
        console.error("Error fetching memberships:", memberError);
        setGroups([]);
        setPendingInvites([]);
        setLoading(false);
        return;
      }

      // ─── 3. Split into accepted vs pending ───
      const acceptedGroupIds = [
        ...new Set(
          (memberRows || [])
            .filter((r) => r.status === "accepted")
            .map((r) => r.group_id)
        ),
      ];

      const pendingGroupIds = [
        ...new Set(
          (memberRows || [])
            .filter((r) => r.status === "pending")
            .map((r) => r.group_id)
        ),
      ];

      // ─── 4. Fetch ACCEPTED groups with their members ───
      if (acceptedGroupIds.length > 0) {
        const { data: groupsData } = await supabase
          .from("groups")
          .select("id, name, description, event_date, owner_id, created_at")
          .in("id", acceptedGroupIds);

        const { data: allMembers } = await supabase
          .from("group_members")
          .select("group_id, nickname, email, role")
          .in("group_id", acceptedGroupIds)
          .eq("status", "accepted");

        const groupsWithMembers: Group[] = (groupsData || []).map((group) => ({
          ...group,
          members: (allMembers || [])
            .filter((m) => m.group_id === group.id)
            .map((m) => ({
              nickname: m.nickname,
              email: m.email,
              role: m.role,
            })),
        }));

        setGroups(groupsWithMembers);
      } else {
        setGroups([]);
      }

      // ─── 5. Fetch PENDING invites ───
      if (pendingGroupIds.length > 0) {
        const { data: pendingGroups } = await supabase
          .from("groups")
          .select("id, name, description, event_date")
          .in("id", pendingGroupIds);

        setPendingInvites(
          (pendingGroups || []).map((g) => ({
            group_id: g.id,
            group_name: g.name,
            group_description: g.description || "",
            group_event_date: g.event_date,
          }))
        );
      } else {
        setPendingInvites([]);
      }

      setLoading(false);
    };

    loadDashboard();

    // ─── Listen for auth changes ───
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setUserName((session.user.email || "Guest").split("@")[0]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg font-semibold text-blue-700">
          Loading dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 text-gray-900 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>
      <div className="relative z-10 text-center max-w-5xl w-full p-10 rounded-xl shadow-xl bg-white/40 backdrop-blur-md">
        <h1
          className="text-4xl font-bold mb-2 drop-shadow-lg"
          style={{ color: "#1E3A8A" }}
        >
          🎁 GiftDraw Dashboard 🎅
        </h1>
        <p className="text-lg mb-8 font-semibold" style={{ color: "#334155" }}>
          Welcome, {userName} 🎁
        </p>

        {/* ─── PENDING INVITATIONS ─── */}
        {pendingInvites.length > 0 && (
          <div className="text-left mb-10">
            <h2 className="text-2xl font-bold mb-4 text-orange-600">
              📩 Pending Invitations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingInvites.map((invite) => (
                <InviteCard
                  key={invite.group_id}
                  groupId={invite.group_id}
                  groupName={invite.group_name}
                  eventDate={invite.group_event_date}
                  description={invite.group_description}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── Festive Cards ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div
            className="text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #F87171, #EF4444)",
              boxShadow: "0 0 20px rgba(239, 68, 68, 0.7)",
            }}
          >
            <div className="bg-white text-red-700 font-bold py-2 text-center rounded-t-[2rem]">
              🔍🎅 Your Secret Santa
            </div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>
                Assignments will appear here
              </p>
              <div className="mt-4 flex justify-center gap-2 text-xl">
                🎁 🌲 🍬
              </div>
            </div>
          </div>

          <div
            className="text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #86EFAC, #22C55E)",
              boxShadow: "0 0 20px rgba(34, 197, 94, 0.7)",
            }}
          >
            <div className="bg-white text-green-700 font-bold py-2 text-center rounded-t-[2rem]">
              💡🎅 Gift Ideas
            </div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>
                Share and explore festive gift ideas
              </p>
              <div className="mt-4 flex justify-center gap-2 text-xl">
                ❄️ 🎁 🍬
              </div>
            </div>
          </div>

          <div
            onClick={() => router.push("/create-group")}
            className="cursor-pointer text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #60A5FA, #3B82F6)",
              boxShadow: "0 0 20px rgba(59, 130, 246, 0.7)",
            }}
          >
            <div className="bg-white text-blue-700 font-bold py-2 text-center rounded-t-[2rem]">
              📋🎉 Create Group
            </div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>
                Start a new Secret Santa event
              </p>
              <div className="mt-4 flex justify-center gap-2 text-xl">
                🎊 🎄 🎁
              </div>
            </div>
          </div>
        </div>

        {/* ─── Your Groups (accepted only) ─── */}
        <div className="text-left mb-10">
          <h2 className="text-2xl font-bold mb-6 text-blue-700">
            🎄 Your Groups
          </h2>

          {groups.length === 0 ? (
            <p className="text-gray-600">
              No groups yet. Create one or accept an invitation above!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => router.push(`/group/${group.id}`)}
                  className="cursor-pointer rounded-xl p-6 shadow-lg hover:scale-105 transition transform relative overflow-hidden text-white"
                  style={{
                    background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
                    boxShadow: "0 0 20px rgba(251, 191, 36, 0.7)",
                  }}
                >
                  <div className="bg-white text-yellow-700 font-bold py-2 px-4 rounded-t-lg text-center">
                    🎁 {group.name}
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-sm text-gray-800 mb-2">
                      {group.description}
                    </p>
                    <p className="text-sm text-gray-600">
                      📅 Event Date: {group.event_date}
                    </p>

                    {group.members.length > 0 && (
                      <div className="mt-4 text-left">
                        <p className="text-xs font-bold text-gray-700 mb-2">
                          👥 Members ({group.members.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {group.members.map((member, i) => (
                            <span
                              key={i}
                              className="bg-white/70 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full shadow-sm"
                            >
                              {member.nickname || "Anonymous"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex justify-center gap-2 text-xl">
                      🎄 🎁 🍬
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            className="text-white font-bold px-6 py-3 rounded-full hover:scale-105 transition flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
              boxShadow: "0 0 20px rgba(251, 191, 36, 0.7)",
            }}
          >
            🍭 Logout
          </button>
        </div>
      </div>
    </main>
  );
}