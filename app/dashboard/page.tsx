"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InviteCard from "./InviteCard";
import SecretSantaCard from "./SecretSantaCard";
import ProfileSetupModal from "./ProfileSetupModal";
import { getProfile } from "@/app/profile/actions";
import { claimInvitedMemberships } from "./actions";
import { deleteGroup } from "@/app/group/[id]/actions";
import { DashboardSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";

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
  isOwner: boolean;
  hasDrawn: boolean;
};

type PendingInvite = {
  group_id: string;
  group_name: string;
  group_description: string;
  group_event_date: string;
};

type ActionMessage = {
  type: "success" | "error";
  text: string;
} | null;

type GroupRow = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  owner_id: string;
  created_at: string;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string | null;
  nickname: string;
  email: string;
  role: string;
};

type MembershipRow = {
  id: string;
  group_id: string;
  status: string;
  role: string;
};

type AssignmentRow = {
  group_id: string;
};

type MyAssignmentRow = {
  group_id: string;
  receiver_id: string;
};

type PendingGroupRow = {
  id: string;
  name: string;
  description: string;
  event_date: string;
};

function createGroupUserKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
}

function createEmptyQueryResult<T>(data: T[] = []): Promise<{ data: T[]; error: null }> {
  return Promise.resolve({ data, error: null });
}

