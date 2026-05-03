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
import { GroupOwnerInsightsPanel, GroupOwnerInsightsSkeleton } from "./GroupOwnerInsightsPanel";
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

const GROUP_PAGE_FALLBACK_POLL_MS = 5 * 60 * 1000;

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
        { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${id}` },
        (payload) => {
          if (matchesGroupChange(payload)) {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups", filter: `id=eq.${id}` },
        (payload) => {
          if (matchesGroupChange(payload, "id")) {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments", filter: `group_id=eq.${id}` },
        (payload) => {
          if (matchesGroupChange(payload)) {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlists", filter: `group_id=eq.${id}` },
        (payload) => {
          if (matchesGroupChange(payload)) {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `group_id=eq.${id}` },
        (payload) => {
          if (matchesGroupChange(payload)) {
            scheduleReload();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_draw_exclusions", filter: `group_id=eq.${id}` },
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
    pollInterval = setInterval(refreshIfVisible, GROUP_PAGE_FALLBACK_POLL_MS);

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
  const drawStatusLabel = groupData.revealed ? "Revealed" : drawDone ? "Names drawn" : "Ready soon";
  const groupBudgetLabel = groupData.budget
    ? `${currencySymbol}${formatGroupBudgetAmount(groupData.budget)}`
    : "No limit";
  const giftDayLabel = formatGroupDisplayDate(groupData.event_date);
  const recapAliasPreview = groupRecap?.aliasRoster.slice(0, 6) || [];
  const recapExtraAliasCount = Math.max(
    (groupRecap?.aliasRoster.length || 0) - recapAliasPreview.length,
    0
  );

  return (
    <main
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background:
          "repeating-linear-gradient(135deg,rgba(72,102,78,.045) 0 1px,transparent 1px 38px),linear-gradient(180deg,#fffefa 0%,#f7faf5 42%,#eef4ef 100%)",
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

      <FadeIn className="relative z-10 mx-auto max-w-376 px-4 py-5 sm:px-6 sm:py-6">
        <button
          onClick={() => router.push("/groups")}
          className="mb-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition hover:-translate-y-0.5 sm:w-auto"
          style={{
            color: "#48664e",
            background: "rgba(255,255,255,.72)",
            border: "1px solid rgba(72,102,78,.15)",
            fontFamily: "inherit",
          }}
        >
          <ChevronLeftIcon />
          Back to groups
        </button>

        <div className="space-y-5">
          <section
            id="group-overview"
            className="rounded-3xl px-5 py-4 shadow-[0_18px_44px_rgba(46,52,50,.05)] ring-1 ring-[rgba(72,102,78,.12)] sm:px-6"
            style={{
              background: "linear-gradient(135deg,rgba(255,255,255,.94),rgba(242,244,242,.74))",
              color: "#2e3432",
            }}
            aria-label="Group overview"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                <GroupGiftBadge />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1
                      className="truncate text-[28px] font-black leading-tight text-[#48664e] sm:text-[32px]"
                      style={{ fontFamily: "'Fredoka', sans-serif" }}
                    >
                      {groupData.name}
                    </h1>
                    {isOwner && (
                      <span className="rounded-full bg-[#fff4df] px-3 py-1 text-[11px] font-black text-[#7b5902] shadow-[inset_0_0_0_1px_rgba(123,89,2,.1)]">
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-bold text-[#5b605e]">
                    <span className="inline-flex items-center gap-1.5">
                      <HeaderMembersIcon />
                      {members.length} members
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <HeaderCalendarIcon />
                      Gift day: {giftDayLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <HeaderBudgetIcon />
                      Budget: {groupBudgetLabel}
                    </span>
                  </div>
                </div>
              </div>

              {isOwner ? (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#2e3432] shadow-[inset_0_0_0_1px_rgba(72,102,78,.12)] transition hover:-translate-y-0.5"
                >
                  <EditPencilIcon />
                  Edit group
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openLeaveModal}
                  disabled={drawDone}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#fff4df] px-5 text-sm font-black text-[#7b5902] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {drawDone ? "Group locked" : "Leave group"}
                </button>
              )}
            </div>
            {!groupDataFresh && (
              <div className="mt-2 text-[11px] font-bold" style={{ color: "#64748b" }}>
                Updating event details...
              </div>
            )}
          </section>

          <nav
            aria-label="Group sections"
            className="flex gap-8 overflow-x-auto border-b border-[rgba(72,102,78,.12)] text-sm font-black text-[#64748b]"
          >
            {[
              { href: "#group-overview", label: "Overview" },
              { href: "#group-members", label: "Members" },
              { href: "#draw-controls", label: "Matches" },
              { href: "/secret-santa-chat", label: "Messages" },
              { href: "#owner-controls", label: "Settings" },
            ].map((tab, index) => (
              <a
                key={tab.label}
                href={tab.href}
                aria-current={index === 0 ? "page" : undefined}
                className="shrink-0 pb-3"
                style={{
                  color: index === 0 ? "#48664e" : "#64748b",
                  borderBottom: index === 0 ? "3px solid #48664e" : "3px solid transparent",
                }}
              >
                {tab.label}
              </a>
            ))}
          </nav>

          <div
            className={`grid gap-5 ${
              isOwner ? "xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start" : ""
            }`}
          >
            <div className="space-y-5">
              <GroupMembersSection
                acceptedMembers={acceptedMembers}
                currentUserId={currentUserId}
                declinedMembers={declinedMembers}
                drawDone={drawDone}
                groupId={id}
                isOwner={isOwner}
                missingWishlistMemberNames={ownerInsights?.missingWishlistMemberNames ?? []}
                pendingMembers={pendingMembers}
                requireAnonymousNickname={Boolean(groupData?.require_anonymous_nickname)}
                onRemoveMember={handleOpenRemoveMember}
                onRevokeMembership={handleRevokeMembership}
              />

              <GroupEventSummaryPanel
                acceptedCount={acceptedMembers.length}
                currencySymbol={currencySymbol}
                drawDone={drawDone}
                drawStatusLabel={drawStatusLabel}
                groupData={groupData}
                totalMemberCount={members.length}
              />

            <div
              id="draw-controls"
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

            {isOwner && (
              <div
                id="owner-controls"
                className="rounded-2xl bg-white/75 px-4 py-3 text-right shadow-[inset_0_0_0_1px_rgba(164,60,63,.12)]"
              >
                <button
                  type="button"
                  onClick={openDeleteModal}
                  className="rounded-full bg-[#fff7f6] px-4 py-2 text-xs font-black text-[#a43c3f] transition hover:-translate-y-0.5"
                >
                  Delete group
                </button>
              </div>
            )}

            </div>

            {isOwner && (
              ownerInsights ? (
                <GroupOwnerInsightsPanel
                  canDrawNames={canDrawNames}
                  declinedMemberCount={declinedMembers.length}
                  drawDone={drawDone}
                  drawRulesReady={drawRulesReady}
                  eventDate={groupData.event_date}
                  ownerInsights={ownerInsights}
                  pendingInviteCount={pendingMembers.length}
                  pendingMemberCount={pendingMembers.length}
                />
              ) : (
                <GroupOwnerInsightsSkeleton />
              )
            )}
          </div>
        </div>
      </FadeIn>
    </main>
  );
}

function formatGroupBudgetAmount(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function formatGroupDisplayDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || "Not set";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="m12.5 4.5-5.5 5.5 5.5 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EditPencilIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="m4.2 13.8-.6 2.6 2.6-.6 8.2-8.2-2-2-8.2 8.2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m11.4 6.6 2 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function GroupGiftBadge() {
  return (
    <div className="grid h-18 w-18 shrink-0 place-items-center rounded-3xl bg-white shadow-[inset_0_0_0_1px_rgba(72,102,78,.1),0_14px_34px_rgba(46,52,50,.06)]">
      <svg viewBox="0 0 64 64" className="h-13 w-13" fill="none" aria-hidden="true">
        <ellipse cx="32" cy="51" rx="18" ry="5" fill="rgba(72,102,78,.12)" />
        <path d="M16 25h32v24H16V25Z" fill="#48664e" />
        <path d="M16 25h32v9H16V25Z" fill="#fcce72" />
        <path d="M29 25h6v24h-6V25Z" fill="#f6e4b6" />
        <path d="M20 18c6-6 10 1 12 7-8 .5-13-.7-12-7Z" fill="#a43c3f" />
        <path d="M44 18c-6-6-10 1-12 7 8 .5 13-.7 12-7Z" fill="#a43c3f" />
        <circle cx="52" cy="31" r="2" fill="#fcce72" />
        <path
          d="M53.5 40h5M56 37.5v5M12 35h5M14.5 32.5v5"
          stroke="#fcce72"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function HeaderMembersIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M7.1 9.4a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM13.3 8.8a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6ZM3.2 16c.5-2.8 2-4.2 4.1-4.2s3.6 1.4 4.1 4.2M11 12.1c.7-.5 1.5-.8 2.4-.8 2 0 3.3 1.3 3.8 3.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function HeaderCalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M6 3.8v2.5M14 3.8v2.5M4.6 8h10.8M5.7 5.5h8.6c.9 0 1.5.7 1.5 1.5v7.2c0 .9-.7 1.5-1.5 1.5H5.7c-.9 0-1.5-.7-1.5-1.5V7c0-.9.7-1.5 1.5-1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function HeaderBudgetIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4.2 6.2h11.6v8.4H4.2V6.2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M7.4 6.2V5.1c0-.8.6-1.4 1.4-1.4h2.4c.8 0 1.4.6 1.4 1.4v1.1M7.2 10.4h5.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
