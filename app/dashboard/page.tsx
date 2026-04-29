"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getProfile } from "@/app/profile/actions";
import { claimInvitedMemberships } from "./actions";
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
import { DashboardActivitySection } from "./DashboardActivitySection";
import { DashboardBackdrop } from "./DashboardBackdrop";
import { DashboardGroupsOverview } from "./DashboardGroupsOverview";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardHero } from "./DashboardHero";
import { DashboardInvitesSection } from "./DashboardInvitesSection";
import { DashboardNotificationsPanel } from "./DashboardNotificationsPanel";
import { DashboardProfileMenu } from "./DashboardProfileMenu";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardStatusMessage } from "./DashboardStatusMessage";
import { useDashboardProfileMenu } from "./useDashboardProfileMenu";
import { useDashboardRoutePrefetch } from "./useDashboardRoutePrefetch";
import {
  clearDashboardSnapshots,
  readDashboardSnapshot,
  sanitizeGroupsForDashboardSnapshot,
  writeDashboardSnapshot,
} from "./dashboard-snapshot";
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

export default function DashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [canViewAffiliateReport, setCanViewAffiliateReport] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("ss_ara") === "1"
  );
  const [userName, setUserName] = useState(
    () => (typeof sessionStorage !== "undefined" ? (sessionStorage.getItem("ss_un") ?? "") : "")
  );
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [recipientNames, setRecipientNames] = useState<string[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [wishlistItemCount, setWishlistItemCount] = useState(0);
  const [wishlistGroupCount, setWishlistGroupCount] = useState(0);
  const [giftProgressSummary, setGiftProgressSummary] = useState<GiftProgressSummary | null>(null);
  const [activityFeedItems, setActivityFeedItems] = useState<DashboardActivityItem[]>([]);
  const [notificationPreviewItems, setNotificationPreviewItems] = useState<
    DashboardNotificationPreviewItem[]
  >([]);
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(() => {
    if (typeof window === "undefined") {
      return "default";
    }

    return localStorage.getItem("ss_dashboard_theme") === "midnight" ? "midnight" : "default";
  });
  const [loading, setLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const {
    closeProfileMenu,
    profileMenuOpen,
    profileMenuPanelRef,
    profileMenuPosition,
    profileMenuRef,
    toggleProfileMenu,
  } = useDashboardProfileMenu();
  const loadDashboardDataRef = useRef<
    ((user: { id: string; email?: string | null }) => Promise<void>) | null
  >(null);
  const loadProfileDataRef = useRef<(() => Promise<void>) | null>(null);
  const loadNotificationCountRef = useRef<((userId: string) => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (dashboardTheme !== "default") {
      localStorage.setItem("ss_dashboard_theme", "default");
      setDashboardTheme("default");
      return;
    }

    localStorage.setItem("ss_dashboard_theme", dashboardTheme);
  }, [dashboardTheme]);

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
    let profileReloadTimer: ReturnType<typeof setTimeout> | null = null;
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

      setUserName(savedUserName || snapshot.userName);
      setOwnedGroups(snapshot.ownedGroups);
      setInvitedGroups(snapshot.invitedGroups);
      setPendingInvites(snapshot.pendingInvites);
      setRecipientNames(snapshot.recipientNames);
      setUnreadNotificationCount(snapshot.unreadNotificationCount);
      setWishlistItemCount(snapshot.wishlistItemCount);
      setWishlistGroupCount(snapshot.wishlistGroupCount);
      setGiftProgressSummary(snapshot.giftProgressSummary);
      setActivityFeedItems(snapshot.activityFeedItems);
      setNotificationPreviewItems(snapshot.notificationPreviewItems);
      setLoading(false);
    };

    const loadDashboardPeerProfiles = async (
      groups: Group[],
      loadVersion: number
    ) => {
      if (groups.length === 0) {
        return;
      }

      const enhancedGroups = await enhanceDashboardGroupsWithPeerProfiles(supabase, groups);
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
          setWishlistGroupCount(0);
          setGiftProgressSummary(null);
          setActivityFeedItems([]);
          setNotificationPreviewItems([]);
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
        const allMembers = membersRes.data || [];
        const allAssignments = assignmentsRes.data || [];
        const myAssignments = myAssignRes.data || [];
        const pendingGroups = pendingRes.data || [];
        const wishlistSummary = (wishlistSummaryRes.data || []) as WishlistSummaryRow[];
        const recentNotifications =
          (activityNotificationsRes.data || []) as NotificationFeedRow[];
        const drawnGroupIds = new Set(allAssignments.map((assignment) => assignment.group_id));

        const groupsWithMembers: Group[] = groupsData.map((group) => {
          return {
            ...group,
            isOwner: roleMap[group.id] === "owner",
            hasDrawn: drawnGroupIds.has(group.id),
            members: allMembers
              .filter((member) => member.group_id === group.id)
              .map((member) => ({
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
        const groupNameById = new Map(groupsData.map((group) => [group.id, group.name]));

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
        setWishlistGroupCount(nextWishlistGroupCount);
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
          ...recentNotifications.map((notification) => {
            const visual = getActivityFeedVisual(notification.type);

            return {
              id: notification.id,
              title: notification.title,
              subtitle: notification.body || "Open the notification center for details.",
              createdAt: notification.created_at,
              href: notification.link_path,
              ...visual,
            };
          }),
        ]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        const nextNotificationPreviewItems = recentNotifications.slice(0, 3).map((notification) => {
          const visual = getActivityFeedVisual(notification.type);

          return {
            id: notification.id,
            title: getNotificationPreviewTitle(notification.type, notification.title),
            href: notification.link_path,
            createdAt: notification.created_at,
            ...visual,
          };
        });
        const nextPendingInvites = pendingGroups.map((group) => ({
          group_id: group.id,
          group_name: group.name,
          group_description: group.description || "",
          group_event_date: group.event_date,
          require_anonymous_nickname: Boolean(group.require_anonymous_nickname),
        }));

        setActivityFeedItems(feedItems);
        setNotificationPreviewItems(nextNotificationPreviewItems);
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
        setShowProfileSetup(!profileData.profile_setup_complete);
        setUserName(resolvedName);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("ss_un", resolvedName);
        }
      }
    };

    loadProfileDataRef.current = loadProfileData;

    const loadNotificationCount = async (targetUserId: string) => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", targetUserId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!isMounted) {
        return;
      }

      if (error) {
        return;
      }

      setUnreadNotificationCount((data || []).length);
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

        const email = (session.user.email || "guest@example.com").toLowerCase();
        const defaultName = email.split("@")[0];

        if (!isMounted) {
          return;
        }

        setUserName((current) => current || defaultName);

        const cachedDashboard = readDashboardSnapshot(session.user.id);

        if (cachedDashboard) {
          applyDashboardSnapshot(cachedDashboard);
        }

        // claimInvitedMemberships only needs to run once per browser session.
        // Email-linked invites don't change between visits; realtime will trigger
        // a data reload automatically when a brand-new invite arrives.
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
        }, 30000);
        dashboardPollInterval = setInterval(() => {
          refreshDashboardIfVisible();
        }, 60000);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          const changedUserId =
            (payload.new as { user_id?: string } | null)?.user_id ||
            (payload.old as { user_id?: string } | null)?.user_id;

          if (sessionUser && changedUserId === sessionUser.id) {
            scheduleNotificationsReload();
            scheduleDashboardReload();
          }
        }
      )
      .subscribe();

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
      if (profileReloadTimer) {
        clearTimeout(profileReloadTimer);
      }
      if (notificationPollInterval) {
        clearInterval(notificationPollInterval);
      }
      if (dashboardPollInterval) {
        clearInterval(dashboardPollInterval);
      }
      window.removeEventListener("focus", refreshDashboardIfVisible);
      document.removeEventListener("visibilitychange", refreshDashboardIfVisible);
      void supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  useDashboardRoutePrefetch({
    canViewAffiliateReport,
    invitedGroups,
    ownedGroups,
    router,
  });

  const handleLogout = async () => {
    clearDashboardSnapshots();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const hasAssignments = recipientNames.length > 0;
  const displayFirstName = getDisplayFirstName(userName);
  // The shared authenticated shell owns the dashboard backdrop, so keep dashboard text in
  // the light palette even if a browser still has the retired midnight preference stored.
  const isDarkTheme = false;
  const allDashboardGroups = [...ownedGroups, ...invitedGroups];
  const revealMessage = buildDashboardRevealMessage(allDashboardGroups, countdownNow);
  const dashboardShellClass = isDarkTheme
    ? "relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#08111f_0%,#0f172a_38%,#111827_100%)] text-slate-100"
    : "relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#edf6ff_0%,#f8fbff_45%,#eef5ff_100%)] text-slate-900";
  const handleOpenGroup = (groupId: string) => {
    router.push(`/group/${groupId}`);
  };
  const openNotificationsPanel = () => {
    closeProfileMenu();
    setNotificationsPanelOpen(true);
  };
  const toggleNotificationsPanel = () => {
    closeProfileMenu();
    setNotificationsPanelOpen((current) => !current);
  };
  const toggleProfilePanel = () => {
    setNotificationsPanelOpen(false);
    toggleProfileMenu();
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
      {profileMenuOpen && (
        <DashboardProfileMenu
          isDarkTheme={isDarkTheme}
          menuRef={profileMenuPanelRef}
          position={profileMenuPosition}
          onClose={closeProfileMenu}
          onGoProfile={() => router.push("/profile")}
          onLogout={() => void handleLogout()}
        />
      )}
      <DashboardNotificationsPanel
        anchorRef={notificationButtonRef}
        isDarkTheme={isDarkTheme}
        open={notificationsPanelOpen}
        onClose={() => setNotificationsPanelOpen(false)}
        onUnreadCountChange={setUnreadNotificationCount}
      />

      <DashboardHeader
        isDarkTheme={isDarkTheme}
        notificationButtonRef={notificationButtonRef}
        notificationsPanelOpen={notificationsPanelOpen}
        profileMenuOpen={profileMenuOpen}
        profileMenuRef={profileMenuRef}
        unreadNotificationCount={unreadNotificationCount}
        onGoDashboard={() => router.push("/dashboard")}
        onGoWishlist={() => router.push("/wishlist")}
        onScrollToActivity={() => document.getElementById("dashboard-activity")?.scrollIntoView({ behavior: "smooth" })}
        onScrollToGroups={() => document.getElementById("dashboard-groups")?.scrollIntoView({ behavior: "smooth" })}
        onToggleNotifications={toggleNotificationsPanel}
        onToggleProfileMenu={toggleProfilePanel}
        onToggleTheme={() => setDashboardTheme((current) => (current === "midnight" ? "default" : "midnight"))}
      />

      <FadeIn className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <DashboardStatusMessage message={actionMessage} />

        <DashboardHero
          displayFirstName={displayFirstName}
          isDarkTheme={isDarkTheme}
          revealMessage={revealMessage}
        />

        <DashboardInvitesSection pendingInvites={pendingInvites} />

        <DashboardQuickActions
          hasAssignments={hasAssignments}
          isDarkTheme={isDarkTheme}
          onCreateGroup={() => router.push("/create-group")}
          onOpenChat={() => router.push("/secret-santa-chat")}
          onOpenSecretSanta={() => router.push("/secret-santa")}
        />

        <section data-fade className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-12">
            <DashboardGroupsOverview
              countdownNow={countdownNow}
              invitedGroups={invitedGroups}
              isDarkTheme={isDarkTheme}
              ownedGroups={ownedGroups}
              onCreateGroup={() => router.push("/create-group")}
              onOpenGroup={handleOpenGroup}
              onOpenGroups={() => router.push("/groups")}
            />

            <DashboardActivitySection
              activityFeedItems={activityFeedItems}
              isDarkTheme={isDarkTheme}
              onOpenPath={(path) => router.push(path)}
            />
          </div>

          <DashboardSidebar
            giftProgressSummary={giftProgressSummary}
            isDarkTheme={isDarkTheme}
            notificationPreviewItems={notificationPreviewItems}
            unreadNotificationCount={unreadNotificationCount}
            wishlistGroupCount={wishlistGroupCount}
            wishlistItemCount={wishlistItemCount}
            onGoNotifications={openNotificationsPanel}
            onGoSecretSanta={() => router.push("/secret-santa")}
            onGoWishlist={() => router.push("/wishlist")}
            onOpenPath={(path) => router.push(path)}
          />
        </section>

      </FadeIn>
    </main>
  );
}
