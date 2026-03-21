"use client";

// ─── Group Detail Page (with Real-Time) ───
// Shows group info, members (accepted/pending/declined),
// invite form, nickname editor, and resend button.
// REAL-TIME: auto-updates when members accept/decline/change nickname.

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InviteForm from "./InviteForm";
import NicknameForm from "./NicknameForm";
import ResendButton from "./ResendButton";

// ─── Types ───
type Member = {
  user_id: string | null;
  nickname: string | null;
  email: string | null;
  role: string;
  status: string;
};

type GroupData = {
  name: string;
  description: string | null;
  event_date: string;
  owner_id: string;
};

export default function GroupDetails() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // ─── Create stable Supabase client ───
  const [supabase] = useState(() => createClient());

  // ─── State ───
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // ─── Load all group data ───
    // Defined inside useEffect to avoid dependency issues.
    // Called on first load AND when real-time detects a change.
    const loadGroupData = async () => {
      // Get the logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      // Fetch group details
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("name, description, event_date, owner_id")
        .eq("id", id)
        .maybeSingle();

      if (groupError) {
        console.error("Error loading group:", groupError);
        setError("Error loading group");
        setLoading(false);
        return;
      }

      if (!group) {
        setError("Group not found");
        setLoading(false);
        return;
      }

      setGroupData(group);
      setIsOwner(user.id === group.owner_id);

      // Fetch all members
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select("user_id, nickname, email, role, status")
        .eq("group_id", id);

      if (membersError) {
        console.error("Error loading members:", membersError);
        setError("Error loading members");
        setLoading(false);
        return;
      }

      setMembers((membersData ?? []) as Member[]);
      setLoading(false);
    };

    // ─── Initial load ───
    loadGroupData();

    // ─── REAL-TIME SUBSCRIPTION ───
    // Listens for any change to group_members for THIS group.
    // When someone accepts, declines, changes nickname, or gets invited,
    // the page reloads automatically. No manual refresh needed.
    const channel = supabase
      .channel(`group-${id}-realtime`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `group_id=eq.${id}`,
        },
        () => loadGroupData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "groups",
          filter: `id=eq.${id}`,
        },
        () => loadGroupData()
      )
      .subscribe();

    // ─── Cleanup ───
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, supabase, router]);

  // ─── Loading state ───
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg font-semibold text-blue-700">Loading group...</p>
      </main>
    );
  }

  // ─── Error state ───
  if (error || !groupData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg font-semibold text-red-600">{error || "Group not found"}</p>
      </main>
    );
  }

  // ─── Split members by status ───
  const acceptedMembers = members.filter((m) => m.status === "accepted");
  const pendingMembers = members.filter((m) => m.status === "pending");
  const declinedMembers = members.filter((m) => m.status === "declined");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 via-white to-yellow-200 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0"></div>

      <div className="relative z-10 max-w-2xl w-full p-8 rounded-xl shadow-xl bg-white/80 backdrop-blur-md">

        {/* ─── Group Title ─── */}
        <h1 className="text-3xl font-bold text-yellow-700 drop-shadow-lg mb-2">
          🎁 {groupData.name}
        </h1>

        {groupData.description && (
          <p className="text-gray-600 mb-2">{groupData.description}</p>
        )}

        <p className="text-sm text-gray-500 mb-6">
          📅 Event Date: {groupData.event_date}
        </p>

        {/* ─── Status Summary ─── */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold">
            ✅ Accepted: {acceptedMembers.length}
          </div>
          <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg text-sm font-bold">
            ⏳ Pending: {pendingMembers.length}
          </div>
          {declinedMembers.length > 0 && (
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-bold">
              ❌ Declined: {declinedMembers.length}
            </div>
          )}
          <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold">
            👥 Total: {members.length}
          </div>
        </div>

        {/* ─── Invite Form (owner only) ─── */}
        {isOwner && <InviteForm groupId={id} />}

        {/* ─── Delete Group (owner only) ─── */}
        {isOwner && (
          <div className="mb-6">
            <button
              onClick={async () => {
                if (!confirm("Are you sure you want to delete this group?")) return;
                const { error } = await supabase
                  .from("groups")
                  .delete()
                  .eq("id", id);
                if (!error) router.push("/dashboard");
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition"
            >
              🗑️ Delete Group
            </button>
          </div>
        )}

        {/* ═══ ACCEPTED MEMBERS ═══ */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          🎄 Participants
        </h2>

        {acceptedMembers.length === 0 ? (
          <p className="text-gray-600 text-center mb-6">
            No accepted members yet.
          </p>
        ) : (
          <ul className="space-y-3 mb-6">
            {acceptedMembers.map((m, index) => {
              const isCurrentUser = currentUserId === m.user_id;

              return (
                <li
                  key={m.user_id || index}
                  className="rounded-lg p-4 shadow-md font-semibold transition transform hover:scale-105 bg-gradient-to-r from-green-300 to-green-500 text-white"
                >
                  {isCurrentUser ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <span>🎁 You</span>
                        <span className="text-xs px-3 py-1 rounded-full font-bold bg-white/30 text-white">
                          Accepted ✓
                        </span>
                      </div>
                      <NicknameForm
                        groupId={id}
                        currentNickname={m.nickname || ""}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>
                        🎁 {m.nickname || `Participant ${index + 1}`}
                      </span>
                      <span className="text-xs px-3 py-1 rounded-full font-bold bg-white/30 text-white">
                        Accepted ✓
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* ═══ PENDING MEMBERS ═══ */}
        {pendingMembers.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-yellow-700 mb-3">
              ⏳ Waiting for Response
            </h2>
            <ul className="space-y-3 mb-6">
              {pendingMembers.map((m, index) => (
                <li
                  key={m.email || index}
                  className="rounded-lg p-4 shadow-md font-semibold bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600 flex items-center justify-between"
                >
                  <span>⏳ {m.nickname || `Participant ${index + 1}`}</span>
                  <span className="text-xs px-3 py-1 rounded-full font-bold bg-yellow-400/30 text-yellow-800">
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* ═══ DECLINED MEMBERS (owner only) ═══ */}
        {isOwner && declinedMembers.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-red-600 mb-3">
              ❌ Declined
            </h2>
            <ul className="space-y-3 mb-6">
              {declinedMembers.map((m, index) => (
                <li
                  key={m.email || index}
                  className="rounded-lg p-4 shadow-md font-semibold bg-gradient-to-r from-red-100 to-red-200 text-red-700 flex items-center justify-between"
                >
                  <span>{m.nickname || `Participant ${index + 1}`}</span>
                  <ResendButton
                    groupId={id}
                    memberEmail={m.email || ""}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* ─── Info box (owner only) ─── */}
        {pendingMembers.length > 0 && isOwner && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            💡 <strong>Pending members</strong> need to log in and accept the invitation
            from their dashboard. <strong>Declined members</strong> can be re-invited
            using the Resend button above.
          </div>
        )}

        {/* ─── Back to dashboard ─── */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-blue-600 font-bold hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}