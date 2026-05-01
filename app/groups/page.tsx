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
import { isGroupInHistory } from "@/lib/groups/history";
import { createClient } from "@/lib/supabase/client";

type GroupsPageUser = {
  id: string;
  email?: string | null;
};

function splitActiveGroups(groups: Group[]) {
  return splitDashboardGroups(groups.filter((group) => !isGroupInHistory(group.event_date)));
}

export default function GroupsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const loadVersionRef = useRef(0);
  const sessionUserRef = useRef<GroupsPageUser | null>(null);

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

  const loadGroups = useCallback(
    async (user: GroupsPageUser) => {
      const loadVersion = ++loadVersionRef.current;

      try {
        const groups = await loadDashboardGroups(supabase, user);

        if (!mountedRef.current || loadVersion !== loadVersionRef.current) {
          return;
        }

        const activeGroups = splitActiveGroups(groups.allGroups);
        setOwnedGroups(activeGroups.ownedGroups);
        setInvitedGroups(activeGroups.invitedGroups);
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
      }
    },
    [supabase]
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
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        sessionUserRef.current = { email: user.email, id: user.id };
        await loadGroups(sessionUserRef.current);

        if (!mountedRef.current) {
          return;
        }

        groupPollInterval = setInterval(refreshGroupsIfVisible, 60_000);
      } catch {
        if (!mountedRef.current) {
          return;
        }

        setActionMessage({
          type: "error",
          text: "Failed to load your groups. Please refresh and try again.",
        });
        setLoading(false);
      }
    };

    void bootstrapGroups();

    window.addEventListener("focus", refreshGroupsIfVisible);
    document.addEventListener("visibilitychange", refreshGroupsIfVisible);

    const channel = supabase
      .channel("groups-list-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        scheduleGroupsReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        scheduleGroupsReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        scheduleGroupsReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        scheduleGroupsReload
      )
      .subscribe();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
        return;
      }

      sessionUserRef.current = { email: session.user.email, id: session.user.id };
      scheduleGroupsReload();
    });

    return () => {
      mountedRef.current = false;
      if (groupReloadTimer) {
        clearTimeout(groupReloadTimer);
      }
      if (groupPollInterval) {
        clearInterval(groupPollInterval);
      }
      window.removeEventListener("focus", refreshGroupsIfVisible);
      document.removeEventListener("visibilitychange", refreshGroupsIfVisible);
      void supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [loadGroups, router, supabase]);

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const confirmed = confirm(
      `Delete "${groupName}"?\n\nThis permanently removes the group, members, wishlists, messages, and draw details.`
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

      if (result.success) {
        clearDashboardSnapshots();
        const sessionUser = sessionUserRef.current;
        if (sessionUser) {
          void loadGroups(sessionUser);
        }
      }
    } catch {
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

  const totalDashboardGroupCount = ownedGroups.length + invitedGroups.length;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <DashboardStatusMessage message={actionMessage} />
        <DashboardGroupsSection
          countdownNow={countdownNow}
          deletingGroupId={deletingGroupId}
          invitedGroups={invitedGroups}
          isDarkTheme={false}
          ownedGroups={ownedGroups}
          totalDashboardGroupCount={totalDashboardGroupCount}
          onCreateGroup={() => router.push("/create-group")}
          onDeleteGroup={handleDeleteGroup}
          onOpenGroup={(groupId) => router.push(`/group/${groupId}`)}
        />
      </div>
    </main>
  );
}
