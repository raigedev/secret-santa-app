"use server";

import { recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  isWishlistCategory,
  WishlistCategory,
  WISHLIST_ITEMS_PER_GROUP_LIMIT,
} from "@/lib/wishlist/options";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeText(input: string, maxLength: number): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeOptionalUrl(url: string): string {
  const trimmed = url.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed.slice(0, 500);
    }

    return "";
  } catch {
    return "";
  }
}

function normalizeWishlistCategory(category: string): WishlistCategory | null {
  const trimmed = category.trim();

  if (!trimmed) {
    return null;
  }

  return isWishlistCategory(trimmed) ? trimmed : null;
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
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return { success: false, message: "Invalid group." };
  }

  const cleanName = sanitizeText(itemName, 100);
  const cleanNote = sanitizeText(itemNote, 200);
  const cleanLink = normalizeOptionalUrl(itemLink);
  const cleanImageUrl = normalizeOptionalUrl(itemImageUrl);
  const cleanCategory = normalizeWishlistCategory(itemCategory);
  const cleanPriority = Math.min(Math.max(Math.floor(priority || 0), 0), 10);

  if (cleanName.length === 0) {
    return { success: false, message: "Item name is required." };
  }

  if (itemCategory.trim() && !cleanCategory) {
    return { success: false, message: "Choose a valid wishlist category." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const addRateLimit = await enforceRateLimit({
    action: "wishlist.add_item",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: groupId,
    resourceType: "wishlist",
    subject: user.id,
    windowSeconds: 600,
  });

  if (!addRateLimit.allowed) {
    return { success: false, message: addRateLimit.message };
  }

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
      message: "Failed to check your wishlist limit. Please try again.",
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
    item_name: cleanName,
    item_link: cleanLink,
    item_note: cleanNote,
    item_category: cleanCategory,
    item_image_url: cleanImageUrl,
    priority: cleanPriority,
  });

  if (error) {
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "wishlist.add_item",
      resourceId: groupId,
      resourceType: "wishlist",
    });

    return { success: false, message: "Failed to add item. Please try again." };
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
  if (!itemId || !UUID_PATTERN.test(itemId)) {
    return { success: false, message: "Invalid item." };
  }

  const cleanName = sanitizeText(itemName, 100);
  const cleanNote = sanitizeText(itemNote, 200);
  const cleanLink = normalizeOptionalUrl(itemLink);
  const cleanImageUrl = normalizeOptionalUrl(itemImageUrl);
  const cleanCategory = normalizeWishlistCategory(itemCategory);
  const cleanPriority = Math.min(Math.max(Math.floor(priority || 0), 0), 10);

  if (cleanName.length === 0) {
    return { success: false, message: "Item name is required." };
  }

  if (itemCategory.trim() && !cleanCategory) {
    return { success: false, message: "Choose a valid wishlist category." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const editRateLimit = await enforceRateLimit({
    action: "wishlist.edit_item",
    actorUserId: user.id,
    maxAttempts: 30,
    resourceId: itemId,
    resourceType: "wishlist",
    subject: user.id,
    windowSeconds: 600,
  });

  if (!editRateLimit.allowed) {
    return { success: false, message: editRateLimit.message };
  }

  // We keep the explicit `user_id` filter even with RLS in place so the intent
  // is obvious: wishlist edits only ever apply to the current user's own item.
  const { error } = await supabase
    .from("wishlists")
    .update({
      item_name: cleanName,
      item_link: cleanLink,
      item_note: cleanNote,
      item_category: cleanCategory,
      item_image_url: cleanImageUrl,
      priority: cleanPriority,
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

    return { success: false, message: "Failed to update item. Please try again." };
  }

  return { success: true, message: "Item updated!" };
}

export async function deleteWishlistItem(
  itemId: string
): Promise<{ success: boolean; message: string }> {
  if (!itemId || !UUID_PATTERN.test(itemId)) {
    return { success: false, message: "Invalid item." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  const deleteRateLimit = await enforceRateLimit({
    action: "wishlist.delete_item",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceId: itemId,
    resourceType: "wishlist",
    subject: user.id,
    windowSeconds: 600,
  });

  if (!deleteRateLimit.allowed) {
    return { success: false, message: deleteRateLimit.message };
  }

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

    return { success: false, message: "Failed to delete item. Please try again." };
  }

  return { success: true, message: "Item deleted!" };
}
