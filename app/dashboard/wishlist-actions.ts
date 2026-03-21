"use server";

// ═══════════════════════════════════════
// WISHLIST SERVER ACTIONS
// ═══════════════════════════════════════
// Handles add, edit, delete of wishlist items.
//
// Security applied:
// Core#1: Input validation + sanitization (trim, length, strip HTML)
// Core#3: Least privilege — only your own items
// Core#6: Generic error messages, real errors server-side only
// Playbook#03: Uses server-side auth, no secrets exposed
// Playbook#08: Parameterized queries via Supabase client
// Playbook#12: URL validation on item_link
// Playbook#19: Server-side auth check on every action
// Playbook#20: Logs critical actions
// ═══════════════════════════════════════

import { createClient } from "@/lib/supabase/server";

// ─── Sanitize text: strip HTML tags, trim, enforce max length ───
// Core#1: Never trust user input
function sanitizeText(input: string, maxLength: number): string {
  return input
    .replace(/<[^>]*>/g, "")   // Strip HTML tags
    .replace(/&lt;/g, "<")      // Decode common entities
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[<>]/g, "")       // Remove any remaining angle brackets
    .trim()
    .slice(0, maxLength);
}

// ─── Validate URL format ───
// Playbook#12: Only allow valid https URLs or empty
function validateUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === "") return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return trimmed.slice(0, 500);
    }
    return "";
  } catch {
    return "";
  }
}

// ─── ADD WISHLIST ITEM ───
export async function addWishlistItem(
  groupId: string,
  itemName: string,
  itemLink: string,
  itemNote: string,
  priority: number
): Promise<{ success: boolean; message: string }> {

  // Core#1: Validate inputs
  if (!groupId || typeof groupId !== "string") {
    return { success: false, message: "Invalid group." };
  }

  const cleanName = sanitizeText(itemName, 100);
  const cleanNote = sanitizeText(itemNote, 200);
  const cleanLink = validateUrl(itemLink);
  const cleanPriority = Math.min(Math.max(Math.floor(priority || 0), 0), 10);

  if (cleanName.length === 0) {
    return { success: false, message: "Item name is required." };
  }

  // Playbook#19: Server-side auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  // Core#3: Verify user is a member of this group
  const { data: membership } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!membership) {
    return { success: false, message: "You must be a member of this group." };
  }

  // Playbook#08: Parameterized insert via Supabase
  const { error } = await supabase
    .from("wishlists")
    .insert({
      group_id: groupId,
      user_id: user.id,
      item_name: cleanName,
      item_link: cleanLink,
      item_note: cleanNote,
      priority: cleanPriority,
    });

  if (error) {
    // Core#6: Generic message to user, real error server-side
    console.error("[WISHLIST] Add failed:", error.message);
    return { success: false, message: "Failed to add item. Please try again." };
  }

  // Playbook#20: Log critical action
  console.log(`[WISHLIST] User ${user.id} added "${cleanName}" to group ${groupId}`);

  return { success: true, message: "Item added!" };
}

// ─── EDIT WISHLIST ITEM ───
export async function editWishlistItem(
  itemId: string,
  itemName: string,
  itemLink: string,
  itemNote: string,
  priority: number
): Promise<{ success: boolean; message: string }> {

  if (!itemId || typeof itemId !== "string") {
    return { success: false, message: "Invalid item." };
  }

  const cleanName = sanitizeText(itemName, 100);
  const cleanNote = sanitizeText(itemNote, 200);
  const cleanLink = validateUrl(itemLink);
  const cleanPriority = Math.min(Math.max(Math.floor(priority || 0), 0), 10);

  if (cleanName.length === 0) {
    return { success: false, message: "Item name is required." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  // RLS ensures only the owner can update, but we also check explicitly
  const { error } = await supabase
    .from("wishlists")
    .update({
      item_name: cleanName,
      item_link: cleanLink,
      item_note: cleanNote,
      priority: cleanPriority,
    })
    .eq("id", itemId)
    .eq("user_id", user.id); // Double check: RLS + explicit filter

  if (error) {
    console.error("[WISHLIST] Edit failed:", error.message);
    return { success: false, message: "Failed to update item. Please try again." };
  }

  console.log(`[WISHLIST] User ${user.id} edited item ${itemId}`);

  return { success: true, message: "Item updated!" };
}

// ─── DELETE WISHLIST ITEM ───
export async function deleteWishlistItem(
  itemId: string
): Promise<{ success: boolean; message: string }> {

  if (!itemId || typeof itemId !== "string") {
    return { success: false, message: "Invalid item." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  // RLS ensures only the owner can delete, but we also check explicitly
  const { error } = await supabase
    .from("wishlists")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id); // Double check: RLS + explicit filter

  if (error) {
    console.error("[WISHLIST] Delete failed:", error.message);
    return { success: false, message: "Failed to delete item. Please try again." };
  }

  console.log(`[WISHLIST] User ${user.id} deleted item ${itemId}`);

  return { success: true, message: "Item deleted!" };
}