"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardSkeleton } from "@/app/components/PageSkeleton";
import {
  enhanceDashboardGroupsWithPeerProfiles,
  loadDashboardGroups,
  splitDashboardGroups,
} from "@/app/dashboard/dashboard-groups-data";
import { clearDashboardSnapshots } from "@/app/dashboard/dashboard-snapshot";
import { deleteWishlistItem } from "@/app/dashboard/wishlist-actions";
import { deleteGroup } from "@/app/group/[id]/actions";
import { clearGroupPageSnapshots } from "@/app/group/[id]/group-page-state";
import { GroupDeleteDialog, type DeleteGroupTarget } from "@/app/groups/GroupDeleteDialog";
import type { Group } from "@/app/dashboard/dashboard-types";
import { type HistoryWishlistItem } from "@/app/history/HistoryGroupCard";
import {
  HistoryMemoryBook,
  type HistoryAssignmentSummary,
} from "@/app/history/HistoryMemoryBook";
import { isGroupInHistory } from "@/lib/groups/history";
import { createClient } from "@/lib/supabase/client";
import {
  createGroupUserKey,
  getDashboardMemberLabel,
} from "@/app/dashboard/dashboard-formatters";
import { fetchMyAssignmentGiftPrep } from "@/lib/assignments/gift-prep-client";

type HistoryPageUser = {
  id: string;
  email?: string | null;
};

type HistoryAssignmentRow = {
  gift_prep_status: string | null;
  gift_received: boolean | null;
  group_id: string;
  receiver_id: string;
};

const HISTORY_PAGE_FALLBACK_POLL_MS = 5 * 60 * 1000;

function filterHistoryGroups(groups: Group[]) {
  return splitDashboardGroups(groups.filter((group) => isGroupInHistory(group.event_date)));
}

