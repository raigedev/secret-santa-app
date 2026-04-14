const NICKNAME_MAX_LENGTH = 30;
const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const RESERVED_ROLE_LABELS = new Set(["organizer", "owner", "host"]);

function normalizeComparableValue(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function sanitizeGroupNickname(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, NICKNAME_MAX_LENGTH);
}

export function getAnonymousGroupDisplayName(
  nickname: string | null | undefined,
  fallbackLabel = "Participant"
): string {
  const cleanNickname = sanitizeGroupNickname(nickname || "");

  if (!cleanNickname) {
    return fallbackLabel;
  }

  if (RESERVED_ROLE_LABELS.has(normalizeComparableValue(cleanNickname))) {
    return fallbackLabel;
  }

  return cleanNickname;
}

export function validateAnonymousGroupNickname(options: {
  nickname: string;
  displayName?: string | null;
  email?: string | null;
}): string | null {
  const cleanNickname = sanitizeGroupNickname(options.nickname);

  if (!cleanNickname) {
    return "Enter an event codename to continue.";
  }

  if (cleanNickname.includes("@") || EMAIL_LIKE_PATTERN.test(cleanNickname)) {
    return "Use a codename, not an email address.";
  }

  const normalizedNickname = normalizeComparableValue(cleanNickname);
  const normalizedEmail = normalizeComparableValue(options.email);
  const normalizedEmailName = normalizeComparableValue(options.email?.split("@")[0]);
  const normalizedDisplayName = normalizeComparableValue(options.displayName);

  if (RESERVED_ROLE_LABELS.has(normalizedNickname)) {
    return "Choose a codename instead of a role label.";
  }

  if (normalizedNickname && normalizedNickname === normalizedEmail) {
    return "Use a codename, not your email address.";
  }

  if (normalizedNickname && normalizedNickname === normalizedEmailName) {
    return "Choose a codename that is different from your email name.";
  }

  if (normalizedDisplayName && normalizedNickname === normalizedDisplayName) {
    return "Choose a codename that is different from your profile name.";
  }

  return null;
}
