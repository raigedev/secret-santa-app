"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMyAssignmentGiftPrep } from "@/lib/assignments/gift-prep-client";
import { clearClientSnapshots } from "@/lib/client-snapshot";
import {
  formatExchangeDate,
  getDaysUntilExchangeDate,
  resolveExchangeTimeZone,
} from "@/lib/exchange-date.mjs";
import { isGroupInHistory } from "@/lib/groups/history";
import { createClient } from "@/lib/supabase/client";
import { loadReceiverChatThreads } from "./chat-actions";
import { ChatConversation, type ChatThread } from "./ChatConversation";
import { CHAT_EXCHANGE_POLL_MS } from "./chat-polling";
import styles from "./chat.module.css";

type GroupRow = {
  id: string;
  name: string | null;
  event_date: string | null;
  event_timezone: string | null;
  require_anonymous_nickname: boolean | null;
};

type ChatExchange = GroupRow & { giver: ChatThread | null; receiver: ChatThread | null };

const CHAT_THREAD_MESSAGE_SCAN_LIMIT = 1000;
const CHAT_PAGE_LOAD_TIMEOUT_MS = 10_000;

function getGiftDayLabel(exchange: ChatExchange): string {
  const days = getDaysUntilExchangeDate(
    exchange.event_date,
    Date.now(),
    resolveExchangeTimeZone(exchange.event_timezone)
  );
  if (days === null) return "Gift day not set";

  const date = formatExchangeDate(exchange.event_date, { month: "short", day: "numeric" });
  if (days === 0) return `Gift day ${date} · Today`;
  if (days < 0) return `Gift day ${date} · Passed`;
  return `Gift day ${date} · ${days} ${days === 1 ? "day" : "days"} left`;
}

