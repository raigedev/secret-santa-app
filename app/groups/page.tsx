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
import { DashboardGroupsSection } from "@/app/dashboard/DashboardGroupsSection";
import { DashboardStatusMessage } from "@/app/dashboard/DashboardStatusMessage";
import type { ActionMessage, Group } from "@/app/dashboard/dashboard-types";
import { deleteGroup } from "@/app/group/[id]/actions";
import { GroupDeleteDialog, type DeleteGroupTarget } from "@/app/groups/GroupDeleteDialog";
import { InviteCard } from "@/app/groups/InviteCard";
import { isGroupInHistory } from "@/lib/groups/history";
import type { PendingInvite } from "@/lib/groups/pending-invites";
import { createClient } from "@/lib/supabase/client";

type GroupsPageUser = {
  id: string;
  email?: string | null;
};

const GROUPS_PAGE_FALLBACK_POLL_MS = 5 * 60 * 1000;
const GROUPS_PAGE_LOAD_TIMEOUT_MS = 10_000;
const INVITE_REQUEST_TIMEOUT_MS = 8_000;
const INVITE_RETRY_DELAY_MS = 400;
const GROUPS_PAGE_LOAD_TIMEOUT_MESSAGE =
  "Your groups are taking longer than expected. Refresh the page or try another section.";

async function requestPendingInvites(signal: AbortSignal): Promise<PendingInvite[]> {
  const response = await fetch("/api/groups/pending-invites", {
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(INVITE_REQUEST_TIMEOUT_MS)]),
  });
  if (!response.ok) throw new Error("Could not load invitations.");
  const result: { success: boolean; invites: PendingInvite[] } = await response.json();
  if (!result.success || !Array.isArray(result.invites)) {
    throw new Error("Could not load invitations.");
  }
  return result.invites;
}

async function loadPendingInvites(signal: AbortSignal): Promise<PendingInvite[]> {
  try {
    return await requestPendingInvites(signal);
  } catch {
    signal.throwIfAborted();
    await new Promise((resolve) => setTimeout(resolve, INVITE_RETRY_DELAY_MS));
    signal.throwIfAborted();
    return requestPendingInvites(signal);
  }
}

function splitActiveGroups(groups: Group[]) {
  return splitDashboardGroups(
    groups.filter(
      (group) =>
        !isGroupInHistory(
          group.event_date,
          Date.now(),
          group.event_timezone
        )
    )
  );
}

