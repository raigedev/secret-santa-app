"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InviteCard from "./InviteCard";
import SecretSantaCard from "./SecretSantaCard";
import ProfileSetupModal from "./ProfileSetupModal";
import { getProfile } from "@/app/profile/actions";
import { DashboardSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";

type GroupMember = { nickname: string | null; email: string | null; role: string };
type Group = {
  id: string; name: string; description?: string; event_date: string;
  owner_id: string; created_at: string; members: GroupMember[];
  isOwner: boolean; hasDrawn: boolean;
};
type PendingInvite = { group_id: string; group_name: string; group_description: string; group_event_date: string };

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

  useEffect(() => {
    const loadDashboard = async () => {
      // Fast auth check (cached, ~10ms vs ~300ms)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const user = session.user;
      const email = user.email || "Guest";
      setUserName(email.split("@")[0]);

      // Parallel fetch: profile + link user + memberships
      const [profileData] = await Promise.all([
        getProfile(),
        supabase.from("group_members").update({ user_id: user.id }).eq("email", email.toLowerCase()).is("user_id", null),
      ]);

      if (profileData) {
        if (!profileData.profile_setup_complete) setShowProfileSetup(true);
        if (profileData.display_name) setUserName(profileData.display_name);
        if (profileData.avatar_emoji) setUserEmoji(profileData.avatar_emoji);
      }

      const { data: memberRows } = await supabase
        .from("group_members")
        .select("group_id, status, role")
        .or(`user_id.eq.${user.id},email.eq.${email}`);

      if (!memberRows || memberRows.length === 0) {
        setOwnedGroups([]); setInvitedGroups([]); setPendingInvites([]);
        setRecipientNames([]); setLoading(false); return;
      }

      const acceptedRows = memberRows.filter((r) => r.status === "accepted");
      const pendingRows = memberRows.filter((r) => r.status === "pending");
      const acceptedGroupIds = [...new Set(acceptedRows.map((r) => r.group_id))];
      const pendingGroupIds = [...new Set(pendingRows.map((r) => r.group_id))];
      const roleMap: Record<string, string> = {};
      for (const row of acceptedRows) roleMap[row.group_id] = row.role;

      // Parallel fetch — each typed separately to avoid TS errors
      const [groupsRes, membersRes, assignmentsRes, myAssignRes, pendingRes] = await Promise.all([
        acceptedGroupIds.length > 0
          ? supabase.from("groups").select("id, name, description, event_date, owner_id, created_at").in("id", acceptedGroupIds)
          : Promise.resolve({ data: [] as { id: string; name: string; description: string; event_date: string; owner_id: string; created_at: string }[] }),
        acceptedGroupIds.length > 0
          ? supabase.from("group_members").select("group_id, nickname, email, role").in("group_id", acceptedGroupIds).eq("status", "accepted")
          : Promise.resolve({ data: [] as { group_id: string; nickname: string; email: string; role: string }[] }),
        acceptedGroupIds.length > 0
          ? supabase.from("assignments").select("group_id").in("group_id", acceptedGroupIds)
          : Promise.resolve({ data: [] as { group_id: string }[] }),
        acceptedGroupIds.length > 0
          ? supabase.from("assignments").select("group_id, receiver_id").eq("giver_id", user.id).in("group_id", acceptedGroupIds)
          : Promise.resolve({ data: [] as { group_id: string; receiver_id: string }[] }),
        pendingGroupIds.length > 0
          ? supabase.from("groups").select("id, name, description, event_date").in("id", pendingGroupIds)
          : Promise.resolve({ data: [] as { id: string; name: string; description: string; event_date: string }[] }),
      ]);

      const groupsData = groupsRes.data || [];
      const allMembers = membersRes.data || [];
      const allAssignments = assignmentsRes.data || [];
      const myAssignments = myAssignRes.data || [];
      const pendingGroups = pendingRes.data || [];;

      const drawnGroupIds = new Set(allAssignments.map((a) => a.group_id));

      const groupsWithMembers: Group[] = groupsData.map((group) => ({
        ...group,
        isOwner: roleMap[group.id] === "owner",
        hasDrawn: drawnGroupIds.has(group.id),
        members: allMembers.filter((m) => m.group_id === group.id).map((m) => ({ nickname: m.nickname, email: m.email, role: m.role })),
      }));

      setOwnedGroups(groupsWithMembers.filter((g) => g.isOwner));
      setInvitedGroups(groupsWithMembers.filter((g) => !g.isOwner));

      // Recipient names
      if (myAssignments.length > 0) {
        const receiverIds = myAssignments.map((a) => a.receiver_id);
        const { data: receiverMembers } = await supabase
          .from("group_members").select("user_id, nickname").in("user_id", receiverIds).eq("status", "accepted");
        setRecipientNames(myAssignments.map((a) => {
          const r = (receiverMembers || []).find((m) => m.user_id === a.receiver_id);
          return r?.nickname || "Secret Participant";
        }));
      } else {
        setRecipientNames([]);
      }

      setPendingInvites(pendingGroups.map((g) => ({
        group_id: g.id, group_name: g.name, group_description: g.description || "", group_event_date: g.event_date,
      })));

      setLoading(false);
    };

    loadDashboard();

    const channel = supabase.channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => loadDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => loadDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => loadDashboard())
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/login");
    });

    return () => { supabase.removeChannel(channel); subscription.unsubscribe(); };
  }, [supabase, router]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/login"); };

  // Show skeleton while loading
  if (loading) return <DashboardSkeleton />;

  const GroupCard = ({ group, type }: { group: Group; type: "owned" | "invited" }) => (
    <div onClick={() => router.push(`/group/${group.id}`)}
      className="cursor-pointer rounded-[14px] overflow-hidden transition hover:-translate-y-1"
      style={{
        background: type === "owned" ? "linear-gradient(135deg,#1e40af,#2563eb)" : "linear-gradient(135deg,#b45309,#f59e0b)",
        boxShadow: type === "owned" ? "0 4px 20px rgba(37,99,235,.25)" : "0 4px 20px rgba(245,158,11,.25)",
      }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "rgba(255,255,255,.92)" }}>
        <span className="text-sm font-extrabold" style={{ color: type === "owned" ? "#1e40af" : "#b45309" }}>🎁 {group.name}</span>
        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide"
          style={{ background: type === "owned" ? "rgba(37,99,235,.1)" : "rgba(245,158,11,.1)", color: type === "owned" ? "#1e40af" : "#b45309" }}>
          {type === "owned" ? "👑 Owner" : "🎁 Member"}
        </span>
      </div>
      <div className="px-4 py-3 text-white">
        {group.description && <p className="text-xs opacity-85 mb-1.5 leading-relaxed">{group.description}</p>}
        <p className="text-xs opacity-70 mb-2.5">📅 {group.event_date}</p>
        {group.members.length > 0 && (
          <div className="mb-2.5">
            <p className="text-[10px] font-bold opacity-60 mb-1.5">👥 {group.members.length} Members</p>
            <div className="flex flex-wrap gap-1">
              {group.members.slice(0, 4).map((m, i) => (
                <span key={i} className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,.2)" }}>{m.nickname || "Anonymous"}</span>
              ))}
              {group.members.length > 4 && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,.15)" }}>+{group.members.length - 4} more</span>}
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">🎲 Draw: {group.hasDrawn ? "Done ✓" : "Not yet"}</div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 text-gray-900 relative">

      {showProfileSetup && (
        <ProfileSetupModal defaultName={userName} onComplete={() => setShowProfileSetup(false)} onSkip={() => setShowProfileSetup(false)} />
      )}

      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0" />

      <FadeIn className="relative z-10 text-center max-w-5xl w-full p-10 rounded-xl shadow-xl bg-white/40 backdrop-blur-md">

        {/* Header */}
        <div data-fade className="flex items-center justify-center gap-3 mb-2">
          <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center text-[26px]"
            style={{ background: "linear-gradient(135deg,#fef2f2,#fee2e2)", border: "3px solid #fff", boxShadow: "0 2px 10px rgba(192,57,43,.1)" }}>
            {userEmoji}
          </div>
          <h1 className="text-4xl font-bold drop-shadow-lg" style={{ color: "#1E3A8A" }}>My Secret Santa</h1>
        </div>
        <p data-fade className="text-lg mb-8 font-semibold" style={{ color: "#334155" }}>Welcome, {userName} 🎁</p>

        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <div data-fade className="text-left mb-10">
            <h2 className="text-2xl font-bold mb-4 text-orange-600">📩 Pending Invitations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingInvites.map((invite) => (
                <InviteCard key={invite.group_id} groupId={invite.group_id} groupName={invite.group_name} eventDate={invite.group_event_date} description={invite.group_description} />
              ))}
            </div>
          </div>
        )}

        {/* Action Cards */}
        <div data-fade className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <SecretSantaCard recipientNames={recipientNames} />
          <div onClick={() => router.push("/secret-santa-chat")}
            className="cursor-pointer text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #86EFAC, #22C55E)", boxShadow: "0 0 20px rgba(34, 197, 94, 0.7)" }}>
            <div className="bg-white text-green-700 font-bold py-2 text-center rounded-t-[2rem]">💬🎅 Secret Santa Chat</div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>Chat with your matches anonymously</p>
              <div className="mt-4 flex justify-center gap-2 text-xl">💬 🎅 🎁</div>
            </div>
          </div>
          <div onClick={() => router.push("/create-group")}
            className="cursor-pointer text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #60A5FA, #3B82F6)", boxShadow: "0 0 20px rgba(59, 130, 246, 0.7)" }}>
            <div className="bg-white text-blue-700 font-bold py-2 text-center rounded-t-[2rem]">📋🎉 Create Group</div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>Start a new Secret Santa event</p>
              <div className="mt-4 flex justify-center gap-2 text-xl">🎊 🎄 🎁</div>
            </div>
          </div>
        </div>

        {/* My Groups */}
        <div data-fade className="text-left mb-8">
          <h2 className="text-2xl font-bold mb-4 text-blue-700">👑 My Groups</h2>
          {ownedGroups.length === 0 ? (
            <div className="text-center py-5 rounded-xl" style={{ background: "rgba(0,0,0,.02)", border: "1px dashed rgba(0,0,0,.08)" }}>
              <p className="text-gray-500 text-sm font-semibold">You haven&apos;t created any groups yet.</p>
              <button onClick={() => router.push("/create-group")} className="mt-3 px-5 py-2 rounded-lg text-sm font-bold text-white transition hover:scale-105"
                style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}>+ Create Your First Group</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{ownedGroups.map((g) => <GroupCard key={g.id} group={g} type="owned" />)}</div>
          )}
        </div>

        {/* Invited Groups */}
        <div data-fade className="text-left mb-10">
          <h2 className="text-2xl font-bold mb-4 text-green-700">🎄 Invited Groups</h2>
          {invitedGroups.length === 0 ? (
            <div className="text-center py-5 rounded-xl" style={{ background: "rgba(0,0,0,.02)", border: "1px dashed rgba(0,0,0,.08)" }}>
              <p className="text-gray-500 text-sm font-semibold">No group invitations accepted yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{invitedGroups.map((g) => <GroupCard key={g.id} group={g} type="invited" />)}</div>
          )}
        </div>

        {/* Profile + Logout */}
        <div data-fade className="flex justify-center gap-3">
          <button onClick={() => router.push("/profile")}
            className="font-bold px-6 py-3 rounded-full hover:scale-105 transition flex items-center gap-2"
            style={{ color: "#c0392b", background: "rgba(192,57,43,.06)", border: "1px solid rgba(192,57,43,.1)" }}>
            🎅 Edit Profile
          </button>
          <button onClick={handleLogout}
            className="text-white font-bold px-6 py-3 rounded-full hover:scale-105 transition flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #FBBF24, #F59E0B)", boxShadow: "0 0 20px rgba(251, 191, 36, 0.7)" }}>
            🍭 Logout
          </button>
        </div>

      </FadeIn>
    </main>
  );
}