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
  readStoredAffiliateReportAccess,
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
import {
  DASHBOARD_THEME_CHANGED_EVENT,
  readStoredDashboardTheme,
  type DashboardTheme,
} from "@/app/components/theme-preferences";
import { getProfile } from "@/app/profile/actions";

const APP_BACKGROUND =
  "repeating-linear-gradient(135deg,rgba(72,102,78,.045) 0 1px,transparent 1px 38px),radial-gradient(circle at 12% 8%,rgba(252,206,114,.16),transparent 24%),linear-gradient(180deg,#fffefa 0%,#f7faf5 42%,#eef4ef 100%)";
const PAGE_TEXT_COLOR = "#2e3432";
const HOLIDAY_GREEN = "#48664e";
const HOLIDAY_RED = "#a43c3f";
const TEXT_MUTED = "#64748b";
const APP_SHELL_FALLBACK_POLL_MS = 5 * 60 * 1000;
const NOTIFICATION_BADGE_COUNT_LIMIT = 100;
const DEFAULT_TIME_OF_DAY_GREETING = "Welcome back";

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
    pathname === "/gift-tracking"
  ) {
    return false;
  }

  return !PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function shouldUseShellProfileRealtime(pathname: string) {
  if (!shouldUseAppShell(pathname)) {
    return false;
  }

  return pathname !== "/dashboard" && pathname !== "/profile";
}

function shouldUseShellNotificationsRealtime(pathname: string) {
  if (!shouldUseAppShell(pathname)) {
    return false;
  }

  return pathname !== "/dashboard" && pathname !== "/notifications";
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function createNavItems(canViewAffiliateReport: boolean): AppNavItem[] {
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
      match: (path) => path === "/my-giftee" || path.endsWith("/reveal"),
    },
    {
      href: "/wishlist",
      icon: "wishlist",
      label: "My Wishlist",
      match: (path) => path === "/wishlist",
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
      label: "Gift Progress",
      match: (path) => path === "/gift-tracking",
    },
    {
      href: "/history",
      icon: "history",
      label: "History",
      match: (path) => path === "/history",
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
      href: "/settings",
      icon: "settings",
      label: "Settings",
      match: (path) => path === "/settings" || path === "/reminders",
    },
  ];

  return navItems;
}

function getShellSubtitle(pathname: string): string {
  if (pathname === "/dashboard") {
    return "A quick view of active groups, gift progress, and updates that need attention.";
  }
  if (pathname === "/groups" || pathname.startsWith("/group/")) {
    return "Active exchanges with members, invites, wishlists, and draw details.";
  }
  if (pathname === "/wishlist") return "Add gift ideas, links, sizes, and notes your Santa can shop from.";
  if (pathname === "/secret-santa-chat") {
    return "Message your giftees as their Santa, or reply to the Santa gifting you.";
  }
  if (pathname === "/notifications") return "Updates from your groups, messages, and gift reminders.";
  if (pathname === "/profile") return "Your photo, avatar, account, and preferences.";
  if (pathname === "/settings" || pathname === "/reminders") {
    return "Display, assistant, and reminder preferences.";
  }
  if (pathname === "/history") return "Past exchanges that have concluded.";
  if (pathname === "/create-group") return "Set up a new Secret Santa exchange.";
  if (pathname === "/dashboard/affiliate-report") return "Owner-only link and report activity.";
  return "Your group tools stay in one place.";
}

