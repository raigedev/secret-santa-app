"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { requireRateLimitedAction } from "@/lib/auth/server-action-context";
import { createClient } from "@/lib/supabase/server";
import { isUuid, sanitizePlainText } from "@/lib/validation/common";
import { normalizeOptionalWishlistUrl } from "@/lib/wishlist/url";
import {
  isWishlistCategory,
  WishlistCategory,
  WISHLIST_ITEMS_PER_GROUP_LIMIT,
} from "@/lib/wishlist/options";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type AuthenticatedWishlistUser = { id: string };

function sanitizeText(input: string, maxLength: number): string {
  const decodedInput = input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

  return sanitizePlainText(decodedInput, maxLength);
}

function normalizeWishlistCategory(category: string): WishlistCategory | null {
  const trimmed = category.trim();

  if (!trimmed) {
    return null;
  }

  return isWishlistCategory(trimmed) ? trimmed : null;
}

type NormalizedWishlistItemInput =
  | {
      cleanCategory: WishlistCategory | null;
      cleanImageUrl: string;
      cleanLink: string;
      cleanName: string;
      cleanNote: string;
      cleanPriority: number;
      success: true;
    }
  | {
      message: string;
      success: false;
    };

type WishlistItemInputFields = {
  itemCategory: string;
  itemImageUrl: string;
  itemLink: string;
  itemName: string;
  itemNote: string;
  priority: number;
};

type PreparedWishlistItemAction =
  | {
      normalizedInput: Extract<NormalizedWishlistItemInput, { success: true }>;
      success: true;
      supabase: SupabaseServerClient;
      user: AuthenticatedWishlistUser;
    }
  | {
      message: string;
      success: false;
    };

function normalizeWishlistItemInput(input: WishlistItemInputFields): NormalizedWishlistItemInput {
  const cleanName = sanitizeText(input.itemName, 100);
  const cleanNote = sanitizeText(input.itemNote, 200);
  const cleanLink = normalizeOptionalWishlistUrl(input.itemLink);
  const cleanImageUrl = normalizeOptionalWishlistUrl(input.itemImageUrl);
  const cleanCategory = normalizeWishlistCategory(input.itemCategory);
  const cleanPriority = Math.min(Math.max(Math.floor(input.priority || 0), 0), 10);

  if (cleanName.length === 0) {
    return { message: "Item name is required.", success: false };
  }

  if (input.itemCategory.trim() && !cleanCategory) {
    return { message: "Choose a valid wishlist category.", success: false };
  }

  return {
    cleanCategory,
    cleanImageUrl,
    cleanLink,
    cleanName,
    cleanNote,
    cleanPriority,
    success: true,
  };
}

async function prepareWishlistItemAction(
  input: WishlistItemInputFields,
  rateLimitConfig: {
    action: string;
    maxAttempts: number;
    resourceId: string;
  }
): Promise<PreparedWishlistItemAction> {
  const normalizedInput = normalizeWishlistItemInput(input);

  if (!normalizedInput.success) {
    return normalizedInput;
  }

  const context = await requireRateLimitedAction({
    action: rateLimitConfig.action,
    maxAttempts: rateLimitConfig.maxAttempts,
    resourceId: rateLimitConfig.resourceId,
    resourceType: "wishlist",
    subject: (userId) => userId,
    windowSeconds: 600,
  });

  if (!context.ok) {
    return { success: false, message: context.message };
  }

  return {
    normalizedInput,
    success: true,
    supabase: context.supabase,
    user: context.user,
  };
}

async function requireAcceptedWishlistMember(groupId: string, userId: string) {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  return membership ? supabase : null;
}

