import type { RefObject } from "react";
import { BellIcon, SantaMarkIcon, ThemeIcon, UserOutlineIcon } from "./dashboard-icons";

type DashboardHeaderProps = {
  isDarkTheme: boolean;
  notificationButtonRef: RefObject<HTMLButtonElement | null>;
  notificationsPanelOpen: boolean;
  profileMenuOpen: boolean;
  profileMenuRef: RefObject<HTMLDivElement | null>;
  unreadNotificationCount: number;
  viewerAvatarEmoji: string;
  viewerAvatarUrl: string;
  viewerName: string;
  onAvatarImageError: () => void;
  onGoDashboard: () => void;
  onGoWishlist: () => void;
  onScrollToActivity: () => void;
  onScrollToGroups: () => void;
  onToggleNotifications: () => void;
  onToggleProfileMenu: () => void;
  onToggleTheme: () => void;
};

export function DashboardHeader({
  isDarkTheme,
  notificationButtonRef,
  notificationsPanelOpen,
  profileMenuOpen,
  profileMenuRef,
  unreadNotificationCount,
  viewerAvatarEmoji,
  viewerAvatarUrl,
  viewerName,
  onAvatarImageError,
  onGoDashboard,
  onGoWishlist,
  onScrollToActivity,
  onScrollToGroups,
  onToggleNotifications,
  onToggleProfileMenu,
  onToggleTheme,
}: DashboardHeaderProps) {
  const utilityIconClass = isDarkTheme ? "text-slate-300" : "text-slate-500";
  const utilityButtonClass = `relative inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:-translate-y-0.5 ${
    isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/80"
  }`;
  const displayViewerName = viewerName.trim() || "Profile";
  const profileInitial = displayViewerName.slice(0, 1).toUpperCase() || "?";
  const fallbackAvatar = viewerAvatarEmoji || profileInitial;
  const fallbackAvatarIsEmoji = Boolean(viewerAvatarEmoji);
  const inactiveNavClass = isDarkTheme
    ? "text-slate-400 text-base font-semibold hover:text-red-300"
    : "text-slate-500 text-base font-semibold hover:text-red-600";

  return (
    <header
      data-app-page-header="true"
      className={`fixed left-0 right-0 top-0 z-80 w-full backdrop-blur-xl shadow-[0_8px_24px_rgba(45,51,55,0.06)] ${
        isDarkTheme ? "bg-slate-950/70" : "bg-white/70"
      }`}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-8">
          <button
            type="button"
            onClick={onGoDashboard}
            className="inline-flex shrink-0 items-center gap-3 rounded-full text-left transition hover:-translate-y-0.5"
            aria-label="Go to Secret Santa dashboard"
          >
            <span
              className={`inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full ring-1 ${
                isDarkTheme ? "bg-slate-900/80 ring-white/10" : "bg-white/85 ring-white/80"
              }`}
            >
              <SantaMarkIcon size={32} />
            </span>
            <span className="hidden flex-col items-start leading-[0.94] sm:flex">
              <span className={`text-[13px] font-extrabold tracking-[-0.01em] ${isDarkTheme ? "text-[#ff9b86]" : "text-[#c0392b]"}`}>
                My Secret
              </span>
              <span className={`mt-0.5 text-[25px] font-black tracking-[-0.045em] ${isDarkTheme ? "text-white" : "text-slate-950"}`}>
                Santa
              </span>
              <span className={`mt-1 text-[10px] font-semibold italic tracking-[-0.01em] ${isDarkTheme ? "text-[#ffb4a3]/80" : "text-[#c0392b]/85"}`}>
                shhh... it&apos;s a secret!
              </span>
            </span>
          </button>
          <nav className="hidden items-center gap-6 md:flex">
            <button
              type="button"
              className={isDarkTheme ? "text-red-300 text-base font-bold" : "text-red-700 text-base font-bold"}
            >
              Home
            </button>
            <button type="button" onClick={onScrollToGroups} className={inactiveNavClass}>
              Groups
            </button>
            <button type="button" onClick={onGoWishlist} className={inactiveNavClass}>
              My Wishlist
            </button>
            <button type="button" onClick={onScrollToActivity} className={inactiveNavClass}>
              Activity
            </button>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            ref={notificationButtonRef}
            type="button"
            onClick={onToggleNotifications}
            className={`${utilityButtonClass} ${
              notificationsPanelOpen
                ? isDarkTheme
                  ? "bg-blue-500/20"
                  : "bg-blue-50"
                : ""
            }`}
            aria-haspopup="dialog"
            aria-expanded={notificationsPanelOpen}
            aria-label={unreadNotificationCount > 0 ? `Open notifications, ${unreadNotificationCount} unread` : "Open notifications"}
            title="Open notifications"
          >
            <BellIcon className={`h-5 w-5 ${utilityIconClass}`} />
            {unreadNotificationCount > 0 && (
              <span
                data-testid="dashboard-notification-badge"
                className="pointer-events-none absolute -right-2 -top-2.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow-[0_6px_14px_rgba(244,63,94,.22)]"
              >
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className={utilityButtonClass}
            aria-pressed={isDarkTheme}
            aria-label={isDarkTheme ? "Switch to default dashboard theme" : "Switch to midnight dashboard theme"}
            title={isDarkTheme ? "Switch to default dashboard theme" : "Switch to midnight dashboard theme"}
          >
            <ThemeIcon dark={isDarkTheme} className={`h-5 w-5 ${utilityIconClass}`} />
          </button>
          <div ref={profileMenuRef} className="relative z-90">
            <button
              type="button"
              onClick={onToggleProfileMenu}
              className={`flex min-h-10 items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:-translate-y-0.5 ${
                isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/80"
              }`}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Open profile menu"
              title="Open profile menu"
            >
              <span
                data-testid="app-shell-viewer-avatar"
                className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-1 ${
                  fallbackAvatarIsEmoji && !viewerAvatarUrl
                    ? "bg-amber-50 text-[20px] ring-amber-100"
                    : isDarkTheme
                      ? "bg-slate-800 text-[13px] font-black text-white ring-white/10"
                      : "bg-[#48664e] text-[13px] font-black text-white ring-white/80"
                }`}
              >
                {viewerAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewerAvatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={onAvatarImageError}
                  />
                ) : (
                  fallbackAvatar
                )}
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span
                  data-testid="app-shell-viewer-name"
                  className={`block max-w-32 truncate text-[12px] font-black leading-tight ${
                    isDarkTheme ? "text-white" : "text-slate-950"
                  }`}
                >
                  {displayViewerName}
                </span>
                <span className={`block text-[10px] font-semibold ${utilityIconClass}`}>
                  View profile
                </span>
              </span>
              <UserOutlineIcon className={`hidden h-4 w-4 lg:block ${utilityIconClass}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
