const VIEWER_NAME_STORAGE_KEY = "ss_un";
const VIEWER_AVATAR_STORAGE_KEY = "ss_uav";
const VIEWER_AVATAR_EMOJI_STORAGE_KEY = "ss_uae";
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

export function readStoredViewerName() {
  if (typeof sessionStorage === "undefined") {
    return "";
  }

  return normalizeViewerName(sessionStorage.getItem(VIEWER_NAME_STORAGE_KEY));
}

export function readStoredViewerAvatarUrl() {
  if (typeof sessionStorage === "undefined") {
    return "";
  }

  return normalizeViewerAvatarUrl(sessionStorage.getItem(VIEWER_AVATAR_STORAGE_KEY));
}

export function readStoredViewerAvatarEmoji() {
  if (typeof sessionStorage === "undefined") {
    return "";
  }

  return normalizeViewerAvatarEmoji(sessionStorage.getItem(VIEWER_AVATAR_EMOJI_STORAGE_KEY));
}

export function readStoredViewerProfile() {
  return {
    avatarEmoji: readStoredViewerAvatarEmoji(),
    avatarUrl: readStoredViewerAvatarUrl(),
    displayName: readStoredViewerName(),
  };
}

export function storeViewerName(value: string) {
  const normalized = normalizeViewerName(value);

  if (normalized && typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(VIEWER_NAME_STORAGE_KEY, normalized);
  }
}

export function storeViewerAvatarUrl(value: string | null | undefined) {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  const normalized = normalizeViewerAvatarUrl(value);

  if (normalized) {
    sessionStorage.setItem(VIEWER_AVATAR_STORAGE_KEY, normalized);
  } else {
    sessionStorage.removeItem(VIEWER_AVATAR_STORAGE_KEY);
  }
}

export function storeViewerAvatarEmoji(value: string | null | undefined) {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  const normalized = normalizeViewerAvatarEmoji(value);

  if (normalized) {
    sessionStorage.setItem(VIEWER_AVATAR_EMOJI_STORAGE_KEY, normalized);
  } else {
    sessionStorage.removeItem(VIEWER_AVATAR_EMOJI_STORAGE_KEY);
  }
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
