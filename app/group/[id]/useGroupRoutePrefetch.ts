import { useEffect } from "react";

type PrefetchRouter = {
  prefetch: (route: string) => void;
};

type GroupRoutePrefetchOptions = {
  groupId: string;
  router: PrefetchRouter;
};

export function useGroupRoutePrefetch({ groupId, router }: GroupRoutePrefetchOptions) {
  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/wishlist");
    router.prefetch("/secret-santa");
    router.prefetch("/secret-santa-chat");
    router.prefetch(`/group/${groupId}/reveal`);
  }, [router, groupId]);
}
