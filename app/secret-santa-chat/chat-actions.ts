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
import { isGroupInHistory } from "@/lib/groups/history";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid, sanitizePlainText } from "@/lib/validation/common";

const RECEIVER_THREAD_PREFIX = "receiver:";
const CHAT_THREAD_MESSAGE_SCAN_LIMIT = 1000;
const CHAT_ACTIVE_THREAD_MESSAGE_LIMIT = 250;

type ReceiverAssignmentRow = {
  giver_id: string;
  group_id: string;
  receiver_id: string;
};

type ReceiverGroupRow = {
  event_date: string | null;
  id: string;
  name: string | null;
};

type ReceiverMessageRow = {
  content: string;
  created_at: string;
  group_id: string;
  id?: string;
  sender_id: string;
  thread_giver_id: string;
  thread_receiver_id: string;
};

type ReceiverThreadReadRow = {
  group_id: string;
  last_read_at: string;
  thread_giver_id: string;
  thread_receiver_id: string;
};

export type ReceiverChatThread = {
  group_gift_date: string;
  group_id: string;
  group_name: string;
  last_message: string;
  last_time: string;
  other_name: "Secret Santa";
  role: "receiver";
  thread_id: string;
  unread: number;
};

export type SafeChatMessage = {
  content: string;
  created_at: string;
  from_current_user: boolean;
  id: string;
};

// Core#1: Strip HTML tags, trim, enforce max length
function sanitizeMessage(input: string): string {
  return sanitizePlainText(input, 500);
}

function createReceiverThreadId(groupId: string): string {
  return `${RECEIVER_THREAD_PREFIX}${groupId}`;
}

function parseReceiverThreadId(threadId: string): string | null {
  if (!threadId.startsWith(RECEIVER_THREAD_PREFIX)) {
    return null;
  }

  const groupId = threadId.slice(RECEIVER_THREAD_PREFIX.length);
  return isUuid(groupId) ? groupId : null;
}

function createThreadKey(groupId: string, giverId: string, receiverId: string): string {
  return `${groupId}:${giverId}:${receiverId}`;
}

