import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

type RecipientWishlistAccessResult =
  | { allowed: true }
  | {
      allowed: false;
      error?: string;
      reason: "assignment_lookup_failed" | "unauthorized" | "wishlist_lookup_failed";
    };

export async function canAccessRecipientWishlistItem(options: {
  groupId: string;
  userId: string;
  wishlistItemId: string;
}): Promise<RecipientWishlistAccessResult> {
  const { data: wishlistItem, error: wishlistItemError } = await supabaseAdmin
    .from("wishlists")
    .select("group_id, user_id")
    .eq("id", options.wishlistItemId)
    .eq("group_id", options.groupId)
    .maybeSingle();

  if (wishlistItemError) {
    return {
      allowed: false,
      error: wishlistItemError.message,
      reason: "wishlist_lookup_failed",
    };
  }

  if (!wishlistItem?.user_id) {
    return { allowed: false, reason: "unauthorized" };
  }

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("assignments")
    .select("id")
    .eq("group_id", options.groupId)
    .eq("giver_id", options.userId)
    .eq("receiver_id", wishlistItem.user_id)
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    return {
      allowed: false,
      error: assignmentError.message,
      reason: "assignment_lookup_failed",
    };
  }

  if (!assignment) {
    return { allowed: false, reason: "unauthorized" };
  }

  return { allowed: true };
}
