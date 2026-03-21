"use client";

// ═══════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════
// Security: #02 Supabase Auth, #09 RLS, #19 server-side checks
// Real-time: group_members, groups, assignments, wishlists

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InviteCard from "./InviteCard";
import SecretSantaCard from "./SecretSantaCard";

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

type WishlistItem = {
  id: string;
  item_name: string;
  item_link: string;
  item_note: string;
  priority: number;
};

type RecipientData = {
  group_id: string;
  group_name: string;
  group_event_date: string;
  receiver_nickname: string;
  receiver_wishlist: WishlistItem[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userName, setUserName] = useState("");
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [assignments, setAssignments] = useState<RecipientData[]>([]);
  const [myWishlistItems, setMyWishlistItems] = useState<WishlistItem[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const user = session.user;
      const email = user.email || "Guest";
      setUserName(email.split("@")[0]);

      // Link user to invited groups
      await supabase
        .from("group_members")
        .update({ user_id: user.id })
        .eq("email", email.toLowerCase())
        .is("user_id", null);

      // Get all memberships
      const { data: memberRows, error: memberError } = await supabase
        .from("group_members")
        .select("group_id, status, role")
        .or(`user_id.eq.${user.id},email.eq.${email}`);

      if (memberError) {
        setOwnedGroups([]); setInvitedGroups([]); setPendingInvites([]);
        setAssignments([]); setMyWishlistItems([]);
        setLoading(false); return;
      }

      const acceptedRows = (memberRows || []).filter((r) => r.status === "accepted");
      const pendingRows = (memberRows || []).filter((r) => r.status === "pending");
      const acceptedGroupIds = [...new Set(acceptedRows.map((r) => r.group_id))];
      const pendingGroupIds = [...new Set(pendingRows.map((r) => r.group_id))];

      const roleMap: Record<string, string> = {};
      for (const row of acceptedRows) roleMap[row.group_id] = row.role;

      // ─── Fetch accepted groups + members + draw status ───
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

        const { data: allAssignments } = await supabase
          .from("assignments")
          .select("group_id")
          .in("group_id", acceptedGroupIds);

        const drawnGroupIds = new Set((allAssignments || []).map((a) => a.group_id));

        const groupsWithMembers: Group[] = (groupsData || []).map((group) => ({
          ...group,
          isOwner: roleMap[group.id] === "owner",
          hasDrawn: drawnGroupIds.has(group.id),
          members: (allMembers || [])
            .filter((m) => m.group_id === group.id)
            .map((m) => ({ nickname: m.nickname, email: m.email, role: m.role })),
        }));

        setOwnedGroups(groupsWithMembers.filter((g) => g.isOwner));
        setInvitedGroups(groupsWithMembers.filter((g) => !g.isOwner));
        setMyGroupIds(acceptedGroupIds);

        // ─── Fetch MY assignments (who I give to) ───
        const { data: myAssignments } = await supabase
          .from("assignments")
          .select("group_id, receiver_id")
          .eq("giver_id", user.id)
          .in("group_id", acceptedGroupIds);

        if (myAssignments && myAssignments.length > 0) {
          const receiverIds = myAssignments.map((a) => a.receiver_id);

          // Fetch receiver nicknames
          const { data: receiverMembers } = await supabase
            .from("group_members")
            .select("group_id, user_id, nickname")
            .in("user_id", receiverIds)
            .in("group_id", acceptedGroupIds)
            .eq("status", "accepted");

          // Fetch receiver wishlists (RLS only returns items I'm allowed to see)
          const { data: receiverWishlists } = await supabase
            .from("wishlists")
            .select("id, group_id, user_id, item_name, item_link, item_note, priority")
            .in("user_id", receiverIds)
            .in("group_id", acceptedGroupIds);

          const recipientData: RecipientData[] = myAssignments.map((a) => {
            const group = (groupsData || []).find((g) => g.id === a.group_id);
            const receiver = (receiverMembers || []).find(
              (m) => m.user_id === a.receiver_id && m.group_id === a.group_id
            );
            const wishlist = (receiverWishlists || [])
              .filter((w) => w.user_id === a.receiver_id && w.group_id === a.group_id)
              .map((w) => ({
                id: w.id,
                item_name: w.item_name,
                item_link: w.item_link || "",
                item_note: w.item_note || "",
                priority: w.priority || 0,
              }));

            return {
              group_id: a.group_id,
              group_name: group?.name || "Unknown Group",
              group_event_date: group?.event_date || "",
              receiver_nickname: receiver?.nickname || "Secret Participant",
              receiver_wishlist: wishlist,
            };
          });

          setAssignments(recipientData);
        } else {
          setAssignments([]);
        }

        // ─── Fetch MY wishlist items (across all groups) ───
        const { data: myItems } = await supabase
          .from("wishlists")
          .select("id, item_name, item_link, item_note, priority")
          .eq("user_id", user.id)
          .in("group_id", acceptedGroupIds);

        setMyWishlistItems(
          (myItems || []).map((w) => ({
            id: w.id,
            item_name: w.item_name,
            item_link: w.item_link || "",
            item_note: w.item_note || "",
            priority: w.priority || 0,
          }))
        );
      } else {
        setOwnedGroups([]); setInvitedGroups([]);
        setAssignments([]); setMyWishlistItems([]);
      }

      // Pending invites
      if (pendingGroupIds.length > 0) {
        const { data: pendingGroups } = await supabase
          .from("groups")
          .select("id, name, description, event_date")
          .in("id", pendingGroupIds);
        setPendingInvites(
          (pendingGroups || []).map((g) => ({
            group_id: g.id, group_name: g.name,
            group_description: g.description || "", group_event_date: g.event_date,
          }))
        );
      } else {
        setPendingInvites([]);
      }

      setLoading(false);
    };

    loadDashboard();

    // Real-time: all relevant tables
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => loadDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => loadDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => loadDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlists" }, () => loadDashboard())
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/login");
      else setUserName((session.user.email || "Guest").split("@")[0]);
    });

    return () => { supabase.removeChannel(channel); subscription.unsubscribe(); };
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-lg font-semibold text-blue-700">Loading dashboard...</p>
    </main>
  );

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
              {group.members.length > 4 && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,.15)" }}>+{group.members.length - 4} more</span>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">🎲 Draw: {group.hasDrawn ? "Done ✓" : "Not yet"}</div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-200 text-gray-900 relative">
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0" />
      <div className="relative z-10 text-center max-w-5xl w-full p-10 rounded-xl shadow-xl bg-white/40 backdrop-blur-md">

        <h1 className="text-4xl font-bold mb-2 drop-shadow-lg" style={{ color: "#1E3A8A" }}>🎁 GiftDraw Dashboard 🎅</h1>
        <p className="text-lg mb-8 font-semibold" style={{ color: "#334155" }}>Welcome, {userName} 🎁</p>

        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <div className="text-left mb-10">
            <h2 className="text-2xl font-bold mb-4 text-orange-600">📩 Pending Invitations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingInvites.map((invite) => (
                <InviteCard key={invite.group_id} groupId={invite.group_id} groupName={invite.group_name} eventDate={invite.group_event_date} description={invite.group_description} />
              ))}
            </div>
          </div>
        )}

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Secret Santa Card */}
          <SecretSantaCard assignments={assignments} myWishlistItems={myWishlistItems} myGroupIds={myGroupIds} />

          <div className="text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #86EFAC, #22C55E)", boxShadow: "0 0 20px rgba(34, 197, 94, 0.7)" }}>
            <div className="bg-white text-green-700 font-bold py-2 text-center rounded-t-[2rem]">💡🎅 Gift Ideas</div>
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: "#334155" }}>Share and explore festive gift ideas</p>
              <div className="mt-4 flex justify-center gap-2 text-xl">❄️ 🎁 🍬</div>
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
        <div className="text-left mb-8">
          <h2 className="text-2xl font-bold mb-4 text-blue-700">👑 My Groups</h2>
          {ownedGroups.length === 0 ? (
            <div className="text-center py-5 rounded-xl" style={{ background: "rgba(0,0,0,.02)", border: "1px dashed rgba(0,0,0,.08)" }}>
              <p className="text-gray-500 text-sm font-semibold">You haven&apos;t created any groups yet.</p>
              <button onClick={() => router.push("/create-group")} className="mt-3 px-5 py-2 rounded-lg text-sm font-bold text-white transition hover:scale-105"
                style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}>+ Create Your First Group</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ownedGroups.map((g) => <GroupCard key={g.id} group={g} type="owned" />)}
            </div>
          )}
        </div>

        {/* Invited Groups */}
        <div className="text-left mb-10">
          <h2 className="text-2xl font-bold mb-4 text-green-700">🎄 Invited Groups</h2>
          {invitedGroups.length === 0 ? (
            <div className="text-center py-5 rounded-xl" style={{ background: "rgba(0,0,0,.02)", border: "1px dashed rgba(0,0,0,.08)" }}>
              <p className="text-gray-500 text-sm font-semibold">No group invitations accepted yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invitedGroups.map((g) => <GroupCard key={g.id} group={g} type="invited" />)}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button onClick={handleLogout} className="text-white font-bold px-6 py-3 rounded-full hover:scale-105 transition flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #FBBF24, #F59E0B)", boxShadow: "0 0 20px rgba(251, 191, 36, 0.7)" }}>🍭 Logout</button>
        </div>
      </div>
    </main>
  );
}