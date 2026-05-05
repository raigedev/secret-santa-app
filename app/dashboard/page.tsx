"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getProfile } from "@/app/profile/actions";
import { claimInvitedMemberships } from "./actions";
import { isGroupInHistory } from "@/lib/groups/history";
import { DashboardSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";
import {
  buildDashboardRevealMessage,
  createEmptyQueryResult,
  createGroupUserKey,
  formatGiftPrepStatusLabel,
  getDisplayFirstName,
  getNotificationPreviewTitle,
  normalizeGiftProgressStep,
} from "./dashboard-formatters";
import { DashboardBackdrop } from "./DashboardBackdrop";
import { DashboardPreviewWorkspace } from "./DashboardPreviewWorkspace";
import { DashboardStatusMessage } from "./DashboardStatusMessage";
import { useDashboardRoutePrefetch } from "./useDashboardRoutePrefetch";
import {
  clearDashboardSnapshots,
  readDashboardSnapshot,
  sanitizeGroupsForDashboardSnapshot,
  writeDashboardSnapshot,
} from "./dashboard-snapshot";
import {
  addViewerProfileChangedListener,
  applyViewerProfileChangedEvent,
  normalizeViewerAvatarEmoji,
  normalizeViewerAvatarUrl,
  readStoredViewerProfile,
  storeViewerAvatarEmoji,
  storeViewerAvatarUrl,
} from "@/app/components/viewer-profile-client";
import { enhanceDashboardGroupsWithPeerProfiles } from "./dashboard-groups-data";
import type {
  ActionMessage,
  AssignmentRow,
  DashboardActivityItem,
  DashboardNotificationPreviewItem,
  DashboardSnapshot,
  DashboardTheme,
  GiftProgressStep,
  GiftProgressSummary,
  Group,
  GroupMemberRow,
  GroupRow,
  MembershipRow,
  MyAssignmentRow,
  NotificationFeedRow,
  PendingGroupRow,
  PendingInvite,
  WishlistSummaryRow,
} from "./dashboard-types";
import { getActivityFeedVisual } from "./dashboard-visuals";

type ProfileSetupModalProps = {
  defaultName: string;
  onComplete: () => void;
  onSkip: () => void;
};

const ProfileSetupModal = dynamic<ProfileSetupModalProps>(() => import("./ProfileSetupModal"), {
  loading: () => null,
});

const DASHBOARD_THEME_STORAGE_KEY = "ss_dashboard_theme";
const DASHBOARD_THEME_CHANGED_EVENT = "ss-dashboard-theme-changed";
const DASHBOARD_NOTIFICATION_PREVIEW_LIMIT = 3;
const DASHBOARD_FALLBACK_POLL_MS = 5 * 60 * 1000;
const NOTIFICATION_BADGE_COUNT_LIMIT = 100;

type DashboardNotificationPreviewGroup = {
  count: number;
  latest: NotificationFeedRow;
};

function getNotificationGroupKey(notification: NotificationFeedRow): string {
  return notification.type;
}

function getNotificationSortTime(notification: NotificationFeedRow): number {
  const timestamp = new Date(notification.created_at).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getGroupedNotificationPreviewTitle(
  notification: NotificationFeedRow,
  count: number
): string {
  if (count === 1) {
    return getNotificationPreviewTitle(notification.type, notification.title);
  }

  switch (notification.type) {
    case "invite":
      return `${count} group invites`;
    case "chat":
      return `${count} private messages`;
    case "draw":
      return `${count} draw updates`;
    case "reveal":
      return `${count} reveal updates`;
    case "gift_received":
      return `${count} gift updates`;
    default:
      return `${count} updates`;
  }
}

function buildNotificationPreviewItems(
  notifications: NotificationFeedRow[]
): DashboardNotificationPreviewItem[] {
  const groups = new Map<string, DashboardNotificationPreviewGroup>();

  notifications.forEach((notification) => {
    const groupKey = getNotificationGroupKey(notification);
    const group = groups.get(groupKey);

    if (!group) {
      groups.set(groupKey, { count: 1, latest: notification });
      return;
    }

    group.count += 1;

    if (getNotificationSortTime(notification) > getNotificationSortTime(group.latest)) {
      group.latest = notification;
    }
  });

  return [...groups.values()]
    .sort(
      (left, right) =>
        getNotificationSortTime(right.latest) - getNotificationSortTime(left.latest)
    )
    .slice(0, DASHBOARD_NOTIFICATION_PREVIEW_LIMIT)
    .map(({ count, latest }) => {
      const visual = getActivityFeedVisual(latest.type);

      return {
        id: count > 1 ? `${latest.type}:${latest.id}:${count}` : latest.id,
        title: getGroupedNotificationPreviewTitle(latest, count),
        href: count > 1 ? "/notifications" : latest.link_path,
        createdAt: latest.created_at,
        ...visual,
      };
    });
}

function readStoredDashboardTheme(): DashboardTheme {
  if (typeof window === "undefined") {
    return "default";
  }

  return localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY) === "midnight"
    ? "midnight"
    : "default";
}

export default function DashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [canViewAffiliateReport, setCanViewAffiliateReport] = useState(false);
  const [userName, setUserName] = useState("");
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [recipientNames, setRecipientNames] = useState<string[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [wishlistItemCount, setWishlistItemCount] = useState(0);
  const [giftProgressSummary, setGiftProgressSummary] = useState<GiftProgressSummary | null>(null);
  const [activityFeedItems, setActivityFeedItems] = useState<DashboardActivityItem[]>([]);
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>("default");
  const [dashboardThemeReady, setDashboardThemeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);
  const loadDashboardDataRef = useRef<
    ((user: { id: string; email?: string | null }) => Promise<void>) | null
  >(null);
  const loadNotificationCountRef = useRef<((userId: string) => Promise<void>) | null>(null);

  useEffect(() => {
    const storedViewerProfile = readStoredViewerProfile();

    if (storedViewerProfile.displayName) {
      setUserName(storedViewerProfile.displayName);
    }

    return addViewerProfileChangedListener((event) => {
      applyViewerProfileChangedEvent(event, {
        setViewerAvatarEmoji: () => undefined,
        setViewerAvatarUrl: () => undefined,
        setViewerName: setUserName,
      });
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!dashboardThemeReady) {
      return;
    }

    localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, dashboardTheme);
  }, [dashboardTheme, dashboardThemeReady]);

  useEffect(() => {
    const syncStoredTheme = () => {
      setDashboardTheme(readStoredDashboardTheme());
      setDashboardThemeReady(true);
    };

    syncStoredTheme();
    window.addEventListener("storage", syncStoredTheme);
    window.addEventListener(DASHBOARD_THEME_CHANGED_EVENT, syncStoredTheme);

    return () => {
      window.removeEventListener("storage", syncStoredTheme);
      window.removeEventListener(DASHBOARD_THEME_CHANGED_EVENT, syncStoredTheme);
    };
  }, []);

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

  useEffect(() => {
    let isMounted = true;
    let dashboardReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let notificationPollInterval: ReturnType<typeof setInterval> | null = null;
    let dashboardPollInterval: ReturnType<typeof setInterval> | null = null;
    let dashboardLoadVersion = 0;
    let sessionUser:
      | {
          id: string;
          email?: string | null;
        }
      | null = null;

    const applyDashboardSnapshot = (snapshot: DashboardSnapshot) => {
      const savedUserName =
        typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ss_un") : null;
      const activeOwnedGroups = snapshot.ownedGroups.filter(
        (group) => !isGroupInHistory(group.event_date)
      );
      const activeInvitedGroups = snapshot.invitedGroups.filter(
        (group) => !isGroupInHistory(group.event_date)
      );

      if (savedUserName) {
        setUserName(savedUserName);
      }
      setOwnedGroups(activeOwnedGroups);
      setInvitedGroups(activeInvitedGroups);
      setPendingInvites(snapshot.pendingInvites);
      setRecipientNames(snapshot.recipientNames);
      setUnreadNotificationCount(snapshot.unreadNotificationCount);
      setWishlistItemCount(snapshot.wishlistItemCount);
      setGiftProgressSummary(snapshot.giftProgressSummary);
      setActivityFeedItems(snapshot.activityFeedItems);
      setLoading(false);
    };

    const loadDashboardPeerProfiles = async (
      groups: Group[],
      loadVersion: number
    ) => {
      if (groups.length === 0) {
        return;
      }

      const enhancedGroups = await enhanceDashboardGroupsWithPeerProfiles(groups);
      if (!isMounted || loadVersion !== dashboardLoadVersion) {
        return;
      }

      const enhancedGroupById = new Map(enhancedGroups.map((group) => [group.id, group]));

      setOwnedGroups((currentGroups) =>
        currentGroups.map((group) => enhancedGroupById.get(group.id) || group)
      );
      setInvitedGroups((currentGroups) =>
        currentGroups.map((group) => enhancedGroupById.get(group.id) || group)
      );
    };

    // Reload the dashboard cards and lists without repeating one-time setup like
    // profile bootstrap or invited-membership claiming on every realtime event.
    const loadDashboardData = async (user: { id: string; email?: string | null }) => {
      const currentLoadVersion = ++dashboardLoadVersion;

      try {
        const email = (user.email || "guest@example.com").toLowerCase();

        // Group membership rows drive most of the dashboard, but owned groups
        // should still show up even if a legacy membership row is missing.
        const [membershipRes, ownedGroupLookupRes] = await Promise.all([
          supabase
            .from("group_members")
            .select("id, group_id, status, role")
            .eq("user_id", user.id),
          supabase.from("groups").select("id").eq("owner_id", user.id),
        ]);

        if (membershipRes.error) {
          throw membershipRes.error;
        }

        if (ownedGroupLookupRes.error) {
          throw ownedGroupLookupRes.error;
        }

        const memberRows = (membershipRes.data || []) as MembershipRow[];
        const ownedGroupIds = [...new Set((ownedGroupLookupRes.data || []).map((group) => group.id))];

        if (!isMounted) {
          return;
        }

        if ((!memberRows || memberRows.length === 0) && ownedGroupIds.length === 0) {
          const defaultDisplayName = email.split("@")[0];
          const snapshotUserName =
            typeof sessionStorage !== "undefined"
              ? sessionStorage.getItem("ss_un") || defaultDisplayName
              : defaultDisplayName;

          setOwnedGroups([]);
          setInvitedGroups([]);
          setPendingInvites([]);
          setRecipientNames([]);
          setWishlistItemCount(0);
          setGiftProgressSummary(null);
          setActivityFeedItems([]);
          writeDashboardSnapshot({
            createdAt: Date.now(),
            userId: user.id,
            userName: snapshotUserName,
            ownedGroups: [],
            invitedGroups: [],
            pendingInvites: [],
            recipientNames: [],
            unreadNotificationCount: 0,
            wishlistItemCount: 0,
            wishlistGroupCount: 0,
            giftProgressSummary: null,
            activityFeedItems: [],
            notificationPreviewItems: [],
          });
          setLoading(false);
          return;
        }

        const acceptedRows = memberRows.filter((row) => row.status === "accepted");
        const pendingRows = memberRows.filter((row) => row.status === "pending");
        const acceptedGroupIds = [...new Set([...acceptedRows.map((row) => row.group_id), ...ownedGroupIds])];
        const pendingGroupIds = [...new Set(pendingRows.map((row) => row.group_id))];
        const roleMap: Record<string, string> = {};

        for (const ownedGroupId of ownedGroupIds) {
          roleMap[ownedGroupId] = "owner";
        }

        for (const row of acceptedRows) {
          roleMap[row.group_id] = row.role;
        }

        const [
          groupsRes,
          membersRes,
          assignmentsRes,
          myAssignRes,
          pendingRes,
          wishlistSummaryRes,
          activityNotificationsRes,
        ] =
          await Promise.all([
            acceptedGroupIds.length > 0
              ? supabase
                  .from("groups")
                  .select("id, name, description, event_date, budget, currency, owner_id, created_at, require_anonymous_nickname")
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
                  .select(
                    "group_id, receiver_id, gift_prep_status, gift_prep_updated_at"
                  )
                  .eq("giver_id", user.id)
                  .in("group_id", acceptedGroupIds)
              : createEmptyQueryResult<MyAssignmentRow>(),
            pendingGroupIds.length > 0
              ? supabase
                  .from("groups")
                  .select("id, name, description, event_date, require_anonymous_nickname")
                  .in("id", pendingGroupIds)
              : createEmptyQueryResult<PendingGroupRow>(),
            acceptedGroupIds.length > 0
              ? supabase
                  .from("wishlists")
                  .select("group_id")
                  .eq("user_id", user.id)
                  .in("group_id", acceptedGroupIds)
              : createEmptyQueryResult<WishlistSummaryRow>(),
            supabase
              .from("notifications")
              .select("id, type, title, body, link_path, created_at")
              .eq("user_id", user.id)
              .in("type", ["invite", "chat", "draw", "reveal", "gift_received"])
              .order("created_at", { ascending: false })
              .limit(8),
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

        if (wishlistSummaryRes.error) {
          throw wishlistSummaryRes.error;
        }

        if (activityNotificationsRes.error) {
          throw activityNotificationsRes.error;
        }

        const groupsData = groupsRes.data || [];
        const activeGroupsData = groupsData.filter(
          (group) => !isGroupInHistory(group.event_date)
        );
        const activeGroupIds = new Set(activeGroupsData.map((group) => group.id));
        const allMembers = (membersRes.data || []).filter((member) =>
          activeGroupIds.has(member.group_id)
        );
        const allAssignments = (assignmentsRes.data || []).filter((assignment) =>
          activeGroupIds.has(assignment.group_id)
        );
        const myAssignments = (myAssignRes.data || []).filter((assignment) =>
          activeGroupIds.has(assignment.group_id)
        );
        const pendingGroups = (pendingRes.data || []).filter(
          (group) => !isGroupInHistory(group.event_date)
        );
        const wishlistSummary = ((wishlistSummaryRes.data || []) as WishlistSummaryRow[]).filter(
          (row) => activeGroupIds.has(row.group_id)
        );
        const recentNotifications =
          (activityNotificationsRes.data || []) as NotificationFeedRow[];
        const drawnGroupIds = new Set(allAssignments.map((assignment) => assignment.group_id));
        const membersByGroupId = new Map<string, GroupMemberRow[]>();

        for (const member of allMembers) {
          const currentMembers = membersByGroupId.get(member.group_id) || [];
          currentMembers.push(member);
          membersByGroupId.set(member.group_id, currentMembers);
        }

        const groupsWithMembers: Group[] = activeGroupsData.map((group) => {
          return {
            ...group,
            isOwner: roleMap[group.id] === "owner",
            hasDrawn: drawnGroupIds.has(group.id),
            members: (membersByGroupId.get(group.id) || []).map((member) => ({
              userId: member.user_id,
              nickname: member.nickname,
              email: member.email,
              role: member.role,
              displayName: null,
              avatarEmoji: null,
              avatarUrl: null,
            })),
          };
        });

        if (!isMounted) {
          return;
        }

        const nextOwnedGroups = groupsWithMembers.filter((group) => group.isOwner);
        const nextInvitedGroups = groupsWithMembers.filter((group) => !group.isOwner);

        setOwnedGroups(nextOwnedGroups);
        setInvitedGroups(nextInvitedGroups);

        void loadDashboardPeerProfiles(groupsWithMembers, currentLoadVersion);

        const receiverNameByGroupUser = new Map<string, string>();
        const groupNameById = new Map(activeGroupsData.map((group) => [group.id, group.name]));

        for (const member of allMembers) {
          if (!member.user_id) {
            continue;
          }

          receiverNameByGroupUser.set(
            createGroupUserKey(member.group_id, member.user_id),
            member.nickname || "Secret Member"
          );
        }

        const nextRecipientNames = myAssignments.map((assignment) => {
          return (
            receiverNameByGroupUser.get(
              createGroupUserKey(assignment.group_id, assignment.receiver_id)
            ) || "Secret Member"
          );
        });

        setRecipientNames(nextRecipientNames);
        setWishlistItemCount(wishlistSummary.length);
        const nextWishlistGroupCount = new Set(wishlistSummary.map((row) => row.group_id)).size;
        let nextGiftProgressSummary: GiftProgressSummary | null = null;

        if (myAssignments.length > 0) {
          const normalizedAssignments = myAssignments.map((assignment) => ({
            step: normalizeGiftProgressStep(assignment.gift_prep_status),
            recipientName:
              receiverNameByGroupUser.get(
                createGroupUserKey(assignment.group_id, assignment.receiver_id)
              ) || "your recipient",
            groupName: groupNameById.get(assignment.group_id) || "your group",
            updatedAt: assignment.gift_prep_updated_at
              ? new Date(assignment.gift_prep_updated_at).getTime()
              : 0,
          }));

          const countsByStep: Record<GiftProgressStep, number> = {
            planning: 0,
            purchased: 0,
            wrapped: 0,
            ready_to_give: 0,
          };

          for (const assignment of normalizedAssignments) {
            countsByStep[assignment.step] += 1;
          }

          const focusStep =
            countsByStep.planning > 0
              ? "planning"
              : countsByStep.purchased > 0
                ? "purchased"
                : countsByStep.wrapped > 0
                  ? "wrapped"
                  : "ready_to_give";

          const primaryAssignment = [...normalizedAssignments].sort((a, b) => b.updatedAt - a.updatedAt)[0];

          nextGiftProgressSummary = {
            focusStep,
            focusCount: countsByStep[focusStep],
            countsByStep,
            totalAssignments: normalizedAssignments.length,
            readyToGiveCount: countsByStep.ready_to_give,
            recipientName: normalizedAssignments.length === 1 ? primaryAssignment.recipientName : null,
            groupName: normalizedAssignments.length === 1 ? primaryAssignment.groupName : null,
          };
        }

        setGiftProgressSummary(nextGiftProgressSummary);

        const nextNotificationPreviewItems = buildNotificationPreviewItems(recentNotifications);

        // The dashboard feed combines "what changed around me" notifications
        // with the user's own gift-progress actions so the home page feels alive
        // without inventing a separate activity table.
        const feedItems: DashboardActivityItem[] = [
          ...myAssignments
            .filter(
              (assignment) => assignment.gift_prep_status && assignment.gift_prep_updated_at
            )
            .map((assignment) => {
              const receiverName =
                receiverNameByGroupUser.get(
                  createGroupUserKey(assignment.group_id, assignment.receiver_id)
                ) || "your recipient";
              const groupName = groupNameById.get(assignment.group_id) || "your group";
              const statusLabel = formatGiftPrepStatusLabel(assignment.gift_prep_status);
              const visual = getActivityFeedVisual("gift_progress");

              return {
                id: `gift-progress-${assignment.group_id}`,
                title: `You marked your gift as ${statusLabel}`,
                subtitle: `For ${receiverName} in ${groupName}`,
                createdAt: assignment.gift_prep_updated_at as string,
                href: "/secret-santa",
                ...visual,
              };
            }),
          ...nextNotificationPreviewItems.map((notification) => ({
            id: `notification:${notification.id}`,
            title: notification.title,
            subtitle:
              notification.href === "/notifications"
                ? "Review the grouped updates."
                : "Open the update.",
            createdAt: notification.createdAt,
            href: notification.href,
            icon: notification.icon,
            tone: notification.tone,
          })),
        ]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        const nextPendingInvites = pendingGroups.map((group) => ({
          group_id: group.id,
          group_name: group.name,
          group_description: group.description || "",
          group_event_date: group.event_date,
          require_anonymous_nickname: Boolean(group.require_anonymous_nickname),
        }));

        setActivityFeedItems(feedItems);
        setPendingInvites(nextPendingInvites);

        const defaultDisplayName = email.split("@")[0];
        const snapshotUserName =
          typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem("ss_un") || defaultDisplayName
            : defaultDisplayName;

        writeDashboardSnapshot({
          createdAt: Date.now(),
          userId: user.id,
          userName: snapshotUserName,
          ownedGroups: sanitizeGroupsForDashboardSnapshot(nextOwnedGroups),
          invitedGroups: sanitizeGroupsForDashboardSnapshot(nextInvitedGroups),
          pendingInvites: nextPendingInvites,
          recipientNames: nextRecipientNames,
          unreadNotificationCount: 0,
          wishlistItemCount: wishlistSummary.length,
          wishlistGroupCount: nextWishlistGroupCount,
          giftProgressSummary: nextGiftProgressSummary,
          activityFeedItems: feedItems,
          notificationPreviewItems: nextNotificationPreviewItems,
        });
      } catch {
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

    const loadAffiliateReportAccess = async () => {
      try {
        const response = await fetch("/api/affiliate/report-access", {
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (isMounted) {
            setCanViewAffiliateReport(false);
          }
          return;
        }

        const payload = (await response.json()) as { allowed?: boolean };
        const allowed = Boolean(payload.allowed);

        if (typeof sessionStorage !== "undefined") {
          if (allowed) {
            sessionStorage.setItem("ss_ara", "1");
          } else {
            sessionStorage.removeItem("ss_ara");
          }
        }

        if (isMounted) {
          setCanViewAffiliateReport(allowed);
        }
      } catch {
        if (isMounted) {
          setCanViewAffiliateReport(false);
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
        const resolvedName = profileData.display_name || defaultName;
        const resolvedAvatarEmoji = normalizeViewerAvatarEmoji(profileData.avatar_emoji);
        const resolvedAvatarUrl = normalizeViewerAvatarUrl(profileData.avatar_url);

        setShowProfileSetup(!profileData.profile_setup_complete);
        setUserName(resolvedName);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("ss_un", resolvedName);
        }
        storeViewerAvatarEmoji(resolvedAvatarEmoji || null);
        storeViewerAvatarUrl(resolvedAvatarUrl || null);
      }
    };

    const loadNotificationCount = async (targetUserId: string) => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", targetUserId)
        .is("read_at", null)
        .limit(NOTIFICATION_BADGE_COUNT_LIMIT);

      if (!isMounted) {
        return;
      }

      if (error) {
        return;
      }

      setUnreadNotificationCount(data?.length || 0);
    };

    loadNotificationCountRef.current = loadNotificationCount;

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

    const scheduleNotificationsReload = () => {
      if (!sessionUser) {
        return;
      }

      if (loadNotificationCountRef.current) {
        void loadNotificationCountRef.current(sessionUser.id);
      }
    };

    const refreshNotificationsIfVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      scheduleNotificationsReload();
    };

    const refreshDashboardIfVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      scheduleDashboardReload();
      scheduleNotificationsReload();
    };

    const bootstrapDashboard = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          clearDashboardSnapshots();
          router.push("/login");
          return;
        }

        sessionUser = session.user;

        if (!isMounted) {
          return;
        }

        const cachedDashboard = readDashboardSnapshot(session.user.id);

        if (cachedDashboard) {
          applyDashboardSnapshot(cachedDashboard);
        }

        // claimInvitedMemberships only needs to run once per browser session.
        // Email-linked invites don't change between visits; focus and the light
        // fallback refresh keep brand-new invites synced without hot polling.
        const CLAIM_KEY = "ss_mc";
        const alreadyClaimed =
          typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem(CLAIM_KEY) === "1";

        if (!alreadyClaimed) {
          void claimInvitedMemberships().then((claimResult) => {
            if (claimResult.success && typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(CLAIM_KEY, "1");
            }

            if (
              claimResult.success &&
              claimResult.linkedCount > 0 &&
              isMounted &&
              sessionUser &&
              loadDashboardDataRef.current
            ) {
              void loadDashboardDataRef.current(sessionUser);
            }
          });
        }

        // The main dashboard content should not wait on secondary polish like
        // invite claiming, owner report access, or the unread bell count.
        // Kick those off in the background so the cards can render as soon as
        // the core data is ready.
        void loadProfileData();
        void loadAffiliateReportAccess();
        void loadNotificationCount(session.user.id);

        await loadDashboardData(session.user);

        if (!isMounted) {
          return;
        }

        if (notificationPollInterval) {
          clearInterval(notificationPollInterval);
        }

        // Realtime is the primary path, but a light polling fallback keeps the
        // bell accurate if the browser misses a websocket event or resumes from sleep.
        notificationPollInterval = setInterval(() => {
          refreshNotificationsIfVisible();
        }, DASHBOARD_FALLBACK_POLL_MS);
        dashboardPollInterval = setInterval(() => {
          refreshDashboardIfVisible();
        }, DASHBOARD_FALLBACK_POLL_MS);
      } catch {
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

    window.addEventListener("focus", refreshDashboardIfVisible);
    document.addEventListener("visibilitychange", refreshDashboardIfVisible);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        clearDashboardSnapshots();
        router.push("/login");
      }
    });

    return () => {
      isMounted = false;
      if (dashboardReloadTimer) {
        clearTimeout(dashboardReloadTimer);
      }
      if (notificationPollInterval) {
        clearInterval(notificationPollInterval);
      }
      if (dashboardPollInterval) {
        clearInterval(dashboardPollInterval);
      }
      window.removeEventListener("focus", refreshDashboardIfVisible);
      document.removeEventListener("visibilitychange", refreshDashboardIfVisible);
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  useDashboardRoutePrefetch({
    canViewAffiliateReport,
    invitedGroups,
    ownedGroups,
    router,
  });

  if (loading || !dashboardThemeReady) {
    return <DashboardSkeleton />;
  }

  const hasAssignments = recipientNames.length > 0;
  const displayFirstName = getDisplayFirstName(userName);
  const isDarkTheme = dashboardTheme === "midnight";
  const allDashboardGroups = [...ownedGroups, ...invitedGroups];
  const revealMessage = buildDashboardRevealMessage(allDashboardGroups, countdownNow);
  const dashboardShellClass = isDarkTheme
    ? "relative min-h-screen bg-[linear-gradient(180deg,#08111f_0%,#0f172a_38%,#111827_100%)] text-slate-100"
    : "relative min-h-screen bg-[linear-gradient(180deg,#edf6ff_0%,#f8fbff_45%,#eef5ff_100%)] text-slate-900";
  const handleOpenGroup = (groupId: string) => {
    router.push(`/group/${groupId}`);
  };

  return (
    <main className={dashboardShellClass}>
      {showProfileSetup && (
        <ProfileSetupModal
          defaultName={userName}
          onComplete={() => setShowProfileSetup(false)}
          onSkip={() => setShowProfileSetup(false)}
        />
      )}

      <DashboardBackdrop isDarkTheme={isDarkTheme} />

      <FadeIn className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <DashboardStatusMessage message={actionMessage} />

        <DashboardPreviewWorkspace
          activityFeedItems={activityFeedItems}
          countdownNow={countdownNow}
          displayFirstName={displayFirstName}
          giftProgressSummary={giftProgressSummary}
          groups={allDashboardGroups}
          hasAssignments={hasAssignments}
          isDarkTheme={isDarkTheme}
          pendingInvites={pendingInvites}
          recipientCount={recipientNames.length}
          revealMessage={revealMessage}
          unreadNotificationCount={unreadNotificationCount}
          wishlistItemCount={wishlistItemCount}
          onCreateGroup={() => router.push("/create-group")}
          onOpenChat={() => router.push("/secret-santa-chat")}
          onOpenGiftProgress={() => router.push("/gift-tracking")}
          onOpenGroup={handleOpenGroup}
          onOpenGroups={() => router.push("/groups")}
          onOpenPath={(path) => router.push(path)}
          onOpenSecretSanta={() => router.push("/secret-santa")}
          onOpenWishlist={() => router.push("/wishlist")}
        />

      </FadeIn>
    </main>
  );
}
