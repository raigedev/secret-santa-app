import { useEffect, useRef } from "react";
import type { Group } from "./dashboard-types";

const CORE_PREFETCH_ROUTES = [
  "/groups",
  "/secret-santa",
  "/secret-santa-chat",
  "/wishlist",
  "/notifications",
  "/history",
  "/settings",
  "/create-group",
] as const;

type PrefetchRouter = {
  prefetch: (route: string) => void;
};

type DashboardRoutePrefetchOptions = {
  canViewAffiliateReport: boolean;
  invitedGroups: Group[];
  ownedGroups: Group[];
  router: PrefetchRouter;
};

export function useDashboardRoutePrefetch({
  canViewAffiliateReport,
  invitedGroups,
  ownedGroups,
  router,
}: DashboardRoutePrefetchOptions) {
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const prefetchOnce = (route: string) => {
      if (prefetchedRoutesRef.current.has(route)) {
        return;
      }

      prefetchedRoutesRef.current.add(route);
      router.prefetch(route);
    };

    const routesToPrefetch: string[] = [...CORE_PREFETCH_ROUTES];
    if (canViewAffiliateReport) {
      routesToPrefetch.push("/dashboard/affiliate-report");
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const prefetchCoreRoutes = () => {
      for (const route of routesToPrefetch) {
        prefetchOnce(route);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(prefetchCoreRoutes, { timeout: 1500 });
    } else if (typeof window !== "undefined") {
      timeoutId = setTimeout(prefetchCoreRoutes, 1200);
    } else {
      prefetchCoreRoutes();
    }

    return () => {
      if (typeof window !== "undefined" && idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [router, canViewAffiliateReport]);

  useEffect(() => {
    const groupRoutes = [...ownedGroups, ...invitedGroups]
      .slice(0, 6)
      .map((group) => `/group/${group.id}`);
    if (groupRoutes.length === 0) {
      return;
    }

    const prefetchGroupRoutes = () => {
      for (const route of groupRoutes) {
        if (prefetchedRoutesRef.current.has(route)) {
          continue;
        }

        prefetchedRoutesRef.current.add(route);
        router.prefetch(route);
      }
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(prefetchGroupRoutes, { timeout: 1800 });
    } else if (typeof window !== "undefined") {
      timeoutId = setTimeout(prefetchGroupRoutes, 1200);
    } else {
      prefetchGroupRoutes();
    }

    return () => {
      if (typeof window !== "undefined" && idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [router, ownedGroups, invitedGroups]);
}
