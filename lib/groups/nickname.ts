import { sanitizePlainText } from "@/lib/validation/common";

const NICKNAME_MAX_LENGTH = 30;
const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const RESERVED_ROLE_LABELS = new Set(["organizer", "owner", "host"]);

function normalizeComparableValue(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function sanitizeGroupNickname(input: string): string {
  return sanitizePlainText(input, NICKNAME_MAX_LENGTH);
}

function getDefaultGroupNicknameFromEmail(
  email: string | null | undefined,
  fallbackLabel = "member"
): string {
  const emailName = email?.split("@")[0] || "";
  return sanitizeGroupNickname(emailName) || fallbackLabel;
}

export function isEmailDerivedGroupNickname(
  nickname: string | null | undefined,
  email: string | null | undefined
): boolean {
  const cleanNickname = normalizeComparableValue(sanitizeGroupNickname(nickname || ""));
  const emailNickname = normalizeComparableValue(getDefaultGroupNicknameFromEmail(email, ""));

  return Boolean(cleanNickname && emailNickname && cleanNickname === emailNickname);
}

export function getAnonymousGroupDisplayName(
  nickname: string | null | undefined,
  fallbackLabel = "Member"
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
    return "Enter a group nickname to continue.";
  }

  if (cleanNickname.includes("@") || EMAIL_LIKE_PATTERN.test(cleanNickname)) {
    return "Use a nickname, not an email address.";
  }

  const normalizedNickname = normalizeComparableValue(cleanNickname);
  const normalizedEmail = normalizeComparableValue(options.email);
  const normalizedEmailName = normalizeComparableValue(options.email?.split("@")[0]);
  const normalizedDisplayName = normalizeComparableValue(options.displayName);

  if (RESERVED_ROLE_LABELS.has(normalizedNickname)) {
    return "Choose a nickname instead of a role label.";
  }

  if (normalizedNickname && normalizedNickname === normalizedEmail) {
    return "Use a nickname, not your email address.";
  }

  if (normalizedNickname && normalizedNickname === normalizedEmailName) {
    return "Choose a nickname that is different from your email name.";
  }

  if (normalizedDisplayName && normalizedNickname === normalizedDisplayName) {
    return "Choose a nickname that is different from your profile name.";
  }

  return null;
}
