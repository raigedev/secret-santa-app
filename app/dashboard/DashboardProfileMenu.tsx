import type { CSSProperties, RefObject } from "react";
import { createPortal } from "react-dom";
import { ArrowRightIcon } from "./dashboard-icons";
import type { ProfileMenuPosition } from "./dashboard-types";

type DashboardProfileMenuProps = {
  isDarkTheme: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  position: ProfileMenuPosition;
  onClose: () => void;
  onGoProfile: () => void;
  onLogout: () => void;
};

export function DashboardProfileMenu({
  isDarkTheme,
  menuRef,
  position,
  onClose,
  onGoProfile,
  onLogout,
}: DashboardProfileMenuProps) {
  if (!position || typeof document === "undefined") {
    return null;
  }

  const utilityIconClass = isDarkTheme ? "text-slate-300" : "text-slate-500";
  const menuStyle: CSSProperties = {
    position: "fixed",
    top: position.top,
    left: position.left,
    width: position.width,
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Profile options"
      style={menuStyle}
      className={`z-200 overflow-hidden rounded-[20px] border p-1.5 shadow-[0_22px_44px_rgba(15,23,42,0.20)] backdrop-blur-md ${
        isDarkTheme ? "border-slate-700/80 bg-slate-900/94" : "border-white/80 bg-white/96"
      }`}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onGoProfile();
        }}
        className={`flex w-full items-center justify-between rounded-[18px] px-3 py-2.5 text-left transition ${
          isDarkTheme ? "text-slate-100 hover:bg-slate-800/80" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <div>
          <div className="text-sm font-semibold">Edit profile</div>
          <div className={`mt-0.5 hidden text-[11px] leading-4 sm:block ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Update your festive avatar and account details.
          </div>
        </div>
        <ArrowRightIcon className={`h-4 w-4 shrink-0 ${utilityIconClass}`} />
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onLogout();
        }}
        className={`mt-1.5 flex w-full items-center justify-between rounded-[18px] px-3 py-2.5 text-left transition ${
          isDarkTheme ? "text-rose-200 hover:bg-rose-500/10" : "text-rose-600 hover:bg-rose-50"
        }`}
      >
        <div>
          <div className="text-sm font-semibold">Logout</div>
          <div className={`mt-0.5 hidden text-[11px] leading-4 sm:block ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Sign out and return to the login screen.
          </div>
        </div>
        <ArrowRightIcon className="h-4 w-4 shrink-0" />
      </button>
    </div>,
    document.body
  );
}
