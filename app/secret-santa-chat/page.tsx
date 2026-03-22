"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatSkeleton } from "@/app/components/PageSkeleton";

type Thread = {
  group_id: string; group_name: string; giver_id: string; receiver_id: string;
  other_name: string; role: "giver" | "receiver"; last_message: string;
  last_time: string; unread: number;
};

type Message = { id: string; sender_id: string; content: string; created_at: string };

function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, 500);
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

  useEffect(() => { activeThreadRef.current = activeThread; }, [activeThread]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const markAsRead = useCallback(async (thread: Thread, uid: string) => {
    supabase.from("thread_reads").upsert({
      user_id: uid, group_id: thread.group_id,
      thread_giver_id: thread.giver_id, thread_receiver_id: thread.receiver_id,
      last_read_at: new Date().toISOString(),
    }, { onConflict: "user_id,group_id,thread_giver_id,thread_receiver_id" }).then();
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;

    const loadThreads = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const user = session.user;
      if (isMounted) setUserId(user.id);

      const { data: memberRows } = await supabase
        .from("group_members").select("group_id")
        .eq("user_id", user.id).eq("status", "accepted");

      const groupIds = [...new Set((memberRows || []).map((r) => r.group_id))];
      if (groupIds.length === 0) { if (isMounted) { setThreads([]); setLoading(false); } return; }

      const [
        { data: groupsData },
        { data: giverAssignments },
        { data: receiverAssignments },
        { data: allMessages },
        { data: readTimestamps },
      ] = await Promise.all([
        supabase.from("groups").select("id, name, event_date").in("id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("giver_id", user.id).in("group_id", groupIds),
        supabase.from("assignments").select("group_id, giver_id, receiver_id").eq("receiver_id", user.id).in("group_id", groupIds),
        supabase.from("messages").select("group_id, thread_giver_id, thread_receiver_id, sender_id, content, created_at").in("group_id", groupIds).order("created_at", { ascending: false }),
        supabase.from("thread_reads").select("group_id, thread_giver_id, thread_receiver_id, last_read_at").eq("user_id", user.id),
      ]);

      const receiverUserIds = (giverAssignments || []).map((a) => a.receiver_id).filter(Boolean);
      const allUserIds = [...new Set(receiverUserIds)];

      let memberNicknames: { group_id: string; user_id: string; nickname: string }[] = [];
      if (allUserIds.length > 0) {
        const { data } = await supabase.from("group_members").select("group_id, user_id, nickname")
          .in("user_id", allUserIds).in("group_id", groupIds).eq("status", "accepted");
        memberNicknames = (data || []) as typeof memberNicknames;
      }

      const getUnread = (gId: string, giverId: string, receiverId: string, msgs: typeof allMessages, uid: string) => {
        const threadMsgs = (msgs || []).filter((m) => m.group_id === gId && m.thread_giver_id === giverId && m.thread_receiver_id === receiverId);
        const readEntry = (readTimestamps || []).find((r) => r.group_id === gId && r.thread_giver_id === giverId && r.thread_receiver_id === receiverId);
        const lastRead = readEntry ? new Date(readEntry.last_read_at) : new Date(0);
        return Math.min(threadMsgs.filter((m) => m.sender_id !== uid && new Date(m.created_at) > lastRead).length, 9);
      };

      const getLastMsg = (gId: string, giverId: string, receiverId: string, msgs: typeof allMessages, uid: string, otherName: string) => {
        const threadMsgs = (msgs || []).filter((m) => m.group_id === gId && m.thread_giver_id === giverId && m.thread_receiver_id === receiverId);
        const lastMsg = threadMsgs[0];
        if (!lastMsg) return { text: "", time: "" };
        const prefix = lastMsg.sender_id === uid ? "You: " : `${otherName}: `;
        return { text: prefix + lastMsg.content.slice(0, 40), time: new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      };

      const buildThreads: Thread[] = [];

      for (const a of giverAssignments || []) {
        const group = (groupsData || []).find((g) => g.id === a.group_id);
        const receiver = memberNicknames.find((m) => m.user_id === a.receiver_id && m.group_id === a.group_id);
        const name = receiver?.nickname || "Participant";
        const last = getLastMsg(a.group_id, a.giver_id, a.receiver_id, allMessages, user.id, name);
        buildThreads.push({
          group_id: a.group_id, group_name: group?.name || "Unknown",
          giver_id: a.giver_id, receiver_id: a.receiver_id,
          other_name: name, role: "giver",
          last_message: last.text || "No messages yet — say hi! 👋",
          last_time: last.time,
          unread: getUnread(a.group_id, a.giver_id, a.receiver_id, allMessages, user.id),
        });
      }

      for (const a of receiverAssignments || []) {
        const group = (groupsData || []).find((g) => g.id === a.group_id);
        const last = getLastMsg(a.group_id, a.giver_id, a.receiver_id, allMessages, user.id, "🎅");
        buildThreads.push({
          group_id: a.group_id, group_name: group?.name || "Unknown",
          giver_id: a.giver_id, receiver_id: a.receiver_id,
          other_name: "Secret Santa", role: "receiver",
          last_message: last.text || "No messages yet",
          last_time: last.time,
          unread: getUnread(a.group_id, a.giver_id, a.receiver_id, allMessages, user.id),
        });
      }

      if (isMounted) { setThreads(buildThreads); setLoading(false); }
    };

    loadThreads();

    const channel = supabase.channel("chat-threads-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadThreads())
      .subscribe();

    return () => { isMounted = false; supabase.removeChannel(channel); };
  }, [supabase, router]);

  useEffect(() => {
    if (!activeThread) return;
    let isMounted = true;

    const loadMessages = async () => {
      const { data } = await supabase.from("messages").select("id, sender_id, content, created_at")
        .eq("group_id", activeThread.group_id).eq("thread_giver_id", activeThread.giver_id)
        .eq("thread_receiver_id", activeThread.receiver_id).order("created_at", { ascending: true });
      if (isMounted) { setMessages((data || []) as Message[]); setTimeout(scrollToBottom, 50); }
    };

    loadMessages();

    const channel = supabase
      .channel(`chat-live-${activeThread.group_id}-${activeThread.giver_id}-${activeThread.receiver_id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `group_id=eq.${activeThread.group_id}`,
      }, (payload) => {
        if (!isMounted) return;
        const n = payload.new as Message & { thread_giver_id: string; thread_receiver_id: string };
        const at = activeThreadRef.current;
        if (!at || n.thread_giver_id !== at.giver_id || n.thread_receiver_id !== at.receiver_id) return;

        setMessages((prev) => {
          const cleaned = prev.filter((m) => !(m.id.startsWith("temp-") && m.sender_id === n.sender_id));
          if (cleaned.find((m) => m.id === n.id)) return cleaned;
          return [...cleaned, { id: n.id, sender_id: n.sender_id, content: n.content, created_at: n.created_at }];
        });
        setTimeout(scrollToBottom, 50);
        if (at && userId) markAsRead(at, userId);
      }).subscribe();

    return () => { isMounted = false; supabase.removeChannel(channel); };
  }, [activeThread, supabase, scrollToBottom, markAsRead, userId]);

  const handleSend = async () => {
    if (!activeThread || !msgInput.trim() || !userId) return;
    const content = sanitize(msgInput);
    if (!content) return;

    setMsgInput("");
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, sender_id: userId, content, created_at: new Date().toISOString() }]);
    setTimeout(scrollToBottom, 30);

    const { error } = await supabase.from("messages").insert({
      group_id: activeThread.group_id, sender_id: userId,
      thread_giver_id: activeThread.giver_id, thread_receiver_id: activeThread.receiver_id, content,
    });

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openThread = (t: Thread) => {
    setActiveThread(t);
    if (userId) markAsRead(t, userId);
  };

  if (loading) return <ChatSkeleton />;

  const giverThreads = threads.filter((t) => t.role === "giver");
  const receiverThreads = threads.filter((t) => t.role === "receiver");

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
                  <div className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,.4)" }}>
                    {activeThread.group_name}{isGiver && ` · ${activeThread.other_name} sees you as "🎅 Secret Santa"`}
                  </div>
                </div>
              </div>
              <button onClick={() => setActiveThread(null)} className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold"
                style={{ background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.08)", fontFamily: "inherit", cursor: "pointer" }}>
                ← Back
              </button>
            </div>

            <div className="flex items-center justify-center py-2" style={{ background: isGiver ? "rgba(251,191,36,.06)" : "rgba(34,197,94,.06)" }}>
              <span className="text-[10px] font-extrabold px-3 py-1 rounded-full"
                style={{ background: isGiver ? "rgba(251,191,36,.12)" : "rgba(34,197,94,.12)", color: isGiver ? "#fbbf24" : "#86efac" }}>
                {isGiver ? `🎁 You are ${activeThread.other_name}'s Secret Santa` : "🎅 This person drew your name — identity hidden!"}
              </span>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-2" style={{ maxHeight: "55vh", minHeight: "280px" }}>
              {messages.length === 0 ? (
                <div className="text-center py-10" style={{ color: "rgba(255,255,255,.2)" }}>
                  <div className="text-[40px] mb-2">💬</div>
                  <p className="text-[13px] font-semibold">No messages yet — send the first one!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  const isTemp = msg.id.startsWith("temp-");
                  return (
                    <div key={msg.id} className={`max-w-[75%] px-3.5 py-2.5 rounded-[14px] text-[13px] leading-relaxed ${isMine ? "self-end" : "self-start"}`}
                      style={{
                        background: isMine ? (isGiver ? "linear-gradient(135deg,#b45309,#d97706)" : "linear-gradient(135deg,#2563eb,#3b82f6)") : "rgba(255,255,255,.08)",
                        color: isMine ? "#fff" : "rgba(255,255,255,.85)",
                        borderBottomRightRadius: isMine ? "4px" : "14px",
                        borderBottomLeftRadius: isMine ? "14px" : "4px",
                        opacity: isTemp ? 0.7 : 1,
                      }}>
                      <div className="text-[10px] font-bold mb-0.5" style={{ opacity: .6 }}>
                        {isMine ? (isGiver ? "You (as 🎅 Secret Santa)" : "You") : (isGiver ? activeThread.other_name : "🎅 Secret Santa")}
                      </div>
                      {msg.content}
                      <div className="text-[9px] mt-1" style={{ opacity: .4 }}>
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
                className="flex-1 px-3.5 py-2.5 rounded-xl text-[13px] outline-none"
                style={{ background: "rgba(255,255,255,.05)", border: `1px solid ${isGiver ? "rgba(251,191,36,.12)" : "rgba(34,197,94,.12)"}`, color: "#fff", fontFamily: "inherit" }} />
              <button onClick={handleSend} disabled={!msgInput.trim()}
                className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition"
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
          <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,.5)" }}>Private conversations with your matches</p>
        </div>

        <div className="flex gap-3 mb-6 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
          <div className="flex-1 text-center p-3 rounded-xl" style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.12)" }}>
            <div className="text-[28px] mb-1">🎁</div>
            <div className="text-[12px] font-extrabold" style={{ color: "#fbbf24" }}>You → Recipient</div>
            <div className="text-[10px] leading-relaxed mt-1" style={{ color: "rgba(255,255,255,.4)" }}>You know who they are.<br />They see you as &quot;🎅 Secret Santa&quot;</div>
          </div>
          <div className="flex items-center justify-center text-[11px] font-extrabold" style={{ color: "rgba(255,255,255,.15)" }}>VS</div>
          <div className="flex-1 text-center p-3 rounded-xl" style={{ background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.12)" }}>
            <div className="text-[28px] mb-1">🎅</div>
            <div className="text-[12px] font-extrabold" style={{ color: "#86efac" }}>Secret Santa → You</div>
            <div className="text-[10px] leading-relaxed mt-1" style={{ color: "rgba(255,255,255,.4)" }}>Someone drew your name.<br />You don&apos;t know who they are!</div>
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
                    <div className="text-[11px] font-semibold" style={{ color: "rgba(251,191,36,.5)" }}>You know who they are — they don&apos;t know it&apos;s you!</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 mb-6">
                  {giverThreads.map((t, i) => (
                    <div key={`g-${i}`} onClick={() => openThread(t)}
                      className="cursor-pointer flex items-center justify-between p-3.5 rounded-[14px] transition hover:translate-x-1"
                      style={{ background: "linear-gradient(135deg,rgba(251,191,36,.06),rgba(245,158,11,.04))", border: "1px solid rgba(251,191,36,.15)", borderLeft: "4px solid #fbbf24" }}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center text-[20px] flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)", boxShadow: "0 3px 12px rgba(251,191,36,.25)" }}>🎁</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-extrabold" style={{ color: "#fbbf24" }}>{t.other_name}</div>
                          <div className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,.35)" }}>{t.group_name}</div>
                          <div className="text-[12px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,.3)" }}>{t.last_message}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                        {t.last_time && <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,.25)" }}>{t.last_time}</span>}
                        {t.unread > 0 && (
                          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
                            style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 2px 8px rgba(220,38,38,.3)" }}>{t.unread}</div>
                        )}
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md" style={{ background: "rgba(251,191,36,.12)", color: "#fbbf24" }}>You → {t.other_name}</span>
                        <span className="text-[16px]" style={{ color: "rgba(251,191,36,.3)" }}>›</span>
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
                    <div className="text-[11px] font-semibold" style={{ color: "rgba(34,197,94,.5)" }}>Someone drew your name — you don&apos;t know who!</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  {receiverThreads.map((t, i) => (
                    <div key={`r-${i}`} onClick={() => openThread(t)}
                      className="cursor-pointer flex items-center justify-between p-3.5 rounded-[14px] transition hover:translate-x-1"
                      style={{ background: "linear-gradient(135deg,rgba(34,197,94,.06),rgba(22,163,74,.04))", border: "1px solid rgba(34,197,94,.15)", borderLeft: "4px solid #22c55e" }}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center text-[20px] flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 3px 12px rgba(34,197,94,.25)" }}>🎅</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-extrabold" style={{ color: "#86efac" }}>Secret Santa</div>
                          <div className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,.35)" }}>{t.group_name}</div>
                          <div className="text-[12px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,.3)" }}>{t.last_message}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                        {t.last_time && <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,.25)" }}>{t.last_time}</span>}
                        {t.unread > 0 && (
                          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
                            style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 2px 8px rgba(220,38,38,.3)" }}>{t.unread}</div>
                        )}
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md" style={{ background: "rgba(34,197,94,.12)", color: "#86efac" }}>🎅 → You</span>
                        <span className="text-[16px]" style={{ color: "rgba(34,197,94,.3)" }}>›</span>
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