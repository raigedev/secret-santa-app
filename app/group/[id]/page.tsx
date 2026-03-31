"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InviteForm from "./InviteForm";
import NicknameForm from "./NicknameForm";
import ResendButton from "./ResendButton";
import RevokeInviteButton from "./RevokeInviteButton";
import { drawSecretSanta, resetSecretSantaDraw } from "./draw-action";
import {
  deleteGroup,
  editGroup,
  getRevealMatches,
  getGroupOwnerInsights,
  leaveGroup,
  removeMember,
  triggerReveal,
} from "./actions";
import { GroupSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";

type Member = {
  id: string;
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
  budget: number | null;
  currency: string | null;
  revealed: boolean;
  revealed_at: string | null;
};

type Assignment = {
  receiver_nickname: string;
};

type RevealMatch = {
  giver: string;
  receiver: string;
};

type OwnerInsights = {
  acceptedCount: number;
  wishlistReadyCount: number;
  missingWishlistMemberNames: string[];
  activeChatThreadCount: number;
  totalChatThreadCount: number;
  confirmedGiftCount: number;
  totalGiftCount: number;
};

const BUDGET_OPTIONS = [10, 15, 25, 50, 100];
const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD" },
  { code: "EUR", symbol: "€", label: "EUR" },
  { code: "GBP", symbol: "£", label: "GBP" },
  { code: "PHP", symbol: "₱", label: "PHP" },
  { code: "JPY", symbol: "¥", label: "JPY" },
  { code: "AUD", symbol: "A$", label: "AUD" },
  { code: "CAD", symbol: "C$", label: "CAD" },
];

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-[20px] p-7"
        style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [supabase] = useState(() => createClient());

  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawLoading, setDrawLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [drawMessage, setDrawMessage] = useState("");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [drawDone, setDrawDone] = useState(false);
  const [ownerInsights, setOwnerInsights] = useState<OwnerInsights | null>(null);
  const [revealMatches, setRevealMatches] = useState<RevealMatch[]>([]);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealMessage, setRevealMessage] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editBudget, setEditBudget] = useState(25);
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editCustom, setEditCustom] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  const [actionSaving, setActionSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const loadGroupDataRef = useRef<(() => Promise<void>) | null>(null);

  const notifyGroupRefresh = () => {
    try {
      localStorage.setItem(`group-refresh:${id}`, Date.now().toString());
    } catch {
      // Best-effort same-browser tab sync only.
    }

    if (loadGroupDataRef.current) {
      void loadGroupDataRef.current();
    }
  };

  const forceGroupRefresh = () => {
    notifyGroupRefresh();
    router.refresh();

    // Some changes can take a moment to show up in the next read. A short
    // retry sequence makes the page settle into the final state without
    // asking the user to refresh manually.
    window.setTimeout(() => {
      if (loadGroupDataRef.current) {
        void loadGroupDataRef.current();
      }
    }, 250);

    window.setTimeout(() => {
      if (loadGroupDataRef.current) {
        void loadGroupDataRef.current();
      }
    }, 900);
  };

  useEffect(() => {
    if (!id) return;

    // Ignore late async responses after unmount or route changes so they do
    // not overwrite newer state from the next page load.
    let isMounted = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const loadGroupData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const user = session.user;

      if (!isMounted) return;
      setCurrentUserId(user.id);

      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("name, description, event_date, owner_id, budget, currency, revealed, revealed_at")
        .eq("id", id)
        .maybeSingle();

      if (!isMounted) return;

      if (groupError) {
        setError("Error loading group.");
        setLoading(false);
        return;
      }

      if (!group) {
        setError("Group not found.");
        setLoading(false);
        return;
      }

      setGroupData(group);
      const isCurrentUserOwner = user.id === group.owner_id;
      setIsOwner(isCurrentUserOwner);

      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select("id, user_id, nickname, email, role, status")
        .eq("group_id", id);

      if (!isMounted) return;

      if (membersError) {
        setError("Error loading members.");
        setLoading(false);
        return;
      }

      const safeMembers = (membersData ?? []) as Member[];
      setMembers(safeMembers);

      // Keep the owner's readiness panel in sync with the main group data.
      // Chat stays aggregate-only here so the owner gets engagement signals
      // without learning anything about the anonymous pairings themselves.
      const [{ data: myAssignment }, insightsResult, revealResult] = await Promise.all([
        supabase
          .from("assignments")
          .select("receiver_id")
          .eq("group_id", id)
          .eq("giver_id", user.id)
          .maybeSingle(),
        isCurrentUserOwner ? getGroupOwnerInsights(id) : Promise.resolve(null),
        group.revealed ? getRevealMatches(id) : Promise.resolve(null),
      ]);

      if (!isMounted) return;

      if (insightsResult?.success && insightsResult.insights) {
        setOwnerInsights(insightsResult.insights);
      } else {
        setOwnerInsights(null);
      }

      if (revealResult?.success && revealResult.matches) {
        setRevealMatches(revealResult.matches);
      } else {
        setRevealMatches([]);
      }

      if (myAssignment) {
        setDrawDone(true);
        const receiver = safeMembers.find((member) => member.user_id === myAssignment.receiver_id);
        setAssignment({
          receiver_nickname: receiver?.nickname || "Secret Participant",
        });
      } else {
        setDrawDone(false);
        setAssignment(null);
      }

      setLoading(false);
    };

    loadGroupDataRef.current = loadGroupData;

    loadGroupData();

    const scheduleReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        void loadGroupData();
      }, 120);
    };

    const handleStorageRefresh = (event: StorageEvent) => {
      if (event.key === `group-refresh:${id}`) {
        scheduleReload();
      }
    };

    const matchesGroupChange = (
      payload: {
        new: Record<string, string | null | undefined>;
        old: Record<string, string | null | undefined>;
      },
      key: "group_id" | "id" = "group_id"
    ) => {
      const nextValue = payload.new?.[key];
      const previousValue = payload.old?.[key];

      // Delete events can be sparse depending on the table settings. When we
      // cannot tell which row changed, prefer a safe reload over stale owner
      // insights that would make the page feel broken.
      if (!nextValue && !previousValue) {
        return true;
      }

      return nextValue === id || previousValue === id;
    };

    // Refresh the page state whenever members, the group record, or
    // assignments change so the owner does not have to manually reload.
    const channel = supabase
      .channel(`group-${id}-realtime`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        (payload) => {
          if (matchesGroupChange(payload)) {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        (payload) => {
          if (matchesGroupChange(payload, "id")) {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        (payload) => {
          if (matchesGroupChange(payload)) {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlists" },
        (payload) => {
          if (matchesGroupChange(payload)) {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (matchesGroupChange(payload)) {
            scheduleReload();
          }
        }
      )
      .subscribe();

    window.addEventListener("storage", handleStorageRefresh);

    return () => {
      isMounted = false;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      window.removeEventListener("storage", handleStorageRefresh);
      supabase.removeChannel(channel);
    };
  }, [id, router, supabase]);

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch(`/group/${id}/reveal`);
  }, [router, id]);

  const openEditModal = () => {
    if (!groupData) return;

    setEditName(groupData.name);
    setEditDesc(groupData.description || "");
    setEditDate(groupData.event_date);
    setEditBudget(groupData.budget || 25);
    setEditCurrency(groupData.currency || "USD");
    setEditCustom(!BUDGET_OPTIONS.includes(groupData.budget || 25));
    setEditMsg("");
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    setEditMsg("");

    const result = await editGroup(id, editName, editDesc, editDate, editBudget, editCurrency);

    setEditMsg(result.message);
    setEditSaving(false);

    if (result.success) {
      notifyGroupRefresh();
      setTimeout(() => setShowEditModal(false), 800);
    }
  };

  const handleDelete = async () => {
    setDeleteSaving(true);
    setDeleteMsg("");

    const result = await deleteGroup(id, deleteConfirm);

    setDeleteMsg(result.message);
    setDeleteSaving(false);

    if (result.success) {
      router.push("/dashboard");
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember?.user_id) return;

    const memberToRemove = removingMember;
    const memberUserId = memberToRemove.user_id!;

    setActionSaving(true);
    setActionMsg("");
    setMembers((currentMembers) =>
      currentMembers.filter(
        (member) => member.id !== memberToRemove.id && member.user_id !== memberUserId
      )
    );

    const result = await removeMember(id, memberUserId);

    setActionMsg(result.message);
    setActionSaving(false);

    if (result.success) {
      forceGroupRefresh();
      setTimeout(() => setRemovingMember(null), 800);
      return;
    }

    if (loadGroupDataRef.current) {
      void loadGroupDataRef.current();
    }
  };

  const handleLeave = async () => {
    setActionSaving(true);
    setActionMsg("");

    const result = await leaveGroup(id);

    setActionMsg(result.message);
    setActionSaving(false);

    if (result.success) {
      router.push("/dashboard");
    }
  };

  const handleDraw = async () => {
    if (
      !confirm(
        "Are you sure? This will assign everyone a recipient. If you reset later, the current assignments and anonymous chat history for this group will be deleted."
      )
    ) {
      return;
    }

    setDrawLoading(true);
    setDrawMessage("");

    try {
      const result = await drawSecretSanta(id);
      setDrawMessage(result.message);
      if (result.success) {
        notifyGroupRefresh();
      }
    } finally {
      setDrawLoading(false);
    }
  };

  const handleResetDraw = async () => {
    if (
      !confirm(
        "Reset this draw? This will permanently delete the current assignments, anonymous chat messages, read markers, and gift received confirmations for this group. You can draw again afterwards."
      )
    ) {
      return;
    }

    setResetLoading(true);
    setDrawMessage("");

    try {
      const result = await resetSecretSantaDraw(id);
      setDrawMessage(result.message);
      if (result.success) {
        setRevealMatches([]);
        setRevealMessage("");
        setGroupData((currentGroupData) =>
          currentGroupData
            ? {
                ...currentGroupData,
                revealed: false,
                revealed_at: null,
              }
            : currentGroupData
        );
        notifyGroupRefresh();
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleTriggerReveal = async () => {
    if (
      !confirm(
        "Reveal the Secret Santa matches for everyone in this group? Once revealed, all accepted members will be able to see the full pairings."
      )
    ) {
      return;
    }

    setRevealLoading(true);
    setRevealMessage("");

    try {
      const result = await triggerReveal(id);
      setRevealMessage(result.message);

      if (result.success) {
        setRevealMatches(result.matches || []);
        setGroupData((currentGroupData) =>
          currentGroupData
            ? {
                ...currentGroupData,
                revealed: true,
                revealed_at: new Date().toISOString(),
              }
            : currentGroupData
        );
        notifyGroupRefresh();
      }
    } finally {
      setRevealLoading(false);
    }
  };

  const formatRevealTime = (value: string | null) => {
    if (!value) {
      return "just now";
    }

    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) return <GroupSkeleton />;

  if (error || !groupData) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(180deg,#eef4fb,#dce8f5)" }}
      >
        <p className="text-lg font-semibold text-red-600">{error || "Group not found"}</p>
      </main>
    );
  }

  const acceptedMembers = members.filter((member) => member.status === "accepted");
  const pendingMembers = members.filter((member) => member.status === "pending");
  const declinedMembers = members.filter((member) => member.status === "declined");

  const allAccepted =
    pendingMembers.length === 0 && declinedMembers.length === 0 && acceptedMembers.length >= 3;

  const currencySymbol =
    CURRENCIES.find((item) => item.code === (groupData.currency || "USD"))?.symbol || "$";
  const drawStatusLabel = groupData.revealed ? "Revealed" : drawDone ? "Drawn" : "Not Yet";
  const missingWishlistPreview = ownerInsights?.missingWishlistMemberNames.slice(0, 4) || [];
  const extraMissingWishlistCount = Math.max(
    (ownerInsights?.missingWishlistMemberNames.length || 0) - missingWishlistPreview.length,
    0
  );

  return (
    <main
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background: "linear-gradient(180deg,#eef4fb 0%,#dce8f5 35%,#d0e0f0 65%,#e8dce0 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka:wght@500;600;700&display=swap');
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)}>
          <h3
            className="text-[20px] font-bold mb-4 flex items-center gap-2"
            style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}
          >
            ✏️ Edit Group
          </h3>

          <div className="space-y-3">
            <div>
              <label
                className="text-[12px] font-extrabold block mb-1"
                style={{ color: "#374151" }}
              >
                Group Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
                style={{ border: "2px solid #e5e7eb", fontFamily: "inherit" }}
              />
            </div>

            <div>
              <label
                className="text-[12px] font-extrabold block mb-1"
                style={{ color: "#374151" }}
              >
                Description
              </label>
              <input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={300}
                className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
                style={{ border: "2px solid #e5e7eb", fontFamily: "inherit" }}
              />
            </div>

            <div>
              <label
                className="text-[12px] font-extrabold block mb-1"
                style={{ color: "#374151" }}
              >
                Event Date
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
                style={{ border: "2px solid #e5e7eb", fontFamily: "inherit" }}
              />
            </div>

            <div>
              <label
                className="text-[12px] font-extrabold block mb-1"
                style={{ color: "#374151" }}
              >
                Budget
              </label>

              <div className="flex gap-1.5 flex-wrap">
                {BUDGET_OPTIONS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      setEditBudget(amount);
                      setEditCustom(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-bold"
                    style={{
                      border: `2px solid ${
                        !editCustom && editBudget === amount ? "#c0392b" : "#e5e7eb"
                      }`,
                      background: !editCustom && editBudget === amount ? "#fef2f2" : "#fff",
                      color: !editCustom && editBudget === amount ? "#c0392b" : "#6b7280",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {currencySymbol}
                    {amount}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setEditCustom(true)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold"
                  style={{
                    border: `2px solid ${editCustom ? "#c0392b" : "#e5e7eb"}`,
                    background: editCustom ? "#fef2f2" : "#fff",
                    color: editCustom ? "#c0392b" : "#6b7280",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    borderStyle: "dashed",
                  }}
                >
                  Custom
                </button>
              </div>

              {editCustom && (
                <input
                  type="number"
                  value={editBudget}
                  onChange={(e) => setEditBudget(parseInt(e.target.value, 10) || 0)}
                  className="mt-2 w-28 px-3 py-2 rounded-lg text-[13px] outline-none"
                  style={{ border: "2px solid #c0392b", fontFamily: "inherit" }}
                />
              )}
            </div>

            {editMsg && (
              <p
                className={`text-[12px] font-bold ${
                  editMsg.includes("updated") ? "text-green-600" : "text-red-600"
                }`}
              >
                {editMsg}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-bold"
                style={{
                  background: "#f3f4f6",
                  color: "#6b7280",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="px-5 py-2 rounded-lg text-[13px] font-extrabold text-white"
                style={{
                  background: editSaving
                    ? "#9ca3af"
                    : "linear-gradient(135deg,#c0392b,#e74c3c)",
                  border: "none",
                  cursor: editSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal onClose={() => setShowDeleteModal(false)}>
          <div className="text-center">
            <div className="text-[48px] mb-2">⚠️</div>
            <h3
              className="text-[20px] font-bold mb-2"
              style={{ fontFamily: "'Fredoka', sans-serif", color: "#dc2626" }}
            >
              Delete this group?
            </h3>

            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: "#6b7280" }}>
              This will permanently delete{" "}
              <strong style={{ color: "#1f2937" }}>&quot;{groupData.name}&quot;</strong>, all
              assignments, wishlists, and messages. This cannot be undone.
            </p>

            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={`Type "${groupData.name}" to confirm`}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] text-center outline-none mb-3"
              style={{ border: "2px solid #e5e7eb", fontFamily: "inherit" }}
            />

            {deleteMsg && <p className="text-[12px] font-bold text-red-600 mb-2">{deleteMsg}</p>}

            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-bold"
                style={{
                  background: "#f3f4f6",
                  color: "#6b7280",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                disabled={deleteSaving}
                className="px-5 py-2 rounded-lg text-[13px] font-extrabold"
                style={{
                  background: "rgba(220,38,38,.06)",
                  color: "#dc2626",
                  border: "1px solid rgba(220,38,38,.15)",
                  cursor: deleteSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {deleteSaving ? "Deleting..." : "🗑️ Delete Forever"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showLeaveModal && (
        <Modal onClose={() => setShowLeaveModal(false)}>
          <div className="text-center">
            <div className="text-[48px] mb-2">🚪</div>
            <h3
              className="text-[20px] font-bold mb-2"
              style={{ fontFamily: "'Fredoka', sans-serif", color: "#f59e0b" }}
            >
              Leave this group?
            </h3>

            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: "#6b7280" }}>
              You&apos;ll be removed from{" "}
              <strong style={{ color: "#1f2937" }}>&quot;{groupData.name}&quot;</strong>.
              You&apos;ll lose access to assignments, wishlists, and chat. You can be
              re-invited later.
            </p>

            {actionMsg && <p className="text-[12px] font-bold text-red-600 mb-2">{actionMsg}</p>}

            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-bold"
                style={{
                  background: "#f3f4f6",
                  color: "#6b7280",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Stay
              </button>

              <button
                onClick={handleLeave}
                disabled={actionSaving}
                className="px-5 py-2 rounded-lg text-[13px] font-extrabold text-white"
                style={{
                  background: actionSaving
                    ? "#9ca3af"
                    : "linear-gradient(135deg,#b45309,#f59e0b)",
                  border: "none",
                  cursor: actionSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {actionSaving ? "Leaving..." : "🚪 Leave Group"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {removingMember && (
        <Modal onClose={() => setRemovingMember(null)}>
          <div className="text-center">
            <div className="text-[48px] mb-2">👋</div>
            <h3
              className="text-[20px] font-bold mb-2"
              style={{ fontFamily: "'Fredoka', sans-serif", color: "#dc2626" }}
            >
              Remove {removingMember.nickname}?
            </h3>

            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: "#6b7280" }}>
              <strong style={{ color: "#1f2937" }}>{removingMember.nickname}</strong> will be
              removed from the group. If names have already been drawn, the draw will need
              to be redone.
            </p>

            {actionMsg && (
              <p
                className="text-[12px] font-bold mb-2"
                style={{ color: actionMsg.includes("removed") ? "#16a34a" : "#dc2626" }}
              >
                {actionMsg}
              </p>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setRemovingMember(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-bold"
                style={{
                  background: "#f3f4f6",
                  color: "#6b7280",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleRemoveMember}
                disabled={actionSaving}
                className="px-5 py-2 rounded-lg text-[13px] font-extrabold"
                style={{
                  background: "rgba(220,38,38,.06)",
                  color: "#dc2626",
                  border: "1px solid rgba(220,38,38,.15)",
                  cursor: actionSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {actionSaving ? "Removing..." : "✕ Remove Member"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <FadeIn className="relative z-10 max-w-[760px] mx-auto px-4 py-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-5 px-4 py-2 rounded-lg transition"
          style={{
            color: "#4a6fa5",
            background: "rgba(255,255,255,.72)",
            border: "1px solid rgba(74,111,165,.15)",
            fontFamily: "inherit",
          }}
        >
          ← Back to Dashboard
        </button>

        <div
          className="rounded-[24px] overflow-hidden"
          style={{
            background: "linear-gradient(170deg,#fdfbf7,#f8f1e8)",
            border: "2px solid rgba(26,107,42,.14)",
            boxShadow: "0 18px 50px rgba(0,0,0,.08)",
          }}
        >
          <div
            className="px-6 py-5"
            style={{
              background: "linear-gradient(135deg,#14532d,#166534)",
              color: "#fff",
            }}
          >
            <div
              className="text-[28px] font-bold"
              style={{ fontFamily: "'Fredoka', sans-serif" }}
            >
              🎁 {groupData.name}
            </div>

            <div className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,.8)" }}>
              Manage members, draw names, and monitor the group from here.
            </div>
          </div>

          <div className="p-6">
            {groupData.description && (
              <div
                className="rounded-xl overflow-hidden mb-4"
                style={{
                  background: "rgba(127,29,29,.04)",
                  border: "1px solid rgba(127,29,29,.08)",
                }}
              >
                <div
                  className="flex items-center gap-1.5 px-3.5 py-2"
                  style={{
                    background: "rgba(127,29,29,.04)",
                    borderBottom: "1px solid rgba(127,29,29,.06)",
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#991b1b",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                  }}
                >
                  📋 Rules & Description
                </div>

                <div
                  className="px-3.5 py-2.5"
                  style={{ fontSize: "13px", color: "#4b5563", lineHeight: 1.6 }}
                >
                  {groupData.description}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { icon: "📅", value: groupData.event_date, label: "Event Date" },
                {
                  icon: "💰",
                  value: groupData.budget ? `${currencySymbol}${groupData.budget}` : "No limit",
                  label: "Budget",
                },
                { icon: "👥", value: `${members.length}`, label: "Members" },
                  { icon: "🎲", value: drawStatusLabel, label: "Draw Status" },
              ].map((item, index) => (
                <div
                  key={index}
                  className="rounded-[16px] px-4 py-4"
                  style={{
                    background: "rgba(255,255,255,.78)",
                    border: "1px solid rgba(255,255,255,.92)",
                  }}
                >
                  <div className="text-[18px] mb-1">{item.icon}</div>
                  <div className="text-[16px] font-bold text-gray-800">{item.value}</div>
                  <div className="text-[11px] font-semibold text-gray-500">{item.label}</div>
                </div>
              ))}
            </div>

            {isOwner && (
              <div className="flex gap-2 justify-center mb-5 flex-wrap">
                <button
                  onClick={openEditModal}
                  className="px-4 py-2 rounded-lg text-[11px] font-bold transition"
                  style={{
                    background: "rgba(59,130,246,.08)",
                    color: "#3b82f6",
                    border: "1px solid rgba(59,130,246,.15)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ✏️ Edit Group
                </button>

                <button
                  onClick={() => {
                    setDeleteConfirm("");
                    setDeleteMsg("");
                    setShowDeleteModal(true);
                  }}
                  className="px-4 py-2 rounded-lg text-[11px] font-bold transition"
                  style={{
                    background: "rgba(220,38,38,.06)",
                    color: "#ef4444",
                    border: "1px solid rgba(220,38,38,.12)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  🗑️ Delete Group
                </button>
              </div>
            )}

            {!isOwner && (
              <div className="flex flex-col items-center gap-2 mb-5">
                <button
                  onClick={() => {
                    setActionMsg("");
                    setShowLeaveModal(true);
                  }}
                  disabled={drawDone}
                  className="px-4 py-2 rounded-lg text-[11px] font-bold transition"
                  style={{
                    background: "rgba(245,158,11,.08)",
                    color: drawDone ? "#9ca3af" : "#f59e0b",
                    border: "1px solid rgba(245,158,11,.12)",
                    cursor: drawDone ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: drawDone ? 0.7 : 1,
                  }}
                >
                  {drawDone ? "Draw Locked" : "🚪 Leave Group"}
                </button>

                {drawDone && (
                  <p className="text-center text-[11px]" style={{ color: "#6b7280" }}>
                    Participant changes are locked after draw. Ask the owner to reset first.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { n: acceptedMembers.length, l: "Accepted", c: "#15803d", b: "#22c55e" },
                { n: pendingMembers.length, l: "Pending", c: "#b45309", b: "#f59e0b" },
                { n: declinedMembers.length, l: "Declined", c: "#dc2626", b: "#dc2626" },
                { n: members.length, l: "Total", c: "#1d4ed8", b: "#2563eb" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="rounded-[16px] py-4 px-3 text-center relative overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,.78)",
                    border: "1px solid rgba(255,255,255,.92)",
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ background: s.b }}
                  />
                  <div
                    className="text-2xl font-bold leading-none"
                    style={{ fontFamily: "'Fredoka', sans-serif", color: s.c }}
                  >
                    {s.n}
                  </div>
                  <div className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wide">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>

            {isOwner && ownerInsights && (
              <div
                className="rounded-[18px] p-5 mb-5"
                style={{
                  background: "rgba(255,255,255,.76)",
                  border: "1px solid rgba(255,255,255,.92)",
                  boxShadow: "0 10px 24px rgba(15,23,42,.05)",
                }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <div
                      className="text-[18px] font-bold"
                      style={{ fontFamily: "'Fredoka', sans-serif", color: "#14532d" }}
                    >
                      🔎 Owner Insights
                    </div>
                    <div className="text-[12px] font-semibold mt-1" style={{ color: "#64748b" }}>
                      Quick readiness signals for this group. Anonymous chat stays aggregate-only
                      here so the secret part stays secret.
                    </div>
                  </div>

                  <div
                    className="px-3 py-1.5 rounded-full text-[11px] font-extrabold"
                    style={{
                      background: drawDone ? "rgba(30,64,175,.08)" : "rgba(21,128,61,.08)",
                      color: drawDone ? "#1d4ed8" : "#15803d",
                    }}
                  >
                    {drawDone ? "Post-draw snapshot" : "Pre-draw readiness"}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: "rgba(21,128,61,.05)",
                      border: "1px solid rgba(21,128,61,.1)",
                    }}
                  >
                    <div
                      className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                      style={{ color: "#15803d" }}
                    >
                      Wishlist Coverage
                    </div>
                    <div
                      className="text-[26px] font-bold mt-2"
                      style={{ color: "#14532d", fontFamily: "'Fredoka', sans-serif" }}
                    >
                      {ownerInsights.wishlistReadyCount}/{ownerInsights.acceptedCount}
                    </div>
                    <div
                      className="text-[12px] font-semibold mt-1"
                      style={{ color: "#64748b", lineHeight: 1.45 }}
                    >
                      {ownerInsights.missingWishlistMemberNames.length === 0
                        ? "Every accepted member has at least one wishlist item."
                        : `${ownerInsights.missingWishlistMemberNames.length} accepted member${
                            ownerInsights.missingWishlistMemberNames.length === 1 ? "" : "s"
                          } still need a wishlist.`}
                    </div>
                  </div>

                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: "rgba(37,99,235,.05)",
                      border: "1px solid rgba(37,99,235,.1)",
                    }}
                  >
                    <div
                      className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                      style={{ color: "#2563eb" }}
                    >
                      Anonymous Chat
                    </div>
                    <div
                      className="text-[26px] font-bold mt-2"
                      style={{ color: "#1d4ed8", fontFamily: "'Fredoka', sans-serif" }}
                    >
                      {ownerInsights.totalChatThreadCount > 0
                        ? `${ownerInsights.activeChatThreadCount}/${ownerInsights.totalChatThreadCount}`
                        : "After draw"}
                    </div>
                    <div
                      className="text-[12px] font-semibold mt-1"
                      style={{ color: "#64748b", lineHeight: 1.45 }}
                    >
                      {ownerInsights.totalChatThreadCount > 0
                        ? `${ownerInsights.activeChatThreadCount} thread${
                            ownerInsights.activeChatThreadCount === 1 ? "" : "s"
                          } have at least one message.`
                        : "Threads open once names are drawn, but identities stay hidden from you."}
                    </div>
                  </div>

                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: "rgba(184,131,29,.06)",
                      border: "1px solid rgba(184,131,29,.12)",
                    }}
                  >
                    <div
                      className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                      style={{ color: "#b45309" }}
                    >
                      Gift Confirmations
                    </div>
                    <div
                      className="text-[26px] font-bold mt-2"
                      style={{ color: "#92400e", fontFamily: "'Fredoka', sans-serif" }}
                    >
                      {ownerInsights.totalGiftCount > 0
                        ? `${ownerInsights.confirmedGiftCount}/${ownerInsights.totalGiftCount}`
                        : "After draw"}
                    </div>
                    <div
                      className="text-[12px] font-semibold mt-1"
                      style={{ color: "#64748b", lineHeight: 1.45 }}
                    >
                      {ownerInsights.totalGiftCount > 0
                        ? `${Math.max(
                            ownerInsights.totalGiftCount - ownerInsights.confirmedGiftCount,
                            0
                          )} gift confirmation${
                            ownerInsights.totalGiftCount - ownerInsights.confirmedGiftCount === 1
                              ? ""
                              : "s"
                          } still pending.`
                        : "Recipients can confirm once gifts start getting handed out."}
                    </div>
                  </div>
                </div>

                {ownerInsights.missingWishlistMemberNames.length > 0 && (
                  <div className="mt-4">
                    <div
                      className="text-[11px] font-extrabold uppercase tracking-[0.12em] mb-2"
                      style={{ color: "#b45309" }}
                    >
                      Still missing a wishlist
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {missingWishlistPreview.map((memberName) => (
                        <span
                          key={memberName}
                          className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                          style={{
                            background: "rgba(251,191,36,.14)",
                            color: "#92400e",
                            border: "1px solid rgba(251,191,36,.24)",
                          }}
                        >
                          {memberName}
                        </span>
                      ))}

                      {extraMissingWishlistCount > 0 && (
                        <span
                          className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                          style={{
                            background: "rgba(148,163,184,.12)",
                            color: "#475569",
                            border: "1px solid rgba(148,163,184,.2)",
                          }}
                        >
                          +{extraMissingWishlistCount} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div
              className="text-center my-5 py-5 rounded-2xl"
              style={{ background: "rgba(127,29,29,.03)", border: "1px solid rgba(127,29,29,.08)" }}
            >
              {drawDone && assignment ? (
                <div>
                  <div
                    className="text-lg font-bold mb-2"
                    style={{ fontFamily: "'Fredoka', sans-serif", color: "#1d4ed8" }}
                  >
                    🎲 Names Have Been Drawn!
                  </div>

                  <div
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg mb-4"
                    style={{
                      background: groupData.revealed ? "#dcfce7" : "#dbeafe",
                      color: groupData.revealed ? "#15803d" : "#1d4ed8",
                    }}
                  >
                    {groupData.revealed
                      ? "Reveal live - pairings are public"
                      : "🎲 Draw complete - assignments are active"}
                  </div>

                  <div
                    className="rounded-2xl p-6 mx-4 text-white"
                    style={{
                      background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                      boxShadow: "0 4px 20px rgba(251,191,36,.3)",
                    }}
                  >
                    <div className="text-sm opacity-85 mb-1">🎁 You are giving a gift to:</div>
                    <div
                      className="text-3xl font-bold"
                      style={{
                        fontFamily: "'Fredoka', sans-serif",
                        textShadow: "0 2px 4px rgba(0,0,0,.15)",
                      }}
                    >
                      🎄 {assignment.receiver_nickname} 🎄
                    </div>
                    <div className="text-xs opacity-75 mt-2">
                      {groupData.revealed
                        ? "The reveal is live now, so the full group pairings are listed below."
                        : "This is secret - only you can see this!"}
                    </div>
                  </div>

                  {isOwner && (
                    <div className="mt-4 px-4">
                      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                        Need to change participants or redraw? Resetting will permanently
                        delete the current assignments, anonymous chat messages, read
                        markers, and any gift confirmations for this group.
                      </p>

                      <button
                        onClick={handleResetDraw}
                        disabled={resetLoading || drawLoading}
                        className="px-6 py-2.5 rounded-xl text-sm font-extrabold text-white transition"
                        style={{
                          background:
                            resetLoading || drawLoading
                              ? "#9ca3af"
                              : "linear-gradient(135deg,#dc2626,#ef4444)",
                          boxShadow:
                            resetLoading || drawLoading
                              ? "none"
                              : "0 4px 16px rgba(220,38,38,.25)",
                          cursor: resetLoading || drawLoading ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                          border: "none",
                        }}
                      >
                        {resetLoading ? "↺ Resetting..." : "↺ Reset Draw"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div
                    className="text-lg font-bold mb-2"
                    style={{ fontFamily: "'Fredoka', sans-serif", color: "#7f1d1d" }}
                  >
                    🎲 Secret Santa Draw
                  </div>

                  {allAccepted ? (
                    <div
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg mb-3"
                      style={{ background: "#dcfce7", color: "#15803d" }}
                    >
                      ✅ All {acceptedMembers.length} members accepted - Ready to draw!
                    </div>
                  ) : (
                    <div
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg mb-3"
                      style={{ background: "#fef3c7", color: "#92400e" }}
                    >
                      ⏳ Waiting for all members to accept...
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 justify-center my-4 px-4">
                    {acceptedMembers.map((member, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{
                          background: "rgba(255,255,255,.7)",
                          border: "1px solid rgba(255,255,255,.9)",
                          color: "#1f2937",
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-extrabold text-white"
                          style={{ background: "linear-gradient(135deg,#4ade80,#22c55e)" }}
                        >
                          {(member.nickname || "P")[0].toUpperCase()}
                        </div>
                        {member.nickname || `Member ${index + 1}`}
                      </div>
                    ))}
                  </div>

                  {isOwner ? (
                    <div>
                      <p className="text-xs text-gray-500 mb-3 px-8 leading-relaxed">
                        This will randomly assign each member someone to give a gift to. If
                        you later reset the draw, the current assignments and anonymous chat
                        history for this group will be deleted.
                      </p>

                      <button
                        onClick={handleDraw}
                        disabled={!allAccepted || drawLoading || resetLoading}
                        className="relative overflow-hidden px-8 py-3 rounded-xl text-base font-extrabold text-white transition"
                        style={{
                          background:
                            allAccepted && !drawLoading && !resetLoading
                              ? "linear-gradient(135deg,#7f1d1d,#991b1b)"
                              : "#9ca3af",
                          boxShadow:
                            allAccepted && !drawLoading && !resetLoading
                              ? "0 4px 20px rgba(127,29,29,.3)"
                              : "none",
                          cursor:
                            allAccepted && !drawLoading && !resetLoading
                              ? "pointer"
                              : "not-allowed",
                          fontFamily: "inherit",
                        }}
                      >
                        {drawLoading ? "🎰 Drawing..." : "🎲 Draw Names"}
                        {allAccepted && !drawLoading && !resetLoading && (
                          <span
                            className="absolute inset-0"
                            style={{
                              background:
                                "linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)",
                              animation: "shimmer 2s infinite",
                            }}
                          />
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-2">
                      Waiting for the group owner to draw names...
                    </p>
                  )}
                </div>
              )}

              {drawMessage && (
                <p
                  className={`text-sm font-bold mt-4 ${
                    drawMessage.startsWith("✅") ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {drawMessage}
                </p>
              )}
            </div>

            {drawDone && (
              <div
                className="rounded-[18px] p-5 mb-5"
                style={{
                  background: groupData.revealed
                    ? "linear-gradient(180deg,rgba(240,253,244,.95),rgba(236,252,203,.88))"
                    : "rgba(255,255,255,.8)",
                  border: groupData.revealed
                    ? "1px solid rgba(34,197,94,.18)"
                    : "1px solid rgba(226,232,240,.9)",
                  boxShadow: groupData.revealed
                    ? "0 12px 28px rgba(34,197,94,.08)"
                    : "0 10px 24px rgba(15,23,42,.05)",
                }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <div
                      className="text-[18px] font-bold"
                      style={{
                        fontFamily: "'Fredoka', sans-serif",
                        color: groupData.revealed ? "#166534" : "#7c2d12",
                      }}
                    >
                      {groupData.revealed ? "🎉 Reveal Board" : "🎁 Event-Day Reveal"}
                    </div>
                    <div className="text-[12px] font-semibold mt-1" style={{ color: "#64748b" }}>
                      {groupData.revealed
                        ? `Revealed ${formatRevealTime(groupData.revealed_at)}. Everyone in the group can now see the full Secret Santa pairings.`
                        : isOwner
                          ? "When you're ready at the party, reveal the full Secret Santa pairings for everyone."
                          : "The owner will reveal the full Secret Santa pairings here when it's time."}
                    </div>
                  </div>

                  <div
                    className="px-3 py-1.5 rounded-full text-[11px] font-extrabold"
                    style={{
                      background: groupData.revealed
                        ? "rgba(34,197,94,.12)"
                        : "rgba(251,191,36,.16)",
                      color: groupData.revealed ? "#166534" : "#92400e",
                    }}
                  >
                    {groupData.revealed ? "Reveal live" : "Waiting for owner"}
                  </div>
                </div>

                {!groupData.revealed ? (
                  isOwner ? (
                    <div
                      className="rounded-2xl p-4"
                      style={{
                        background: "rgba(255,247,237,.95)",
                        border: "1px solid rgba(249,115,22,.14)",
                      }}
                    >
                      <div className="text-[13px] font-bold mb-2" style={{ color: "#9a3412" }}>
                        The reveal stays hidden until you trigger it
                      </div>
                      <p
                        className="text-[12px] font-semibold leading-relaxed"
                        style={{ color: "#7c2d12" }}
                      >
                        Use the codename reveal screen on the venue display first. Guests can also
                        open that same screen on their phones and it will stay in sync once you
                        start the live reveal. Publish the final pairings only when you are ready.
                      </p>

                      <div className="mt-4 flex items-center gap-3 flex-wrap">
                        <button
                          onClick={handleTriggerReveal}
                          disabled={revealLoading || drawLoading || resetLoading}
                          className="px-6 py-2.5 rounded-xl text-sm font-extrabold text-white transition"
                          style={{
                            background:
                              revealLoading || drawLoading || resetLoading
                                ? "#9ca3af"
                                : "linear-gradient(135deg,#15803d,#22c55e)",
                            boxShadow:
                              revealLoading || drawLoading || resetLoading
                                ? "none"
                                : "0 4px 16px rgba(34,197,94,.22)",
                            cursor:
                              revealLoading || drawLoading || resetLoading
                                ? "not-allowed"
                                : "pointer",
                            border: "none",
                            fontFamily: "inherit",
                          }}
                        >
                          {revealLoading ? "🎉 Revealing..." : "🎉 Reveal Matches"}
                        </button>

                        <span className="text-[11px] font-semibold" style={{ color: "#64748b" }}>
                          Everyone will be able to see the final pairings after this.
                        </span>

                        <button
                          type="button"
                          onClick={() => router.push(`/group/${id}/reveal`)}
                          className="px-5 py-2.5 rounded-xl text-sm font-extrabold"
                          style={{
                            background: "rgba(15,23,42,.05)",
                            color: "#14532d",
                            border: "1px solid rgba(21,128,61,.16)",
                            fontFamily: "inherit",
                          }}
                        >
                          Open Live Codename Screen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-2xl p-4"
                      style={{
                        background: "rgba(239,246,255,.95)",
                        border: "1px solid rgba(59,130,246,.14)",
                      }}
                    >
                      <div className="text-[13px] font-bold mb-2" style={{ color: "#1d4ed8" }}>
                        Waiting for the reveal
                      </div>
                      <p
                        className="text-[12px] font-semibold leading-relaxed"
                        style={{ color: "#475569" }}
                      >
                        Your own assignment stays secret until the owner starts the event-day
                        reveal. You can open the codename reveal screen now and keep it ready on
                        your phone while the owner starts the live reveal from the venue.
                      </p>

                      <button
                        type="button"
                        onClick={() => router.push(`/group/${id}/reveal`)}
                        className="mt-4 px-5 py-2.5 rounded-xl text-sm font-extrabold"
                        style={{
                          background: "rgba(29,78,216,.08)",
                          color: "#1d4ed8",
                          border: "1px solid rgba(59,130,246,.16)",
                          fontFamily: "inherit",
                        }}
                      >
                        Join Live Codename Screen
                      </button>
                    </div>
                  )
                ) : revealMatches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {revealMatches.map((match, index) => (
                      <div
                        key={`${match.giver}-${match.receiver}-${index}`}
                        className="rounded-2xl p-4"
                        style={{
                          background: "rgba(255,255,255,.8)",
                          border: "1px solid rgba(34,197,94,.12)",
                        }}
                      >
                        <div
                          className="text-[10px] font-extrabold uppercase tracking-[0.14em] mb-2"
                          style={{ color: "#15803d" }}
                        >
                          Match {index + 1}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-extrabold" style={{ color: "#64748b" }}>
                              Giver
                            </div>
                            <div
                              className="text-[18px] font-bold"
                              style={{ fontFamily: "'Fredoka', sans-serif", color: "#14532d" }}
                            >
                              {match.giver}
                            </div>
                          </div>

                          <div className="text-[18px] font-black" style={{ color: "#f59e0b" }}>
                            →
                          </div>

                          <div className="text-right">
                            <div className="text-[11px] font-extrabold" style={{ color: "#64748b" }}>
                              Receiver
                            </div>
                            <div
                              className="text-[18px] font-bold"
                              style={{ fontFamily: "'Fredoka', sans-serif", color: "#991b1b" }}
                            >
                              {match.receiver}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: "rgba(255,255,255,.8)",
                      border: "1px solid rgba(226,232,240,.9)",
                    }}
                  >
                    <p className="text-[12px] font-semibold" style={{ color: "#64748b" }}>
                      Reveal data is syncing. Give it a moment and this board will populate
                      automatically.
                    </p>
                  </div>
                )}

                {revealMessage && (
                  <p
                    className={`text-sm font-bold mt-4 ${
                      revealMessage.toLowerCase().includes("triggered") ||
                      revealMessage.toLowerCase().includes("loaded")
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {revealMessage}
                  </p>
                )}

                {groupData.revealed && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => router.push(`/group/${id}/reveal`)}
                      className="px-5 py-2.5 rounded-xl text-sm font-extrabold"
                      style={{
                        background: "rgba(15,23,42,.05)",
                        color: "#166534",
                        border: "1px solid rgba(34,197,94,.18)",
                        fontFamily: "inherit",
                      }}
                    >
                      Open Live Codename Screen
                    </button>
                  </div>
                )}
              </div>
            )}

            {isOwner && !drawDone && <InviteForm groupId={id} />}

            <div
              className="flex items-center gap-1.5 mb-2.5"
              style={{
                fontFamily: "'Fredoka', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                color: "#15803d",
              }}
            >
              🎄 Participants
            </div>

            {acceptedMembers.length === 0 ? (
              <p className="text-gray-500 text-center text-sm mb-4">No accepted members yet.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {acceptedMembers.map((member, index) => {
                  const isCurrentUser = currentUserId === member.user_id;

                  return (
                    <div
                      key={member.id}
                      className="rounded-xl p-3 transition hover:-translate-y-0.5"
                      style={{
                        background: "rgba(255,255,255,.6)",
                        border: "1px solid rgba(255,255,255,.85)",
                        borderLeft: `4px solid ${isCurrentUser ? "#f59e0b" : "#22c55e"}`,
                      }}
                    >
                      {isCurrentUser ? (
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                                style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                              >
                                {(member.nickname || "Y")[0].toUpperCase()}
                              </div>
                              <div className="text-sm font-bold text-gray-800">You</div>
                            </div>

                            <span
                              className="text-[10px] font-extrabold px-2.5 py-1 rounded-full text-white"
                              style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                            >
                              You ✓
                            </span>
                          </div>

                          {!drawDone && (
                            <NicknameForm groupId={id} currentNickname={member.nickname || ""} />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                              style={{ background: "linear-gradient(135deg,#4ade80,#22c55e)" }}
                            >
                              {(member.nickname || "P")[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-800">
                                {member.nickname || `Participant ${index + 1}`}
                              </div>
                              <div className="text-[11px] text-gray-500 font-semibold">
                                Joined
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isOwner && !drawDone && (
                              <button
                                onClick={() => {
                                  setActionMsg("");
                                  setRemovingMember(member);
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
                                style={{
                                  background: "rgba(220,38,38,.06)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(220,38,38,.12)",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                ✕ Remove
                              </button>
                            )}

                            <span
                              className="text-[10px] font-extrabold px-2.5 py-1 rounded-full"
                              style={{ background: "#dcfce7", color: "#15803d" }}
                            >
                              Accepted ✓
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {pendingMembers.length > 0 && (
              <>
                <div
                  className="flex items-center gap-1.5 mb-2.5"
                  style={{
                    fontFamily: "'Fredoka', sans-serif",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#92400e",
                  }}
                >
                  ⏳ Waiting for Response
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  {pendingMembers.map((member, index) => (
                    <div
                      key={member.id}
                      className="rounded-xl p-3 flex items-center justify-between"
                      style={{
                        background: "rgba(255,255,255,.6)",
                        border: "1px solid rgba(255,255,255,.85)",
                        borderLeft: "4px solid #fbbf24",
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                          style={{ background: "linear-gradient(135deg,#d1d5db,#9ca3af)" }}
                        >
                          ?
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-800">
                            {member.nickname || `Participant ${index + 1}`}
                          </div>
                          <div className="text-[11px] text-gray-500 font-semibold">
                            Hasn&apos;t responded yet
                          </div>
                        </div>
                      </div>

                        <div className="flex items-center gap-2">
                          {isOwner && !drawDone && (
                            <RevokeInviteButton
                              groupId={id}
                              membershipId={member.id}
                              onRevoked={() => {
                                setMembers((currentMembers) =>
                                  currentMembers.filter(
                                    (currentMember) => currentMember.id !== member.id
                                  )
                                );
                                notifyGroupRefresh();
                              }}
                            />
                          )}

                        <span
                          className="text-[10px] font-extrabold px-2.5 py-1 rounded-full"
                          style={{ background: "#fef3c7", color: "#92400e" }}
                        >
                          Pending
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {isOwner && !drawDone && declinedMembers.length > 0 && (
              <>
                <div
                  className="flex items-center gap-1.5 mb-2.5"
                  style={{
                    fontFamily: "'Fredoka', sans-serif",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#dc2626",
                  }}
                >
                  ❌ Declined
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  {declinedMembers.map((member, index) => (
                    <div
                      key={member.id}
                      className="rounded-xl p-3 flex items-center justify-between"
                      style={{
                        background: "rgba(255,255,255,.6)",
                        border: "1px solid rgba(255,255,255,.85)",
                        borderLeft: "4px solid #ef4444",
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                          style={{ background: "linear-gradient(135deg,#f87171,#ef4444)" }}
                        >
                          ✗
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-800">
                            {member.nickname || `Participant ${index + 1}`}
                          </div>
                          <div className="text-[11px] text-gray-500 font-semibold">
                            Declined the invitation
                          </div>
                        </div>
                      </div>

                        <div className="flex items-center gap-2">
                          <ResendButton groupId={id} memberEmail={member.email || ""} />
                          <RevokeInviteButton
                            groupId={id}
                            membershipId={member.id}
                            onRevoked={() => {
                              setMembers((currentMembers) =>
                                currentMembers.filter(
                                  (currentMember) => currentMember.id !== member.id
                                )
                              );
                              notifyGroupRefresh();
                            }}
                          />
                        </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!drawDone && pendingMembers.length > 0 && isOwner && (
              <div
                className="rounded-xl p-3.5 flex items-start gap-2 text-xs leading-relaxed"
                style={{
                  background: "rgba(59,130,246,.04)",
                  border: "1px solid rgba(59,130,246,.1)",
                  color: "#4a6fa5",
                }}
              >
                <span className="text-base">💡</span>
                <div>
                  <strong className="text-blue-700">Pending members</strong> need to log in
                  and accept from their dashboard.{" "}
                  <strong className="text-blue-700">Declined members</strong> can be
                  re-invited with the Resend button.
                </div>
              </div>
            )}
          </div>
        </div>
      </FadeIn>
    </main>
  );
}