export default function HistoryPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [pastWishlistByGroupId, setPastWishlistByGroupId] = useState<
    Record<string, HistoryWishlistItem[]>
  >({});
  const [assignmentSummariesByGroupId, setAssignmentSummariesByGroupId] = useState<
    Record<string, HistoryAssignmentSummary>
  >({});
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deletingWishlistItemId, setDeletingWishlistItemId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteGroupTarget | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteDialogMessage, setDeleteDialogMessage] = useState("");
  const [message, setMessage] = useState("");
  const mountedRef = useRef(false);
  const loadVersionRef = useRef(0);
  const sessionUserRef = useRef<HistoryPageUser | null>(null);

  const loadHistoryGroups = useCallback(
    async (user: HistoryPageUser) => {
      const loadVersion = ++loadVersionRef.current;

      try {
        const groups = await loadDashboardGroups(supabase, user);

        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        const historical = filterHistoryGroups(groups.allGroups);
        const historyGroupIds = historical.allGroups.map((group) => group.id);

        const [wishlistRes, assignmentRes] =
          historyGroupIds.length > 0
            ? await Promise.all([
                supabase
                  .from("wishlists")
                  .select("id, group_id, item_name, item_category, item_link, item_note, priority")
                  .eq("user_id", user.id)
                  .in("group_id", historyGroupIds),
                fetchMyAssignmentGiftPrep(historyGroupIds),
              ])
            : [
                { data: [], error: null },
                { data: [], error: null },
              ];

        if (wishlistRes.error) {
          throw wishlistRes.error;
        }

        if (assignmentRes.error) {
          throw assignmentRes.error;
        }

        const wishlistByGroupId = ((wishlistRes.data || []) as Array<
          HistoryWishlistItem & { group_id: string }
        >).reduce<Record<string, HistoryWishlistItem[]>>((groupsById, item) => {
          const nextItem = {
            id: item.id,
            item_category: item.item_category,
            item_link: item.item_link,
            item_name: item.item_name,
            item_note: item.item_note,
            priority: item.priority,
          };

          groupsById[item.group_id] = [...(groupsById[item.group_id] || []), nextItem];
          return groupsById;
        }, {});

        const memberNameByGroupUser = new Map<string, string>();

        for (const group of historical.allGroups) {
          for (const member of group.members) {
            if (!member.userId) {
              continue;
            }

            memberNameByGroupUser.set(
              createGroupUserKey(group.id, member.userId),
              getDashboardMemberLabel(member, group.require_anonymous_nickname)
            );
          }
        }

        const summariesByGroupId = ((assignmentRes.data || []) as HistoryAssignmentRow[]).reduce<
          Record<string, HistoryAssignmentSummary>
        >((summaries, assignment) => {
          const receiverName =
            memberNameByGroupUser.get(
              createGroupUserKey(assignment.group_id, assignment.receiver_id)
            ) || "Secret Member";
          const isCompleted =
            assignment.gift_received || assignment.gift_prep_status === "ready_to_give";

          summaries[assignment.group_id] = {
            giftProgressLabel: isCompleted ? "Completed" : "Concluded",
            receiverName,
          };

          return summaries;
        }, {});

        setOwnedGroups(historical.ownedGroups);
        setInvitedGroups(historical.invitedGroups);
        setPastWishlistByGroupId(wishlistByGroupId);
        setAssignmentSummariesByGroupId(summariesByGroupId);
        setSelectedGroupId((currentSelectedGroupId) =>
          currentSelectedGroupId && historyGroupIds.includes(currentSelectedGroupId)
            ? currentSelectedGroupId
            : historyGroupIds[0] || null
        );
        setLoading(false);

        const enhancedGroups = await enhanceDashboardGroupsWithPeerProfiles(historical.allGroups);

        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        const enhanced = filterHistoryGroups(enhancedGroups);
        setOwnedGroups(enhanced.ownedGroups);
        setInvitedGroups(enhanced.invitedGroups);
      } catch {
        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        setMessage("Failed to load your history. Please refresh and try again.");
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    mountedRef.current = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const scheduleReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        const sessionUser = sessionUserRef.current;
        if (sessionUser) {
          void loadHistoryGroups(sessionUser);
        }
      }, 120);
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleReload();
      }
    };

    const bootstrap = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        sessionUserRef.current = { email: user.email, id: user.id };
        await loadHistoryGroups(sessionUserRef.current);
      } catch {
        if (!mountedRef.current) {
          return;
        }

        setMessage("Failed to load your history. Please refresh and try again.");
        setLoading(false);
      }
    };

    void bootstrap();
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    pollInterval = setInterval(refreshIfVisible, HISTORY_PAGE_FALLBACK_POLL_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
        return;
      }

      sessionUserRef.current = { email: session.user.email, id: session.user.id };
      scheduleReload();
    });

    return () => {
      mountedRef.current = false;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      subscription.unsubscribe();
    };
  }, [loadHistoryGroups, router, supabase]);

  const handleDeletePastWishlistItem = async (itemId: string, itemName: string) => {
    const confirmed = confirm(
      `Delete "${itemName}" from your past wishlist?\n\nThis permanently removes the saved item from this event history.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingWishlistItemId(itemId);
    setMessage("");

    try {
      const result = await deleteWishlistItem(itemId);
      setMessage(result.message);

      if (result.success) {
        setPastWishlistByGroupId((current) => {
          const nextEntries = Object.entries(current).map(([groupId, items]) => [
            groupId,
            items.filter((item) => item.id !== itemId),
          ]);

          return Object.fromEntries(nextEntries);
        });
      }
    } catch {
      setMessage("We could not delete that wishlist item. Please try again.");
    } finally {
      setDeletingWishlistItemId(null);
    }
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    setDeleteTarget({ id: groupId, name: groupName });
    setDeleteConfirmName("");
    setDeleteDialogMessage("");
    setMessage("");
  };

  const closeDeleteDialog = () => {
    if (deletingGroupId) {
      return;
    }

    setDeleteTarget(null);
    setDeleteConfirmName("");
    setDeleteDialogMessage("");
  };

  const confirmDeleteGroup = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeletingGroupId(deleteTarget.id);
    setDeleteDialogMessage("");
    setMessage("");

    let result: Awaited<ReturnType<typeof deleteGroup>>;

    try {
      result = await deleteGroup(deleteTarget.id, deleteConfirmName);
    } catch {
      setDeleteDialogMessage("We could not delete that exchange. Please try again.");
      setDeletingGroupId(null);
      return;
    }

    if (!result.success) {
      setDeleteDialogMessage(result.message);
      setDeletingGroupId(null);
      return;
    }

    setMessage(result.message);
    clearDashboardSnapshots();
    clearGroupPageSnapshots(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteConfirmName("");
    setDeleteDialogMessage("");
    setOwnedGroups((currentGroups) =>
      currentGroups.filter((group) => group.id !== deleteTarget.id)
    );
    setInvitedGroups((currentGroups) =>
      currentGroups.filter((group) => group.id !== deleteTarget.id)
    );
    setPastWishlistByGroupId((currentItems) => {
      const remainingItems = { ...currentItems };
      delete remainingItems[deleteTarget.id];
      return remainingItems;
    });
    setAssignmentSummariesByGroupId((currentSummaries) => {
      const remainingSummaries = { ...currentSummaries };
      delete remainingSummaries[deleteTarget.id];
      return remainingSummaries;
    });
    setSelectedGroupId((currentSelectedId) =>
      currentSelectedId === deleteTarget.id ? null : currentSelectedId
    );
    setDeletingGroupId(null);
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const allHistoryGroups = [...ownedGroups, ...invitedGroups];

  const selectedGroup =
    allHistoryGroups.find((group) => group.id === selectedGroupId) || allHistoryGroups[0] || null;

  if (!selectedGroup) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-4xl border border-dashed border-[rgba(72,102,78,.24)] bg-white/72 p-8 text-center">
          <h1 className="text-3xl font-black text-[#48664e]">History Memory Book</h1>
          <h2 className="mt-4 text-xl font-black text-[#2e3432]">No concluded exchanges yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-slate-600">
            Past groups will appear here automatically after the wrap-up window ends.
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      <HistoryMemoryBook
        deletingGroupId={deletingGroupId}
        deletingWishlistItemId={deletingWishlistItemId}
        groups={allHistoryGroups}
        message={message}
        onDeleteGroup={handleDeleteGroup}
        onDeleteWishlistItem={handleDeletePastWishlistItem}
        onOpenGroup={(groupId) => router.push(`/group/${groupId}`)}
        onSelectGroup={setSelectedGroupId}
        selectedGroup={selectedGroup}
        summariesByGroupId={assignmentSummariesByGroupId}
        wishlistItems={pastWishlistByGroupId[selectedGroup.id] || []}
      />
      {deleteTarget && (
        <GroupDeleteDialog
          confirmName={deleteConfirmName}
          deleting={deletingGroupId === deleteTarget.id}
          message={
            deleteDialogMessage
              ? {
                  text: deleteDialogMessage,
                  type: "error",
                }
              : null
          }
          target={deleteTarget}
          onCancel={closeDeleteDialog}
          onConfirm={() => void confirmDeleteGroup()}
          onConfirmNameChange={setDeleteConfirmName}
        />
      )}
    </>
  );
}
