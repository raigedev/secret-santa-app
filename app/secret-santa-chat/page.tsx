"use client";

import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ChatSkeleton } from "@/app/components/PageSkeleton";
import { createClient } from "@/lib/supabase/client";

import {
  SecretSantaActiveThreadView,
  SecretSantaChatOverview,
  type ChatMessage,
  type ChatThread,
} from "./components";
import { sendMessage } from "./chat-actions";

type MembershipRow = { group_id: string };
type GroupRow = { id: string; name: string | null };
type AssignmentRow = { group_id: string; giver_id: string; receiver_id: string };
type MessageRow = {
  group_id: string;
  thread_giver_id: string;
  thread_receiver_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};
type ThreadReadRow = {
  group_id: string;
  thread_giver_id: string;
  thread_receiver_id: string;
  last_read_at: string;
};
type MemberNicknameRow = { group_id: string; user_id: string; nickname: string | null };

function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, 500);
}

function createThreadKey(groupId: string, giverId: string, receiverId: string): string {
  return `${groupId}:${giverId}:${receiverId}`;
}

function createGroupUserKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
}

function formatThreadTime(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "New";
  }

  const date = new Date(trimmedValue);

  if (Number.isNaN(date.getTime())) {
    return trimmedValue;
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function createPreviewText(senderId: string, currentUserId: string, otherName: string, content: string): string {
  const prefix =
    senderId === currentUserId ? "You: " : otherName === "Secret Santa" ? "Secret Santa: " : `${otherName}: `;

  return prefix + content.slice(0, 60);
}

function buildThreadMetaMap(messages: MessageRow[], readRows: ThreadReadRow[], currentUserId: string) {
  const lastReadByThread = new Map<string, number>();

  for (const row of readRows) {
    lastReadByThread.set(createThreadKey(row.group_id, row.thread_giver_id, row.thread_receiver_id), new Date(row.last_read_at).getTime());
  }

  const metaByThread = new Map<string, { lastSenderId: string; lastContent: string; lastTime: string; unread: number }>();

  for (const message of messages) {
    const threadKey = createThreadKey(message.group_id, message.thread_giver_id, message.thread_receiver_id);
    const lastReadAt = lastReadByThread.get(threadKey) ?? 0;
    const messageTime = new Date(message.created_at).getTime();
    const isUnread = message.sender_id !== currentUserId && messageTime > lastReadAt;
    const existingMeta = metaByThread.get(threadKey);

    if (!existingMeta) {
      metaByThread.set(threadKey, {
        lastSenderId: message.sender_id,
        lastContent: message.content,
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

function applyMessageToThreads(
  currentThreads: ChatThread[],
  message: MessageRow,
  currentUserId: string,
  activeThread: ChatThread | null
): { matched: boolean; threads: ChatThread[] } {
  const targetKey = createThreadKey(message.group_id, message.thread_giver_id, message.thread_receiver_id);
  const activeThreadKey = activeThread ? createThreadKey(activeThread.group_id, activeThread.giver_id, activeThread.receiver_id) : null;
  let matched = false;

  const threads = currentThreads.map((thread) => {
    const threadKey = createThreadKey(thread.group_id, thread.giver_id, thread.receiver_id);

    if (threadKey !== targetKey) {
      return thread;
    }

    matched = true;

    return {
      ...thread,
      last_message: createPreviewText(message.sender_id, currentUserId, thread.other_name, message.content),
      last_time: formatThreadTime(message.created_at),
      unread: activeThreadKey === targetKey || message.sender_id === currentUserId ? 0 : Math.min(thread.unread + 1, 9),
    };
  });

  return { matched, threads };
}

export default function SecretSantaChatPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [threadListMessage, setThreadListMessage] = useState<string | null>(null);
  const [threadMessage, setThreadMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeThreadRef = useRef<ChatThread | null>(null);
  const userIdRef = useRef<string | null>(null);
  const loadThreadsRef = useRef<() => Promise<void>>(null);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const markAsRead = useCallback(
    async (thread: ChatThread, uid: string) => {
      await supabase.from("thread_reads").upsert(
        {
          user_id: uid,
          group_id: thread.group_id,
          thread_giver_id: thread.giver_id,
          thread_receiver_id: thread.receiver_id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "user_id,group_id,thread_giver_id,thread_receiver_id" }
      );
    },
    [supabase]
  );

  useEffect(() => {
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const loadThreads = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const user = session.user;
      setUserId(user.id);

      const { data: memberRows, error: membershipsError } = await supabase.from("group_members").select("group_id").eq("user_id", user.id).eq("status", "accepted");

      if (membershipsError) {
        setThreadListMessage("Failed to load your chats. Please refresh and try again.");
        setThreads([]);
        setLoading(false);
        return;
      }

      const memberships = (memberRows || []) as MembershipRow[];
      const groupIds = [...new Set(memberships.map((row) => row.group_id))];

      if (groupIds.length === 0) {
        setThreadListMessage(null);
        setThreads([]);
        setLoading(false);
        return;
      }

      const [{ data: groupsData, error: groupsError }, { data: giverAssignments, error: giverAssignmentsError }, { data: receiverAssignments, error: receiverAssignmentsError }, { data: allMessages, error: messagesError }, { data: readTimestamps, error: readTimestampsError }] = await Promise.all([
        supabase.from("groups").select("id, name").in("id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("giver_id", user.id).in("group_id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("receiver_id", user.id).in("group_id", groupIds),
        supabase.from("messages").select("group_id, thread_giver_id, thread_receiver_id, sender_id, content, created_at").in("group_id", groupIds).order("created_at", { ascending: false }),
        supabase.from("thread_reads").select("group_id, thread_giver_id, thread_receiver_id, last_read_at").eq("user_id", user.id),
      ]);

      if (groupsError || giverAssignmentsError || receiverAssignmentsError || messagesError || readTimestampsError) {
        setThreadListMessage("Failed to load your chats. Please refresh and try again.");
        setThreads([]);
        setLoading(false);
        return;
      }

      const giverRows = (giverAssignments || []) as AssignmentRow[];
      const receiverRows = (receiverAssignments || []) as AssignmentRow[];
      const receiverUserIds = giverRows.map((assignment) => assignment.receiver_id).filter(Boolean);
      const allUserIds = [...new Set(receiverUserIds)];

      let memberNicknames: MemberNicknameRow[] = [];
      if (allUserIds.length > 0) {
        const { data, error: nicknamesError } = await supabase.from("group_members").select("group_id, user_id, nickname").in("user_id", allUserIds).in("group_id", groupIds).eq("status", "accepted");

        if (!nicknamesError) {
          memberNicknames = (data || []) as MemberNicknameRow[];
        }
      }

      const groupNameById = new Map(((groupsData || []) as GroupRow[]).map((group) => [group.id, group.name || "Unknown"]));
      const receiverNameByGroupUser = new Map(memberNicknames.map((member) => [createGroupUserKey(member.group_id, member.user_id), member.nickname || "Participant"]));
      const threadMetaByKey = buildThreadMetaMap(((allMessages || []) as MessageRow[]), ((readTimestamps || []) as ThreadReadRow[]), user.id);
      const buildThreads: ChatThread[] = [];

      for (const assignment of giverRows) {
        const name = receiverNameByGroupUser.get(createGroupUserKey(assignment.group_id, assignment.receiver_id)) || "Participant";
        const threadMeta = threadMetaByKey.get(createThreadKey(assignment.group_id, assignment.giver_id, assignment.receiver_id));

        buildThreads.push({
          group_id: assignment.group_id,
          group_name: groupNameById.get(assignment.group_id) || "Unknown",
          giver_id: assignment.giver_id,
          receiver_id: assignment.receiver_id,
          other_name: name,
          role: "giver",
          last_message: threadMeta ? createPreviewText(threadMeta.lastSenderId, user.id, name, threadMeta.lastContent) : "No messages yet. Start with a gift question.",
          last_time: threadMeta?.lastTime || "",
          unread: threadMeta?.unread || 0,
        });
      }

      for (const assignment of receiverRows) {
        const threadMeta = threadMetaByKey.get(createThreadKey(assignment.group_id, assignment.giver_id, assignment.receiver_id));

        buildThreads.push({
          group_id: assignment.group_id,
          group_name: groupNameById.get(assignment.group_id) || "Unknown",
          giver_id: assignment.giver_id,
          receiver_id: assignment.receiver_id,
          other_name: "Secret Santa",
          role: "receiver",
          last_message: threadMeta ? createPreviewText(threadMeta.lastSenderId, user.id, "Secret Santa", threadMeta.lastContent) : "No messages yet.",
          last_time: threadMeta?.lastTime || "",
          unread: threadMeta?.unread || 0,
        });
      }

      const currentActiveThread = activeThreadRef.current;
      const nextActiveThread = currentActiveThread ? buildThreads.find((thread) => thread.group_id === currentActiveThread.group_id && thread.giver_id === currentActiveThread.giver_id && thread.receiver_id === currentActiveThread.receiver_id) || null : null;

      setThreads(buildThreads);
      setThreadListMessage(null);

      if (currentActiveThread && !nextActiveThread) {
        setActiveThread(null);
        setMessages([]);
      } else if (nextActiveThread) {
        setActiveThread(nextActiveThread);
      }

      setLoading(false);
    };

    loadThreadsRef.current = loadThreads;
    void loadThreads();

    const scheduleThreadsReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      reloadTimer = setTimeout(() => {
        void loadThreadsRef.current?.();
      }, 120);
    };

    const channel = supabase
      .channel("chat-threads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        const currentUser = userIdRef.current;

        if (!currentUser) {
          return;
        }

        if (payload.eventType !== "INSERT") {
          scheduleThreadsReload();
          return;
        }

        const newMessage = payload.new as MessageRow;

        if (newMessage.thread_giver_id !== currentUser && newMessage.thread_receiver_id !== currentUser) {
          return;
        }

        let matchedExistingThread = false;

        setThreads((currentThreads) => {
          const result = applyMessageToThreads(currentThreads, newMessage, currentUser, activeThreadRef.current);
          matchedExistingThread = result.matched;
          return result.threads;
        });

        if (!matchedExistingThread) {
          void loadThreadsRef.current?.();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => scheduleThreadsReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => scheduleThreadsReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => scheduleThreadsReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "thread_reads" }, () => scheduleThreadsReload())
      .subscribe();

    return () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!activeThread) {
      return;
    }

    let isMounted = true;

    const loadMessages = async () => {
      const { data, error } = await supabase.from("messages").select("id, sender_id, content, created_at").eq("group_id", activeThread.group_id).eq("thread_giver_id", activeThread.giver_id).eq("thread_receiver_id", activeThread.receiver_id).order("created_at", { ascending: true });

      if (error) {
        setThreadMessage("Failed to load messages. Try reopening this chat.");
        return;
      }

      if (isMounted) {
        setThreadMessage(null);
        setMessages((data || []) as ChatMessage[]);
        setTimeout(scrollToBottom, 50);
      }
    };

    void loadMessages();

    const channel = supabase
      .channel(`chat-live-${activeThread.group_id}-${activeThread.giver_id}-${activeThread.receiver_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `group_id=eq.${activeThread.group_id}` }, (payload) => {
        if (!isMounted) {
          return;
        }

        const currentThread = activeThreadRef.current;
        const changedMessage = payload.eventType === "DELETE" ? (payload.old as Partial<MessageRow>) : (payload.new as Partial<MessageRow>);

        if (!currentThread || changedMessage.thread_giver_id !== currentThread.giver_id || changedMessage.thread_receiver_id !== currentThread.receiver_id) {
          return;
        }

        if (payload.eventType !== "INSERT") {
          void loadMessages();
          void loadThreadsRef.current?.();
          return;
        }

        const nextMessage = payload.new as MessageRow & { id: string };

        setMessages((currentMessages) => {
          const withoutOptimisticCopy = currentMessages.filter((message) => !(message.id.startsWith("temp-") && message.sender_id === nextMessage.sender_id));

          if (withoutOptimisticCopy.find((message) => message.id === nextMessage.id)) {
            return withoutOptimisticCopy;
          }

          return [...withoutOptimisticCopy, { id: nextMessage.id, sender_id: nextMessage.sender_id, content: nextMessage.content, created_at: nextMessage.created_at }];
        });

        setThreads((currentThreads) => {
          const currentUser = userIdRef.current;

          if (!currentUser) {
            return currentThreads;
          }

          return applyMessageToThreads(currentThreads, nextMessage, currentUser, currentThread).threads;
        });

        setTimeout(scrollToBottom, 50);

        if (userId) {
          void markAsRead(currentThread, userId);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeThread, markAsRead, scrollToBottom, supabase, userId]);

  const handleSend = useCallback(async () => {
    if (!activeThread || !msgInput.trim() || !userId) {
      return;
    }

    const content = sanitize(msgInput);

    if (!content) {
      return;
    }

    setMsgInput("");
    const tempId = `temp-${Date.now()}`;
    const optimisticCreatedAt = new Date().toISOString();

    setMessages((currentMessages) => [...currentMessages, { id: tempId, sender_id: userId, content, created_at: optimisticCreatedAt }]);
    setThreads((currentThreads) =>
      applyMessageToThreads(
        currentThreads,
        {
          group_id: activeThread.group_id,
          thread_giver_id: activeThread.giver_id,
          thread_receiver_id: activeThread.receiver_id,
          sender_id: userId,
          content,
          created_at: optimisticCreatedAt,
        },
        userId,
        activeThreadRef.current
      ).threads
    );
    setTimeout(scrollToBottom, 30);

    const result = await sendMessage(activeThread.group_id, activeThread.giver_id, activeThread.receiver_id, content);

    if (!result.success) {
      setMessages((currentMessages) => currentMessages.filter((message) => message.id !== tempId));
      setThreadMessage(result.message || "Failed to send your message. Please try again.");
      return;
    }

    setThreadMessage(null);
  }, [activeThread, msgInput, scrollToBottom, userId]);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  const openThread = useCallback(
    (thread: ChatThread) => {
      setMessages([]);
      setThreadMessage(null);
      setActiveThread(thread);
      setThreads((currentThreads) =>
        currentThreads.map((currentThread) =>
          currentThread.group_id === thread.group_id &&
          currentThread.giver_id === thread.giver_id &&
          currentThread.receiver_id === thread.receiver_id
            ? { ...currentThread, unread: 0 }
            : currentThread
        )
      );

      if (userId) {
        void markAsRead(thread, userId);
      }
    },
    [markAsRead, userId]
  );

  const closeThread = useCallback(() => {
    const currentThread = activeThreadRef.current;
    const currentUser = userIdRef.current;

    if (currentThread) {
      setThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.group_id === currentThread.group_id &&
          thread.giver_id === currentThread.giver_id &&
          thread.receiver_id === currentThread.receiver_id
            ? { ...thread, unread: 0 }
            : thread
        )
      );
    }

    if (currentThread && currentUser) {
      void markAsRead(currentThread, currentUser);
    }

    setActiveThread(null);
  }, [markAsRead]);

  const giverThreads = useMemo(() => threads.filter((thread) => thread.role === "giver"), [threads]);
  const receiverThreads = useMemo(() => threads.filter((thread) => thread.role === "receiver"), [threads]);
  const totalUnread = useMemo(() => threads.reduce((total, thread) => total + thread.unread, 0), [threads]);
  const uniqueGroupCount = useMemo(() => new Set(threads.map((thread) => thread.group_id)).size, [threads]);

  if (loading) {
    return <ChatSkeleton />;
  }

  if (activeThread && userId) {
    return (
      <SecretSantaActiveThreadView
        activeThread={activeThread}
        messages={messages}
        msgInput={msgInput}
        threadMessage={threadMessage}
        userId={userId}
        messagesEndRef={messagesEndRef}
        onBackToThreads={closeThread}
        onMessageInputChange={setMsgInput}
        onComposerKeyDown={handleComposerKeyDown}
        onSend={() => {
          void handleSend();
        }}
      />
    );
  }

  return (
    <SecretSantaChatOverview
      threads={threads}
      giverThreads={giverThreads}
      receiverThreads={receiverThreads}
      totalUnread={totalUnread}
      uniqueGroupCount={uniqueGroupCount}
      threadListMessage={threadListMessage}
      onOpenThread={openThread}
      onGoDashboard={() => router.push("/dashboard")}
    />
  );
}
