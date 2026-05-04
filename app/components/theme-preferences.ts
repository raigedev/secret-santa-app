"use client";

const DASHBOARD_THEME_STORAGE_KEY = "ss_dashboard_theme";
export const DASHBOARD_THEME_CHANGED_EVENT = "ss-dashboard-theme-changed";

export type DashboardTheme = "default" | "midnight";

export function readStoredDashboardTheme(): DashboardTheme {
  if (typeof window === "undefined") {
    return "default";
  }

  return window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY) === "midnight"
    ? "midnight"
    : "default";
}

export function writeStoredDashboardTheme(theme: DashboardTheme): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent(DASHBOARD_THEME_CHANGED_EVENT));
}
