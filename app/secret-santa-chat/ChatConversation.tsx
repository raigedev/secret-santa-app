"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { normalizeProfileAvatarUrlForUser } from "@/lib/profile/avatar";
import type { createClient } from "@/lib/supabase/client";
import { isRecord, sanitizePlainText } from "@/lib/validation/common";
import {
  loadReceiverThreadMessages,
  markReceiverThreadAsRead,
  sendGiverMessage,
  sendReceiverMessage,
  type SafeChatMessage,
} from "./chat-actions";
import { CHAT_ACTIVE_MESSAGE_POLL_MS, nextChatMessagePollDelay } from "./chat-polling";
import styles from "./chat.module.css";

export type ChatThread = {
  id: string;
  receiverId: string;
  name: string;
  unread: number;
};

type ChatConversationProps = {
  groupId: string;
  role: "giver" | "receiver";
  thread: ChatThread | null;
  allowProfilePhoto?: boolean;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  refreshVersion: number;
  onRead: (threadId: string) => void;
  onPollChange: () => void;
};

const CHAT_ACTIVE_THREAD_MESSAGE_LIMIT = 250;
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

function formatDay(date: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dayFormat.format(date);
}

function startsChatPeriod(previous: SafeChatMessage | undefined, date: Date) {
  if (!previous) return true;
  const previousDate = new Date(previous.created_at);
  return date.toDateString() !== previousDate.toDateString() ||
    date.getTime() - previousDate.getTime() >= 30 * 60_000;
}

async function loadGifteePhoto(groupId: string, receiverId: string, signal: AbortSignal) {
  const response = await fetch("/api/groups/peer-profiles", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupIds: [groupId] }),
    signal,
  });
  if (!response.ok) return null;

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.profilesByGroup)) return null;
  const groupProfiles = payload.profilesByGroup[groupId];
  if (!Array.isArray(groupProfiles)) return null;
  const profile: unknown = groupProfiles.find((row: unknown) => isRecord(row) && row.user_id === receiverId);
  return isRecord(profile) && typeof profile.avatar_url === "string"
    ? normalizeProfileAvatarUrlForUser(receiverId, profile.avatar_url)
    : null;
}