function formatThreadTime(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

function createReceiverPreviewText(
  senderId: string,
  currentUserId: string,
  content: string
): string {
  const preview = content.length > 64 ? `${content.slice(0, 61)}...` : content;
  return senderId === currentUserId ? `You: ${preview}` : `Secret Santa: ${preview}`;
}

function buildReceiverThreadMetaMap(
  messages: ReceiverMessageRow[],
  readRows: ReceiverThreadReadRow[],
  currentUserId: string
): Map<
  string,
  {
    lastContent: string;
    lastSenderId: string;
    lastTime: string;
    unread: number;
  }
> {
  const lastReadByThread = new Map<string, number>();

  for (const row of readRows) {
    lastReadByThread.set(
      createThreadKey(row.group_id, row.thread_giver_id, row.thread_receiver_id),
      new Date(row.last_read_at).getTime()
    );
  }

  const metaByThread = new Map<
    string,
    {
      lastContent: string;
      lastSenderId: string;
      lastTime: string;
      unread: number;
    }
  >();

  for (const message of messages) {
    const threadKey = createThreadKey(
      message.group_id,
      message.thread_giver_id,
      message.thread_receiver_id
    );
    const lastReadAt = lastReadByThread.get(threadKey) ?? 0;
    const messageTime = new Date(message.created_at).getTime();
    const isUnread = message.sender_id !== currentUserId && messageTime > lastReadAt;
    const existingMeta = metaByThread.get(threadKey);

    if (!existingMeta) {
      metaByThread.set(threadKey, {
        lastContent: message.content,
        lastSenderId: message.sender_id,
        lastTime: formatThreadTime(message.created_at),
        unread: isUnread ? 1 : 0,
      });
      continue;
    }

    if (isUnread) {
      existingMeta.unread = Math.min(existingMeta.unread + 1, 9);
    }
  }

  return metaByThread;
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || null;
}

async function resolveReceiverAssignment(
  groupId: string,
  receiverId: string
): Promise<ReceiverAssignmentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("assignments")
    .select("group_id, giver_id, receiver_id")
    .eq("group_id", groupId)
    .eq("receiver_id", receiverId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ReceiverAssignmentRow;
}

export async function loadReceiverChatThreads(): Promise<{
  message: string;
  success: boolean;
  threads: ReceiverChatThread[];
}> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, message: "You must be logged in.", threads: [] };
  }

  const rateLimit = await enforceRateLimit({
    action: "chat.load_receiver_threads",
    actorUserId: userId,
    maxAttempts: 500,
    resourceType: "message_thread",
    subject: userId,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message, threads: [] };
  }

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from("assignments")
    .select("group_id, giver_id, receiver_id")
    .eq("receiver_id", userId);

  if (assignmentsError) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: assignmentsError.message,
      eventType: "chat.load_receiver_threads.assignments",
      resourceType: "message_thread",
    });
    return { success: false, message: "We could not load your Santa chats.", threads: [] };
  }

  const receiverAssignments = (assignments || []) as ReceiverAssignmentRow[];
  const groupIds = [...new Set(receiverAssignments.map((assignment) => assignment.group_id))];

  if (groupIds.length === 0) {
    return { success: true, message: "", threads: [] };
  }

  const { data: groups, error: groupsError } = await supabaseAdmin
    .from("groups")
    .select("id, name, event_date")
    .in("id", groupIds);

  if (groupsError) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: groupsError.message,
      eventType: "chat.load_receiver_threads.groups",
      resourceType: "message_thread",
    });
    return { success: false, message: "We could not load your Santa chats.", threads: [] };
  }

  const activeGroups = ((groups || []) as ReceiverGroupRow[]).filter(
    (group) => !isGroupInHistory(group.event_date)
  );
  const activeGroupIds = new Set(activeGroups.map((group) => group.id));
  const activeAssignments = receiverAssignments.filter((assignment) =>
    activeGroupIds.has(assignment.group_id)
  );

  if (activeAssignments.length === 0) {
    return { success: true, message: "", threads: [] };
  }

  const activeGroupIdList = [...activeGroupIds];
  const [messagesResult, readsResult] = await Promise.all([
    supabaseAdmin
      .from("messages")
      .select("id, group_id, thread_giver_id, thread_receiver_id, sender_id, content, created_at")
      .eq("thread_receiver_id", userId)
      .in("group_id", activeGroupIdList)
      .order("created_at", { ascending: false })
      .limit(CHAT_THREAD_MESSAGE_SCAN_LIMIT),
    supabaseAdmin
      .from("thread_reads")
      .select("group_id, thread_giver_id, thread_receiver_id, last_read_at")
      .eq("user_id", userId)
      .eq("thread_receiver_id", userId)
      .in("group_id", activeGroupIdList),
  ]);

  if (messagesResult.error || readsResult.error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: messagesResult.error?.message || readsResult.error?.message || "Unknown chat load failure.",
      eventType: "chat.load_receiver_threads.thread_meta",
      resourceType: "message_thread",
    });
    return { success: false, message: "We could not load your Santa chats.", threads: [] };
  }

  const groupsById = new Map(activeGroups.map((group) => [group.id, group]));
  const threadMetaByKey = buildReceiverThreadMetaMap(
    (messagesResult.data || []) as ReceiverMessageRow[],
    (readsResult.data || []) as ReceiverThreadReadRow[],
    userId
  );

  return {
    success: true,
    message: "",
    threads: activeAssignments.map((assignment) => {
      const group = groupsById.get(assignment.group_id);
      const threadMeta = threadMetaByKey.get(
        createThreadKey(assignment.group_id, assignment.giver_id, assignment.receiver_id)
      );

      return {
        group_gift_date: group?.event_date || "",
        group_id: assignment.group_id,
        group_name: group?.name || "Unknown",
        last_message: threadMeta
          ? createReceiverPreviewText(threadMeta.lastSenderId, userId, threadMeta.lastContent)
          : "No messages yet",
        last_time: threadMeta?.lastTime || "",
        other_name: "Secret Santa",
        role: "receiver",
        thread_id: createReceiverThreadId(assignment.group_id),
        unread: threadMeta?.unread || 0,
      };
    }),
  };
}

