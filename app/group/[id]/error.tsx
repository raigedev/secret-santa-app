"use client";

import { GroupRouteError } from "./GroupRouteError";

export default function GroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GroupRouteError error={error} reset={reset} variant="group" />;
}
