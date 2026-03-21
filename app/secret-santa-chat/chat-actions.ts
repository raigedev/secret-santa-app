"use server";

// ═══════════════════════════════════════
// CHAT SERVER ACTIONS
// ═══════════════════════════════════════
// Handles sending messages in Secret Santa threads.
//
// Security:
// Core#1: Input sanitization (trim, length, strip HTML)
// Core#3: Verify sender is a thread participant
// Core#6: Generic error messages
// Playbook#08: Parameterized queries
// Playbook#19: Server-side auth check
// Playbook#20: Log critical actions
// No dangerouslySetInnerHTML anywhere
// ═══════════════════════════════════════

import { createClient } from "@/lib/supabase/server";

// Core#1: Strip HTML tags, trim, enforce max length
function sanitizeMessage(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 500);
}

export async function sendMessage(
  groupId: string,
  threadGiverId: string,
  threadReceiverId: string,
  content: string
): Promise<{ success: boolean; message: string }> {

  // Core#1: Validate inputs
  if (!groupId || !threadGiverId || !threadReceiverId) {
    return { success: false, message: "Invalid chat thread." };
  }

  const cleanContent = sanitizeMessage(content);

  if (cleanContent.length === 0) {
    return { success: false, message: "Message cannot be empty." };
  }

  // Playbook#19: Server-side auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  // Core#3: Verify sender is either the giver or receiver
  if (user.id !== threadGiverId && user.id !== threadReceiverId) {
    return { success: false, message: "You are not part of this conversation." };
  }

  // Playbook#08: Parameterized insert via Supabase
  const { error } = await supabase
    .from("messages")
    .insert({
      group_id: groupId,
      sender_id: user.id,
      thread_giver_id: threadGiverId,
      thread_receiver_id: threadReceiverId,
      content: cleanContent,
    });

  if (error) {
    // Core#6: Generic message to user
    console.error("[CHAT] Send failed:", error.message);
    return { success: false, message: "Failed to send message. Please try again." };
  }

  // Playbook#20: Log critical action
  console.log(`[CHAT] User ${user.id} sent message in group ${groupId}`);

  return { success: true, message: "" };
}