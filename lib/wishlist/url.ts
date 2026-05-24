const DEFAULT_WISHLIST_URL_MAX_LENGTH = 500;

export function normalizeOptionalWishlistUrl(
  value: string | null | undefined,
  maxLength = DEFAULT_WISHLIST_URL_MAX_LENGTH
): string {
  const trimmed = value?.trim() || "";

  if (!trimmed) {
    return "";
  }

  if (trimmed.length > maxLength) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "https:") {
      return "";
    }

    return trimmed;
  } catch {
    return "";
  }
}
