"use client";

import { useCallback, useEffect, useState } from "react";

const APP_SIDEBAR_COLLAPSED_STORAGE_KEY = "ss_app_sidebar_collapsed";

type AppSidebarToggleButtonProps = {
  background: string;
  borderColor: string;
  collapsed: boolean;
  color: string;
  controlsId: string;
  onToggle: () => void;
};

function readStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(APP_SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(APP_SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // The control still works when browser storage is unavailable; only persistence is skipped.
  }
}

export function useAppSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const initialSync = window.setTimeout(() => {
      setCollapsed(readStoredSidebarCollapsed());
    }, 0);

    const syncStoredPreference = (event: StorageEvent) => {
      if (event.key === APP_SIDEBAR_COLLAPSED_STORAGE_KEY || event.key === null) {
        setCollapsed(readStoredSidebarCollapsed());
      }
    };

    window.addEventListener("storage", syncStoredPreference);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("storage", syncStoredPreference);
    };
  }, []);

  const toggle = useCallback(() => {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    writeStoredSidebarCollapsed(nextCollapsed);
  }, [collapsed]);

  return { collapsed, toggle };
}

export function AppSidebarToggleButton({
  background,
  borderColor,
  collapsed,
  color,
  controlsId,
  onToggle,
}: AppSidebarToggleButtonProps) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <span
      data-testid="app-sidebar-toggle-position"
      className={`fixed top-1/2 z-40 hidden -translate-x-1/2 -translate-y-1/2 xl:inline-flex ${
        collapsed ? "left-20" : "left-70"
      }`}
    >
      <button
        type="button"
        data-testid="app-sidebar-toggle"
        aria-controls={controlsId}
        aria-expanded={!collapsed}
        aria-label={label}
        title={label}
        onClick={onToggle}
        className="gift-shell-control h-11 w-11 justify-center rounded-full shadow-[0_10px_24px_rgba(46,52,50,.12)]"
        style={{ background, borderColor, color }}
      >
        <svg
          aria-hidden="true"
          className={`h-5 w-5 ${collapsed ? "" : "rotate-180"}`}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="m9 18 6-6-6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.9"
          />
        </svg>
      </button>
    </span>
  );
}
