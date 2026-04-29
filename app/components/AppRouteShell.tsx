"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { BellIcon, SantaMarkIcon, UserOutlineIcon } from "@/app/dashboard/dashboard-icons";
import { DashboardNotificationsPanel } from "@/app/dashboard/DashboardNotificationsPanel";
import { AppShellIcon, type AppNavIcon } from "@/app/components/AppShellIcons";
import {
  clearAffiliateReportAccess,
  fetchAffiliateReportAccess,
} from "@/app/components/affiliate-report-access-client";
import {
  useSupabaseRealtimeRefresh,
  type RealtimeRefreshRule,
} from "@/lib/supabase/realtime-refresh";
import {
  addViewerProfileChangedListener,
  applyViewerProfileChangedEvent,
  getEmailViewerName,
  normalizeViewerAvatarEmoji,
  normalizeViewerAvatarUrl,
  normalizeViewerName,
  readStoredViewerProfile,
  storeViewerAvatarEmoji,
  storeViewerAvatarUrl,
  storeViewerName,
} from "@/app/components/viewer-profile-client";
import { getProfile } from "@/app/profile/actions";

const APP_BACKGROUND =
  "repeating-linear-gradient(135deg,rgba(72,102,78,.045) 0 1px,transparent 1px 38px),radial-gradient(circle at 12% 8%,rgba(252,206,114,.16),transparent 24%),linear-gradient(180deg,#fffefa 0%,#f7faf5 42%,#eef4ef 100%)";
const PAGE_TEXT_COLOR = "#2e3432";
const HOLIDAY_GREEN = "#48664e";
const HOLIDAY_RED = "#a43c3f";
const TEXT_MUTED = "#64748b";

type AppNavItem = {
  href: string;
  icon: AppNavIcon;
  label: string;
  match: (pathname: string, hash: string) => boolean;
};

const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/create-account",
  "/forgot-password",
  "/reset-password",
  "/invite",
  "/privacy",
  "/cool-app",
] as const;

