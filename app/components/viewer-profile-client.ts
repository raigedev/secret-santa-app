import {
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from "@/lib/client-snapshot";

const VIEWER_NAME_STORAGE_KEY = "ss_un";
const VIEWER_AVATAR_STORAGE_KEY = "ss_uav";
const VIEWER_AVATAR_EMOJI_STORAGE_KEY = "ss_uae";
const VIEWER_PROFILE_STORAGE_PREFIX = "ss_viewer_profile_v2:";
const VIEWER_PROFILE_CHANGED_EVENT = "ss-profile-updated";

type ViewerProfileChangedDetail = {
  avatarEmoji?: string | null;
  avatarUrl?: string | null;
  displayName?: string;
};

type ViewerProfileSetters = {
  setViewerAvatarEmoji: (value: string) => void;
  setViewerAvatarUrl: (value: string) => void;
  setViewerName: (value: string) => void;
};

type StoredViewerProfile = {
  avatarEmoji: string;
  avatarUrl: string;
  displayName: string;
};

export function normalizeViewerName(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function normalizeViewerAvatarEmoji(value: string | null | undefined) {
  return (value || "").trim().slice(0, 10);
}

export function normalizeViewerAvatarUrl(value: string | null | undefined) {
  const trimmed = (value || "").trim();

  if (!trimmed) {
    return "";
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return "";
  }

  try {
    const candidate = new URL(trimmed);
    const allowedOrigin = new URL(supabaseUrl).origin;
    const allowedPathPrefix = "/storage/v1/object/public/profile-avatars/";

    if (
      candidate.origin !== allowedOrigin ||
      !candidate.pathname.startsWith(allowedPathPrefix)
    ) {
      return "";
    }

    return `${candidate.origin}${candidate.pathname}${candidate.search}`;
  } catch {
    return "";
  }
}

export function getEmailViewerName(email: string | null | undefined) {
  return normalizeViewerName(email?.split("@")[0]?.replace(/[._-]+/g, " "));
}

function getViewerProfileStorageKey(userId: string | null | undefined) {
  const normalizedUserId = (userId || "").trim();

  return normalizedUserId ? `${VIEWER_PROFILE_STORAGE_PREFIX}${normalizedUserId}` : null;
}

function getEmptyStoredViewerProfile(): StoredViewerProfile {
  return {
    avatarEmoji: "",
    avatarUrl: "",
    displayName: "",
  };
}

function readStoredViewerProfileForUser(userId: string | null | undefined): StoredViewerProfile {
  const storageKey = getViewerProfileStorageKey(userId);

  if (!storageKey) {
    return getEmptyStoredViewerProfile();
  }

  const rawProfile = readSessionStorageItem(storageKey);

  if (!rawProfile) {
    return getEmptyStoredViewerProfile();
  }

  try {
    const parsed = JSON.parse(rawProfile) as {
      avatarEmoji?: unknown;
      avatarUrl?: unknown;
      displayName?: unknown;
    };

    return {
      avatarEmoji:
        typeof parsed.avatarEmoji === "string"
          ? normalizeViewerAvatarEmoji(parsed.avatarEmoji)
          : "",
      avatarUrl:
        typeof parsed.avatarUrl === "string" ? normalizeViewerAvatarUrl(parsed.avatarUrl) : "",
      displayName:
        typeof parsed.displayName === "string" ? normalizeViewerName(parsed.displayName) : "",
    };
  } catch {
    removeSessionStorageItem(storageKey);
    return getEmptyStoredViewerProfile();
  }
}

function writeStoredViewerProfileForUser(
  userId: string | null | undefined,
  profile: StoredViewerProfile
) {
  const storageKey = getViewerProfileStorageKey(userId);

  if (!storageKey) {
    return;
  }

  writeSessionStorageItem(storageKey, JSON.stringify(profile));
}

export function readStoredViewerName(userId?: string | null) {
  if (userId) {
    return readStoredViewerProfileForUser(userId).displayName;
  }

  return "";
}

function readStoredViewerAvatarUrl(userId?: string | null) {
  if (userId) {
    return readStoredViewerProfileForUser(userId).avatarUrl;
  }

  return "";
}

function readStoredViewerAvatarEmoji(userId?: string | null) {
  if (userId) {
    return readStoredViewerProfileForUser(userId).avatarEmoji;
  }

  return "";
}

export function readStoredViewerProfile(userId?: string | null) {
  return {
    avatarEmoji: readStoredViewerAvatarEmoji(userId),
    avatarUrl: readStoredViewerAvatarUrl(userId),
    displayName: readStoredViewerName(userId),
  };
}

export function storeViewerName(value: string, userId?: string | null) {
  const normalized = normalizeViewerName(value);

  if (normalized && userId) {
    writeStoredViewerProfileForUser(userId, {
      ...readStoredViewerProfileForUser(userId),
      displayName: normalized,
    });
  }
}

export function storeViewerAvatarUrl(value: string | null | undefined, userId?: string | null) {
  if (!userId) {
    return;
  }

  const normalized = normalizeViewerAvatarUrl(value);
  writeStoredViewerProfileForUser(userId, {
    ...readStoredViewerProfileForUser(userId),
    avatarUrl: normalized,
  });
}

export function storeViewerAvatarEmoji(value: string | null | undefined, userId?: string | null) {
  if (!userId) {
    return;
  }

  const normalized = normalizeViewerAvatarEmoji(value);
  writeStoredViewerProfileForUser(userId, {
    ...readStoredViewerProfileForUser(userId),
    avatarEmoji: normalized,
  });
}

export function clearLegacyViewerProfileStorage() {
  removeSessionStorageItem(VIEWER_NAME_STORAGE_KEY);
  removeSessionStorageItem(VIEWER_AVATAR_STORAGE_KEY);
  removeSessionStorageItem(VIEWER_AVATAR_EMOJI_STORAGE_KEY);
}

function readViewerProfileChangedDetail(event: Event): ViewerProfileChangedDetail | null {
  if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== "object") {
    return null;
  }

  const detail = event.detail as {
    avatarEmoji?: unknown;
    avatarUrl?: unknown;
    displayName?: unknown;
  };

  return {
    avatarEmoji:
      typeof detail.avatarEmoji === "string" || detail.avatarEmoji === null
        ? detail.avatarEmoji
        : undefined,
    avatarUrl:
      typeof detail.avatarUrl === "string" || detail.avatarUrl === null
        ? detail.avatarUrl
        : undefined,
    displayName: typeof detail.displayName === "string" ? detail.displayName : undefined,
  };
}

export function applyViewerProfileChangedEvent(
  event: Event,
  setters: ViewerProfileSetters
) {
  const detail = readViewerProfileChangedDetail(event);

  if (!detail) {
    return false;
  }

  if (detail.displayName !== undefined) {
    const nextName = normalizeViewerName(detail.displayName);

    if (nextName) {
      setters.setViewerName(nextName);
      storeViewerName(nextName);
    }
  }

  if (detail.avatarUrl !== undefined) {
    const nextAvatarUrl = normalizeViewerAvatarUrl(detail.avatarUrl);
    setters.setViewerAvatarUrl(nextAvatarUrl);
    storeViewerAvatarUrl(nextAvatarUrl || null);
  }

  if (detail.avatarEmoji !== undefined) {
    const nextAvatarEmoji = normalizeViewerAvatarEmoji(detail.avatarEmoji);
    setters.setViewerAvatarEmoji(nextAvatarEmoji);
    storeViewerAvatarEmoji(nextAvatarEmoji || null);
  }

  return true;
}

export function publishViewerProfileChanged(detail: ViewerProfileChangedDetail) {
  if (typeof window === "undefined") {
    return;
  }

  const eventDetail: ViewerProfileChangedDetail = {};

  if (detail.displayName !== undefined) {
    const displayName = normalizeViewerName(detail.displayName);

    if (displayName) {
      storeViewerName(displayName);
      eventDetail.displayName = displayName;
    }
  }

  if (detail.avatarUrl !== undefined) {
    const avatarUrl = normalizeViewerAvatarUrl(detail.avatarUrl);
    storeViewerAvatarUrl(avatarUrl || null);
    eventDetail.avatarUrl = avatarUrl || null;
  }

  if (detail.avatarEmoji !== undefined) {
    const avatarEmoji = normalizeViewerAvatarEmoji(detail.avatarEmoji);
    storeViewerAvatarEmoji(avatarEmoji || null);
    eventDetail.avatarEmoji = avatarEmoji || null;
  }

  window.dispatchEvent(
    new CustomEvent(VIEWER_PROFILE_CHANGED_EVENT, {
      detail: eventDetail,
    })
  );
}

export function addViewerProfileChangedListener(listener: (event: Event) => void) {
  window.addEventListener(VIEWER_PROFILE_CHANGED_EVENT, listener);

  return () => {
    window.removeEventListener(VIEWER_PROFILE_CHANGED_EVENT, listener);
  };
}