export async function addWishlistItem(
  groupId: string,
  itemName: string,
  itemLink: string,
  itemNote: string,
  priority: number,
  itemCategory: string,
  itemImageUrl: string
): Promise<{ success: boolean; message: string }> {
  if (!isUuid(groupId)) {
    return { success: false, message: "Choose a valid group." };
  }

  const preparedAction = await prepareWishlistItemAction(
    {
      itemCategory,
      itemImageUrl,
      itemLink,
      itemName,
      itemNote,
      priority,
    },
    {
      action: "wishlist.add_item",
      maxAttempts: 20,
      resourceId: groupId,
    }
  );

  if (!preparedAction.success) {
    return { success: false, message: preparedAction.message };
  }

  const { normalizedInput, user } = preparedAction;

  const memberClient = await requireAcceptedWishlistMember(groupId, user.id);

  if (!memberClient) {
    return { success: false, message: "You must be a member of this group." };
  }

  const { count, error: countError } = await memberClient
    .from("wishlists")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (countError) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: countError.message,
      eventType: "wishlist.add_item",
      resourceId: groupId,
      resourceType: "wishlist",
    });

    return {
      success: false,
      message: "We could not check your wishlist limit. Please try again.",
    };
  }

  if ((count || 0) >= WISHLIST_ITEMS_PER_GROUP_LIMIT) {
    return {
      success: false,
      message: `You can add up to ${WISHLIST_ITEMS_PER_GROUP_LIMIT} wishlist items per group.`,
    };
  }

  const { error } = await memberClient.from("wishlists").insert({
    group_id: groupId,
    user_id: user.id,
    item_name: normalizedInput.cleanName,
    item_link: normalizedInput.cleanLink,
    item_note: normalizedInput.cleanNote,
    item_category: normalizedInput.cleanCategory,
    item_image_url: normalizedInput.cleanImageUrl,
    priority: normalizedInput.cleanPriority,
  });

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "wishlist.add_item",
      resourceId: groupId,
      resourceType: "wishlist",
    });

    return { success: false, message: "We could not add this wishlist item. Please try again." };
  }

  return { success: true, message: "Item added!" };
}

export async function editWishlistItem(
  itemId: string,
  itemName: string,
  itemLink: string,
  itemNote: string,
  priority: number,
  itemCategory: string,
  itemImageUrl: string
): Promise<{ success: boolean; message: string }> {
  if (!isUuid(itemId)) {
    return { success: false, message: "Choose a valid wishlist item." };
  }

  const preparedAction = await prepareWishlistItemAction(
    {
      itemCategory,
      itemImageUrl,
      itemLink,
      itemName,
      itemNote,
      priority,
    },
    {
      action: "wishlist.edit_item",
      maxAttempts: 30,
      resourceId: itemId,
    }
  );

  if (!preparedAction.success) {
    return { success: false, message: preparedAction.message };
  }

  const { normalizedInput, supabase, user } = preparedAction;

  // We keep the explicit `user_id` filter even with RLS in place so the intent
  // is obvious: wishlist edits only ever apply to the current user's own item.
  const { error } = await supabase
    .from("wishlists")
    .update({
      item_name: normalizedInput.cleanName,
      item_link: normalizedInput.cleanLink,
      item_note: normalizedInput.cleanNote,
      item_category: normalizedInput.cleanCategory,
      item_image_url: normalizedInput.cleanImageUrl,
      priority: normalizedInput.cleanPriority,
    })
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "wishlist.edit_item",
      resourceId: itemId,
      resourceType: "wishlist",
    });

    return { success: false, message: "We could not update this wishlist item. Please try again." };
  }

  return { success: true, message: "Item updated!" };
}

export async function deleteWishlistItem(
  itemId: string
): Promise<{ success: boolean; message: string }> {
  if (!isUuid(itemId)) {
    return { success: false, message: "Choose a valid wishlist item." };
  }

  const context = await requireRateLimitedAction({
    action: "wishlist.delete_item",
    maxAttempts: 20,
    resourceId: itemId,
    resourceType: "wishlist",
    subject: (userId) => userId,
    windowSeconds: 600,
  });

  if (!context.ok) {
    return { success: false, message: context.message };
  }

  const { supabase, user } = context;
  const { error } = await supabase
    .from("wishlists")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "wishlist.delete_item",
      resourceId: itemId,
      resourceType: "wishlist",
    });

    return { success: false, message: "We could not delete this wishlist item. Please try again." };
  }

  return { success: true, message: "Item deleted!" };
}
