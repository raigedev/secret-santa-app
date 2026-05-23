const DEFAULT_WISHLIST_URL_MAX_LENGTH = 500;

export function normalizeOptionalWishlistUrl(
  value: string | null | undefined,
  maxLength = DEFAULT_WISHLIST_URL_MAX_LENGTH
): string {
  const trimmed = value?.trim() || "";

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return trimmed.slice(0, maxLength);
  } catch {
    return "";
  }
}