export function ChatConversation({
  groupId, role, thread, allowProfilePhoto = false, userId, supabase, refreshVersion, onRead, onPollChange,
}: ChatConversationProps) {
  const isGiver = role === "giver";
  const threadId = thread?.id;
  const receiverId = thread?.receiverId;
  const unread = thread?.unread ?? 0;
  const canLoadPhoto = isGiver && allowProfilePhoto;
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [messages, setMessages] = useState<SafeChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const loadMessagesRef = useRef<() => Promise<void>>(null);
  const sendPending = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastReadId = useRef<string | null>(null);
  const readPending = useRef(false);

  useEffect(() => {
    if (!canLoadPhoto || !receiverId) return;
    const controller = new AbortController();
    void loadGifteePhoto(groupId, receiverId, controller.signal)
      .catch(() => null)
      .then((url) => {
        if (!controller.signal.aborted) setProfilePhoto(url);
      });
    return () => controller.abort();
  }, [canLoadPhoto, groupId, receiverId]);

  useEffect(() => {
    if (!threadId || !receiverId) return;
    let disposed = false;
    let version = 0;
    let pollDelay = CHAT_ACTIVE_MESSAGE_POLL_MS;
    let lastActivityAt = performance.now();
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let foregroundTimer: ReturnType<typeof setTimeout> | undefined;
    let previousCount: number | undefined;
    let previousLatestId: string | undefined;

    const loadMessages = async (fromPoll = false) => {
      if (fromPoll && document.visibilityState !== "visible") return;
      clearTimeout(pollTimer);
      if (!fromPoll) lastActivityAt = performance.now();
      const request = ++version;
      try {
        let nextMessages: SafeChatMessage[];
        if (role === "receiver") {
          const result = await loadReceiverThreadMessages(threadId);
          if (!result.success) throw new Error(result.message);
          nextMessages = result.messages;
        } else {
          const { data, error } = await supabase
            .from("messages")
            .select("id, sender_id, content, created_at")
            .eq("group_id", groupId)
            .eq("thread_giver_id", userId)
            .eq("thread_receiver_id", receiverId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(CHAT_ACTIVE_THREAD_MESSAGE_LIMIT);
          if (error) throw error;
          nextMessages = (data || []).reverse().map((message) => ({
            content: message.content,
            created_at: message.created_at,
            from_current_user: message.sender_id === userId,
            id: message.id,
          }));
        }

        if (disposed || request !== version) return;
        const latestId = nextMessages.at(-1)?.id;
        const changed = previousCount !== nextMessages.length || previousLatestId !== latestId;
        if (changed) {
          lastActivityAt = performance.now();
          if (fromPoll && previousCount !== undefined) onPollChange();
        }
        previousCount = nextMessages.length;
        previousLatestId = latestId;
        setLoadError(false);
        setMessages(nextMessages);
      } catch {
        if (disposed || request !== version) return;
        setLoadError(true);
        setMessages(null);
      } finally {
        if (!disposed && request === version && document.visibilityState === "visible") {
          pollDelay = nextChatMessagePollDelay(pollDelay, performance.now() - lastActivityAt);
          pollTimer = setTimeout(() => void loadMessages(true), pollDelay);
        }
      }
    };

    loadMessagesRef.current = loadMessages;
    const refreshOnForeground = () => {
      clearTimeout(pollTimer);
      clearTimeout(foregroundTimer);
      if (document.visibilityState === "visible") {
        foregroundTimer = setTimeout(() => void loadMessages(), 120);
      }
    };
    document.addEventListener("visibilitychange", refreshOnForeground);
    window.addEventListener("focus", refreshOnForeground);

    return () => {
      disposed = true;
      loadMessagesRef.current = null;
      clearTimeout(pollTimer);
      clearTimeout(foregroundTimer);
      document.removeEventListener("visibilitychange", refreshOnForeground);
      window.removeEventListener("focus", refreshOnForeground);
    };
  }, [groupId, onPollChange, receiverId, role, supabase, threadId, userId]);

  useEffect(() => {
    void loadMessagesRef.current?.();
  }, [refreshVersion, threadId]);

  const latestMessageId = messages?.at(-1)?.id;
  useLayoutEffect(() => {
    const log = logRef.current;
    if (latestMessageId && log && nearBottom.current) log.scrollTop = log.scrollHeight;
  }, [latestMessageId]);

  useEffect(() => {
    const end = endRef.current;
    const incoming = messages?.findLast((message) => !message.from_current_user);
    if (!threadId || !receiverId || !unread || !end || !incoming) return;
    let disposed = false;
    let endVisible = false;

    const markAsRead = async () => {
      if (!endVisible || document.visibilityState !== "visible" ||
          lastReadId.current === incoming.id || readPending.current) return;
      readPending.current = true;
      try {
        const saved = role === "receiver"
          ? (await markReceiverThreadAsRead(threadId)).success
          : !(await supabase.from("thread_reads").upsert({
              user_id: userId,
              group_id: groupId,
              thread_giver_id: userId,
              thread_receiver_id: receiverId,
              last_read_at: new Date().toISOString(),
            }, { onConflict: "user_id,group_id,thread_giver_id,thread_receiver_id" })).error;
        if (!saved) return;
        lastReadId.current = incoming.id;
        if (!disposed) onRead(threadId);
      } catch {
        // A later refresh can retry the receipt without interrupting the conversation.
      } finally {
        readPending.current = false;
      }
    };
    // The sticky shell can cover the tail without clipping its intersection with the viewport.
    const shell = end.closest("[data-app-shell-content]")?.parentElement;
    const header = shell?.querySelector(":scope > header");
    const nav = shell?.querySelector(':scope > nav[aria-label="Mobile app navigation"]');
    let observer: IntersectionObserver | undefined;
    const resize = new ResizeObserver(() => {
      observer?.disconnect();
      endVisible = false;
      const top = header?.getBoundingClientRect().height ?? 0;
      const bottom = nav?.getBoundingClientRect().height ?? 0;
      observer = new IntersectionObserver(([entry]) => {
        endVisible = entry.isIntersecting && entry.intersectionRatio === 1;
        void markAsRead();
      }, { rootMargin: `-${top}px 0px -${bottom}px 0px`, threshold: 1 });
      observer.observe(end);
    });
    resize.observe(document.documentElement);
    if (header) resize.observe(header);
    if (nav) resize.observe(nav);
    document.addEventListener("visibilitychange", markAsRead);
    return () => {
      disposed = true;
      observer?.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", markAsRead);
    };
  }, [groupId, messages, onRead, receiverId, role, supabase, threadId, unread, userId]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!threadId || !receiverId || sendPending.current) return;
    const content = sanitizePlainText(draft, 500);
    if (!content) return;

    sendPending.current = true;
    setSending(true);
    setSendError(null);
    try {
      const result = role === "receiver"
        ? await sendReceiverMessage(threadId, content)
        : await sendGiverMessage(groupId, receiverId, content);
      if (!result.success) {
        setSendError(result.message || "We could not send your message. Try again.");
        return;
      }
      setDraft((value) => value === draft ? "" : value);
      nearBottom.current = true;
      void loadMessagesRef.current?.();
    } catch {
      setSendError("We could not send your message. Try again.");
    } finally {
      sendPending.current = false;
      setSending(false);
    }
  };

  const label = isGiver ? "The person you're gifting" : "The person gifting you";
  const name = thread?.name ?? (isGiver ? "Your giftee" : "Your Secret Santa");
  const avatarUrl = canLoadPhoto ? profilePhoto : null;
  const avatarInitial = Array.from(name.trim())[0]?.toUpperCase() || "?";
  const composerLabel = isGiver ? `Message ${name}` : "Reply to your Santa";
  return (
    <section className={styles.conversation} data-chat-role={role} aria-label={label}>
      <header className={styles.conversationHeader}>
        <div className={styles.conversationHeading}>
          <p className={styles.role}>{label}</p>
          {unread > 0 && <span className={styles.unread}>{unread === 9 ? "9+" : unread} new</span>}
        </div>
        <h2>{name}</h2>
        {thread && (
          <p className={styles.privacy}>
            {isGiver ? `${name} can't see your name here.` : "Their name stays hidden in this chat."}
          </p>
        )}
      </header>
      <div
        className={styles.log}
        ref={logRef}
        role="log"
        aria-label={`${name} messages`}
        tabIndex={0}
        onScroll={(event) => {
          const log = event.currentTarget;
          nearBottom.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
        }}
      >
        {!thread ? (
          <p className={styles.empty}>Private chats appear after names are drawn.</p>
        ) : loadError ? (
          <div className={styles.notice}>
            We could not load messages.
            <button type="button" onClick={() => void loadMessagesRef.current?.()}>Try again</button>
          </div>
        ) : !messages ? (
          <p className={styles.empty}>Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className={styles.empty}>No messages yet.</p>
        ) : messages.map((message, index) => {
          const date = new Date(message.created_at);
          const previous = messages[index - 1];
          const next = messages[index + 1];
          const showTimestamp = startsChatPeriod(previous, date);
          const showSender = !message.from_current_user && (showTimestamp || previous?.from_current_user);
          const showAvatar = !message.from_current_user &&
            (!next || next.from_current_user || startsChatPeriod(message, new Date(next.created_at)));
          const time = timeFormat.format(date);
          return (
            <Fragment key={message.id}>
              {showTimestamp && (
                <time className={styles.day} dateTime={message.created_at}>
                  {formatDay(date)}{index > 0 ? `, ${time}` : ""}
                </time>
              )}
              <div className={styles.message} data-outgoing={message.from_current_user}>
                {showAvatar && (
                  <span className={styles.avatar} data-testid="chat-sender-avatar" aria-hidden="true">
                    {avatarUrl ? (
                      <Image
                        alt=""
                        src={avatarUrl}
                        width={28}
                        height={28}
                        unoptimized
                        onError={() => setProfilePhoto((current) => current === avatarUrl ? null : current)}
                      />
                    ) : isGiver ? avatarInitial : (
                      <Image alt="" src="/secret-santa-logo.png" width={28} height={28} />
                    )}
                  </span>
                )}
                <div className={styles.messageBody}>
                  {showSender && <p className={styles.sender} aria-hidden="true">{name}</p>}
                  <p className={message.from_current_user ? styles.sent : styles.received} title={time}>
                    <span className="sr-only">{message.from_current_user ? "You: " : `${name}: `}</span>
                    <span>{message.content}</span>
                    <span className="sr-only"> {time}</span>
                  </p>
                </div>
              </div>
            </Fragment>
          );
        })}
        <div ref={endRef} className={styles.logEnd} aria-hidden="true" />
      </div>
      {thread && (
        <form className={styles.composer} onSubmit={handleSend} aria-label={composerLabel}>
          {sendError && <p className={styles.sendError} role="alert">{sendError}</p>}
          <textarea
            aria-label={composerLabel}
            placeholder={composerLabel}
            rows={1}
            maxLength={500}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
          />
          <button type="submit" disabled={sending || !draft.trim()}>
            {sending ? "Sending" : "Send"}
          </button>
        </form>
      )}
    </section>
  );
}
