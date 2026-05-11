import { isRecord } from "@/lib/validation/common";

const CLIENT_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export type ClientSnapshotMetadata = {
  createdAt: number;
  userId: string;
};

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSessionStorageItem(storageKey: string): string | null {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function readLocalStorageItem(storageKey: string): string | null {
  const storage = getLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function writeSessionStorageItem(storageKey: string, value: string): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(storageKey, value);
  } catch {
    // Client snapshots are a best-effort speed-up. Fresh server reads stay authoritative.
  }
}

export function writeLocalStorageItem(storageKey: string, value: string): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(storageKey, value);
  } catch {
    // Browser preferences are best-effort when storage is restricted.
  }
}

export function removeSessionStorageItem(storageKey: string): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore browsers that deny storage access.
  }
}

export function removeLocalStorageItem(storageKey: string): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore browsers that deny storage access.
  }
}

export function forEachSessionStorageKey(callback: (key: string) => void): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);

      if (key) {
        callback(key);
      }
    }
  } catch {
    // Ignore browsers that deny storage access.
  }
}

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
  const rawSnapshot = readSessionStorageItem(storageKey);

  if (!rawSnapshot) {
    return null;
  }

  try {
    const parsedSnapshot = JSON.parse(rawSnapshot) as unknown;

    if (isSnapshot(parsedSnapshot, userId)) {
      return parsedSnapshot;
    }
  } catch {
    removeSessionStorageItem(storageKey);
    return null;
  }

  removeSessionStorageItem(storageKey);
  return null;
}

export function writeClientSnapshot<T>(storageKey: string, snapshot: T) {
  writeSessionStorageItem(storageKey, JSON.stringify(snapshot));
}

export function clearClientSnapshots(storagePrefix: string) {
  forEachSessionStorageKey((key) => {
    if (key?.startsWith(storagePrefix)) {
      removeSessionStorageItem(key);
    }
  });
}

export function clearAppSessionStorage() {
  forEachSessionStorageKey((key) => {
    if (key?.startsWith("ss_")) {
      removeSessionStorageItem(key);
    }
  });
}
