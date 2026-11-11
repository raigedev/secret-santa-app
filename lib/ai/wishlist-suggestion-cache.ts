import "server-only";

import type { SuggestionInput } from "@/lib/wishlist/suggestions";

// Gift ideas for the same wishlist item rarely change between visits, so the
// route reuses a recent provider answer instead of paying for a new AI call on
// every page open. The route must finish its login, rate-limit, and recipient
// access checks before reading this cache, so a hit never widens who can see an
// item's ideas. Entries live only in this server instance's memory.
const WISHLIST_SUGGESTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const WISHLIST_SUGGESTION_CACHE_MAX_ENTRIES = 500;

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const wishlistSuggestionCache = new Map<string, CacheEntry>();

export function buildWishlistSuggestionCacheKey(input: SuggestionInput): string {
  return JSON.stringify([
    input.groupId,
    input.wishlistItemId,
    input.itemName,
    input.itemCategory,
    input.preferredPriceMin,
    input.preferredPriceMax,
    input.groupBudget,
    input.currency,
  ]);
}

export function readCachedWishlistSuggestionDrafts<T>(key: string, now = Date.now()): T | null {
  const entry = wishlistSuggestionCache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    wishlistSuggestionCache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function storeWishlistSuggestionDrafts<T>(key: string, value: T, now = Date.now()): void {
  if (
    !wishlistSuggestionCache.has(key) &&
    wishlistSuggestionCache.size >= WISHLIST_SUGGESTION_CACHE_MAX_ENTRIES
  ) {
    const oldestKey = wishlistSuggestionCache.keys().next().value;

    if (oldestKey !== undefined) {
      wishlistSuggestionCache.delete(oldestKey);
    }
  }

  wishlistSuggestionCache.set(key, {
    expiresAt: now + WISHLIST_SUGGESTION_CACHE_TTL_MS,
    value,
  });
}
