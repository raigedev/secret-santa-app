"use client";

const DASHBOARD_THEME_STORAGE_KEY = "ss_dashboard_theme";
export const DASHBOARD_THEME_CHANGED_EVENT = "ss-dashboard-theme-changed";

export type DashboardTheme = "default" | "midnight";

export function readStoredDashboardTheme(): DashboardTheme {
  if (typeof window === "undefined") {
    return "default";
  }

  try {
    return window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY) === "midnight"
      ? "midnight"
      : "default";
  } catch {
    return "default";
  }
}

export function writeStoredDashboardTheme(theme: DashboardTheme): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, theme);
  } catch {
    // Theme persistence is best-effort when browser storage is restricted.
  }
  window.dispatchEvent(new CustomEvent(DASHBOARD_THEME_CHANGED_EVENT));
}
