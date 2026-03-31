export const WISHLIST_CATEGORIES = [
  "Tech",
  "Fashion",
  "Beauty",
  "Food",
  "Books",
  "Games",
  "Home",
  "Collectibles",
  "Experience",
  "Other",
] as const;

export type WishlistCategory = (typeof WISHLIST_CATEGORIES)[number];

export function isWishlistCategory(value: string | null | undefined): value is WishlistCategory {
  return Boolean(value) && WISHLIST_CATEGORIES.includes(value as WishlistCategory);
}
