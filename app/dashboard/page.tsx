"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InviteCard from "./InviteCard";
import SecretSantaCard from "./SecretSantaCard";
import ProfileSetupModal from "./ProfileSetupModal";
import { getProfile } from "@/app/profile/actions";
import { claimInvitedMemberships } from "./actions";
import { deleteGroup } from "@/app/group/[id]/actions";
import { DashboardSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";

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
  budget: number | null;
  currency: string | null;
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

type ActionMessage = {
  type: "success" | "error";
  text: string;
} | null;

type GroupRow = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  budget: number | null;
  currency: string | null;
  owner_id: string;
  created_at: string;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string | null;
  nickname: string;
  email: string;
  role: string;
};

type MembershipRow = {
  id: string;
  group_id: string;
  status: string;
  role: string;
};

type AssignmentRow = {
  group_id: string;
};

type MyAssignmentRow = {
  group_id: string;
  receiver_id: string;
};

type PendingGroupRow = {
  id: string;
  name: string;
  description: string;
  event_date: string;
};

function createGroupUserKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
}

function createEmptyQueryResult<T>(data: T[] = []): Promise<{ data: T[]; error: null }> {
  return Promise.resolve({ data, error: null });
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: "A$",
  CAD: "C$",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  PHP: "PHP",
  USD: "$",
};

function formatDashboardDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDashboardBudget(budget: number | null, currency: string | null): string | null {
  if (budget === null) {
    return null;
  }

  const code = (currency || "PHP").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] || code;
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });

  if (code === "PHP") {
    return `P ${formatter.format(budget)}`;
  }

  return `${symbol} ${formatter.format(budget)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userName, setUserName] = useState("");
  const [userEmoji, setUserEmoji] = useState("ðŸŽ…");
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [recipientNames, setRecipientNames] = useState<string[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const loadDashboardDataRef = useRef<
    ((user: { id: string; email?: string | null }) => Promise<void>) | null
  >(null);
  const loadProfileDataRef = useRef<(() => Promise<void>) | null>(null);
  const loadNotificationCountRef = useRef<((userId: string) => Promise<void>) | null>(null);

  useEffect(() => {
    let isMounted = true;
    let dashboardReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let profileReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let notificationPollInterval: ReturnType<typeof setInterval> | null = null;
    let sessionUser:
      | {
          id: string;
          email?: string | null;
        }
      | null = null;

    // Reload the dashboard cards and lists without repeating one-time setup like
    // profile bootstrap or invited-membership claiming on every realtime event.
    const loadDashboardData = async (user: { id: string; email?: string | null }) => {
      try {
        const email = (user.email || "guest@example.com").toLowerCase();

        const [membersByUserRes, membersByEmailRes] = await Promise.all([
          supabase
            .from("group_members")
            .select("id, group_id, status, role")
            .eq("user_id", user.id),
          supabase
            .from("group_members")
            .select("id, group_id, status, role")
            .eq("email", email),
        ]);

        if (membersByUserRes.error) {
          throw membersByUserRes.error;
        }

        if (membersByEmailRes.error) {
          throw membersByEmailRes.error;
        }

        const membershipMap = new Map<string, MembershipRow>();

        for (const row of (membersByUserRes.data || []) as MembershipRow[]) {
          membershipMap.set(row.id, row);
        }

        for (const row of (membersByEmailRes.data || []) as MembershipRow[]) {
          membershipMap.set(row.id, row);
        }

        const memberRows = [...membershipMap.values()];

        if (!isMounted) {
          return;
        }

        if (!memberRows || memberRows.length === 0) {
          setOwnedGroups([]);
          setInvitedGroups([]);
          setPendingInvites([]);
          setRecipientNames([]);
          setLoading(false);
          return;
        }

        const acceptedRows = memberRows.filter((row) => row.status === "accepted");
        const pendingRows = memberRows.filter((row) => row.status === "pending");
        const acceptedGroupIds = [...new Set(acceptedRows.map((row) => row.group_id))];
        const pendingGroupIds = [...new Set(pendingRows.map((row) => row.group_id))];
        const roleMap: Record<string, string> = {};

        for (const row of acceptedRows) {
          roleMap[row.group_id] = row.role;
        }

        const [groupsRes, membersRes, assignmentsRes, myAssignRes, pendingRes] =
          await Promise.all([
            acceptedGroupIds.length > 0
              ? supabase
                  .from("groups")
                  .select("id, name, description, event_date, budget, currency, owner_id, created_at")
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
                  .select("group_id, receiver_id")
                  .eq("giver_id", user.id)
                  .in("group_id", acceptedGroupIds)
              : createEmptyQueryResult<MyAssignmentRow>(),
            pendingGroupIds.length > 0
              ? supabase
                  .from("groups")
                  .select("id, name, description, event_date")
                  .in("id", pendingGroupIds)
              : createEmptyQueryResult<PendingGroupRow>(),
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

        const groupsData = groupsRes.data || [];
        const allMembers = membersRes.data || [];
        const allAssignments = assignmentsRes.data || [];
        const myAssignments = myAssignRes.data || [];
        const pendingGroups = pendingRes.data || [];
        const drawnGroupIds = new Set(allAssignments.map((assignment) => assignment.group_id));

        const groupsWithMembers: Group[] = groupsData.map((group) => ({
          ...group,
          isOwner: roleMap[group.id] === "owner",
          hasDrawn: drawnGroupIds.has(group.id),
          members: allMembers
            .filter((member) => member.group_id === group.id)
            .map((member) => ({
              nickname: member.nickname,
              email: member.email,
              role: member.role,
            })),
        }));

        if (!isMounted) {
          return;
        }

        setOwnedGroups(groupsWithMembers.filter((group) => group.isOwner));
        setInvitedGroups(groupsWithMembers.filter((group) => !group.isOwner));

        const receiverNameByGroupUser = new Map<string, string>();

        for (const member of allMembers) {
          if (!member.user_id) {
            continue;
          }

          receiverNameByGroupUser.set(
            createGroupUserKey(member.group_id, member.user_id),
            member.nickname || "Secret Participant"
          );
        }

        setRecipientNames(
          myAssignments.map((assignment) => {
            return (
              receiverNameByGroupUser.get(
                createGroupUserKey(assignment.group_id, assignment.receiver_id)
              ) || "Secret Participant"
            );
          })
        );

        setPendingInvites(
          pendingGroups.map((group) => ({
            group_id: group.id,
            group_name: group.name,
            group_description: group.description || "",
            group_event_date: group.event_date,
          }))
        );
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

    loadDashboardDataRef.current = loadDashboardData;

    const loadProfileData = async () => {
      const profileData = await getProfile();

      if (!isMounted || !sessionUser) {
        return;
      }

      const defaultName = (sessionUser.email || "guest@example.com").split("@")[0];

      if (profileData) {
        setShowProfileSetup(!profileData.profile_setup_complete);
        setUserName(profileData.display_name || defaultName);
        setUserEmoji(profileData.avatar_emoji || "ðŸŽ…");
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

    const bootstrapDashboard = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        sessionUser = session.user;

        const email = (session.user.email || "guest@example.com").toLowerCase();
        const defaultName = email.split("@")[0];

        if (!isMounted) {
          return;
        }

        setUserName(defaultName);

        await Promise.all([loadProfileData(), claimInvitedMemberships()]);

        if (!isMounted) {
          return;
        }


        await loadDashboardData(session.user);
        await loadNotificationCount(session.user.id);

        if (notificationPollInterval) {
          clearInterval(notificationPollInterval);
        }

        // Realtime is the primary path, but a light polling fallback keeps the
        // bell accurate if the browser misses a websocket event or resumes from sleep.
        notificationPollInterval = setInterval(() => {
          refreshNotificationsIfVisible();
        }, 2500);
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

    window.addEventListener("focus", refreshNotificationsIfVisible);
    document.addEventListener("visibilitychange", refreshNotificationsIfVisible);

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
          }
        }
      )
      .subscribe();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
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
      window.removeEventListener("focus", refreshNotificationsIfVisible);
      document.removeEventListener("visibilitychange", refreshNotificationsIfVisible);
      void supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  useEffect(() => {
    router.prefetch("/notifications");
    router.prefetch("/secret-santa");
    router.prefetch("/secret-santa-chat");
    router.prefetch("/create-group");
    router.prefetch("/profile");

    for (const group of [...ownedGroups, ...invitedGroups]) {
      router.prefetch(`/group/${group.id}`);
    }
  }, [router, ownedGroups, invitedGroups]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Only the owner can delete a group.
  // Requiring the exact group name adds another deliberate confirmation step.
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const confirmed = confirm(
      `Delete "${groupName}"?\n\nThis will permanently remove the group.`
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

  const GroupCard = ({
    group,
    type,
  }: {
    group: Group;
    type: "owned" | "invited";
  }) => {
    const budgetLabel = formatDashboardBudget(group.budget, group.currency);

    return (
      <article className="relative overflow-hidden rounded-[32px] border border-white/75 bg-white/88 p-6 shadow-[0_28px_80px_rgba(148,163,184,0.16)] backdrop-blur-md">
        <div className="absolute inset-y-0 right-0 hidden w-44 bg-[radial-gradient(circle_at_center,rgba(147,197,253,0.28),transparent_70%)] lg:block" />
        <div className="absolute bottom-6 right-10 hidden lg:block">
          <div className="relative h-28 w-28 rounded-full border border-white/70 bg-[linear-gradient(180deg,#d9efff,#f4fbff)] shadow-[0_18px_40px_rgba(148,163,184,0.18)]">
            <div className="absolute left-4 top-6 h-10 w-10 rounded-2xl bg-[linear-gradient(180deg,#60a5fa,#3b82f6)]" />
            <div className="absolute left-[1.65rem] top-6 h-2 w-10 rounded-full bg-white/70" />
            <div className="absolute left-8 top-[1.1rem] h-3 w-3 rounded-full bg-amber-300" />
            <div className="absolute right-5 top-10 h-12 w-12 rounded-2xl bg-[linear-gradient(180deg,#f9a8d4,#fb7185)]" />
            <div className="absolute right-[1.55rem] top-10 h-2 w-12 rounded-full bg-white/70" />
            <div className="absolute right-9 top-[2.25rem] h-3 w-3 rounded-full bg-amber-300" />
            <div className="absolute bottom-3 left-3 h-6 w-6 rounded-full bg-white/90" />
            <div className="absolute bottom-3 left-8 h-8 w-8 rounded-full bg-white/90" />
          </div>
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                type === "owned" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {type === "owned" ? "My group" : "Invited group"}
            </span>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {group.members.length} participants
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                group.hasDrawn ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"
              }`}
            >
              {group.hasDrawn ? "Draw completed" : "Draw pending"}
            </span>
          </div>

          <h3 className="mt-4 text-[1.85rem] font-bold leading-tight text-slate-900">
            {group.name}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {group.description || "A shared Secret Santa group ready for planning, matching, and gifting."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Event date: {formatDashboardDate(group.event_date)}
            </span>
            {budgetLabel && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Budget: {budgetLabel}
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {group.members.slice(0, 4).map((member, index) => (
              <span
                key={`${group.id}-${member.email || member.nickname || index}`}
                className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {member.nickname || member.email || "Participant"}
              </span>
            ))}
            {group.members.length > 4 && (
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                +{group.members.length - 4} more
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/group/${group.id}`)}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5"
            >
              <span>View Group</span>
              <span aria-hidden="true">â†’</span>
            </button>
            {type === "owned" && (
              <button
                type="button"
                onClick={() => void handleDeleteGroup(group.id, group.name)}
                disabled={deletingGroupId === group.id}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  deletingGroupId === group.id
                    ? "cursor-wait bg-rose-100 text-rose-500"
                    : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                }`}
              >
                {deletingGroupId === group.id ? "Deleting..." : "Delete Group"}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const ActionCard = ({
    accent,
    subtitle,
    title,
    description,
    buttonLabel,
    onClick,
    scene,
  }: {
    accent: "green" | "blue";
    subtitle: string;
    title: string;
    description: string;
    buttonLabel: string;
    onClick: () => void;
    scene: ReactNode;
  }) => {
    const theme =
      accent === "green"
        ? {
            body: "bg-[linear-gradient(145deg,#8ee6c6_0%,#56d79b_40%,#3ebf84_100%)]",
            button:
              "bg-[linear-gradient(135deg,#22c55e,#16a34a)] shadow-[0_14px_35px_rgba(34,197,94,0.25)]",
            text: "text-emerald-700",
          }
        : {
            body: "bg-[linear-gradient(145deg,#9ac4ff_0%,#6da6ff_42%,#4f87f7_100%)]",
            button:
              "bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] shadow-[0_14px_35px_rgba(37,99,235,0.25)]",
            text: "text-blue-700",
          };

    return (
      <section className="overflow-hidden rounded-[32px] border border-white/80 bg-white/90 shadow-[0_28px_80px_rgba(148,163,184,0.16)] backdrop-blur-md">
        <div className="px-6 pt-5">
          <div
            className={`inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold ${theme.text}`}
          >
            {subtitle}
          </div>
          <h2 className="mt-3 text-[1.8rem] font-bold text-slate-900">{title}</h2>
        </div>
        <div className={`relative mt-5 px-6 pb-6 pt-6 ${theme.body}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.32),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.18),transparent_35%)]" />
          <div className="relative z-10">
            <p className="max-w-sm text-sm leading-6 text-slate-700">{description}</p>
            <div className="mt-5">{scene}</div>
            <button
              type="button"
              onClick={onClick}
              className={`mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 ${theme.button}`}
            >
              <span>{buttonLabel}</span>
              <span aria-hidden="true">{"->"}</span>
            </button>
          </div>
        </div>
      </section>
    );
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#edf6ff_0%,#f8fbff_45%,#eef5ff_100%)] text-slate-900">
      {showProfileSetup && (
        <ProfileSetupModal
          defaultName={userName}
          onComplete={() => setShowProfileSetup(false)}
          onSkip={() => setShowProfileSetup(false)}
        />
      )}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,180,255,0.26),transparent_25%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(191,219,254,0.35),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-60">
        {[
          "left-[8%] top-[12%]",
          "left-[22%] top-[18%]",
          "left-[70%] top-[15%]",
          "left-[84%] top-[24%]",
          "left-[11%] top-[58%]",
          "left-[60%] top-[66%]",
          "left-[88%] top-[72%]",
        ].map((position) => (
          <span
            key={position}
            className={`absolute ${position} h-3 w-3 rounded-full bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.85)]`}
          />
        ))}
      </div>

      <FadeIn className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {actionMessage && (
          <div
            data-fade
            role="status"
            aria-live="polite"
            className={`mb-6 rounded-[24px] px-4 py-3 text-sm font-semibold ${
              actionMessage.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {actionMessage.text}
          </div>
        )}

        <div data-fade className="mb-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/notifications")}
            className="relative inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_18px_50px_rgba(148,163,184,0.14)] backdrop-blur-md transition hover:-translate-y-0.5"
          >
            <span aria-hidden="true">Bell</span>
            <span>Notifications</span>
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_18px_50px_rgba(148,163,184,0.14)] backdrop-blur-md transition hover:-translate-y-0.5"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(145deg,#eff6ff,#dbeafe)] text-base"
            >
              {userEmoji}
            </span>
            <span>Profile</span>
          </button>
        </div>

        <div data-fade className="mb-10 text-center">
          <div className="mx-auto inline-flex items-center gap-3 rounded-full bg-white/85 px-5 py-2 shadow-[0_18px_50px_rgba(148,163,184,0.15)] backdrop-blur-md">
            <span aria-hidden="true" className="text-2xl">
              Gift
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
              Secret Santa
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-sky-900 sm:text-5xl">
            My Secret Santa
          </h1>
          <p className="mt-3 text-lg font-medium text-slate-600">Welcome back, {userName}</p>
          <p className="mt-2 text-sm text-slate-500">
            Keep your groups, draws, and chats in one festive workspace.
          </p>
        </div>

        {pendingInvites.length > 0 && (
          <section data-fade className="mb-10">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">
                  Invitations
                </p>
                <h2 className="mt-1 text-3xl font-bold text-slate-900">Pending invites</h2>
              </div>
              <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
                {pendingInvites.length} waiting
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pendingInvites.map((invite) => (
                <InviteCard
                  key={invite.group_id}
                  groupId={invite.group_id}
                  groupName={invite.group_name}
                  eventDate={invite.group_event_date}
                  description={invite.group_description}
                />
              ))}
            </div>
          </section>
        )}

        <section data-fade className="mb-10 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.95fr)]">
          <SecretSantaCard recipientNames={recipientNames} />
          <ActionCard
            accent="green"
            subtitle="Secret Santa Chat"
            title="Secret Santa chat"
            description="Chat with your groupmates anonymously, send hints, and keep the guessing game going without spoiling the surprise."
            buttonLabel="Open chat"
            onClick={() => router.push("/secret-santa-chat")}
            scene={
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.16em] text-white/90">
                <span>Hints</span>
                <span>Notes</span>
                <span>Chat</span>
              </div>
            }
          />
          <ActionCard
            accent="blue"
            subtitle="Create Group"
            title="Create group"
            description="Start a new Secret Santa event, invite your friends, and keep the whole draw organized from one shared place."
            buttonLabel="New group"
            onClick={() => router.push("/create-group")}
            scene={
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.16em] text-white/90">
                <span>Plan</span>
                <span>Invite</span>
                <span>Draw</span>
              </div>
            }
          />
        </section>

        <section data-fade className="mb-10">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600">
              Groups
            </p>
            <h2 className="mt-1 text-3xl font-bold text-slate-900">Your groups</h2>
          </div>
          {ownedGroups.length === 0 ? (
            <div className="grid gap-5">
              <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_rgba(148,163,184,0.16)] backdrop-blur-md">
                <div className="absolute bottom-4 right-5 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,#dbeafe,transparent_70%)]" />
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Start here
                </p>
                <h3 className="mt-3 text-2xl font-bold text-slate-900">
                  Don&apos;t have a group yet?
                </h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Create a group and start your Secret Santa planning with a budget, date, and invite list already in place.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/create-group")}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5"
                >
                  <span>Start new group</span>
                  <span aria-hidden="true">{"->"}</span>
                </button>
              </section>
            </div>
          ) : (
            <div className="grid gap-5">
              {ownedGroups.map((group) => (
                <GroupCard key={group.id} group={group} type="owned" />
              ))}
            </div>
          )}
        </section>

        <section data-fade className="mb-10">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Shared with you
            </p>
            <h2 className="mt-1 text-3xl font-bold text-slate-900">Invited groups</h2>
          </div>
          {invitedGroups.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm font-medium text-slate-500">
              Accepted invitations will appear here once you join them.
            </div>
          ) : (
            <div className="grid gap-5">
              {invitedGroups.map((group) => (
                <GroupCard key={group.id} group={group} type="invited" />
              ))}
            </div>
          )}
        </section>

        <section data-fade className="flex flex-wrap items-center justify-center gap-3 rounded-[30px] border border-white/70 bg-white/80 px-6 py-5 shadow-[0_24px_70px_rgba(148,163,184,0.12)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_rgba(148,163,184,0.16)] transition hover:-translate-y-0.5"
          >
            <span>Edit profile</span>
            <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#f59e0b,#f97316)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5"
          >
            <span>Logout</span>
            <span aria-hidden="true">→</span>
          </button>
        </section>

      </FadeIn>
    </main>
  );
}