export default function SecretSantaChatPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<ChatExchange[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const loadExchangesRef = useRef<() => void>(null);

  const refreshExchanges = useCallback(() => {
    loadExchangesRef.current?.();
  }, []);

  const refreshChats = useCallback(() => {
    setRefreshVersion((version) => version + 1);
    refreshExchanges();
  }, [refreshExchanges]);

  useEffect(() => {
    let disposed = false;
    let version = 0;
    let activeUserId: string | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    // Discard the legacy thread cache; every panel now starts from verified membership.
    clearClientSnapshots("ss_chat_page_snapshot_v2:");

    const loadExchanges = async () => {
      const request = ++version;
      const isCurrent = () => !disposed && request === version;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!isCurrent()) return;
        setLoadError("Messages are taking longer than expected.");
        setLoading(false);
      }, CHAT_PAGE_LOAD_TIMEOUT_MS);

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!isCurrent()) return;
        if (sessionError) throw sessionError;
        if (!session) {
          setExchanges([]);
          setUserId(null);
          router.replace("/login");
          return;
        }

        const user = session.user;
        if (user.id !== activeUserId) {
          activeUserId = user.id;
          setUserId(user.id);
          setExchanges([]);
          setSelectedId(null);
        }

        const { data: groups, error: groupsError } = await supabase
          .from("groups")
          .select("id, name, event_date, event_timezone, require_anonymous_nickname, group_members!inner(user_id)")
          .eq("group_members.user_id", user.id)
          .eq("group_members.status", "accepted")
          .order("event_date")
          .order("id");
        if (!isCurrent()) return;
        if (groupsError) throw groupsError;

        const now = Date.now();
        const activeGroups = ((groups || []) as GroupRow[]).filter(
          (group) => !isGroupInHistory(group.event_date, now, group.event_timezone)
        );
        const activeGroupIds = activeGroups.map((group) => group.id);
        if (activeGroupIds.length === 0) {
          setExchanges([]);
          setLoadError(null);
          setLoading(false);
          return;
        }

        const [
          { data: giverAssignments, error: giverAssignmentsError },
          receiverResult,
          { data: incomingReplies, error: messagesError },
          { data: readTimestamps, error: readTimestampsError },
        ] = await Promise.all([
          fetchMyAssignmentGiftPrep(activeGroupIds),
          loadReceiverChatThreads(),
          supabase
            .from("messages")
            .select("group_id, thread_receiver_id, created_at")
            .eq("thread_giver_id", user.id)
            .neq("sender_id", user.id)
            .in("group_id", activeGroupIds)
            .order("created_at", { ascending: false })
            .limit(CHAT_THREAD_MESSAGE_SCAN_LIMIT),
          supabase
            .from("thread_reads")
            .select("group_id, thread_receiver_id, last_read_at")
            .eq("user_id", user.id)
            .eq("thread_giver_id", user.id)
            .in("group_id", activeGroupIds),
        ]);
        if (!isCurrent()) return;
        if (giverAssignmentsError || !receiverResult.success || messagesError || readTimestampsError) {
          throw new Error("Could not load chats.");
        }

        const readTimes = new Map((readTimestamps || []).map((row) => [
          `${row.group_id}:${row.thread_receiver_id}`, Date.parse(row.last_read_at),
        ]));
        const unreadCounts = new Map<string, number>();
        for (const reply of incomingReplies || []) {
          const key = `${reply.group_id}:${reply.thread_receiver_id}`;
          if (Date.parse(reply.created_at) > (readTimes.get(key) ?? 0)) {
            unreadCounts.set(key, Math.min((unreadCounts.get(key) ?? 0) + 1, 9));
          }
        }

        const byGroup = new Map<string, ChatExchange>(activeGroups.map((group) => [
          group.id, { ...group, giver: null, receiver: null },
        ]));
        for (const assignment of giverAssignments) {
          const exchange = byGroup.get(assignment.group_id);
          if (!exchange) continue;

          exchange.giver = {
            id: `giver:${exchange.id}:${user.id}:${assignment.receiver_id}`,
            receiverId: assignment.receiver_id,
            name: assignment.receiver_nickname || "Your giftee",
            unread: unreadCounts.get(`${exchange.id}:${assignment.receiver_id}`) ?? 0,
          };
        }
        for (const thread of receiverResult.threads) {
          const exchange = byGroup.get(thread.group_id);
          if (!exchange) continue;

          exchange.receiver = {
            id: thread.thread_id,
            receiverId: user.id,
            name: "Your Secret Santa",
            unread: thread.unread,
          };
        }

        const nextExchanges = [...byGroup.values()];
        setExchanges(nextExchanges);
        setSelectedId((id) => {
          if (id && byGroup.has(id)) return id;
          return (
            nextExchanges.find(({ giver, receiver }) => giver?.unread || receiver?.unread)?.id ??
            nextExchanges.find(({ giver, receiver }) => giver || receiver)?.id ??
            nextExchanges[0]?.id ??
            null
          );
        });
        setLoadError(null);
        setLoading(false);
      } catch {
        if (!isCurrent()) return;
        setExchanges([]);
        setLoadError("We could not load your chats.");
        setLoading(false);
      } finally {
        if (isCurrent()) clearTimeout(timeout);
      }
    };

    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleLoad = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => void loadExchanges(), 120);
    };
    loadExchangesRef.current = scheduleLoad;
    void loadExchanges();

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") scheduleLoad();
    };
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    const poll = setInterval(refreshIfVisible, CHAT_EXCHANGE_POLL_MS);

    return () => {
      disposed = true;
      loadExchangesRef.current = null;
      clearTimeout(timeout);
      clearTimeout(reloadTimer);
      clearInterval(poll);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`private-chat-notifications-${userId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      ({ new: notification }) => {
        if (notification.type === "chat" && document.visibilityState === "visible") refreshChats();
      }
    ).subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [refreshChats, supabase, userId]);

  const exchange = exchanges.find((item) => item.id === selectedId);
  const onRead = useCallback((threadId: string) => {
    setExchanges((items) => items.map((item) => {
      if (item.giver?.id === threadId) return { ...item, giver: { ...item.giver, unread: 0 } };
      if (item.receiver?.id === threadId) return { ...item, receiver: { ...item.receiver, unread: 0 } };
      return item;
    }));
    loadExchangesRef.current?.();
  }, []);

  return (
    <div className={styles.page} data-testid="secret-santa-chat-page" role="main">
      <header className={styles.toolbar}>
        <h1>Messages</h1>
        {exchanges.length > 0 && (
          <div className={styles.exchanges} role="group" aria-label="Gift exchanges">
            {exchanges.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === exchange?.id}
                onClick={() => setSelectedId(item.id)}
              >
                {item.name || "Gift exchange"}
                {item.id !== exchange?.id && Boolean(item.giver?.unread || item.receiver?.unread) && (
                  <>
                    <span className={styles.exchangeUnread} aria-hidden="true" />
                    <span className="sr-only">New messages</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
        {exchange && <p className={styles.giftDay}>{getGiftDayLabel(exchange)}</p>}
      </header>
      {loadError && (
        <div className={styles.notice} role="status">
          {loadError}
          <button type="button" onClick={refreshChats}>Try again</button>
        </div>
      )}
      {loading ? (
        <div className={styles.conversations} aria-busy="true" data-testid="chat-loading-shell">
          <span className="sr-only" role="status">Loading chats...</span>
          <div className={styles.loading} />
          <div className={styles.loading} />
        </div>
      ) : exchange && userId ? (
        <div className={styles.conversations} key={`${userId}:${exchange.id}`}>
          <ChatConversation
            key={exchange.giver?.id ?? "no-giftee"}
            groupId={exchange.id}
            role="giver"
            thread={exchange.giver}
            allowProfilePhoto={exchange.require_anonymous_nickname === false || exchange.require_anonymous_nickname === null}
            userId={userId}
            supabase={supabase}
            refreshVersion={refreshVersion}
            onRead={onRead}
            onPollChange={refreshExchanges}
          />
          <ChatConversation
            key={exchange.receiver?.id ?? "no-santa"}
            groupId={exchange.id}
            role="receiver"
            thread={exchange.receiver}
            userId={userId}
            supabase={supabase}
            refreshVersion={refreshVersion}
            onRead={onRead}
            onPollChange={refreshExchanges}
          />
        </div>
      ) : !loadError && (
        <p className={styles.empty}>Private chats appear after names are drawn.</p>
      )}
    </div>
  );
}