function shouldUseAppShell(pathname: string) {
  if (
    pathname === "/" ||
    pathname === "/secret-santa" ||
    pathname === "/my-giftee" ||
    pathname === "/assignments" ||
    pathname === "/gift-tracking"
  ) {
    return false;
  }

  return !PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function createNavItems(pathname: string, canViewAffiliateReport: boolean): AppNavItem[] {
  const navItems: AppNavItem[] = [
    {
      href: "/dashboard",
      icon: "dashboard",
      label: "Dashboard",
      match: (path) => path === "/dashboard",
    },
    {
      href: "/groups",
      icon: "group",
      label: "My Groups",
      match: (path) =>
        path === "/groups" || (path.startsWith("/group/") && !path.endsWith("/reveal")),
    },
    {
      href: "/my-giftee",
      icon: "giftee",
      label: "My Giftee",
      match: (path) => path === "/my-giftee",
    },
    {
      href: "/wishlist",
      icon: "wishlist",
      label: "Wishlist",
      match: (path) => path === "/wishlist",
    },
    {
      href: pathname.startsWith("/group/")
        ? `${pathname.split("/reveal")[0]}/reveal`
        : "/assignments",
      icon: "assignments",
      label: "Assignments",
      match: (path) => path === "/assignments" || path.endsWith("/reveal"),
    },
    {
      href: "/secret-santa-chat",
      icon: "messages",
      label: "Messages",
      match: (path) => path === "/secret-santa-chat",
    },
    {
      href: "/secret-santa",
      icon: "shopping",
      label: "Shopping Ideas",
      match: (path) => path === "/secret-santa",
    },
    {
      href: "/gift-tracking",
      icon: "tracking",
      label: "Gift Tracking",
      match: (path) => path === "/gift-tracking",
    },
    ...(canViewAffiliateReport
      ? [
          {
            href: "/dashboard/affiliate-report",
            icon: "report" as const,
            label: "Affiliate Report",
            match: (path: string) => path === "/dashboard/affiliate-report",
          },
        ]
      : []),
    {
      href: "/profile#reminder-settings",
      icon: "reminders",
      label: "Reminders",
      match: (path) => path === "/profile",
    },
  ];

  return navItems;
}

export default function AppRouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [currentHash, setCurrentHash] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [viewerAvatarUrl, setViewerAvatarUrl] = useState("");
  const [viewerAvatarEmoji, setViewerAvatarEmoji] = useState("");
  const [shellUserId, setShellUserId] = useState<string | null>(null);
  const [canViewAffiliateReport, setCanViewAffiliateReport] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const loadedShellContextForUserRef = useRef<string | null>(null);
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!shouldUseAppShell(pathname)) {
      return;
    }

    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();

    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, [pathname]);

  const loadShellUnreadCount = useCallback(
    async (userId: string) => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);

      if (!error) {
        setUnreadCount(count || 0);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!shouldUseAppShell(pathname)) {
      return;
    }

    let isMounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const sessionUser = data.session?.user || null;
      const userId = sessionUser?.id || null;
      const emailName = getEmailViewerName(sessionUser?.email);
      const storedViewerProfile = readStoredViewerProfile();
      setShellUserId(userId);

      if (storedViewerProfile.displayName) {
        setViewerName(storedViewerProfile.displayName);
      }

      if (storedViewerProfile.avatarUrl) {
        setViewerAvatarUrl(storedViewerProfile.avatarUrl);
      }

      if (storedViewerProfile.avatarEmoji) {
        setViewerAvatarEmoji(storedViewerProfile.avatarEmoji);
      }

      if (!userId || loadedShellContextForUserRef.current === userId) {
        return;
      }

      void loadShellUnreadCount(userId);
      loadedShellContextForUserRef.current = userId;

      void getProfile()
        .then((profile) => {
          if (!isMounted || loadedShellContextForUserRef.current !== userId) {
            return;
          }

          const profileName = normalizeViewerName(profile?.display_name);
          const resolvedName = profileName || storedViewerProfile.displayName || emailName;
          const resolvedAvatarUrl = normalizeViewerAvatarUrl(profile?.avatar_url);
          const resolvedAvatarEmoji = normalizeViewerAvatarEmoji(profile?.avatar_emoji);

          if (resolvedName) {
            setViewerName(resolvedName);
            storeViewerName(resolvedName);
          }

          setViewerAvatarUrl(resolvedAvatarUrl);
          storeViewerAvatarUrl(resolvedAvatarUrl || null);
          setViewerAvatarEmoji(resolvedAvatarEmoji);
          storeViewerAvatarEmoji(resolvedAvatarEmoji || null);
        })
        .catch(() => {
          // The shell can keep the cached/email name if the profile action is temporarily unavailable.
        });

      void fetchAffiliateReportAccess()
        .then((allowed) => {
          if (!isMounted) {
            return;
          }

          setCanViewAffiliateReport(allowed);
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }

          if (loadedShellContextForUserRef.current === userId) {
            loadedShellContextForUserRef.current = null;
          }
          clearAffiliateReportAccess();
          setCanViewAffiliateReport(false);
        });
    });

    return () => {
      isMounted = false;
    };
  }, [loadShellUnreadCount, pathname, supabase]);

  const shellProfileRealtimeRules = useMemo<readonly RealtimeRefreshRule[]>(() => {
    if (!shellUserId) {
      return [];
    }

    return [
      {
        table: "profiles",
        filter: `user_id=eq.${shellUserId}`,
      },
    ];
  }, [shellUserId]);

  useSupabaseRealtimeRefresh({
    channelName: shellUserId ? `app-shell-profile-${shellUserId}` : "app-shell-profile-disabled",
    enabled: shouldUseAppShell(pathname) && Boolean(shellUserId),
    onRefresh: () => {
      void getProfile()
        .then((profile) => {
          const profileName = normalizeViewerName(profile?.display_name);
          const resolvedAvatarUrl = normalizeViewerAvatarUrl(profile?.avatar_url);
          const resolvedAvatarEmoji = normalizeViewerAvatarEmoji(profile?.avatar_emoji);

          if (profileName) {
            setViewerName(profileName);
            storeViewerName(profileName);
          }

          setViewerAvatarUrl(resolvedAvatarUrl);
          storeViewerAvatarUrl(resolvedAvatarUrl || null);
          setViewerAvatarEmoji(resolvedAvatarEmoji);
          storeViewerAvatarEmoji(resolvedAvatarEmoji || null);
        })
        .catch(() => {
          // Keep the cached shell profile if the background refresh is unavailable.
        });
    },
    pollMs: 60000,
    rules: shellProfileRealtimeRules,
    supabase,
  });

  const shellNotificationsRealtimeRules = useMemo<readonly RealtimeRefreshRule[]>(() => {
    if (!shellUserId) {
      return [];
    }

    return [
      {
        table: "notifications",
        filter: `user_id=eq.${shellUserId}`,
      },
    ];
  }, [shellUserId]);

  useSupabaseRealtimeRefresh({
    channelName: shellUserId
      ? `app-shell-notifications-${shellUserId}`
      : "app-shell-notifications-disabled",
    enabled: shouldUseAppShell(pathname) && Boolean(shellUserId),
    onRefresh: () => {
      if (shellUserId) {
        void loadShellUnreadCount(shellUserId);
      }
    },
    pollMs: 30000,
    rules: shellNotificationsRealtimeRules,
    supabase,
  });

  useEffect(() => {
    if (!shouldUseAppShell(pathname)) {
      return;
    }

    const handleViewerProfileChanged = (event: Event) => {
      applyViewerProfileChangedEvent(event, {
        setViewerAvatarEmoji,
        setViewerAvatarUrl,
        setViewerName,
      });
    };

    return addViewerProfileChangedListener(handleViewerProfileChanged);
  }, [pathname]);

  useEffect(() => {
    if (!shouldUseAppShell(pathname)) {
      return;
    }

    for (const route of [
      "/dashboard",
      "/groups",
      "/my-giftee",
      "/wishlist",
      "/assignments",
      "/secret-santa",
      "/gift-tracking",
      "/secret-santa-chat",
      "/notifications",
      "/profile",
      "/create-group",
      "/dashboard/affiliate-report",
    ]) {
      if (!prefetchedRoutesRef.current.has(route)) {
        prefetchedRoutesRef.current.add(route);
        router.prefetch(route);
      }
    }

    const pathParts = pathname.split("/").filter(Boolean);
    const activeGroupId = pathParts[0] === "group" ? pathParts[1] : null;

    if (activeGroupId) {
      for (const route of [`/group/${activeGroupId}`, `/group/${activeGroupId}/reveal`]) {
        if (!prefetchedRoutesRef.current.has(route)) {
          prefetchedRoutesRef.current.add(route);
          router.prefetch(route);
        }
      }
    }
  }, [pathname, router]);

  if (!shouldUseAppShell(pathname)) {
    return <>{children}</>;
  }

  const navItems = createNavItems(pathname, canViewAffiliateReport);
  const displayViewerName = normalizeViewerName(viewerName);
  const profileInitial = displayViewerName.slice(0, 1).toUpperCase() || "?";
  const fallbackAvatar = viewerAvatarEmoji || profileInitial;
  const fallbackAvatarIsEmoji = Boolean(viewerAvatarEmoji);
  const greetingText = displayViewerName
    ? `${getTimeOfDayGreeting()}, ${displayViewerName}`
    : getTimeOfDayGreeting();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleNavItemClick = (item: AppNavItem) => {
    if (!item.href.includes("#")) {
      setCurrentHash("");
    }
  };

  return (
    <div
      data-testid="app-route-shell"
      className="relative min-h-screen overflow-x-clip"
      style={{ background: APP_BACKGROUND, color: PAGE_TEXT_COLOR, fontFamily: "'Be Vietnam Pro','Nunito',sans-serif" }}
    >
      <style>{`
        [data-app-shell-content] > main {
          min-height: calc(100vh - 84px) !important;
          background: transparent !important;
          overflow: visible !important;
        }
        [data-app-shell-content] > main > header {
          display: none !important;
        }
        [data-app-shell-content] > main > [class*="absolute"][class*="inset-0"],
        [data-app-shell-content] > main > [class*="fixed"][class*="inset-0"] {
          display: none !important;
        }
      `}</style>
      <aside
        data-testid="app-shell-sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col border-r px-5 py-5 xl:flex"
        style={{
          background: "repeating-linear-gradient(135deg,rgba(72,102,78,.045) 0 1px,transparent 1px 38px),linear-gradient(180deg,rgba(255,254,250,.985),rgba(247,250,245,.965))",
          borderColor: "rgba(72,102,78,.16)",
          boxShadow: "18px 0 48px rgba(46,52,50,.07)",
        }}
      >
        <Link href="/dashboard" className="flex items-center gap-3 rounded-[22px] px-2 py-2" style={{ color: HOLIDAY_GREEN, textDecoration: "none" }}>
          <span className="flex h-12 w-12 items-center justify-center rounded-[17px] bg-white/80 ring-1 ring-[rgba(72,102,78,.16)] shadow-[0_12px_24px_rgba(46,52,50,.06)]">
            <SantaMarkIcon size={42} />
          </span>
          <span className="min-w-0">
            <span className="block text-[24px] font-black leading-none" style={{ fontFamily: "'Fredoka','Nunito',sans-serif" }}>Secret Santa</span>
            <span className="mt-0.5 block text-[10px] font-extrabold italic text-[#a43c3f]">shhh, it&apos;s a secret</span>
          </span>
        </Link>

        <nav aria-label="Main app navigation" className="mt-9 space-y-2">
          {navItems.map((item) => {
            const active = item.match(pathname, currentHash);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => handleNavItemClick(item)}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[46px] items-center gap-3 rounded-[12px] px-3 text-[14px] font-extrabold transition hover:-translate-y-0.5"
                style={{
                  background: active ? "rgba(72,102,78,.12)" : "transparent",
                  color: active ? HOLIDAY_GREEN : PAGE_TEXT_COLOR,
                  textDecoration: "none",
                  boxShadow: active ? "inset 0 0 0 1px rgba(72,102,78,.08)" : "none",
                }}
              >
                <AppShellIcon name={item.icon} className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[24px] p-4" style={{ background: "rgba(255,255,255,.72)", border: "1px solid rgba(72,102,78,.14)" }}>
          <div className="text-[15px] font-black" style={{ color: HOLIDAY_GREEN }}>Share the magic</div>
          <p className="mt-2 text-[12px] font-semibold leading-relaxed" style={{ color: TEXT_MUTED }}>
            Invite friends, add wishlists, and keep the exchange moving from one place.
          </p>
          <Link href="/create-group" className="mt-4 inline-flex rounded-full px-4 py-2 text-[12px] font-extrabold" style={{ border: "1px solid rgba(72,102,78,.28)", color: HOLIDAY_GREEN, textDecoration: "none" }}>
            Create group
          </Link>
        </div>
      </aside>

      <div className="relative z-10 min-h-screen xl:pl-[17.5rem]">
        <header className="sticky top-0 z-20 hidden h-[84px] items-center justify-between border-b px-7 xl:flex" style={{ background: "linear-gradient(180deg,rgba(255,254,250,.96),rgba(255,254,250,.9))", borderColor: "rgba(72,102,78,.14)", backdropFilter: "blur(16px)" }}>
          <div>
            <div className="flex items-center gap-2 text-[16px] font-black" style={{ color: PAGE_TEXT_COLOR }}>
              <span data-testid="app-shell-greeting">{greetingText}</span>
            </div>
            <div className="mt-0.5 text-[12px] font-semibold" style={{ color: TEXT_MUTED }}>
              Your group tools stay in one place.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button ref={notificationButtonRef} type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : "Open notifications"} className="relative flex h-12 w-12 items-center justify-center rounded-full transition hover:-translate-y-0.5" style={{ background: "rgba(255,255,255,.82)", border: "1px solid rgba(72,102,78,.16)", color: PAGE_TEXT_COLOR }}>
              <BellIcon className="h-5 w-5" />
              {unreadCount > 0 && <span data-testid="app-shell-notification-badge" className="pointer-events-none absolute -right-2 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1.5 text-[9px] font-black leading-none text-white shadow-[0_6px_14px_rgba(164,60,63,.24)]" style={{ background: HOLIDAY_RED }}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>
            <div className="relative">
              <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Open profile menu" className="flex items-center gap-3 rounded-full py-1.5 pl-2 pr-4 transition hover:-translate-y-0.5" style={{ background: "rgba(255,255,255,.78)", border: "1px solid rgba(72,102,78,.12)", color: PAGE_TEXT_COLOR, boxShadow: "0 12px 26px rgba(46,52,50,.06)" }}>
                <span
                  data-testid="app-shell-viewer-avatar"
                  className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full ${
                    fallbackAvatarIsEmoji && !viewerAvatarUrl
                      ? "text-[24px]"
                      : "text-[15px] font-black text-white"
                  }`}
                  style={{
                    background:
                      fallbackAvatarIsEmoji && !viewerAvatarUrl
                        ? "linear-gradient(135deg,#fff7ed,#fee2e2)"
                        : "linear-gradient(135deg,#48664e,#2e3432)",
                  }}
                >
                  {viewerAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={viewerAvatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() => {
                        setViewerAvatarUrl("");
                        storeViewerAvatarUrl(null);
                      }}
                    />
                  ) : (
                    fallbackAvatar
                  )}
                </span>
                <span className="hidden min-w-0 lg:block">
                  <span data-testid="app-shell-viewer-name" className="block text-[13px] font-black leading-tight">{displayViewerName || "Profile"}</span>
                  <span className="block text-[11px] font-semibold" style={{ color: TEXT_MUTED }}>View profile</span>
                </span>
                <UserOutlineIcon className="hidden h-4 w-4 lg:block" />
              </button>
              {profileOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-48 rounded-[18px] bg-white p-2 shadow-[0_18px_42px_rgba(46,52,50,.16)] ring-1 ring-[rgba(72,102,78,.12)]">
                  <Link role="menuitem" href="/profile" onClick={() => setProfileOpen(false)} className="block rounded-[12px] px-3 py-2 text-[13px] font-extrabold" style={{ color: PAGE_TEXT_COLOR, textDecoration: "none" }}>Profile settings</Link>
                  <button type="button" role="menuitem" onClick={() => void handleLogout()} className="mt-1 block w-full rounded-[12px] px-3 py-2 text-left text-[13px] font-extrabold text-[#a43c3f]">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <DashboardNotificationsPanel
          anchorRef={notificationButtonRef}
          isDarkTheme={false}
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onUnreadCountChange={setUnreadCount}
        />
        <div data-app-shell-content className="mx-auto w-full max-w-[94rem] px-4 py-4 sm:px-6 sm:py-6 xl:px-7 xl:py-3">
          {children}
        </div>
      </div>
    </div>
  );
}
