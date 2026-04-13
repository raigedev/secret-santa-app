const NICKNAME_MAX_LENGTH = 30;
const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeComparableValue(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function sanitizeGroupNickname(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, NICKNAME_MAX_LENGTH);
}

export function validateAnonymousGroupNickname(options: {
  nickname: string;
  displayName?: string | null;
  email?: string | null;
}): string | null {
  const cleanNickname = sanitizeGroupNickname(options.nickname);

  if (!cleanNickname) {
    return "Enter an event alias before joining.";
  }

  if (cleanNickname.includes("@") || EMAIL_LIKE_PATTERN.test(cleanNickname)) {
    return "Use an alias, not an email address.";
  }

  const normalizedNickname = normalizeComparableValue(cleanNickname);
  const normalizedEmail = normalizeComparableValue(options.email);
  const normalizedEmailName = normalizeComparableValue(options.email?.split("@")[0]);
  const normalizedDisplayName = normalizeComparableValue(options.displayName);

  if (normalizedNickname && normalizedNickname === normalizedEmail) {
    return "Use an alias, not your email address.";
  }

  if (normalizedNickname && normalizedNickname === normalizedEmailName) {
    return "Choose an alias that is different from your email name.";
  }

  if (normalizedDisplayName && normalizedNickname === normalizedDisplayName) {
    return "Choose an alias that is different from your profile name.";
  }

  return null;
}