export async function loadReceiverThreadMessages(threadId: string): Promise<{
  message: string;
  messages: SafeChatMessage[];
  success: boolean;
}> {
  const groupId = parseReceiverThreadId(threadId);

  if (!groupId) {
    return { success: false, message: "Choose a valid chat first.", messages: [] };
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, message: "You must be logged in.", messages: [] };
  }

  const assignment = await resolveReceiverAssignment(groupId, userId);

  if (!assignment) {
    return { success: false, message: "You are not part of this conversation.", messages: [] };
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, sender_id, content, created_at")
    .eq("group_id", assignment.group_id)
    .eq("thread_giver_id", assignment.giver_id)
    .eq("thread_receiver_id", assignment.receiver_id)
    .order("created_at", { ascending: false })
    .limit(CHAT_ACTIVE_THREAD_MESSAGE_LIMIT);

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "chat.load_receiver_messages",
      resourceId: groupId,
      resourceType: "message_thread",
    });
    return { success: false, message: "We could not load messages. Try reopening this chat.", messages: [] };
  }

  return {
    success: true,
    message: "",
    messages: ((data || []) as ReceiverMessageRow[]).reverse().map((message) => ({
      content: message.content,
      created_at: message.created_at,
      from_current_user: message.sender_id === userId,
      id: message.id || `${message.created_at}:${message.sender_id}`,
    })),
  };
}

export async function markReceiverThreadAsRead(threadId: string): Promise<{
  message: string;
  success: boolean;
}> {
  const groupId = parseReceiverThreadId(threadId);

  if (!groupId) {
    return { success: false, message: "Choose a valid chat first." };
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, message: "You must be logged in." };
  }

  const assignment = await resolveReceiverAssignment(groupId, userId);

  if (!assignment) {
    return { success: false, message: "You are not part of this conversation." };
  }

  const { error } = await supabaseAdmin.from("thread_reads").upsert(
    {
      group_id: assignment.group_id,
      last_read_at: new Date().toISOString(),
      thread_giver_id: assignment.giver_id,
      thread_receiver_id: assignment.receiver_id,
      user_id: userId,
    },
    { onConflict: "user_id,group_id,thread_giver_id,thread_receiver_id" }
  );

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "chat.mark_receiver_thread_read",
      resourceId: groupId,
      resourceType: "message_thread",
    });
    return { success: false, message: "We could not update this chat." };
  }

  return { success: true, message: "" };
}

export async function sendReceiverMessage(
  threadId: string,
  content: string
): Promise<{ success: boolean; message: string }> {
  const groupId = parseReceiverThreadId(threadId);

  if (!groupId) {
    return { success: false, message: "Choose a valid chat first." };
  }

  const cleanContent = sanitizeMessage(content);

  if (cleanContent.length === 0) {
    return { success: false, message: "Write a message before sending." };
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, message: "You must be logged in." };
  }

  const rateLimit = await enforceRateLimit({
    action: "chat.send_receiver_message",
    actorUserId: userId,
    maxAttempts: 25,
    resourceId: groupId,
    resourceType: "message_thread",
    subject: `${userId}:${groupId}`,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message };
  }

  const assignment = await resolveReceiverAssignment(groupId, userId);

  if (!assignment) {
    return { success: false, message: "You are not part of this conversation." };
  }

  const { error } = await supabaseAdmin.from("messages").insert({
    content: cleanContent,
    group_id: assignment.group_id,
    sender_id: userId,
    thread_giver_id: assignment.giver_id,
    thread_receiver_id: assignment.receiver_id,
  });

  if (error) {
    await recordServerFailure({
      actorUserId: userId,
      errorMessage: error.message,
      eventType: "chat.send_receiver_message",
      resourceId: groupId,
      resourceType: "message_thread",
    });
    return { success: false, message: "We could not send your message. Please try again." };
  }

  await createNotification({
    userId: assignment.giver_id,
    type: "chat",
    title: "New private gift message",
    body: "You have a new message in one of your Secret Santa chats.",
    linkPath: "/secret-santa-chat",
    metadata: {
      groupId,
    },
    preferenceKey: "notify_chat",
  });

  return { success: true, message: "" };
}

export async function sendMessage(
  groupId: string,
  threadGiverId: string,
  threadReceiverId: string,
  content: string
): Promise<{ success: boolean; message: string }> {

  // Core#1: Validate inputs
  if (
    !isUuid(groupId) ||
    !isUuid(threadGiverId) ||
    !isUuid(threadReceiverId)
  ) {
    return { success: false, message: "Choose a valid chat first." };
  }

  const cleanContent = sanitizeMessage(content);

  if (cleanContent.length === 0) {
    return { success: false, message: "Write a message before sending." };
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
    return { success: false, message: "We could not send your message. Please try again." };
  }

  const otherUserId = user.id === threadGiverId ? threadReceiverId : threadGiverId;

  // The message itself is already persisted above, and the UI shows it
  // optimistically. Waiting for this lightweight notification insert keeps the
  // recipient's unread badge timely without the extra group lookup we removed.
  await createNotification({
    userId: otherUserId,
    type: "chat",
    title: "New private gift message",
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
