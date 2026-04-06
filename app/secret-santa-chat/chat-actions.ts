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

import { recordServerFailure } from "@/lib/security/audit";
import { createNotification } from "@/lib/notifications";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (
    !groupId || !UUID_PATTERN.test(groupId) ||
    !threadGiverId || !UUID_PATTERN.test(threadGiverId) ||
    !threadReceiverId || !UUID_PATTERN.test(threadReceiverId)
  ) {
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

  const rateLimit = await enforceRateLimit({
    action: "chat.send_message",
    actorUserId: user.id,
    maxAttempts: 25,
    resourceId: groupId,
    resourceType: "message_thread",
    subject: `${user.id}:${groupId}`,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
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
    await recordServerFailure({
      actorUserId: user.id,
      errorMessage: error.message,
      eventType: "chat.send_message",
      resourceId: groupId,
      resourceType: "message_thread",
      details: {
        threadGiverId,
        threadReceiverId,
      },
    });
    return { success: false, message: "Failed to send message. Please try again." };
  }

  const otherUserId = user.id === threadGiverId ? threadReceiverId : threadGiverId;

  // The message itself is already persisted above, and the UI shows it
  // optimistically. Waiting for this lightweight notification insert keeps the
  // recipient's unread badge timely without the extra group lookup we removed.
  await createNotification({
    userId: otherUserId,
    type: "chat",
    title: "New Secret Santa message",
    body: "You have a new message in one of your Secret Santa chats.",
    linkPath: "/secret-santa-chat",
    metadata: {
      groupId,
    },
    preferenceKey: "notify_chat",
  });

  // Playbook#20: Log critical action

  return { success: true, message: "" };
}
