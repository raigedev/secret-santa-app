import "server-only";

import { canAccessRecipientWishlistItem } from "@/lib/wishlist/recipient-access";

type RedirectAccessResult =
  | { allowed: true }
  | {
      allowed: false;
      error?: string;
      reason: "assignment_lookup_failed" | "unauthorized" | "wishlist_lookup_failed";
    };

export async function canTrackWishlistAffiliateRedirect(options: {
  groupId: string;
  userId: string;
  wishlistItemId: string;
}): Promise<RedirectAccessResult> {
  return canAccessRecipientWishlistItem(options);
}