export default function AppRouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [currentHash, setCurrentHash] = useState("");
  const [timeOfDayGreeting, setTimeOfDayGreeting] = useState(DEFAULT_TIME_OF_DAY_GREETING);
  const [viewerName, setViewerName] = useState("");
  const [viewerAvatarUrl, setViewerAvatarUrl] = useState("");
  const [viewerAvatarEmoji, setViewerAvatarEmoji] = useState("");
  const [shellUserId, setShellUserId] = useState<string | null>(null);
  const [canViewAffiliateReport, setCanViewAffiliateReport] = useState(false);
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>("default");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const loadedShellContextForUserRef = useRef<string | null>(null);
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const mobileNavScrollerRef = useRef<HTMLDivElement | null>(null);
  const mobileNavActiveItemRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!shouldUseAppShell(pathname)) {
      return;
    }

    const greetingSync = window.setTimeout(() => {
      setTimeOfDayGreeting(getTimeOfDayGreeting());
    }, 0);

    return () => window.clearTimeout(greetingSync);
  }, [pathname]);

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

  useEffect(() => {
    if (!shouldUseAppShell(pathname)) {
      return;
    }

    const syncDashboardTheme = () => setDashboardTheme(readStoredDashboardTheme());
    const syncAffiliateAccess = () =>
      setCanViewAffiliateReport(readStoredAffiliateReportAccess());

    syncDashboardTheme();
    const affiliateAccessSync = window.setTimeout(syncAffiliateAccess, 0);
    window.addEventListener("storage", syncDashboardTheme);
    window.addEventListener(DASHBOARD_THEME_CHANGED_EVENT, syncDashboardTheme);

    return () => {
      window.clearTimeout(affiliateAccessSync);
      window.removeEventListener("storage", syncDashboardTheme);
      window.removeEventListener(DASHBOARD_THEME_CHANGED_EVENT, syncDashboardTheme);
    };
  }, [pathname]);

  const loadShellUnreadCount = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .is("read_at", null)
        .limit(NOTIFICATION_BADGE_COUNT_LIMIT);

      if (!error) {
        setUnreadCount(data?.length || 0);
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
    enabled: shouldUseShellProfileRealtime(pathname) && Boolean(shellUserId),
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
    pollMs: APP_SHELL_FALLBACK_POLL_MS,
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
    enabled: shouldUseShellNotificationsRealtime(pathname) && Boolean(shellUserId),
    onRefresh: () => {
      if (shellUserId) {
        void loadShellUnreadCount(shellUserId);
      }
    },
    pollMs: APP_SHELL_FALLBACK_POLL_MS,
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
      "/secret-santa",
      "/gift-tracking",
      "/history",
      "/secret-santa-chat",
      "/notifications",
      "/profile",
      "/settings",
      "/reminders",
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

  const navItems = createNavItems(canViewAffiliateReport);
  const activeNavLabel = navItems.find((item) => item.match(pathname, currentHash))?.label || "";

  useEffect(() => {
    if (!shouldUseAppShell(pathname)) {
      return;
    }

    const activeItem = mobileNavActiveItemRef.current;
    const scroller = mobileNavScrollerRef.current;

    if (!activeItem || !scroller) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeItem.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeNavLabel, pathname]);

  if (!shouldUseAppShell(pathname)) {
    return <>{children}</>;
  }

  const displayViewerName = normalizeViewerName(viewerName);
  const profileInitial = displayViewerName.slice(0, 1).toUpperCase() || "?";
  const fallbackAvatar = viewerAvatarEmoji || profileInitial;
  const fallbackAvatarIsEmoji = Boolean(viewerAvatarEmoji);
  const greetingText = displayViewerName
    ? `${timeOfDayGreeting}, ${displayViewerName}`
    : timeOfDayGreeting;
  const isDarkAppShell = dashboardTheme === "midnight";
  const shellSubtitle = getShellSubtitle(pathname);
  const shellBackground = isDarkAppShell
    ? "radial-gradient(circle at 14% 0%,rgba(252,206,114,.14),transparent 28%),linear-gradient(180deg,#08111f 0%,#0f172a 44%,#111827 100%)"
    : APP_BACKGROUND;
  const shellTextColor = isDarkAppShell ? "#f8fafc" : PAGE_TEXT_COLOR;
  const shellMutedColor = isDarkAppShell ? "#cbd5e1" : TEXT_MUTED;
  const shellSidebarBackground = isDarkAppShell
    ? "linear-gradient(180deg,rgba(8,17,31,.97),rgba(15,23,42,.95))"
    : "repeating-linear-gradient(135deg,rgba(72,102,78,.045) 0 1px,transparent 1px 38px),linear-gradient(180deg,rgba(255,254,250,.985),rgba(247,250,245,.965))";
  const shellBorderColor = isDarkAppShell ? "rgba(148,163,184,.22)" : "rgba(72,102,78,.16)";
  const shellHeaderBackground = isDarkAppShell
    ? "linear-gradient(180deg,rgba(8,17,31,.92),rgba(15,23,42,.86))"
    : "linear-gradient(180deg,rgba(255,254,250,.96),rgba(255,254,250,.9))";
  const shellNavActiveBackground = isDarkAppShell
    ? "rgba(252,206,114,.16)"
    : "rgba(72,102,78,.12)";
  const shellNavInactiveColor = isDarkAppShell ? "#e2e8f0" : PAGE_TEXT_COLOR;
  const shellNavActiveColor = isDarkAppShell ? "#fffefa" : HOLIDAY_GREEN;
  const shellControlBackground = isDarkAppShell
    ? "rgba(15,23,42,.78)"
    : "rgba(255,255,255,.82)";
  const shellMenuBackground = isDarkAppShell ? "#0f172a" : "#ffffff";

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
      style={{ background: shellBackground, color: shellTextColor, fontFamily: "'Be Vietnam Pro','Nunito',sans-serif" }}
    >
      <style>{`
        [data-app-shell-content] > main {
          min-height: calc(100vh - 84px) !important;
          background: transparent !important;
          overflow: visible !important;
        }
        [data-app-shell-content] > main > header:not([data-app-page-header="true"]) {
          display: none !important;
        }
        [data-app-shell-content] > main > [class*="absolute"][class*="inset-0"]:not([data-app-modal="true"]),
        [data-app-shell-content] > main > [class*="fixed"][class*="inset-0"]:not([data-app-modal="true"]) {
          display: none !important;
        }
        [data-app-shell-mobile-nav-scroller]::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <aside
        data-testid="app-shell-sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-70 flex-col border-r px-5 py-5 xl:flex"
        style={{
          background: shellSidebarBackground,
          borderColor: shellBorderColor,
          boxShadow: isDarkAppShell
            ? "18px 0 48px rgba(0,0,0,.22)"
            : "18px 0 48px rgba(46,52,50,.07)",
        }}
      >
        <Link href="/dashboard" className="flex items-center gap-3 rounded-[22px] px-2 py-2" style={{ color: isDarkAppShell ? "#f8fafc" : HOLIDAY_GREEN, textDecoration: "none" }}>
          <span className="flex h-12 w-12 items-center justify-center rounded-[17px] shadow-[0_12px_24px_rgba(46,52,50,.06)] ring-1" style={{ background: isDarkAppShell ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.8)", borderColor: shellBorderColor }}>
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
                className="flex min-h-11.5 items-center gap-3 rounded-xl px-3 text-[14px] font-extrabold transition hover:-translate-y-0.5"
                style={{
                  background: active ? shellNavActiveBackground : "transparent",
                  color: active ? shellNavActiveColor : shellNavInactiveColor,
                  textDecoration: "none",
                  boxShadow: active ? `inset 0 0 0 1px ${shellBorderColor}` : "none",
                }}
              >
                <AppShellIcon name={item.icon} className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-3xl p-4" style={{ background: isDarkAppShell ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.72)", border: `1px solid ${shellBorderColor}` }}>
          <div className="text-[15px] font-black" style={{ color: isDarkAppShell ? "#fffefa" : HOLIDAY_GREEN }}>Share the magic</div>
          <p className="mt-2 text-[12px] font-semibold leading-relaxed" style={{ color: shellMutedColor }}>
            Invite friends, add wishlists, and keep the exchange moving from one place.
          </p>
          <Link href="/create-group" className="mt-4 inline-flex rounded-full px-4 py-2 text-[12px] font-extrabold" style={{ border: `1px solid ${shellBorderColor}`, color: isDarkAppShell ? "#fde68a" : HOLIDAY_GREEN, textDecoration: "none" }}>
            Create group
          </Link>
        </div>
      </aside>

      <div className="relative z-10 min-h-screen xl:pl-70">
        <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between border-b px-4 py-3 sm:px-6 xl:h-21 xl:px-7 xl:py-0" style={{ background: shellHeaderBackground, borderColor: shellBorderColor, backdropFilter: "blur(16px)" }}>
            <div>
              <div className="flex items-center gap-2 text-[16px] font-black" style={{ color: shellTextColor }}>
                <span data-testid="app-shell-greeting">{greetingText}</span>
              </div>
              <div className="mt-0.5 text-[12px] font-semibold" style={{ color: shellMutedColor }}>
                {shellSubtitle}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button ref={notificationButtonRef} type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : "Open notifications"} className="relative flex h-12 w-12 items-center justify-center rounded-full transition hover:-translate-y-0.5" style={{ background: shellControlBackground, border: `1px solid ${shellBorderColor}`, color: shellTextColor }}>
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 && <span data-testid="app-shell-notification-badge" className="pointer-events-none absolute -right-2 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1.5 text-[9px] font-black leading-none text-white shadow-[0_6px_14px_rgba(164,60,63,.24)]" style={{ background: HOLIDAY_RED }}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
              </button>
              <div className="relative">
                <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Open profile menu" className="flex items-center gap-3 rounded-full py-1.5 pl-2 pr-4 transition hover:-translate-y-0.5" style={{ background: shellControlBackground, border: `1px solid ${shellBorderColor}`, color: shellTextColor, boxShadow: isDarkAppShell ? "0 12px 26px rgba(0,0,0,.18)" : "0 12px 26px rgba(46,52,50,.06)" }}>
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
                    <span className="block text-[11px] font-semibold" style={{ color: shellMutedColor }}>View profile</span>
                  </span>
                  <UserOutlineIcon className="hidden h-4 w-4 lg:block" />
                </button>
                {profileOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-48 rounded-[18px] p-2 shadow-[0_18px_42px_rgba(46,52,50,.16)] ring-1" style={{ background: shellMenuBackground, borderColor: shellBorderColor }}>
                    <Link role="menuitem" href="/profile" onClick={() => setProfileOpen(false)} className="block rounded-xl px-3 py-2 text-[13px] font-extrabold" style={{ color: shellTextColor, textDecoration: "none" }}>Profile settings</Link>
                    <button type="button" role="menuitem" onClick={() => void handleLogout()} className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-[13px] font-extrabold text-[#a43c3f]">
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
        </header>
        <DashboardNotificationsPanel
          anchorRef={notificationButtonRef}
          isDarkTheme={isDarkAppShell}
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onUnreadCountChange={setUnreadCount}
        />
        <nav
          aria-label="Mobile app navigation"
          data-testid="app-shell-mobile-nav"
          className="fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl xl:hidden"
          style={{
            background: isDarkAppShell
              ? "linear-gradient(180deg,rgba(15,23,42,.88),rgba(8,17,31,.96))"
              : "linear-gradient(180deg,rgba(255,254,250,.88),rgba(249,250,248,.97))",
            borderColor: shellBorderColor,
            boxShadow: isDarkAppShell
              ? "0 -18px 44px rgba(0,0,0,.26)"
              : "0 -18px 44px rgba(46,52,50,.08)",
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8"
            style={{
              background: isDarkAppShell
                ? "linear-gradient(90deg,rgba(8,17,31,.96),rgba(8,17,31,0))"
                : "linear-gradient(90deg,rgba(255,254,250,.97),rgba(255,254,250,0))",
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8"
            style={{
              background: isDarkAppShell
                ? "linear-gradient(270deg,rgba(8,17,31,.96),rgba(8,17,31,0))"
                : "linear-gradient(270deg,rgba(255,254,250,.97),rgba(255,254,250,0))",
            }}
          />
          <div
            ref={mobileNavScrollerRef}
            data-app-shell-mobile-nav-scroller=""
            className="relative mx-auto flex max-w-3xl gap-2 overflow-x-auto px-1 pb-0.5"
            style={{
              msOverflowStyle: "none",
              overscrollBehaviorX: "contain",
              scrollbarWidth: "none",
            }}
          >
            {navItems.map((item) => {
              const active = item.match(pathname, currentHash);
              return (
                <Link
                  key={`mobile-${item.label}`}
                  ref={active ? mobileNavActiveItemRef : undefined}
                  href={item.href}
                  onClick={() => handleNavItemClick(item)}
                  aria-current={active ? "page" : undefined}
                  data-testid="app-shell-mobile-nav-link"
                  className="flex min-h-15 w-22 shrink-0 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-1.5 text-[10px] font-black leading-tight transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e] sm:w-24"
                  style={{
                    background: active
                      ? isDarkAppShell
                        ? "linear-gradient(180deg,rgba(252,206,114,.18),rgba(252,206,114,.1))"
                        : "linear-gradient(180deg,rgba(72,102,78,.16),rgba(72,102,78,.1))"
                      : isDarkAppShell
                        ? "rgba(255,255,255,.04)"
                        : "rgba(255,255,255,.34)",
                    color: active ? shellNavActiveColor : shellMutedColor,
                    textDecoration: "none",
                    boxShadow: active
                      ? `inset 0 0 0 1px ${shellBorderColor}, 0 8px 18px rgba(46,52,50,.08)`
                      : `inset 0 0 0 1px ${isDarkAppShell ? "rgba(255,255,255,.05)" : "rgba(72,102,78,.08)"}`,
                  }}
                >
                  <AppShellIcon name={item.icon} className="h-5 w-5 shrink-0" />
                  <span
                    data-app-shell-mobile-nav-label=""
                    className="block max-h-[2.2em] w-full max-w-20 overflow-hidden whitespace-normal text-center leading-[1.05] [overflow-wrap:anywhere]"
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
        <div data-app-shell-content className="mx-auto w-full max-w-376 px-4 pb-31 pt-4 sm:px-6 sm:pb-32 sm:pt-6 xl:px-7 xl:pb-3 xl:pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