export default function GroupsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteStatus, setInviteStatus] = useState<"checking" | "ready" | "unavailable">("checking");
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteGroupTarget | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteDialogMessage, setDeleteDialogMessage] = useState<ActionMessage>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(false);
  const loadVersionRef = useRef(0);
  const sessionUserRef = useRef<GroupsPageUser | null>(null);
  const inviteRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncCountdownClock = () => {
      setCountdownNow(Date.now());
    };

    const timeoutId = setTimeout(() => {
      syncCountdownClock();
      intervalId = setInterval(syncCountdownClock, 60_000);
    }, Math.max(1_000, 60_000 - (Date.now() % 60_000)));

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const refreshInvites = useCallback(async (userId: string, restart = false) => {
    if (sessionUserRef.current?.id !== userId || (inviteRequestRef.current && !restart)) {
      return;
    }

    inviteRequestRef.current?.abort();
    const controller = new AbortController();
    inviteRequestRef.current = controller;
    setInviteStatus((status) => status === "unavailable" ? "checking" : status);

    try {
      const invites = await loadPendingInvites(controller.signal);
      if (!controller.signal.aborted && sessionUserRef.current?.id === userId) {
        setPendingInvites(invites);
        setInviteStatus("ready");
      }
    } catch {
      if (!controller.signal.aborted && sessionUserRef.current?.id === userId) {
        setInviteStatus("unavailable");
      }
    } finally {
      if (inviteRequestRef.current === controller) {
        inviteRequestRef.current = null;
      }
    }
  }, []);

  const loadGroups = useCallback(
    async (user: GroupsPageUser, restartInvites = false) => {
      void refreshInvites(user.id, restartInvites);
      const loadVersion = ++loadVersionRef.current;
      const timeoutId = setTimeout(() => {
        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        setActionMessage({
          type: "error",
          text: GROUPS_PAGE_LOAD_TIMEOUT_MESSAGE,
        });
        setLoading(false);
      }, GROUPS_PAGE_LOAD_TIMEOUT_MS);

      try {
        const groups = await loadDashboardGroups(supabase, user);

        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        const activeGroups = splitActiveGroups(groups.allGroups);
        setOwnedGroups(activeGroups.ownedGroups);
        setInvitedGroups(activeGroups.invitedGroups);
        setActionMessage((message) =>
          message?.text === GROUPS_PAGE_LOAD_TIMEOUT_MESSAGE ? null : message
        );
        setLoading(false);

        const enhancedGroups = await enhanceDashboardGroupsWithPeerProfiles(groups.allGroups);

        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        const enhanced = splitActiveGroups(enhancedGroups);
        setOwnedGroups(enhanced.ownedGroups);
        setInvitedGroups(enhanced.invitedGroups);
      } catch {
        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        setActionMessage({
          type: "error",
          text: "Failed to load your groups. Please refresh and try again.",
        });
        setLoading(false);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [refreshInvites, supabase]
  );

  useEffect(() => {
    mountedRef.current = true;
    let groupReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let groupPollInterval: ReturnType<typeof setInterval> | null = null;

    const scheduleGroupsReload = () => {
      if (groupReloadTimer) {
        clearTimeout(groupReloadTimer);
      }

      groupReloadTimer = setTimeout(() => {
        const sessionUser = sessionUserRef.current;
        if (sessionUser) {
          void loadGroups(sessionUser);
        }
      }, 120);
    };

    const refreshGroupsIfVisible = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const sessionUser = sessionUserRef.current;
      if (sessionUser) {
        void loadGroups(sessionUser);
      }
    };

    const bootstrapGroups = async () => {
      const authTimeoutId = setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }

        setActionMessage({
          type: "error",
          text: GROUPS_PAGE_LOAD_TIMEOUT_MESSAGE,
        });
        setLoading(false);
      }, GROUPS_PAGE_LOAD_TIMEOUT_MS);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        clearTimeout(authTimeoutId);

        if (sessionError) {
          throw sessionError;
        }

        const user = session?.user || null;
        if (!user) {
          router.push("/login");
          return;
        }

        sessionUserRef.current = { email: user.email, id: user.id };
        await loadGroups(sessionUserRef.current);

        if (!mountedRef.current) {
          return;
        }

        groupPollInterval = setInterval(refreshGroupsIfVisible, GROUPS_PAGE_FALLBACK_POLL_MS);
      } catch {
        if (!mountedRef.current) {
          return;
        }

        setActionMessage({
          type: "error",
          text: "Failed to load your groups. Please refresh and try again.",
        });
        setLoading(false);
      } finally {
        clearTimeout(authTimeoutId);
      }
    };

    void bootstrapGroups();

    window.addEventListener("focus", refreshGroupsIfVisible);
    document.addEventListener("visibilitychange", refreshGroupsIfVisible);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (sessionUserRef.current && sessionUserRef.current.id !== session?.user.id) {
        loadVersionRef.current++;
        sessionUserRef.current = null;
        inviteRequestRef.current?.abort();
        inviteRequestRef.current = null;
        setPendingInvites([]);
        setInviteStatus("checking");
        setOwnedGroups([]);
        setInvitedGroups([]);
        setActionMessage(null);
        setLoading(true);
      }
      if (!session) {
        router.push("/login");
        return;
      }

      sessionUserRef.current = { email: session.user.email, id: session.user.id };
      scheduleGroupsReload();
    });

    return () => {
      mountedRef.current = false;
      inviteRequestRef.current?.abort();
      inviteRequestRef.current = null;
      if (groupReloadTimer) {
        clearTimeout(groupReloadTimer);
      }
      if (groupPollInterval) {
        clearInterval(groupPollInterval);
      }
      window.removeEventListener("focus", refreshGroupsIfVisible);
      document.removeEventListener("visibilitychange", refreshGroupsIfVisible);
      subscription.unsubscribe();
    };
  }, [loadGroups, router, supabase]);

  const handleInviteResponse = (groupId: string, message: string) => {
    const sessionUser = sessionUserRef.current;
    if (!sessionUser) return;

    setPendingInvites((invites) => invites.filter((invite) => invite.group_id !== groupId));
    setActionMessage({ type: "success", text: message });
    clearDashboardSnapshots();
    void loadGroups(sessionUser, true);
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (deletingGroupId) {
      return;
    }

    deleteTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDeleteTarget({ id: groupId, name: groupName });
    setDeleteConfirmName("");
    setDeleteDialogMessage(null);
    setActionMessage(null);
  };

  const closeDeleteDialog = () => {
    if (deletingGroupId) {
      return;
    }

    setDeleteTarget(null);
    setDeleteConfirmName("");
    setDeleteDialogMessage(null);
    requestAnimationFrame(() => {
      deleteTriggerRef.current?.focus();
    });
  };

  const confirmDeleteGroup = async () => {
    if (!deleteTarget) {
      return;
    }

    if (deleteConfirmName.trim() !== deleteTarget.name.trim()) {
      setDeleteDialogMessage({
        type: "error",
        text: "Type the group name exactly to delete it.",
      });
      return;
    }

    setDeletingGroupId(deleteTarget.id);
    setActionMessage(null);
    setDeleteDialogMessage(null);

    try {
      const result = await deleteGroup(deleteTarget.id, deleteConfirmName);

      if (result.success) {
        setDeleteTarget(null);
        setDeleteConfirmName("");
        clearDashboardSnapshots();
        const sessionUser = sessionUserRef.current;
        if (sessionUser) {
          await loadGroups(sessionUser);
        }
        setActionMessage({ type: "success", text: result.message });
      } else {
        setDeleteDialogMessage({ type: "error", text: result.message });
      }
    } catch {
      setDeleteDialogMessage({
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

  const totalDashboardGroupCount = ownedGroups.length + invitedGroups.length;
  const invitations = pendingInvites.length > 0 || inviteStatus !== "ready" ? (
    <section aria-labelledby="pending-invitations-heading" className="mb-6">
      <h2 id="pending-invitations-heading" className="mb-3 text-lg font-black text-[#2e3432]">
        Pending invitations
      </h2>
      {inviteStatus === "checking" && (
        <p role="status" className="mb-3 text-sm font-semibold text-slate-600">Checking invitations...</p>
      )}
      {inviteStatus === "unavailable" && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm font-semibold text-slate-600">Invitations are temporarily unavailable.</p>
          <button
            type="button"
            className="gift-button gift-button-secondary gift-button-compact"
            onClick={() => {
              if (sessionUserRef.current) void refreshInvites(sessionUserRef.current.id);
            }}
          >
            Try again
          </button>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {pendingInvites.map((invite) => (
          <InviteCard key={invite.group_id} invite={invite} onRespond={handleInviteResponse} />
        ))}
      </div>
    </section>
  ) : null;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <DashboardStatusMessage message={actionMessage} />
        <DashboardGroupsSection
          countdownNow={countdownNow}
          deletingGroupId={deletingGroupId}
          invitations={invitations}
          invitedGroups={invitedGroups}
          isDarkTheme={false}
          ownedGroups={ownedGroups}
          totalDashboardGroupCount={totalDashboardGroupCount}
          onCreateGroup={() => router.push("/create-group")}
          onDeleteGroup={handleDeleteGroup}
          onOpenGroup={(groupId) => router.push(`/group/${groupId}`)}
        />
      </div>
      {deleteTarget && (
        <GroupDeleteDialog
          confirmName={deleteConfirmName}
          deleting={deletingGroupId === deleteTarget.id}
          message={deleteDialogMessage}
          target={deleteTarget}
          onCancel={closeDeleteDialog}
          onConfirm={() => void confirmDeleteGroup()}
          onConfirmNameChange={setDeleteConfirmName}
        />
      )}
    </main>
  );
}
