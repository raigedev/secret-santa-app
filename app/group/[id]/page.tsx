"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  addDrawExclusion,
  drawSecretSanta,
  getDrawExclusions,
  getDrawRerollHistory,
  removeDrawExclusion,
  resetSecretSantaDraw,
} from "./draw-action";
import {
  deleteGroup,
  editGroup,
  getGroupRecap,
  getRevealMatches,
  getGroupOwnerInsights,
  leaveGroup,
  removeMember,
  triggerReveal,
} from "./actions";
import { GroupSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";
import { GroupActionModals } from "./GroupActionModals";
import { GroupEventSummaryPanel } from "./GroupEventSummaryPanel";
import { GroupMembersSection } from "./GroupMembersSection";
import { GroupOwnerInsightsPanel } from "./GroupOwnerInsightsPanel";
import { BUDGET_OPTIONS, CURRENCIES, HISTORY_PAGE_SIZE } from "./group-page-config";
import { HistorySkeletonRows } from "./GroupPagePrimitives";
import {
  clearGroupPageSnapshots,
  getVisibleGroupMemberName,
  readGroupPageSnapshot,
  sanitizeMembersForGroupPageSnapshot,
  writeGroupPageSnapshot,
  type Assignment,
  type DrawCycleHistoryItem,
  type DrawExclusionRule,
  type DrawResetHistoryItem,
  type GroupData,
  type GroupPageSnapshot,
  type GroupRecap,
  type Member,
  type OwnerInsights,
  type RevealMatch,
} from "./group-page-state";
import { useGroupRoutePrefetch } from "./useGroupRoutePrefetch";

type ShareResultsCardProps = {
  codename: string;
  eventDate: string;
  groupName: string;
  recipientName: string;
};

const ShareResultsCard = dynamic<ShareResultsCardProps>(() => import("./ShareResultsCard"), {
  loading: () => null,
});

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
  const [groupDataFresh, setGroupDataFresh] = useState(false);

  const [drawLoading, setDrawLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [drawMessage, setDrawMessage] = useState("");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [drawDone, setDrawDone] = useState(false);
  const [drawExclusions, setDrawExclusions] = useState<DrawExclusionRule[]>([]);
  const [drawRulesReady, setDrawRulesReady] = useState(false);
  const [newExclusionGiver, setNewExclusionGiver] = useState("");
  const [newExclusionReceiver, setNewExclusionReceiver] = useState("");
  const [newExclusionBidirectional, setNewExclusionBidirectional] = useState(true);
  const [drawRuleMessage, setDrawRuleMessage] = useState("");
  const [drawRuleSaving, setDrawRuleSaving] = useState(false);
  const [avoidPreviousRecipient, setAvoidPreviousRecipient] = useState(true);
  const [resetReason, setResetReason] = useState("");
  const [drawCycleHistory, setDrawCycleHistory] = useState<DrawCycleHistoryItem[]>([]);
  const [drawResetHistory, setDrawResetHistory] = useState<DrawResetHistoryItem[]>([]);
  const [hasMoreDrawCycles, setHasMoreDrawCycles] = useState(false);
  const [hasMoreDrawResets, setHasMoreDrawResets] = useState(false);
  const [drawCycleHistoryLoadingMore, setDrawCycleHistoryLoadingMore] = useState(false);
  const [drawResetHistoryLoadingMore, setDrawResetHistoryLoadingMore] = useState(false);
  const [ownerInsights, setOwnerInsights] = useState<OwnerInsights | null>(null);
  const [revealMatches, setRevealMatches] = useState<RevealMatch[]>([]);
  const [groupRecap, setGroupRecap] = useState<GroupRecap | null>(null);
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
    clearGroupPageSnapshots(id);

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
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let loadVersion = 0;
    let hasAppliedSnapshot = false;

    const applyGroupPageSnapshot = (snapshot: GroupPageSnapshot) => {
      setCurrentUserId(snapshot.currentUserId);
      setGroupData(snapshot.groupData);
      setMembers(snapshot.members);
      setIsOwner(snapshot.isOwner);
      setAssignment(snapshot.assignment);
      setDrawDone(snapshot.drawDone);
      setDrawExclusions([]);
      setDrawRulesReady(!snapshot.isOwner);
      setGroupDataFresh(false);
      setOwnerInsights(null);
      setRevealMatches([]);
      setGroupRecap(null);
      setDrawCycleHistory([]);
      setDrawResetHistory([]);
      setHasMoreDrawCycles(false);
      setHasMoreDrawResets(false);
      setError(null);
      setLoading(false);
    };

    const loadGroupData = async () => {
      const currentLoadVersion = ++loadVersion;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        clearGroupPageSnapshots();
        router.push("/login");
        return;
      }

      const user = session.user;

      if (!isMounted) return;
      setCurrentUserId(user.id);

      if (!hasAppliedSnapshot) {
        hasAppliedSnapshot = true;
        const cachedGroupPage = readGroupPageSnapshot(id, user.id);

        if (cachedGroupPage) {
          applyGroupPageSnapshot(cachedGroupPage);
        }
      }

      const [groupResult, membersResult] = await Promise.all([
        supabase
          .from("groups")
          .select("name, description, event_date, owner_id, budget, currency, require_anonymous_nickname, revealed, revealed_at")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("group_members")
          .select("id, user_id, nickname, email, role, status")
          .eq("group_id", id),
      ]);

      if (!isMounted) return;

      if (groupResult.error) {
        setError("Error loading group.");
        setLoading(false);
        return;
      }

      if (!groupResult.data) {
        setError("Group not found.");
        setLoading(false);
        return;
      }

      if (membersResult.error) {
        setError("Error loading members.");
        setLoading(false);
        return;
      }

      const group = groupResult.data;
      setError(null);
      setGroupDataFresh(false);
      setOwnerInsights(null);
      setRevealMatches([]);
      setGroupRecap(null);
      setDrawCycleHistory([]);
      setDrawResetHistory([]);
      setHasMoreDrawCycles(false);
      setHasMoreDrawResets(false);
      setGroupData(group);
      const isCurrentUserOwner = user.id === group.owner_id;
      setIsOwner(isCurrentUserOwner);
      setDrawRulesReady(!isCurrentUserOwner);

      const safeMembers = (membersResult.data ?? []) as Member[];
      setMembers(safeMembers);

      const { data: myAssignment } = await supabase
        .from("assignments")
        .select("receiver_id")
        .eq("group_id", id)
        .eq("giver_id", user.id)
        .maybeSingle();

      if (!isMounted || currentLoadVersion !== loadVersion) return;

      if (myAssignment) {
        setDrawDone(true);
        const receiver = safeMembers.find((member) => member.user_id === myAssignment.receiver_id);
        setAssignment({
          receiver_nickname: receiver?.nickname || "Secret Member",
        });
      } else {
        setDrawDone(false);
        setAssignment(null);
      }

      setGroupDataFresh(true);
      writeGroupPageSnapshot({
        assignment: myAssignment
          ? {
              receiver_nickname:
                safeMembers.find((member) => member.user_id === myAssignment.receiver_id)?.nickname ||
                "Secret Member",
            }
          : null,
        createdAt: Date.now(),
        currentUserId: user.id,
        drawDone: Boolean(myAssignment),
        groupData: group,
        groupId: id,
        isOwner: isCurrentUserOwner,
        members: sanitizeMembersForGroupPageSnapshot(safeMembers, user.id),
        userId: user.id,
      });
      setLoading(false);

      void (async () => {
        const [exclusionResult, insightsResult, revealResult, recapResult, rerollHistoryResult] = await Promise.all([
          isCurrentUserOwner ? getDrawExclusions(id) : Promise.resolve(null),
          isCurrentUserOwner ? getGroupOwnerInsights(id) : Promise.resolve(null),
          group.revealed ? getRevealMatches(id) : Promise.resolve(null),
          group.revealed ? getGroupRecap(id) : Promise.resolve(null),
          isCurrentUserOwner
            ? getDrawRerollHistory(id, {
                cycleOffset: 0,
                resetOffset: 0,
                pageSize: HISTORY_PAGE_SIZE,
              })
            : Promise.resolve(null),
        ]);

        if (!isMounted || currentLoadVersion !== loadVersion) return;

        if (isCurrentUserOwner) {
          if (exclusionResult?.success && exclusionResult.exclusions) {
            setDrawExclusions(exclusionResult.exclusions);
            setDrawRulesReady(true);
          } else {
            setDrawExclusions([]);
            setDrawRulesReady(false);
            setDrawRuleMessage("We could not load pairing rules. Refresh this page before drawing names.");
          }
        } else {
          setDrawExclusions([]);
          setDrawRulesReady(true);
        }

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

        if (recapResult?.success && recapResult.recap) {
          setGroupRecap(recapResult.recap);
        } else {
          setGroupRecap(null);
        }

        if (rerollHistoryResult?.success) {
          setDrawCycleHistory(rerollHistoryResult.cycles || []);
          setDrawResetHistory(rerollHistoryResult.resets || []);
          setHasMoreDrawCycles(Boolean(rerollHistoryResult.hasMoreCycles));
          setHasMoreDrawResets(Boolean(rerollHistoryResult.hasMoreResets));
        } else {
          setDrawCycleHistory([]);
          setDrawResetHistory([]);
          setHasMoreDrawCycles(false);
          setHasMoreDrawResets(false);
        }
      })();
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

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_draw_exclusions" },
        (payload) => {
          if (matchesGroupChange(payload)) {
            scheduleReload();
          }
        }
      )
      .subscribe();

    window.addEventListener("storage", handleStorageRefresh);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    pollInterval = setInterval(refreshIfVisible, 60000);

    return () => {
      isMounted = false;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      window.removeEventListener("storage", handleStorageRefresh);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      supabase.removeChannel(channel);
    };
  }, [id, router, supabase]);

  useGroupRoutePrefetch({ groupId: id, router });

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

  const openDeleteModal = () => {
    setDeleteConfirm("");
    setDeleteMsg("");
    setShowDeleteModal(true);
  };

  const openLeaveModal = () => {
    setActionMsg("");
    setShowLeaveModal(true);
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
      clearGroupPageSnapshots(id);
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

  const handleOpenRemoveMember = (member: Member) => {
    setActionMsg("");
    setRemovingMember(member);
  };

  const handleRevokeMembership = (membershipId: string) => {
    setMembers((currentMembers) =>
      currentMembers.filter((currentMember) => currentMember.id !== membershipId)
    );
    notifyGroupRefresh();
  };

  const handleLeave = async () => {
    setActionSaving(true);
    setActionMsg("");

    const result = await leaveGroup(id);

    setActionMsg(result.message);
    setActionSaving(false);

    if (result.success) {
      clearGroupPageSnapshots(id);
      router.push("/dashboard");
    }
  };

  const handleDraw = async () => {
    if (!drawRulesReady) {
      setDrawMessage("Pairing rules are still loading. Please wait a moment before drawing names.");
      return;
    }

    if (
      !confirm(
        "Draw names now? Everyone will get one recipient. If you reset later, the current recipients and private chat history for this group will be deleted."
      )
    ) {
      return;
    }

    setDrawLoading(true);
    setDrawMessage("");

    try {
      const result = await drawSecretSanta(id, {
        avoidPreviousRecipient,
      });
      setDrawMessage(result.message);
      if (result.success) {
        notifyGroupRefresh();
      }
    } finally {
      setDrawLoading(false);
    }
  };

  const handleAddDrawRule = async () => {
    if (!newExclusionGiver || !newExclusionReceiver) {
      setDrawRuleMessage("Choose both members for this draw rule.");
      return;
    }

    setDrawRuleSaving(true);
    setDrawRuleMessage("");

    try {
      const result = await addDrawExclusion(
        id,
        newExclusionGiver,
        newExclusionReceiver,
        newExclusionBidirectional
      );
      setDrawRuleMessage(result.message);

      if (result.success) {
        setNewExclusionGiver("");
        setNewExclusionReceiver("");
        notifyGroupRefresh();
      }
    } finally {
      setDrawRuleSaving(false);
    }
  };

  const handleRemoveDrawRule = async (exclusionId: string) => {
    setDrawRuleSaving(true);
    setDrawRuleMessage("");

    try {
      const result = await removeDrawExclusion(id, exclusionId);
      setDrawRuleMessage(result.message);

      if (result.success) {
        notifyGroupRefresh();
      }
    } finally {
      setDrawRuleSaving(false);
    }
  };

  const handleResetDraw = async () => {
    const trimmedReason = resetReason.trim();

    if (trimmedReason.length < 8) {
      setDrawMessage("Please provide at least 8 characters for reset reason.");
      return;
    }

    if (
      !confirm(
        "Reset this draw? This will permanently delete the current recipients, private chat messages, read markers, and gift confirmations for this group. You can draw names again afterwards."
      )
    ) {
      return;
    }

    setResetLoading(true);
    setDrawMessage("");

    try {
      const result = await resetSecretSantaDraw(id, trimmedReason);
      setDrawMessage(result.message);
      if (result.success) {
        setResetReason("");
        setRevealMatches([]);
        setGroupRecap(null);
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

  const handleLoadMoreCycleHistory = async () => {
    if (!isOwner || drawCycleHistoryLoadingMore || !hasMoreDrawCycles) {
      return;
    }

    setDrawCycleHistoryLoadingMore(true);

    try {
      const result = await getDrawRerollHistory(id, {
        cycleOffset: drawCycleHistory.length,
        resetOffset: 0,
        pageSize: HISTORY_PAGE_SIZE,
      });

      if (result.success) {
        setDrawCycleHistory((current) => [...current, ...(result.cycles || [])]);
        setHasMoreDrawCycles(Boolean(result.hasMoreCycles));
      }
    } finally {
      setDrawCycleHistoryLoadingMore(false);
    }
  };

  const handleLoadMoreResetHistory = async () => {
    if (!isOwner || drawResetHistoryLoadingMore || !hasMoreDrawResets) {
      return;
    }

    setDrawResetHistoryLoadingMore(true);

    try {
      const result = await getDrawRerollHistory(id, {
        cycleOffset: 0,
        resetOffset: drawResetHistory.length,
        pageSize: HISTORY_PAGE_SIZE,
      });

      if (result.success) {
        setDrawResetHistory((current) => [...current, ...(result.resets || [])]);
        setHasMoreDrawResets(Boolean(result.hasMoreResets));
      }
    } finally {
      setDrawResetHistoryLoadingMore(false);
    }
  };

  const handleTriggerReveal = async () => {
    if (
      !confirm(
        "Reveal all Secret Santa matches to this group? Once revealed, accepted members can see every pairing."
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
  const currentMember = members.find((member) => member.user_id === currentUserId) || null;
  const shareCardCodename = currentMember?.nickname?.trim() || null;
  const shareCardRecipientName =
    assignment?.receiver_nickname?.trim() ||
    (shareCardCodename
      ? revealMatches.find((match) => match.giver === shareCardCodename)?.receiver || null
      : null);

  const allAccepted =
    pendingMembers.length === 0 && declinedMembers.length === 0 && acceptedMembers.length >= 3;
  const drawRuleControlsDisabled = drawRuleSaving || drawLoading || resetLoading || !drawRulesReady;
  const canDrawNames = allAccepted && drawRulesReady && !drawLoading && !resetLoading;

  const currencySymbol =
    CURRENCIES.find((item) => item.code === (groupData.currency || "USD"))?.symbol || "$";
  const editCurrencySymbol =
    CURRENCIES.find((item) => item.code === editCurrency)?.symbol || "$";
  const drawStatusLabel = groupData.revealed ? "Revealed" : drawDone ? "Names drawn" : "Not yet";
  const recapAliasPreview = groupRecap?.aliasRoster.slice(0, 6) || [];
  const recapExtraAliasCount = Math.max(
    (groupRecap?.aliasRoster.length || 0) - recapAliasPreview.length,
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

      <GroupActionModals
        actionMsg={actionMsg}
        actionSaving={actionSaving}
        deleteConfirm={deleteConfirm}
        deleteMsg={deleteMsg}
        deleteSaving={deleteSaving}
        editBudget={editBudget}
        editCurrency={editCurrency}
        editCurrencySymbol={editCurrencySymbol}
        editCustom={editCustom}
        editDate={editDate}
        editDesc={editDesc}
        editMsg={editMsg}
        editName={editName}
        editSaving={editSaving}
        groupData={groupData}
        removingMember={removingMember}
        showDeleteModal={showDeleteModal}
        showEditModal={showEditModal}
        showLeaveModal={showLeaveModal}
        onCloseDelete={() => setShowDeleteModal(false)}
        onCloseEdit={() => setShowEditModal(false)}
        onCloseLeave={() => setShowLeaveModal(false)}
        onCloseRemoveMember={() => setRemovingMember(null)}
        onDelete={handleDelete}
        onEditSave={handleEditSave}
        onLeave={handleLeave}
        onRemoveMember={handleRemoveMember}
        setDeleteConfirm={setDeleteConfirm}
        setEditBudget={setEditBudget}
        setEditCurrency={setEditCurrency}
        setEditCustom={setEditCustom}
        setEditDate={setEditDate}
        setEditDesc={setEditDesc}
        setEditName={setEditName}
      />

      <FadeIn className="relative z-10 mx-auto max-w-[760px] px-4 py-5 sm:px-6 sm:py-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition sm:w-auto"
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
              Manage members, invites, wishlists, and the name draw from here.
            </div>
            {!groupDataFresh && (
              <div className="mt-2 text-[11px] font-bold" style={{ color: "rgba(255,255,255,.72)" }}>
                Updating event details...
              </div>
            )}
          </div>

          <div className="p-6">
            <GroupEventSummaryPanel
              acceptedCount={acceptedMembers.length}
              currencySymbol={currencySymbol}
              declinedCount={declinedMembers.length}
              drawDone={drawDone}
              drawStatusLabel={drawStatusLabel}
              groupData={groupData}
              isOwner={isOwner}
              pendingCount={pendingMembers.length}
              totalMemberCount={members.length}
              onOpenDelete={openDeleteModal}
              onOpenEdit={openEditModal}
              onOpenLeave={openLeaveModal}
            />

            {isOwner && ownerInsights && (
              <GroupOwnerInsightsPanel drawDone={drawDone} ownerInsights={ownerInsights} />
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
                    🎲 Names have been drawn!
                  </div>

                  <div
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg mb-4"
                    style={{
                      background: groupData.revealed ? "#dcfce7" : "#dbeafe",
                      color: groupData.revealed ? "#15803d" : "#1d4ed8",
                    }}
                  >
                    {groupData.revealed
                      ? "Reveal live - everyone can see the pairings"
                      : "🎲 Names drawn - recipient details are ready"}
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
                        Need to change members or draw names again? Resetting will permanently
                        delete the current recipients, private chat messages, read
                        markers, and any gift confirmations for this group.
                      </p>

                      <textarea
                        value={resetReason}
                        onChange={(event) => setResetReason(event.target.value)}
                        placeholder="Required reason for reset (at least 8 characters)"
                        className="mb-3 w-full rounded-xl px-3 py-2 text-[12px] font-semibold outline-none"
                        style={{
                          border: "2px solid #fecaca",
                          background: "rgba(255,255,255,.92)",
                          color: "#7f1d1d",
                          fontFamily: "inherit",
                        }}
                        rows={2}
                        maxLength={300}
                        disabled={resetLoading || drawLoading}
                      />

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
                    🎲 Secret Santa Name Draw
                  </div>

                  {allAccepted ? (
                    <div
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg mb-3"
                      style={{ background: "#dcfce7", color: "#15803d" }}
                    >
                      ✅ All {acceptedMembers.length} members accepted - ready to draw names!
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
                          {getVisibleGroupMemberName(
                            member,
                            index,
                            Boolean(groupData?.require_anonymous_nickname),
                            "Member"
                          )[0]?.toUpperCase()}
                        </div>
                        {getVisibleGroupMemberName(
                          member,
                          index,
                          Boolean(groupData?.require_anonymous_nickname),
                          "Member"
                        )}
                      </div>
                    ))}
                  </div>

                  {isOwner && (
                    <div
                      className="mx-4 mt-1 mb-5 rounded-2xl p-4 text-left"
                      style={{
                        background: "rgba(255,255,255,.82)",
                        border: "1px solid rgba(15,23,42,.08)",
                      }}
                    >
                      <div
                        className="text-[14px] font-extrabold"
                        style={{ fontFamily: "'Fredoka', sans-serif", color: "#7f1d1d" }}
                      >
                        🚫 Pairing rules
                      </div>
                      <p className="text-[12px] mt-1 mb-3" style={{ color: "#64748b" }}>
                        Use these when two members should not be paired. Rules apply only when names are drawn.
                      </p>

                      {!drawRulesReady && (
                        <div
                          className="mb-3 rounded-xl px-3 py-2 text-[12px] font-bold"
                          style={{
                            background: "rgba(251,191,36,.14)",
                            border: "1px solid rgba(245,158,11,.22)",
                            color: "#92400e",
                          }}
                        >
                          Loading pairing rules...
                        </div>
                      )}

                      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <select
                          value={newExclusionGiver}
                          onChange={(event) => setNewExclusionGiver(event.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none font-semibold"
                          style={{
                            border: "2px solid #cbd5e1",
                            fontFamily: "inherit",
                            background: "#ffffff",
                            color: newExclusionGiver ? "#0f172a" : "#475569",
                            WebkitTextFillColor: newExclusionGiver ? "#0f172a" : "#475569",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,.65)",
                          }}
                          disabled={drawRuleControlsDisabled}
                        >
                          <option value="" style={{ color: "#475569", fontWeight: 700 }}>
                            Member A
                          </option>
                          {acceptedMembers
                            .filter((member) => Boolean(member.user_id))
                            .map((member) => (
                              <option
                                key={`giver-${member.user_id}`}
                                value={member.user_id || ""}
                                style={{ color: "#0f172a", fontWeight: 700 }}
                              >
                                {member.nickname || "Member"}
                              </option>
                            ))}
                        </select>

                        <select
                          value={newExclusionReceiver}
                          onChange={(event) => setNewExclusionReceiver(event.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none font-semibold"
                          style={{
                            border: "2px solid #cbd5e1",
                            fontFamily: "inherit",
                            background: "#ffffff",
                            color: newExclusionReceiver ? "#0f172a" : "#475569",
                            WebkitTextFillColor: newExclusionReceiver ? "#0f172a" : "#475569",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,.65)",
                          }}
                          disabled={drawRuleControlsDisabled}
                        >
                          <option value="" style={{ color: "#475569", fontWeight: 700 }}>
                            Member B
                          </option>
                          {acceptedMembers
                            .filter((member) => Boolean(member.user_id) && member.user_id !== newExclusionGiver)
                            .map((member) => (
                              <option
                                key={`receiver-${member.user_id}`}
                                value={member.user_id || ""}
                                style={{ color: "#0f172a", fontWeight: 700 }}
                              >
                                {member.nickname || "Member"}
                              </option>
                            ))}
                        </select>

                        <button
                          type="button"
                          onClick={handleAddDrawRule}
                          disabled={drawRuleControlsDisabled}
                          className="px-4 py-2.5 rounded-xl text-[13px] font-extrabold text-white"
                          style={{
                            background:
                              drawRuleControlsDisabled
                                ? "#9ca3af"
                                : "linear-gradient(135deg,#b91c1c,#ef4444)",
                            border: "none",
                            cursor:
                              drawRuleControlsDisabled
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {drawRuleSaving ? "Saving..." : "Add Rule"}
                        </button>
                      </div>

                      <label
                        className="mt-2 inline-flex items-center gap-2 text-[12px] font-semibold"
                        style={{ color: "#475569" }}
                      >
                        <input
                          type="checkbox"
                          checked={newExclusionBidirectional}
                          onChange={(event) => setNewExclusionBidirectional(event.target.checked)}
                          disabled={drawRuleControlsDisabled}
                        />
                        Block both directions
                      </label>

                      {drawRuleMessage && (
                        <p
                          className={`text-[12px] font-bold mt-2 ${
                            drawRuleMessage.startsWith("✅") ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {drawRuleMessage}
                        </p>
                      )}

                      {drawExclusions.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {drawExclusions.map((rule) => (
                            <div
                              key={rule.id}
                              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                              style={{
                                background: "rgba(248,250,252,.95)",
                                border: "1px solid rgba(148,163,184,.25)",
                              }}
                            >
                              <span className="text-[12px] font-bold" style={{ color: "#334155" }}>
                                {rule.giverNickname} → {rule.receiverNickname}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveDrawRule(rule.id)}
                                disabled={drawRuleControlsDisabled}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold"
                                style={{
                                  background: "rgba(220,38,38,.08)",
                                  color: "#dc2626",
                                  border: "1px solid rgba(220,38,38,.2)",
                                  cursor:
                                    drawRuleControlsDisabled
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-[12px] font-semibold" style={{ color: "#64748b" }}>
                          No exclusion rules yet.
                        </div>
                      )}

                      <div
                        className="mt-4 rounded-xl p-3"
                        style={{
                          background: "rgba(15,23,42,.04)",
                          border: "1px solid rgba(148,163,184,.25)",
                        }}
                      >
                        <div className="text-[13px] font-extrabold" style={{ color: "#334155" }}>
                          🧭 Draw options
                        </div>
                        <label
                          className="mt-2 inline-flex items-center gap-2 text-[12px] font-semibold"
                          style={{ color: "#475569" }}
                        >
                          <input
                            type="checkbox"
                            checked={avoidPreviousRecipient}
                            onChange={(event) => setAvoidPreviousRecipient(event.target.checked)}
                            disabled={drawRuleControlsDisabled}
                          />
                          Try not to give members the same recipient as last time.
                        </label>
                        <p className="mt-1 text-[11px]" style={{ color: "#64748b" }}>
                          If the current rules make that impossible, the app will relax this preference.
                        </p>
                      </div>

                      {(drawCycleHistory.length > 0 || drawResetHistory.length > 0) && (
                        <div
                          className="mt-4 rounded-xl p-3"
                          style={{
                            background: "rgba(255,255,255,.95)",
                            border: "1px solid rgba(148,163,184,.25)",
                          }}
                        >
                          <div className="text-[13px] font-extrabold" style={{ color: "#334155" }}>
                            📜 Draw history
                          </div>

                          {drawCycleHistory.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {drawCycleHistory.map((cycle) => (
                                <div
                                  key={cycle.id}
                                  className="rounded-lg px-2.5 py-2 text-[11px]"
                                  style={{
                                    background: "rgba(248,250,252,.95)",
                                    border: "1px solid rgba(148,163,184,.2)",
                                    color: "#334155",
                                  }}
                                >
                                  <strong>Draw {cycle.cycleNumber}</strong> • {new Date(cycle.createdAt).toLocaleString()} • {cycle.assignmentCount} recipients
                                  <div style={{ color: "#64748b" }}>
                                    Avoid previous recipient: {cycle.avoidPreviousRecipient ? "On" : "Off"}
                                    {cycle.repeatAvoidanceRelaxed ? " (relaxed)" : ""}
                                  </div>
                                </div>
                              ))}

                              {hasMoreDrawCycles && (
                                <button
                                  type="button"
                                  onClick={handleLoadMoreCycleHistory}
                                  disabled={drawCycleHistoryLoadingMore}
                                  className="w-full rounded-lg px-3 py-2 text-[11px] font-extrabold"
                                  style={{
                                    background: "rgba(37,99,235,.08)",
                                    color: "#1d4ed8",
                                    border: "1px solid rgba(37,99,235,.18)",
                                    cursor: drawCycleHistoryLoadingMore ? "not-allowed" : "pointer",
                                  }}
                                >
                                  {drawCycleHistoryLoadingMore ? "Loading..." : "Load more draws"}
                                </button>
                              )}

                              {drawCycleHistoryLoadingMore && (
                                <HistorySkeletonRows tone="blue" />
                              )}
                            </div>
                          )}

                          {drawResetHistory.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {drawResetHistory.map((reset) => (
                                <div
                                  key={reset.id}
                                  className="rounded-lg px-2.5 py-2 text-[11px]"
                                  style={{
                                    background: "rgba(255,247,237,.95)",
                                    border: "1px solid rgba(251,146,60,.2)",
                                    color: "#7c2d12",
                                  }}
                                >
                                  <strong>Reset</strong> • {new Date(reset.createdAt).toLocaleString()} • {reset.assignmentCount} recipients, {reset.confirmedGiftCount} confirmed gifts
                                  <div style={{ color: "#9a3412" }}>Reason: {reset.reason}</div>
                                </div>
                              ))}

                              {hasMoreDrawResets && (
                                <button
                                  type="button"
                                  onClick={handleLoadMoreResetHistory}
                                  disabled={drawResetHistoryLoadingMore}
                                  className="w-full rounded-lg px-3 py-2 text-[11px] font-extrabold"
                                  style={{
                                    background: "rgba(249,115,22,.08)",
                                    color: "#c2410c",
                                    border: "1px solid rgba(249,115,22,.2)",
                                    cursor: drawResetHistoryLoadingMore ? "not-allowed" : "pointer",
                                  }}
                                >
                                  {drawResetHistoryLoadingMore ? "Loading..." : "Load more resets"}
                                </button>
                              )}

                              {drawResetHistoryLoadingMore && (
                                <HistorySkeletonRows tone="orange" />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {isOwner ? (
                    <div>
                      <p className="text-xs text-gray-500 mb-3 px-8 leading-relaxed">
                        This will randomly assign each member someone to give a gift to. If
                        you later reset the draw, the current recipients and private chat
                        history for this group will be deleted.
                      </p>

                      <button
                        onClick={handleDraw}
                        disabled={!canDrawNames}
                        className="relative overflow-hidden px-8 py-3 rounded-xl text-base font-extrabold text-white transition"
                        style={{
                          background:
                            canDrawNames
                              ? "linear-gradient(135deg,#7f1d1d,#991b1b)"
                              : "#9ca3af",
                          boxShadow:
                            canDrawNames
                              ? "0 4px 20px rgba(127,29,29,.3)"
                              : "none",
                          cursor:
                            canDrawNames
                              ? "pointer"
                              : "not-allowed",
                          fontFamily: "inherit",
                        }}
                      >
                        {drawLoading
                          ? "🎰 Drawing..."
                          : drawRulesReady
                            ? "🎲 Draw Names"
                            : "Loading draw rules..."}
                        {canDrawNames && (
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
                      {groupData.revealed ? "🎉 Reveal Board" : "🎁 Gift Exchange Reveal"}
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
                        Use the event reveal screen on the venue display first. Guests can also
                        open that same screen on their phones and it will stay in sync once you
                        start the live reveal. It now walks through both nickname owners and the
                        final Secret Santa pairings in one shared flow.
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
                          Open Event Reveal Screen
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
                        Your own recipient stays secret until the owner starts the gift exchange
                        reveal. You can open the event reveal screen now and keep it ready on
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
                        Join Event Reveal Screen
                      </button>
                    </div>
                  )
                ) : revealMatches.length > 0 ? (
                  <>
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

                  {shareCardCodename && shareCardRecipientName && (
                    <ShareResultsCard
                      codename={shareCardCodename}
                      eventDate={groupData.event_date}
                      groupName={groupData.name}
                      recipientName={shareCardRecipientName}
                    />
                  )}
                  </>
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
                  <>
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
                        Open Event Replay Screen
                      </button>
                    </div>

                    {groupRecap && (
                      <div
                        className="rounded-[18px] p-5 mt-5"
                        style={{
                          background: "rgba(255,255,255,.82)",
                          border: "1px solid rgba(34,197,94,.12)",
                          boxShadow: "0 10px 24px rgba(15,23,42,.05)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                          <div>
                            <div
                              className="text-[18px] font-bold"
                              style={{
                                fontFamily: "'Fredoka', sans-serif",
                                color: "#166534",
                              }}
                            >
                              Group Recap
                            </div>
                            <div
                              className="text-[12px] font-semibold mt-1"
                              style={{ color: "#64748b" }}
                            >
                              A quick look back at how the whole exchange came together after the
                              reveal.
                            </div>
                          </div>

                          <div
                            className="px-3 py-1.5 rounded-full text-[11px] font-extrabold"
                            style={{
                              background: "rgba(34,197,94,.1)",
                              color: "#166534",
                            }}
                          >
                            Post-event summary
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                          <div
                            className="rounded-2xl p-4"
                            style={{
                              background: "rgba(240,253,244,.72)",
                              border: "1px solid rgba(34,197,94,.12)",
                            }}
                          >
                            <div
                              className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                              style={{ color: "#15803d" }}
                            >
                              Members
                            </div>
                            <div
                              className="text-[28px] font-bold mt-2"
                              style={{ fontFamily: "'Fredoka', sans-serif", color: "#166534" }}
                            >
                              {groupRecap.participantCount}
                            </div>
                            <div className="text-[12px] font-semibold mt-1" style={{ color: "#64748b" }}>
                              Accepted members in the final exchange
                            </div>
                          </div>

                          <div
                            className="rounded-2xl p-4"
                            style={{
                              background: "rgba(254,252,232,.78)",
                              border: "1px solid rgba(234,179,8,.14)",
                            }}
                          >
                            <div
                              className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                              style={{ color: "#a16207" }}
                            >
                              Wishlists Ready
                            </div>
                            <div
                              className="text-[28px] font-bold mt-2"
                              style={{ fontFamily: "'Fredoka', sans-serif", color: "#854d0e" }}
                            >
                              {groupRecap.wishlistReadyCount}/{groupRecap.participantCount}
                            </div>
                            <div className="text-[12px] font-semibold mt-1" style={{ color: "#78716c" }}>
                              Members who added wishlist items before the reveal
                            </div>
                          </div>

                          <div
                            className="rounded-2xl p-4"
                            style={{
                              background: "rgba(239,246,255,.86)",
                              border: "1px solid rgba(59,130,246,.12)",
                            }}
                          >
                            <div
                              className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                              style={{ color: "#1d4ed8" }}
                            >
                              Chat Activity
                            </div>
                            <div
                              className="text-[28px] font-bold mt-2"
                              style={{ fontFamily: "'Fredoka', sans-serif", color: "#1d4ed8" }}
                            >
                              {groupRecap.activeChatThreadCount}/{groupRecap.totalChatThreadCount}
                            </div>
                            <div className="text-[12px] font-semibold mt-1" style={{ color: "#64748b" }}>
                              Private chat threads that were used
                            </div>
                          </div>

                          <div
                            className="rounded-2xl p-4"
                            style={{
                              background: "rgba(255,247,237,.85)",
                              border: "1px solid rgba(249,115,22,.14)",
                            }}
                          >
                            <div
                              className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                              style={{ color: "#c2410c" }}
                            >
                              Gifts Confirmed
                            </div>
                            <div
                              className="text-[28px] font-bold mt-2"
                              style={{ fontFamily: "'Fredoka', sans-serif", color: "#9a3412" }}
                            >
                              {groupRecap.confirmedGiftCount}/{groupRecap.totalGiftCount}
                            </div>
                            <div className="text-[12px] font-semibold mt-1" style={{ color: "#78716c" }}>
                              Recipients who marked their gift as received
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,.9fr)] gap-4 mt-4">
                          <div
                            className="rounded-2xl p-4"
                            style={{
                              background: "rgba(248,250,252,.92)",
                              border: "1px solid rgba(148,163,184,.14)",
                            }}
                          >
                            <div
                              className="text-[13px] font-bold mb-3"
                              style={{ color: "#166534" }}
                            >
                              Alias Roster
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {recapAliasPreview.map((participant) => (
                                <div
                                  key={`${participant.alias}-${participant.realName}`}
                                  className="rounded-xl px-3 py-2"
                                  style={{
                                    background: "rgba(240,253,244,.78)",
                                    border: "1px solid rgba(34,197,94,.12)",
                                  }}
                                >
                                  <div className="text-[11px] font-extrabold" style={{ color: "#166534" }}>
                                    {participant.avatarEmoji} {participant.alias}
                                  </div>
                                  <div className="text-[12px] font-semibold mt-1" style={{ color: "#475569" }}>
                                    {participant.realName}
                                  </div>
                                </div>
                              ))}

                              {recapExtraAliasCount > 0 && (
                                <div
                                  className="rounded-xl px-3 py-2 flex items-center"
                                  style={{
                                    background: "rgba(239,246,255,.86)",
                                    border: "1px solid rgba(59,130,246,.12)",
                                  }}
                                >
                                  <span className="text-[12px] font-bold" style={{ color: "#1d4ed8" }}>
                                    +{recapExtraAliasCount} more aliases
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div
                            className="rounded-2xl p-4"
                            style={{
                              background: "rgba(255,255,255,.86)",
                              border: "1px solid rgba(148,163,184,.14)",
                            }}
                          >
                            <div
                              className="text-[13px] font-bold mb-3"
                              style={{ color: "#166534" }}
                            >
                              Recap Notes
                            </div>
                            <div className="flex flex-col gap-2 text-[12px] font-semibold" style={{ color: "#475569" }}>
                              <div>
                                Final matches revealed: <strong style={{ color: "#166534" }}>{revealMatches.length}</strong>
                              </div>
                              <div>
                                Nickname owners revealed: <strong style={{ color: "#166534" }}>{groupRecap.aliasRoster.length}</strong>
                              </div>
                              <div>
                                Wishlist gaps before reveal:{" "}
                                <strong style={{ color: "#166534" }}>
                                  {groupRecap.wishlistMissingAliases.length === 0
                                    ? "None"
                                    : groupRecap.wishlistMissingAliases.join(", ")}
                                </strong>
                              </div>
                              <div>
                                Chat recap stays aggregate-only to preserve the anonymous thread
                                design even after the event.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <GroupMembersSection
              acceptedMembers={acceptedMembers}
              currentUserId={currentUserId}
              declinedMembers={declinedMembers}
              drawDone={drawDone}
              groupId={id}
              isOwner={isOwner}
              pendingMembers={pendingMembers}
              requireAnonymousNickname={Boolean(groupData?.require_anonymous_nickname)}
              onRemoveMember={handleOpenRemoveMember}
              onRevokeMembership={handleRevokeMembership}
            />
          </div>
        </div>
      </FadeIn>
    </main>
  );
}
