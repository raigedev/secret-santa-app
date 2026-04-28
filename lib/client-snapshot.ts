import { isRecord } from "@/lib/validation/common";

export const CLIENT_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export type ClientSnapshotMetadata = {
  createdAt: number;
  userId: string;
};

export function hasFreshClientSnapshotMetadata(
  value: unknown,
  userId: string,
  ttlMs = CLIENT_SNAPSHOT_TTL_MS
): value is ClientSnapshotMetadata & Record<string, unknown> {
  return (
    isRecord(value) &&
    value.userId === userId &&
    typeof value.createdAt === "number" &&
    Date.now() - value.createdAt < ttlMs
  );
}

export function readClientSnapshot<T>(
  storageKey: string,
  userId: string,
  isSnapshot: (value: unknown, userId: string) => value is T
): T | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  const rawSnapshot = sessionStorage.getItem(storageKey);

  if (!rawSnapshot) {
    return null;
  }

  try {
    const parsedSnapshot = JSON.parse(rawSnapshot) as unknown;

    if (isSnapshot(parsedSnapshot, userId)) {
      return parsedSnapshot;
    }
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }

  sessionStorage.removeItem(storageKey);
  return null;
}

export function writeClientSnapshot<T>(storageKey: string, snapshot: T) {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
}

export function clearClientSnapshots(storagePrefix: string) {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);

    if (key?.startsWith(storagePrefix)) {
      sessionStorage.removeItem(key);
    }
  }
}
