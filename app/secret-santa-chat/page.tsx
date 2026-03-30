"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatSkeleton } from "@/app/components/PageSkeleton";
import { sendMessage } from "./chat-actions";

type Thread = {
  group_id: string;
  group_name: string;
  giver_id: string;
  receiver_id: string;
  other_name: string;
  role: "giver" | "receiver";
  last_message: string;
  last_time: string;
  unread: number;
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type MembershipRow = {
  group_id: string;
};

type GroupRow = {
  id: string;
  name: string | null;
};

type AssignmentRow = {
  group_id: string;
  giver_id: string;
  receiver_id: string;
};

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

type MemberNicknameRow = {
  group_id: string;
  user_id: string;
  nickname: string | null;
};

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
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createPreviewText(
  senderId: string,
  currentUserId: string,
  otherName: string,
  content: string
): string {
  const prefix =
    senderId === currentUserId
      ? "You: "
      : otherName === "Secret Santa"
        ? "Secret Santa: "
        : `${otherName}: `;

  return prefix + content.slice(0, 60);
}

function buildThreadMetaMap(
  messages: MessageRow[],
  readRows: ThreadReadRow[],
  currentUserId: string
): Map<
  string,
  {
    lastSenderId: string;
    lastContent: string;
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
      lastSenderId: string;
      lastContent: string;
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

    // Messages are loaded newest-first, so the first entry becomes the preview.
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
  currentThreads: Thread[],
  message: MessageRow,
  currentUserId: string,
  activeThread: Thread | null
): { matched: boolean; threads: Thread[] } {
  const targetKey = createThreadKey(
    message.group_id,
    message.thread_giver_id,
    message.thread_receiver_id
  );
  const activeThreadKey = activeThread
    ? createThreadKey(activeThread.group_id, activeThread.giver_id, activeThread.receiver_id)
    : null;

  let matched = false;

  const threads = currentThreads.map((thread) => {
    const threadKey = createThreadKey(thread.group_id, thread.giver_id, thread.receiver_id);

    if (threadKey !== targetKey) {
      return thread;
    }

    matched = true;

    return {
      ...thread,
      last_message: createPreviewText(
        message.sender_id,
        currentUserId,
        thread.other_name,
        message.content
      ),
      last_time: formatThreadTime(message.created_at),
      unread:
        activeThreadKey === targetKey || message.sender_id === currentUserId
          ? 0
          : Math.min(thread.unread + 1, 9),
    };
  });

  return { matched, threads };
}

export default function SecretSantaChatPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeThreadRef = useRef<Thread | null>(null);
  const userIdRef = useRef<string | null>(null);
  const loadThreadsRef = useRef<() => Promise<void>>(null);

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
    async (thread: Thread, uid: string) => {
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

  // ─── Load threads on mount + real-time ───
  useEffect(() => {
    const loadThreads = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const user = session.user;
      setUserId(user.id);

      const { data: memberRows, error: membershipsError } = await supabase
        .from("group_members").select("group_id")
        .eq("user_id", user.id).eq("status", "accepted");

      if (membershipsError) {
        console.error("[Chat] Failed to load memberships:", membershipsError);
        setThreads([]);
        setLoading(false);
        return;
      }

      const memberships = (memberRows || []) as MembershipRow[];
      const groupIds = [...new Set(memberships.map((row) => row.group_id))];
      if (groupIds.length === 0) { setThreads([]); setLoading(false); return; }

      const [
        { data: groupsData, error: groupsError },
        { data: giverAssignments, error: giverAssignmentsError },
        { data: receiverAssignments, error: receiverAssignmentsError },
        { data: allMessages, error: messagesError },
        { data: readTimestamps, error: readTimestampsError },
      ] = await Promise.all([
        supabase.from("groups").select("id, name").in("id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("giver_id", user.id).in("group_id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("receiver_id", user.id).in("group_id", groupIds),
        supabase.from("messages").select("group_id, thread_giver_id, thread_receiver_id, sender_id, content, created_at").in("group_id", groupIds).order("created_at", { ascending: false }),
        supabase.from("thread_reads").select("group_id, thread_giver_id, thread_receiver_id, last_read_at").eq("user_id", user.id),
      ]);

      if (
        groupsError ||
        giverAssignmentsError ||
        receiverAssignmentsError ||
        messagesError ||
        readTimestampsError
      ) {
        console.error("[Chat] Failed to load thread data:", {
          groupsError,
          giverAssignmentsError,
          receiverAssignmentsError,
          messagesError,
          readTimestampsError,
        });
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
        const { data, error: nicknamesError } = await supabase.from("group_members").select("group_id, user_id, nickname")
          .in("user_id", allUserIds).in("group_id", groupIds).eq("status", "accepted");

        if (nicknamesError) {
          console.error("[Chat] Failed to load participant nicknames:", nicknamesError);
        } else {
          memberNicknames = (data || []) as MemberNicknameRow[];
        }
      }

      const groupNameById = new Map(
        ((groupsData || []) as GroupRow[]).map((group) => [group.id, group.name || "Unknown"])
      );
      const receiverNameByGroupUser = new Map(
        memberNicknames.map((member) => [
          createGroupUserKey(member.group_id, member.user_id),
          member.nickname || "Participant",
        ])
      );
      const threadMetaByKey = buildThreadMetaMap(
        ((allMessages || []) as MessageRow[]),
        ((readTimestamps || []) as ThreadReadRow[]),
        user.id
      );

      const buildThreads: Thread[] = [];

      for (const a of giverRows) {
        const name =
          receiverNameByGroupUser.get(createGroupUserKey(a.group_id, a.receiver_id)) ||
          "Participant";
        const threadMeta = threadMetaByKey.get(
          createThreadKey(a.group_id, a.giver_id, a.receiver_id)
        );
        buildThreads.push({
          group_id: a.group_id,
          group_name: groupNameById.get(a.group_id) || "Unknown",
          giver_id: a.giver_id,
          receiver_id: a.receiver_id,
          other_name: name,
          role: "giver",
          last_message: threadMeta
            ? createPreviewText(threadMeta.lastSenderId, user.id, name, threadMeta.lastContent)
            : "No messages yet - say hi!",
          last_time: threadMeta?.lastTime || "",
          unread: threadMeta?.unread || 0,
        });
      }

      for (const a of receiverRows) {
        const threadMeta = threadMetaByKey.get(
          createThreadKey(a.group_id, a.giver_id, a.receiver_id)
        );
        buildThreads.push({
          group_id: a.group_id,
          group_name: groupNameById.get(a.group_id) || "Unknown",
          giver_id: a.giver_id,
          receiver_id: a.receiver_id,
          other_name: "Secret Santa",
          role: "receiver",
          last_message: threadMeta
            ? createPreviewText(
                threadMeta.lastSenderId,
                user.id,
                "Secret Santa",
                threadMeta.lastContent
              )
            : "No messages yet",
          last_time: threadMeta?.lastTime || "",
          unread: threadMeta?.unread || 0,
        });
      }

      setThreads(buildThreads);
      setLoading(false);
    };

    loadThreadsRef.current = loadThreads;

    void loadThreads();

    const channel = supabase
      .channel("chat-threads-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const currentUserId = userIdRef.current;

          if (!currentUserId) {
            return;
          }

          const newMessage = payload.new as MessageRow;

          if (
            newMessage.thread_giver_id !== currentUserId &&
            newMessage.thread_receiver_id !== currentUserId
          ) {
            return;
          }

          let matchedExistingThread = false;

          setThreads((currentThreads) => {
            const result = applyMessageToThreads(
              currentThreads,
              newMessage,
              currentUserId,
              activeThreadRef.current
            );

            matchedExistingThread = result.matched;
            return result.threads;
          });

          if (!matchedExistingThread) {
            void loadThreadsRef.current?.();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, router]);

  // ─── Load messages + real-time for active thread ───
  useEffect(() => {
    if (!activeThread) return;

    let isMounted = true;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("group_id", activeThread.group_id)
        .eq("thread_giver_id", activeThread.giver_id)
        .eq("thread_receiver_id", activeThread.receiver_id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[Chat] Failed to load messages:", error);
        return;
      }

      if (isMounted) {
        setMessages((data || []) as Message[]);
        setTimeout(scrollToBottom, 50);
      }
    };

    void loadMessages();

    const channel = supabase
      .channel(`chat-live-${activeThread.group_id}-${activeThread.giver_id}-${activeThread.receiver_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${activeThread.group_id}`,
        },
        (payload) => {
          if (!isMounted) return;

          const nextMessage = payload.new as MessageRow & { id: string };
          const currentThread = activeThreadRef.current;

          if (
            !currentThread ||
            nextMessage.thread_giver_id !== currentThread.giver_id ||
            nextMessage.thread_receiver_id !== currentThread.receiver_id
          ) {
            return;
          }

          setMessages((currentMessages) => {
            const withoutOptimisticCopy = currentMessages.filter(
              (message) =>
                !(message.id.startsWith("temp-") && message.sender_id === nextMessage.sender_id)
            );

            if (withoutOptimisticCopy.find((message) => message.id === nextMessage.id)) {
              return withoutOptimisticCopy;
            }

            return [
              ...withoutOptimisticCopy,
              {
                id: nextMessage.id,
                sender_id: nextMessage.sender_id,
                content: nextMessage.content,
                created_at: nextMessage.created_at,
              },
            ];
          });
          setThreads((currentThreads) => {
            const currentUserId = userIdRef.current;

            if (!currentUserId) {
              return currentThreads;
            }

            return applyMessageToThreads(
              currentThreads,
              nextMessage,
              currentUserId,
              currentThread
            ).threads;
          });
          setTimeout(scrollToBottom, 50);

          if (userId) {
            void markAsRead(currentThread, userId);
          }
        }
      )
      .subscribe();

    return () => { isMounted = false; supabase.removeChannel(channel); };
  }, [activeThread, supabase, scrollToBottom, markAsRead, userId]);

  const handleSend = async () => {
    if (!activeThread || !msgInput.trim() || !userId) return;
    const content = sanitize(msgInput);
    if (!content) return;

    setMsgInput("");
    const tempId = `temp-${Date.now()}`;
    const optimisticCreatedAt = new Date().toISOString();

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: userId,
        content,
        created_at: optimisticCreatedAt,
      },
    ]);
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

    const result = await sendMessage(
      activeThread.group_id,
      activeThread.giver_id,
      activeThread.receiver_id,
      content
    );

    if (!result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const openThread = (t: Thread) => {
    // Clear the previous thread immediately so we do not flash stale messages
    // while the next conversation history is loading.
    setMessages([]);
    setActiveThread(t);
    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.group_id === t.group_id &&
        thread.giver_id === t.giver_id &&
        thread.receiver_id === t.receiver_id
          ? { ...thread, unread: 0 }
          : thread
      )
    );

    if (userId) {
      void markAsRead(t, userId);
    }
  };

  const giverThreads = useMemo(() => threads.filter((t) => t.role === "giver"), [threads]);
  const receiverThreads = useMemo(() => threads.filter((t) => t.role === "receiver"), [threads]);

  if (loading) return <ChatSkeleton />;

  // ═══ CHAT VIEW ═══
  if (activeThread) {
    const isGiver = activeThread.role === "giver";
    return (
      <main className="min-h-screen relative" style={{ background: "linear-gradient(180deg,#0a1628 0%,#0f1f3d 20%,#162d50 50%,#0f1f3d 80%,#0a1628 100%)", fontFamily: "'Nunito', sans-serif", color: "#fff" }}>
        <div className="relative z-10 max-w-[720px] mx-auto px-4 py-6">
          <div className="rounded-[18px] overflow-hidden" style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${isGiver ? "rgba(251,191,36,.15)" : "rgba(34,197,94,.15)"}` }}>
            <div className="flex items-center justify-between p-4" style={{ background: "rgba(255,255,255,.04)", borderBottom: `1px solid ${isGiver ? "rgba(251,191,36,.1)" : "rgba(34,197,94,.1)"}` }}>
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-[18px]"
                  style={{ background: isGiver ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                  {isGiver ? "🎁" : "🎅"}
                </div>
                <div>
                  <div className="text-[16px] font-extrabold" style={{ color: isGiver ? "#fbbf24" : "#86efac" }}>{activeThread.other_name}</div>
                  <div className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,.58)" }}>
                    {activeThread.group_name}{isGiver && ` · ${activeThread.other_name} sees you as "🎅 Secret Santa"`}
                  </div>
                </div>
              </div>
              <button onClick={async () => {
                if (activeThread && userId) {
                  await markAsRead(activeThread, userId);
                  setThreads((currentThreads) =>
                    currentThreads.map((thread) =>
                      thread.group_id === activeThread.group_id &&
                      thread.giver_id === activeThread.giver_id &&
                      thread.receiver_id === activeThread.receiver_id
                        ? { ...thread, unread: 0 }
                        : thread
                    )
                  );
                }
                setActiveThread(null);
              }} className="px-4 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.78)", border: "1px solid rgba(255,255,255,.1)", fontFamily: "inherit", cursor: "pointer" }}>
                ← Back
              </button>
            </div>

            <div className="flex items-center justify-center py-2.5" style={{ background: isGiver ? "rgba(251,191,36,.06)" : "rgba(34,197,94,.06)" }}>
              <span className="text-[11px] font-extrabold px-3.5 py-1.5 rounded-full"
                style={{ background: isGiver ? "rgba(251,191,36,.12)" : "rgba(34,197,94,.12)", color: isGiver ? "#fbbf24" : "#86efac" }}>
                {isGiver ? `🎁 You are ${activeThread.other_name}'s Secret Santa` : "🎅 This person drew your name — identity hidden!"}
              </span>
            </div>

            <div className="p-5 overflow-y-auto flex flex-col gap-3" style={{ maxHeight: "55vh", minHeight: "280px" }}>
              {messages.length === 0 ? (
                <div className="text-center py-10" style={{ color: "rgba(255,255,255,.28)" }}>
                  <div className="text-[40px] mb-2">💬</div>
                  <p className="text-[13px] font-semibold">No messages yet — send the first one!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  const isTemp = msg.id.startsWith("temp-");
                  return (
                    <div key={msg.id} className={`max-w-[82%] px-4 py-3 rounded-[16px] text-[14px] leading-[1.65] shadow-sm ${isMine ? "self-end" : "self-start"}`}
                      style={{
                        background: isMine ? (isGiver ? "linear-gradient(135deg,#b45309,#d97706)" : "linear-gradient(135deg,#2563eb,#3b82f6)") : "rgba(15,23,42,.72)",
                        color: isMine ? "#fff" : "rgba(255,255,255,.95)",
                        border: isMine ? "none" : "1px solid rgba(255,255,255,.08)",
                        borderBottomRightRadius: isMine ? "4px" : "14px",
                        borderBottomLeftRadius: isMine ? "14px" : "4px",
                        opacity: isTemp ? 0.7 : 1,
                      }}>
                      <div className="text-[11px] font-bold mb-1" style={{ opacity: .78 }}>
                        {isMine ? (isGiver ? "You (as 🎅 Secret Santa)" : "You") : (isGiver ? activeThread.other_name : "🎅 Secret Santa")}
                      </div>
                      <div style={{ wordBreak: "break-word" }}>{msg.content}</div>
                      <div className="text-[10px] mt-2" style={{ opacity: .58 }}>
                        {isTemp ? "Sending..." : new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2 p-4" style={{ background: "rgba(255,255,255,.03)", borderTop: `1px solid ${isGiver ? "rgba(251,191,36,.08)" : "rgba(34,197,94,.08)"}` }}>
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={isGiver ? `Message ${activeThread.other_name} as 🎅 Secret Santa...` : "Reply to your Secret Santa..."}
                maxLength={500}
                className="flex-1 px-4 py-3 rounded-xl text-[14px] outline-none"
                style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${isGiver ? "rgba(251,191,36,.16)" : "rgba(34,197,94,.16)"}`, color: "#fff", fontFamily: "inherit" }} />
              <button onClick={handleSend} disabled={!msgInput.trim()}
                className="px-5 py-3 rounded-xl text-[13px] font-bold text-white transition"
                style={{
                  background: msgInput.trim() ? (isGiver ? "linear-gradient(135deg,#b45309,#d97706)" : "linear-gradient(135deg,#2563eb,#3b82f6)") : "rgba(255,255,255,.08)",
                  color: msgInput.trim() ? "#fff" : "rgba(255,255,255,.3)",
                  border: "none", fontFamily: "inherit",
                  cursor: msgInput.trim() ? "pointer" : "not-allowed",
                  boxShadow: msgInput.trim() ? (isGiver ? "0 2px 10px rgba(180,83,9,.3)" : "0 2px 10px rgba(37,99,235,.3)") : "none",
                }}>
                {isGiver ? "Send 🎁" : "Send 💬"}
              </button>
            </div>
          </div>

          {isGiver && (
            <p className="text-center text-[11px] mt-3" style={{ color: "rgba(255,255,255,.2)" }}>
              🔒 {activeThread.other_name} sees your messages as &quot;🎅 Your Secret Santa&quot; — your identity stays hidden
            </p>
          )}
        </div>
      </main>
    );
  }

  // ═══ THREAD LIST VIEW ═══
  return (
    <main className="min-h-screen relative overflow-x-hidden" style={{ background: "linear-gradient(180deg,#0a1628 0%,#0f1f3d 20%,#162d50 50%,#0f1f3d 80%,#0a1628 100%)", fontFamily: "'Nunito', sans-serif", color: "#fff" }}>
      <div id="snowWrap" className="fixed inset-0 pointer-events-none z-0 overflow-hidden" />
      <style>{`
        .snowflake{position:absolute;background:#fff;border-radius:50%;animation:fall linear infinite;}
        @keyframes fall{0%{transform:translateY(-10px) translateX(0);opacity:.5;}50%{transform:translateY(50vh) translateX(12px);}100%{transform:translateY(105vh) translateX(-6px);opacity:.1;}}
      `}</style>

      <div className="relative z-10 max-w-[720px] mx-auto px-4 py-6">
        <button onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-5 px-4 py-2 rounded-lg transition"
          style={{ color: "rgba(255,255,255,.6)", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", fontFamily: "inherit" }}>
          ← Back to Dashboard
        </button>

        <div className="text-center mb-6">
          <h1 className="text-[32px] font-bold mb-1" style={{ fontFamily: "'Fredoka', sans-serif", textShadow: "0 2px 8px rgba(0,0,0,.3)" }}>💬 Secret Santa Chat</h1>
          <p className="text-[14px] font-semibold" style={{ color: "#efe4d0" }}>Private conversations with your matches</p>
        </div>

        <div
          className="flex items-stretch gap-4 mb-6 p-4 rounded-[24px]"
          style={{
            background: "rgba(255,255,255,.045)",
            border: "1px solid rgba(255,255,255,.08)",
            boxShadow: "0 10px 30px rgba(0,0,0,.08)",
          }}
        >
          <div className="flex-1 p-4 rounded-xl" style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.12)" }}>
            <div className="flex items-start gap-3">
              <div
                className="w-[44px] h-[44px] rounded-xl flex items-center justify-center text-[24px] flex-shrink-0"
                style={{ background: "rgba(251,191,36,.12)" }}
              >
                🎁
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold" style={{ color: "#fbbf24" }}>
                  You → Recipient
                </div>
                <div
                  className="text-[12px] font-semibold mt-2"
                  style={{ color: "#f6ead3", lineHeight: 1.45 }}
                >
                  You know who they are.
                </div>
                <div
                  className="text-[11px] font-semibold mt-1"
                  style={{ color: "#d8c4a0", lineHeight: 1.45 }}
                >
                  They see you as &quot;🎅 Secret Santa&quot;.
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 min-w-[108px]">
            <div
              className="w-px h-5"
              style={{ background: "linear-gradient(180deg,transparent,rgba(255,255,255,.16),transparent)" }}
            />
            <div
              className="text-center px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-[0.14em]"
              style={{
                color: "#ffd7d7",
                background: "rgba(192,57,43,.16)",
                border: "1px solid rgba(231,76,60,.22)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
              }}
            >
              How It Works
            </div>
            <div
              className="w-px h-5"
              style={{ background: "linear-gradient(180deg,transparent,rgba(255,255,255,.16),transparent)" }}
            />
          </div>
          <div
            className="flex-1 p-4 rounded-xl"
            style={{ background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.12)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-[44px] h-[44px] rounded-xl flex items-center justify-center text-[24px] flex-shrink-0"
                style={{ background: "rgba(34,197,94,.12)" }}
              >
                🎅
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold" style={{ color: "#86efac" }}>
                  Secret Santa → You
                </div>
                <div
                  className="text-[12px] font-semibold mt-2"
                  style={{ color: "#e5f7e5", lineHeight: 1.45 }}
                >
                  Someone drew your name.
                </div>
                <div
                  className="text-[11px] font-semibold mt-1"
                  style={{ color: "#b9d7be", lineHeight: 1.45 }}
                >
                  You don&apos;t know who they are yet.
                </div>
              </div>
            </div>
          </div>
        </div>

        {threads.length === 0 ? (
          <div className="text-center py-12 rounded-[18px]" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div className="text-[48px] mb-3">💬</div>
            <div className="text-[18px] font-bold" style={{ fontFamily: "'Fredoka', sans-serif", color: "rgba(255,255,255,.7)" }}>No chats yet</div>
            <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,.35)" }}>Once names are drawn, your chat threads will appear here!</p>
          </div>
        ) : (
          <>
            {giverThreads.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-[40px] h-[40px] rounded-xl flex items-center justify-center text-[20px]" style={{ background: "rgba(251,191,36,.15)" }}>🎁</div>
                  <div>
                    <div className="text-[18px] font-bold" style={{ fontFamily: "'Fredoka', sans-serif", color: "#fbbf24" }}>People You&apos;re Buying For</div>
                    <div className="text-[11px] font-semibold" style={{ color: "#d8c4a0" }}>You know who they are — they don&apos;t know it&apos;s you!</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 mb-7">
                  {giverThreads.map((t, i) => (
                    <div key={`g-${i}`} onClick={() => openThread(t)}
                      className="cursor-pointer flex items-center justify-between p-4 rounded-[16px] transition hover:translate-x-1"
                      style={{ background: "linear-gradient(135deg,rgba(251,191,36,.07),rgba(245,158,11,.04))", border: "1px solid rgba(251,191,36,.15)", borderLeft: "4px solid #fbbf24", boxShadow: "0 6px 20px rgba(0,0,0,.08)" }}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center text-[20px] flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)", boxShadow: "0 3px 12px rgba(251,191,36,.25)" }}>🎁</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[17px] font-extrabold" style={{ color: "#fbbf24" }}>{t.other_name}</div>
                          <div className="text-[11px] font-semibold mt-1" style={{ color: "#ddd3c1" }}>{t.group_name}</div>
                          <div className="mt-2 rounded-xl px-3 py-2" style={{ background: "rgba(15,23,42,.35)", border: "1px solid rgba(251,191,36,.08)" }}>
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "rgba(251,191,36,.8)" }}>Latest message</div>
                            <div className="text-[13px] font-semibold mt-1 truncate" style={{ color: "#f8f1e4" }}>{t.last_message}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                        {t.last_time && <span className="text-[11px] font-semibold px-2 py-1 rounded-md" style={{ color: "#f3e3c2", background: "rgba(92,58,15,.28)" }}>{t.last_time}</span>}
                        {t.unread > 0 && (
                          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
                            style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 2px 8px rgba(220,38,38,.3)" }}>{t.unread}</div>
                        )}
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md" style={{ background: "rgba(251,191,36,.12)", color: "#fbbf24" }}>You → Recipient</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {giverThreads.length > 0 && receiverThreads.length > 0 && (
              <div className="my-5" style={{ height: "1px", background: "rgba(255,255,255,.06)" }} />
            )}

            {receiverThreads.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-[40px] h-[40px] rounded-xl flex items-center justify-center text-[20px]" style={{ background: "rgba(34,197,94,.15)" }}>🎅</div>
                  <div>
                    <div className="text-[18px] font-bold" style={{ fontFamily: "'Fredoka', sans-serif", color: "#86efac" }}>Your Mystery Santa</div>
                    <div className="text-[11px] font-semibold" style={{ color: "#b9d7be" }}>Someone drew your name — you don&apos;t know who!</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {receiverThreads.map((t, i) => (
                    <div key={`r-${i}`} onClick={() => openThread(t)}
                      className="cursor-pointer flex items-center justify-between p-4 rounded-[16px] transition hover:translate-x-1"
                      style={{ background: "linear-gradient(135deg,rgba(34,197,94,.07),rgba(22,163,74,.04))", border: "1px solid rgba(34,197,94,.15)", borderLeft: "4px solid #22c55e", boxShadow: "0 6px 20px rgba(0,0,0,.08)" }}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center text-[20px] flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 3px 12px rgba(34,197,94,.25)" }}>🎅</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[17px] font-extrabold" style={{ color: "#86efac" }}>Secret Santa</div>
                          <div className="text-[11px] font-semibold mt-1" style={{ color: "#d6ead8" }}>{t.group_name}</div>
                          <div className="mt-2 rounded-xl px-3 py-2" style={{ background: "rgba(15,23,42,.35)", border: "1px solid rgba(34,197,94,.08)" }}>
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "rgba(134,239,172,.85)" }}>Latest message</div>
                            <div className="text-[13px] font-semibold mt-1 truncate" style={{ color: "#eef8ef" }}>{t.last_message}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                        {t.last_time && <span className="text-[11px] font-semibold px-2 py-1 rounded-md" style={{ color: "#dff5df", background: "rgba(18,84,41,.28)" }}>{t.last_time}</span>}
                        {t.unread > 0 && (
                          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
                            style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 2px 8px rgba(220,38,38,.3)" }}>{t.unread}</div>
                        )}
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md" style={{ background: "rgba(34,197,94,.12)", color: "#86efac" }}>Secret Santa → You</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="flex items-start gap-2 mt-6 p-3.5 rounded-xl" style={{ background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.1)" }}>
          <span className="text-[16px] flex-shrink-0">🔒</span>
          <div className="text-[11px] leading-relaxed" style={{ color: "rgba(147,197,253,.6)" }}>
            <strong style={{ color: "#93c5fd" }}>Your identity is always hidden</strong> when chatting with recipients. They only see &quot;🎅 Secret Santa&quot;. Your Secret Santa&apos;s identity is hidden from you too!
          </div>
        </div>
      </div>

      <SnowEffect />
    </main>
  );
}

function SnowEffect() {
  useEffect(() => {
    const sw = document.getElementById("snowWrap");
    if (sw && sw.children.length === 0) {
      for (let i = 0; i < 50; i++) {
        const s = document.createElement("div");
        s.className = "snowflake";
        const sz = 2 + Math.random() * 3;
        s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;animation-duration:${5 + Math.random() * 10}s;animation-delay:${Math.random() * 6}s;opacity:${.15 + Math.random() * .25};`;
        sw.appendChild(s);
      }
    }
    return () => { const sw = document.getElementById("snowWrap"); if (sw) sw.innerHTML = ""; };
  }, []);
  return null;
}
