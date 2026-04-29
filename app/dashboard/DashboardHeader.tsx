import type { RefObject } from "react";
import { BellIcon, SantaMarkIcon, ThemeIcon, UserOutlineIcon } from "./dashboard-icons";

type DashboardHeaderProps = {
  isDarkTheme: boolean;
  notificationButtonRef: RefObject<HTMLButtonElement | null>;
  notificationsPanelOpen: boolean;
  profileMenuOpen: boolean;
  profileMenuRef: RefObject<HTMLDivElement | null>;
  unreadNotificationCount: number;
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
  const inactiveNavClass = isDarkTheme
    ? "text-slate-400 text-base font-semibold hover:text-red-300"
    : "text-slate-500 text-base font-semibold hover:text-red-600";

  return (
    <header
      className={`sticky top-0 z-[80] w-full backdrop-blur-xl shadow-[0_8px_24px_rgba(45,51,55,0.06)] ${
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
              Wishlist
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
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
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
          <div ref={profileMenuRef} className="relative z-[90]">
            <button
              type="button"
              onClick={onToggleProfileMenu}
              className={utilityButtonClass}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Open profile menu"
              title="Open profile menu"
            >
              <UserOutlineIcon className={`h-5 w-5 ${utilityIconClass}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
