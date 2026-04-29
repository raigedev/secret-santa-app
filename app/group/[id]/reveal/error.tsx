"use client";

import { GroupRouteError } from "../GroupRouteError";

export default function GroupRevealError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GroupRouteError error={error} reset={reset} variant="reveal" />;
}
