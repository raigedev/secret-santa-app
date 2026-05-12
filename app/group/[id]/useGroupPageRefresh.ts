"use client";

import type { RefObject } from "react";
import { clearGroupPageSnapshots } from "./group-page-state";

type RefreshRouter = {
  refresh: () => void;
};

type UseGroupPageRefreshInput = {
  groupId: string;
  loadGroupDataRef: RefObject<(() => Promise<void>) | null>;
  router: RefreshRouter;
};

const GROUP_REFRESH_RETRY_DELAYS_MS = [250, 900];

export function useGroupPageRefresh({
  groupId,
  loadGroupDataRef,
  router,
}: UseGroupPageRefreshInput) {
  const notifyGroupRefresh = () => {
    clearGroupPageSnapshots(groupId);

    try {
      localStorage.setItem(`group-refresh:${groupId}`, Date.now().toString());
    } catch {
      // Best-effort same-browser tab sync only.
    }

    if (loadGroupDataRef.current) {
      void loadGroupDataRef.current();
    }
  };

  const forceGroupRefresh = () => {
    notifyGroupRefresh();
    router.refresh();

    // Some server actions commit before the next client read sees the final
    // row state. A short bounded retry keeps the UI settled without asking the
    // user to refresh manually or adding an open-ended polling loop.
    for (const delay of GROUP_REFRESH_RETRY_DELAYS_MS) {
      window.setTimeout(() => {
        if (loadGroupDataRef.current) {
          void loadGroupDataRef.current();
        }
      }, delay);
    }
  };

  return {
    forceGroupRefresh,
    notifyGroupRefresh,
  };
}