export default function DashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userName, setUserName] = useState("");
  const [userEmoji, setUserEmoji] = useState("🎅");
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [recipientNames, setRecipientNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const loadDashboardDataRef = useRef<
    ((user: { id: string; email?: string | null }) => Promise<void>) | null
  >(null);
  const loadProfileDataRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let isMounted = true;
    let dashboardReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let profileReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let sessionUser:
      | {
          id: string;
          email?: string | null;
        }
      | null = null;

    // Reload the dashboard cards and lists without repeating one-time setup like
    // profile bootstrap or invited-membership claiming on every realtime event.
    const loadDashboardData = async (user: { id: string; email?: string | null }) => {
      try {
        const email = (user.email || "guest@example.com").toLowerCase();

        const [membersByUserRes, membersByEmailRes] = await Promise.all([
          supabase
            .from("group_members")
            .select("id, group_id, status, role")
            .eq("user_id", user.id),
          supabase
            .from("group_members")
            .select("id, group_id, status, role")
            .eq("email", email),
        ]);

        if (membersByUserRes.error) {
          throw membersByUserRes.error;
        }

        if (membersByEmailRes.error) {
          throw membersByEmailRes.error;
        }

        const membershipMap = new Map<string, MembershipRow>();

        for (const row of (membersByUserRes.data || []) as MembershipRow[]) {
          membershipMap.set(row.id, row);
        }

        for (const row of (membersByEmailRes.data || []) as MembershipRow[]) {
          membershipMap.set(row.id, row);
        }

        const memberRows = [...membershipMap.values()];

        if (!isMounted) {
          return;
        }

        if (!memberRows || memberRows.length === 0) {
          setOwnedGroups([]);
          setInvitedGroups([]);
          setPendingInvites([]);
          setRecipientNames([]);
          setLoading(false);
          return;
        }

        const acceptedRows = memberRows.filter((row) => row.status === "accepted");
        const pendingRows = memberRows.filter((row) => row.status === "pending");
        const acceptedGroupIds = [...new Set(acceptedRows.map((row) => row.group_id))];
        const pendingGroupIds = [...new Set(pendingRows.map((row) => row.group_id))];
        const roleMap: Record<string, string> = {};

        for (const row of acceptedRows) {
          roleMap[row.group_id] = row.role;
        }

        const [groupsRes, membersRes, assignmentsRes, myAssignRes, pendingRes] =
          await Promise.all([
            acceptedGroupIds.length > 0
              ? supabase
                  .from("groups")
                  .select("id, name, description, event_date, owner_id, created_at")
                  .in("id", acceptedGroupIds)
              : createEmptyQueryResult<GroupRow>(),
            acceptedGroupIds.length > 0
              ? supabase
                  .from("group_members")
                  .select("group_id, user_id, nickname, email, role")
                  .in("group_id", acceptedGroupIds)
                  .eq("status", "accepted")
              : createEmptyQueryResult<GroupMemberRow>(),
            acceptedGroupIds.length > 0
              ? supabase.from("assignments").select("group_id").in("group_id", acceptedGroupIds)
              : createEmptyQueryResult<AssignmentRow>(),
            acceptedGroupIds.length > 0
              ? supabase
                  .from("assignments")
                  .select("group_id, receiver_id")
                  .eq("giver_id", user.id)
                  .in("group_id", acceptedGroupIds)
              : createEmptyQueryResult<MyAssignmentRow>(),
            pendingGroupIds.length > 0
              ? supabase
                  .from("groups")
                  .select("id, name, description, event_date")
                  .in("id", pendingGroupIds)
              : createEmptyQueryResult<PendingGroupRow>(),
          ]);

        if (groupsRes.error) {
          throw groupsRes.error;
        }

        if (membersRes.error) {
          throw membersRes.error;
        }

        if (assignmentsRes.error) {
          throw assignmentsRes.error;
        }

        if (myAssignRes.error) {
          throw myAssignRes.error;
        }

        if (pendingRes.error) {
          throw pendingRes.error;
        }

        const groupsData = groupsRes.data || [];
        const allMembers = membersRes.data || [];
        const allAssignments = assignmentsRes.data || [];
        const myAssignments = myAssignRes.data || [];
        const pendingGroups = pendingRes.data || [];
        const drawnGroupIds = new Set(allAssignments.map((assignment) => assignment.group_id));

        const groupsWithMembers: Group[] = groupsData.map((group) => ({
          ...group,
          isOwner: roleMap[group.id] === "owner",
          hasDrawn: drawnGroupIds.has(group.id),
          members: allMembers
            .filter((member) => member.group_id === group.id)
            .map((member) => ({
              nickname: member.nickname,
              email: member.email,
              role: member.role,
            })),
        }));

        if (!isMounted) {
          return;
        }

        setOwnedGroups(groupsWithMembers.filter((group) => group.isOwner));
        setInvitedGroups(groupsWithMembers.filter((group) => !group.isOwner));

        const receiverNameByGroupUser = new Map<string, string>();

        for (const member of allMembers) {
          if (!member.user_id) {
            continue;
          }

          receiverNameByGroupUser.set(
            createGroupUserKey(member.group_id, member.user_id),
            member.nickname || "Secret Participant"
          );
        }

        setRecipientNames(
          myAssignments.map((assignment) => {
            return (
              receiverNameByGroupUser.get(
                createGroupUserKey(assignment.group_id, assignment.receiver_id)
              ) || "Secret Participant"
            );
          })
        );

        setPendingInvites(
          pendingGroups.map((group) => ({
            group_id: group.id,
            group_name: group.name,
            group_description: group.description || "",
            group_event_date: group.event_date,
          }))
        );
      } catch (error) {
        console.error("[Dashboard] Failed to load dashboard:", error);

        if (!isMounted) {
          return;
        }

        setActionMessage({
          type: "error",
          text: "Failed to load the dashboard. Please refresh and try again.",
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboardDataRef.current = loadDashboardData;

    const loadProfileData = async () => {
      const profileData = await getProfile();

      if (!isMounted || !sessionUser) {
        return;
      }

      const defaultName = (sessionUser.email || "guest@example.com").split("@")[0];

      if (profileData) {
        setShowProfileSetup(!profileData.profile_setup_complete);
        setUserName(profileData.display_name || defaultName);
        setUserEmoji(profileData.avatar_emoji || "🎅");
      }
    };

    loadProfileDataRef.current = loadProfileData;

    const scheduleDashboardReload = () => {
      if (!sessionUser) {
        return;
      }

      if (dashboardReloadTimer) {
        clearTimeout(dashboardReloadTimer);
      }

      // Group actions often touch several related rows. Debouncing the reload
      // keeps the dashboard from flashing through multiple intermediate states.
      dashboardReloadTimer = setTimeout(() => {
        if (sessionUser && loadDashboardDataRef.current) {
          void loadDashboardDataRef.current(sessionUser);
        }
      }, 120);
    };

    const scheduleProfileReload = () => {
      if (profileReloadTimer) {
        clearTimeout(profileReloadTimer);
      }

      profileReloadTimer = setTimeout(() => {
        if (loadProfileDataRef.current) {
          void loadProfileDataRef.current();
        }
      }, 120);
    };

    const bootstrapDashboard = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        sessionUser = session.user;

        const email = (session.user.email || "guest@example.com").toLowerCase();
        const defaultName = email.split("@")[0];

        if (!isMounted) {
          return;
        }

        setUserName(defaultName);

        await Promise.all([loadProfileData(), claimInvitedMemberships()]);

        if (!isMounted) {
          return;
        }


        await loadDashboardData(session.user);
      } catch (error) {
        console.error("[Dashboard] Failed to bootstrap dashboard:", error);

        if (!isMounted) {
          return;
        }

        setActionMessage({
          type: "error",
          text: "Failed to load the dashboard. Please refresh and try again.",
        });
        setLoading(false);
      }
    };

    void bootstrapDashboard();

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => scheduleDashboardReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => scheduleDashboardReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        () => scheduleDashboardReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          const changedUserId =
            (payload.new as { user_id?: string } | null)?.user_id ||
            (payload.old as { user_id?: string } | null)?.user_id;

          if (sessionUser && changedUserId === sessionUser.id) {
            scheduleProfileReload();
          }
        }
      )
      .subscribe();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      }
    });

    return () => {
      isMounted = false;
      if (dashboardReloadTimer) {
        clearTimeout(dashboardReloadTimer);
      }
      if (profileReloadTimer) {
        clearTimeout(profileReloadTimer);
      }
      void supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Only the owner can delete a group.
  // Requiring the exact group name adds another deliberate confirmation step.
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const confirmed = confirm(
      `Delete "${groupName}"?\n\nThis will permanently remove the group.`
    );

    if (!confirmed) {
      return;
    }

    const typedName = prompt(
      `Type the group name exactly to confirm deletion:\n\n${groupName}`,
      ""
    );

    if (typedName === null) {
      return;
    }

    setDeletingGroupId(groupId);
    setActionMessage(null);

    try {
      const result = await deleteGroup(groupId, typedName);
      setActionMessage({
        type: result.success ? "success" : "error",
        text: result.message,
      });
    } catch (error) {
      console.error("[Dashboard] Delete group failed:", error);
      setActionMessage({
        type: "error",
        text: "Failed to delete the group. Please try again.",
      });
    } finally {
      setDeletingGroupId(null);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const GroupCard = ({
    group,
    type,
  }: {
    group: Group;
    type: "owned" | "invited";
  }) => (
    <div
      onClick={() => router.push(`/group/${group.id}`)}
      className="cursor-pointer rounded-[14px] overflow-hidden transition hover:-translate-y-1"
      style={{
        background:
          type === "owned"
            ? "linear-gradient(135deg,#1e40af,#2563eb)"
            : "linear-gradient(135deg,#b45309,#f59e0b)",
        boxShadow:
          type === "owned"
            ? "0 4px 20px rgba(37,99,235,.25)"
            : "0 4px 20px rgba(245,158,11,.25)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: "rgba(255,255,255,.92)" }}
      >
        <span
          className="text-sm font-extrabold"
          style={{ color: type === "owned" ? "#1e40af" : "#b45309" }}
        >
          🎁 {group.name}
        </span>
        <span
          className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide"
          style={{
            background:
              type === "owned" ? "rgba(37,99,235,.1)" : "rgba(245,158,11,.1)",
            color: type === "owned" ? "#1e40af" : "#b45309",
          }}
        >
          {type === "owned" ? "👑 Owner" : "🎁 Member"}
        </span>
      </div>
      <div className="px-4 py-3 text-white">
        {group.description && (
          <p className="text-xs opacity-85 mb-1.5 leading-relaxed">{group.description}</p>
        )}
        <p className="text-xs opacity-70 mb-2.5">📅 {group.event_date}</p>
        {group.members.length > 0 && (
          <div className="mb-2.5">
            <p className="text-[10px] font-bold opacity-60 mb-1.5">
              👥 {group.members.length} Members
            </p>
            <div className="flex flex-wrap gap-1">
              {group.members.slice(0, 4).map((member, index) => (
                <span
                  key={index}
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,.2)" }}
                >
                  {member.nickname || "Anonymous"}
                </span>
              ))}
              {group.members.length > 4 && (
                <span
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,.15)" }}
                >
                  +{group.members.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">
          🎲 Draw: {group.hasDrawn ? "Done ✓" : "Not yet"}
        </div>
        {type === "owned" && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void handleDeleteGroup(group.id, group.name);
              }}
              disabled={deletingGroupId === group.id}
              className="px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition"
              style={{
                background: "rgba(127,29,29,.85)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,.18)",
                cursor: deletingGroupId === group.id ? "wait" : "pointer",
                opacity: deletingGroupId === group.id ? 0.75 : 1,
              }}
            >
              {deletingGroupId === group.id ? "Deleting..." : "Delete Group"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 text-gray-900 relative">
      {showProfileSetup && (
        <ProfileSetupModal
          defaultName={userName}
          onComplete={() => setShowProfileSetup(false)}
          onSkip={() => setShowProfileSetup(false)}
        />
      )}

      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0" />

      <FadeIn className="relative z-10 text-center max-w-5xl w-full p-10 rounded-xl shadow-xl bg-white/40 backdrop-blur-md">
        {actionMessage && (
          <div
            data-fade
            role="status"
            aria-live="polite"
            className="mb-6 rounded-xl px-4 py-3 text-sm font-bold"
            style={{
              background:
                actionMessage.type === "success"
                  ? "rgba(34,197,94,.12)"
                  : "rgba(239,68,68,.12)",
              color: actionMessage.type === "success" ? "#166534" : "#991b1b",
              border:
                actionMessage.type === "success"
                  ? "1px solid rgba(34,197,94,.2)"
                  : "1px solid rgba(239,68,68,.2)",
            }}
          >
            {actionMessage.text}
          </div>
        )}

        {/* Header */}
        <div data-fade className="flex items-center justify-center gap-3 mb-2">
          <div
            className="w-[48px] h-[48px] rounded-full flex items-center justify-center text-[26px]"
            style={{
              background: "linear-gradient(135deg,#fef2f2,#fee2e2)",
              border: "3px solid #fff",
              boxShadow: "0 2px 10px rgba(192,57,43,.1)",
            }}
          >
            {userEmoji}
          </div>
          <h1 className="text-4xl font-bold drop-shadow-lg" style={{ color: "#1E3A8A" }}>
            My Secret Santa
          </h1>
        </div>
        <p data-fade className="text-lg mb-8 font-semibold" style={{ color: "#334155" }}>
          Welcome, {userName} 🎁
        </p>

        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <div data-fade className="text-left mb-10">
            <h2 className="text-2xl font-bold mb-4 text-orange-600">📩 Pending Invitations</h2>
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

        {/* Action Cards */}
        <div data-fade className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <SecretSantaCard recipientNames={recipientNames} />
          <div
            onClick={() => router.push("/secret-santa-chat")}
            className="cursor-pointer text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #86EFAC, #22C55E)",
              boxShadow: "0 0 20px rgba(34, 197, 94, 0.7)",
            }}
          >
            <div className="bg-white text-green-700 font-bold py-2 text-center rounded-t-[2rem]">
              💬🎅 Secret Santa Chat
            </div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>
                Chat with your matches anonymously
              </p>
              <div className="mt-4 flex justify-center gap-2 text-xl">💬 🎅 🎁</div>
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
              <div className="mt-4 flex justify-center gap-2 text-xl">🎊 🎄 🎁</div>
            </div>
          </div>
        </div>

        {/* My Groups */}
        <div data-fade className="text-left mb-8">
          <h2 className="text-2xl font-bold mb-4 text-blue-700">👑 My Groups</h2>
          {ownedGroups.length === 0 ? (
            <div
              className="text-center py-5 rounded-xl"
              style={{ background: "rgba(0,0,0,.02)", border: "1px dashed rgba(0,0,0,.08)" }}
            >
              <p className="text-gray-500 text-sm font-semibold">
                You haven&apos;t created any groups yet.
              </p>
              <button
                type="button"
                onClick={() => router.push("/create-group")}
                className="mt-3 px-5 py-2 rounded-lg text-sm font-bold text-white transition hover:scale-105"
                style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}
              >
                + Create Your First Group
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ownedGroups.map((group) => (
                <GroupCard key={group.id} group={group} type="owned" />
              ))}
            </div>
          )}
        </div>

        {/* Invited Groups */}
        <div data-fade className="text-left mb-10">
          <h2 className="text-2xl font-bold mb-4 text-green-700">🎄 Invited Groups</h2>
          {invitedGroups.length === 0 ? (
            <div
              className="text-center py-5 rounded-xl"
              style={{ background: "rgba(0,0,0,.02)", border: "1px dashed rgba(0,0,0,.08)" }}
            >
              <p className="text-gray-500 text-sm font-semibold">
                No group invitations accepted yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invitedGroups.map((group) => (
                <GroupCard key={group.id} group={group} type="invited" />
              ))}
            </div>
          )}
        </div>

        {/* Profile + Logout */}
        <div data-fade className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="font-bold px-6 py-3 rounded-full hover:scale-105 transition flex items-center gap-2"
            style={{
              color: "#c0392b",
              background: "rgba(192,57,43,.06)",
              border: "1px solid rgba(192,57,43,.1)",
            }}
          >
            🎅 Edit Profile
          </button>
          <button
            type="button"
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
      </FadeIn>
    </main>
  );
}
