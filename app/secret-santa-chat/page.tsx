"use client";

// ═══════════════════════════════════════
// SECRET SANTA CHAT PAGE — /secret-santa-chat
// ═══════════════════════════════════════
// Redesigned with clear visual separation:
// Gold = You → Recipient (you know who)
// Green = Secret Santa → You (anonymous)
//
// Security: Core#1 sanitization, Core#3 RLS,
// Playbook#09 RLS, Playbook#19 server-side auth
// No dangerouslySetInnerHTML

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "./chat-actions";

type Thread = {
  group_id: string;
  group_name: string;
  group_event_date: string;
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

export default function SecretSantaChatPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ─── Load threads ───
  useEffect(() => {
    const loadThreads = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: memberRows } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      const groupIds = [...new Set((memberRows || []).map((r) => r.group_id))];
      if (groupIds.length === 0) { setThreads([]); setLoading(false); return; }

      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name, event_date")
        .in("id", groupIds);

      const { data: giverAssignments } = await supabase
        .from("assignments")
        .select("group_id, giver_id, receiver_id")
        .eq("giver_id", user.id)
        .in("group_id", groupIds);

      const { data: receiverAssignments } = await supabase
        .from("assignments")
        .select("group_id, giver_id, receiver_id")
        .eq("receiver_id", user.id)
        .in("group_id", groupIds);

      const receiverUserIds = (giverAssignments || []).map((a) => a.receiver_id).filter(Boolean);
      const giverUserIds = (receiverAssignments || []).map((a) => a.giver_id).filter(Boolean);
      const allUserIds = [...new Set([...receiverUserIds, ...giverUserIds])];

      let memberNicknames: { group_id: string; user_id: string; nickname: string }[] = [];
      if (allUserIds.length > 0) {
        const { data } = await supabase
          .from("group_members")
          .select("group_id, user_id, nickname")
          .in("user_id", allUserIds)
          .in("group_id", groupIds)
          .eq("status", "accepted");
        memberNicknames = (data || []) as typeof memberNicknames;
      }

      const { data: allMessages } = await supabase
        .from("messages")
        .select("group_id, thread_giver_id, thread_receiver_id, sender_id, content, created_at")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false });

      const buildThreads: Thread[] = [];

      for (const a of giverAssignments || []) {
        const group = (groupsData || []).find((g) => g.id === a.group_id);
        const receiver = memberNicknames.find(
          (m) => m.user_id === a.receiver_id && m.group_id === a.group_id
        );
        const threadMsgs = (allMessages || []).filter(
          (m) => m.group_id === a.group_id && m.thread_giver_id === a.giver_id && m.thread_receiver_id === a.receiver_id
        );
        const lastMsg = threadMsgs[0];
        const receiverName = receiver?.nickname || "Participant";

        buildThreads.push({
          group_id: a.group_id,
          group_name: group?.name || "Unknown",
          group_event_date: group?.event_date || "",
          giver_id: a.giver_id,
          receiver_id: a.receiver_id,
          other_name: receiverName,
          role: "giver",
          last_message: lastMsg
            ? (lastMsg.sender_id === user.id ? "You: " : `${receiverName}: `) + lastMsg.content.slice(0, 40)
            : "No messages yet — say hi! 👋",
          last_time: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          unread: 0,
        });
      }

      for (const a of receiverAssignments || []) {
        const group = (groupsData || []).find((g) => g.id === a.group_id);
        const threadMsgs = (allMessages || []).filter(
          (m) => m.group_id === a.group_id && m.thread_giver_id === a.giver_id && m.thread_receiver_id === a.receiver_id
        );
        const lastMsg = threadMsgs[0];

        buildThreads.push({
          group_id: a.group_id,
          group_name: group?.name || "Unknown",
          group_event_date: group?.event_date || "",
          giver_id: a.giver_id,
          receiver_id: a.receiver_id,
          other_name: "Secret Santa",
          role: "receiver",
          last_message: lastMsg
            ? (lastMsg.sender_id === user.id ? "You: " : "🎅: ") + lastMsg.content.slice(0, 40)
            : "No messages yet",
          last_time: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          unread: threadMsgs.filter((m) => m.sender_id !== user.id).length > 0 ? Math.min(threadMsgs.filter((m) => m.sender_id !== user.id).length, 9) : 0,
        });
      }

      setThreads(buildThreads);
      setLoading(false);
    };

    loadThreads();

    const channel = supabase
      .channel("chat-threads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => loadThreads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, router]);

  // ─── Load messages when opening a thread ───
  useEffect(() => {
    if (!activeThread) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("group_id", activeThread.group_id)
        .eq("thread_giver_id", activeThread.giver_id)
        .eq("thread_receiver_id", activeThread.receiver_id)
        .order("created_at", { ascending: true });
      setMessages((data || []) as Message[]);
      setTimeout(scrollToBottom, 100);
    };

    loadMessages();

    const channel = supabase
      .channel(`chat-${activeThread.group_id}-${activeThread.giver_id}-${activeThread.receiver_id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `group_id=eq.${activeThread.group_id}`,
      }, (payload) => {
        const newMsg = payload.new as Message & { thread_giver_id: string; thread_receiver_id: string };
        if (newMsg.thread_giver_id === activeThread.giver_id && newMsg.thread_receiver_id === activeThread.receiver_id) {
          setMessages((prev) => [...prev, { id: newMsg.id, sender_id: newMsg.sender_id, content: newMsg.content, created_at: newMsg.created_at }]);
          setTimeout(scrollToBottom, 100);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeThread, supabase]);

  // ─── Send message ───
  const handleSend = async () => {
    if (!activeThread || !msgInput.trim() || sending) return;
    setSending(true);
    const result = await sendMessage(activeThread.group_id, activeThread.giver_id, activeThread.receiver_id, msgInput.trim());
    setSending(false);
    if (result.success) {
      setMsgInput("");
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("group_id", activeThread.group_id)
        .eq("thread_giver_id", activeThread.giver_id)
        .eq("thread_receiver_id", activeThread.receiver_id)
        .order("created_at", { ascending: true });
      setMessages((data || []) as Message[]);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg,#0a1628,#162d50,#0a1628)" }}>
      <p className="text-lg font-semibold text-blue-300">Loading chats...</p>
    </main>
  );

  const giverThreads = threads.filter((t) => t.role === "giver");
  const receiverThreads = threads.filter((t) => t.role === "receiver");

  // ═══════════════════════════════════
  // CHAT VIEW (opened conversation)
  // ═══════════════════════════════════
  if (activeThread) {
    const isGiver = activeThread.role === "giver";
    return (
      <main className="min-h-screen relative" style={{ background: "linear-gradient(180deg,#0a1628 0%,#0f1f3d 20%,#162d50 50%,#0f1f3d 80%,#0a1628 100%)", fontFamily: "'Nunito', sans-serif", color: "#fff" }}>
        <div className="relative z-10 max-w-[720px] mx-auto px-4 py-6">
          <div className="rounded-[18px] overflow-hidden" style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${isGiver ? "rgba(251,191,36,.15)" : "rgba(34,197,94,.15)"}` }}>

            {/* Chat header */}
            <div className="flex items-center justify-between p-4" style={{ background: "rgba(255,255,255,.04)", borderBottom: `1px solid ${isGiver ? "rgba(251,191,36,.1)" : "rgba(34,197,94,.1)"}` }}>
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-[18px]"
                  style={{ background: isGiver ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                  {isGiver ? "🎁" : "🎅"}
                </div>
                <div>
                  <div className="text-[16px] font-extrabold" style={{ color: isGiver ? "#fbbf24" : "#86efac" }}>
                    {activeThread.other_name}
                  </div>
                  <div className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,.4)" }}>
                    {activeThread.group_name}
                    {isGiver && ` · ${activeThread.other_name} sees you as "🎅 Secret Santa"`}
                  </div>
                </div>
              </div>
              <button onClick={() => setActiveThread(null)}
                className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold"
                style={{ background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.08)", fontFamily: "inherit", cursor: "pointer" }}>
                ← Back
              </button>
            </div>

            {/* Role indicator bar */}
            <div className="flex items-center justify-center gap-2 py-2" style={{ background: isGiver ? "rgba(251,191,36,.06)" : "rgba(34,197,94,.06)" }}>
              <span className="text-[10px] font-extrabold px-3 py-1 rounded-full"
                style={{ background: isGiver ? "rgba(251,191,36,.12)" : "rgba(34,197,94,.12)", color: isGiver ? "#fbbf24" : "#86efac" }}>
                {isGiver ? `🎁 You are ${activeThread.other_name}'s Secret Santa` : "🎅 This person drew your name — identity hidden!"}
              </span>
            </div>

            {/* Messages */}
            <div className="p-4 overflow-y-auto flex flex-col gap-2" style={{ maxHeight: "55vh", minHeight: "280px" }}>
              {messages.length === 0 ? (
                <div className="text-center py-10" style={{ color: "rgba(255,255,255,.2)" }}>
                  <div className="text-[40px] mb-2">💬</div>
                  <p className="text-[13px] font-semibold">No messages yet — send the first one!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  return (
                    <div key={msg.id} className={`max-w-[75%] px-3.5 py-2.5 rounded-[14px] text-[13px] leading-relaxed ${isMine ? "self-end" : "self-start"}`}
                      style={{
                        background: isMine
                          ? (isGiver ? "linear-gradient(135deg,#b45309,#d97706)" : "linear-gradient(135deg,#2563eb,#3b82f6)")
                          : "rgba(255,255,255,.08)",
                        color: isMine ? "#fff" : "rgba(255,255,255,.85)",
                        borderBottomRightRadius: isMine ? "4px" : "14px",
                        borderBottomLeftRadius: isMine ? "14px" : "4px",
                      }}>
                      <div className="text-[10px] font-bold mb-0.5" style={{ opacity: .6 }}>
                        {isMine
                          ? (isGiver ? "You (as 🎅 Secret Santa)" : "You")
                          : (isGiver ? activeThread.other_name : "🎅 Secret Santa")}
                      </div>
                      {msg.content}
                      <div className="text-[9px] mt-1" style={{ opacity: .4 }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 p-4" style={{ background: "rgba(255,255,255,.03)", borderTop: `1px solid ${isGiver ? "rgba(251,191,36,.08)" : "rgba(34,197,94,.08)"}` }}>
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isGiver ? `Message ${activeThread.other_name} as 🎅 Secret Santa...` : "Reply to your Secret Santa..."}
                maxLength={500}
                className="flex-1 px-3.5 py-2.5 rounded-xl text-[13px] outline-none"
                style={{ background: "rgba(255,255,255,.05)", border: `1px solid ${isGiver ? "rgba(251,191,36,.12)" : "rgba(34,197,94,.12)"}`, color: "#fff", fontFamily: "inherit" }} />
              <button onClick={handleSend} disabled={sending || !msgInput.trim()}
                className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition"
                style={{
                  background: msgInput.trim() && !sending
                    ? (isGiver ? "linear-gradient(135deg,#b45309,#d97706)" : "linear-gradient(135deg,#2563eb,#3b82f6)")
                    : "rgba(255,255,255,.08)",
                  color: msgInput.trim() && !sending ? "#fff" : "rgba(255,255,255,.3)",
                  border: "none", fontFamily: "inherit",
                  cursor: msgInput.trim() && !sending ? "pointer" : "not-allowed",
                  boxShadow: msgInput.trim() && !sending ? (isGiver ? "0 2px 10px rgba(180,83,9,.3)" : "0 2px 10px rgba(37,99,235,.3)") : "none",
                }}>
                {sending ? "..." : isGiver ? "Send 🎁" : "Send 💬"}
              </button>
            </div>
          </div>

          {/* Privacy notice */}
          {isGiver && (
            <p className="text-center text-[11px] mt-3" style={{ color: "rgba(255,255,255,.2)" }}>
              🔒 {activeThread.other_name} sees your messages as &quot;🎅 Your Secret Santa&quot; — your identity stays hidden
            </p>
          )}
        </div>
      </main>
    );
  }

  // ═══════════════════════════════════
  // THREAD LIST VIEW
  // ═══════════════════════════════════
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

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-[32px] font-bold mb-1" style={{ fontFamily: "'Fredoka', sans-serif", textShadow: "0 2px 8px rgba(0,0,0,.3)" }}>
            💬 Secret Santa Chat
          </h1>
          <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,.5)" }}>
            Private conversations with your matches
          </p>
        </div>

        {/* Explainer banner */}
        <div className="flex gap-3 mb-6 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
          <div className="flex-1 text-center p-3 rounded-xl" style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.12)" }}>
            <div className="text-[28px] mb-1">🎁</div>
            <div className="text-[12px] font-extrabold" style={{ color: "#fbbf24" }}>You → Recipient</div>
            <div className="text-[10px] leading-relaxed mt-1" style={{ color: "rgba(255,255,255,.4)" }}>
              You know who they are.<br />They see you as &quot;🎅 Secret Santa&quot;
            </div>
          </div>
          <div className="flex items-center justify-center text-[11px] font-extrabold" style={{ color: "rgba(255,255,255,.15)" }}>VS</div>
          <div className="flex-1 text-center p-3 rounded-xl" style={{ background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.12)" }}>
            <div className="text-[28px] mb-1">🎅</div>
            <div className="text-[12px] font-extrabold" style={{ color: "#86efac" }}>Secret Santa → You</div>
            <div className="text-[10px] leading-relaxed mt-1" style={{ color: "rgba(255,255,255,.4)" }}>
              Someone drew your name.<br />You don&apos;t know who they are!
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
            {/* ═══ GIVER SECTION (Gold) ═══ */}
            {giverThreads.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-[40px] h-[40px] rounded-xl flex items-center justify-center text-[20px]"
                    style={{ background: "rgba(251,191,36,.15)", boxShadow: "0 2px 10px rgba(251,191,36,.1)" }}>🎁</div>
                  <div>
                    <div className="text-[18px] font-bold" style={{ fontFamily: "'Fredoka', sans-serif", color: "#fbbf24" }}>People You&apos;re Buying For</div>
                    <div className="text-[11px] font-semibold" style={{ color: "rgba(251,191,36,.5)" }}>You know who they are — they don&apos;t know it&apos;s you!</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 mb-6">
                  {giverThreads.map((t, i) => (
                    <div key={`giver-${i}`} onClick={() => setActiveThread(t)}
                      className="cursor-pointer flex items-center justify-between p-3.5 rounded-[14px] transition"
                      style={{
                        background: "linear-gradient(135deg,rgba(251,191,36,.06),rgba(245,158,11,.04))",
                        border: "1px solid rgba(251,191,36,.15)",
                        borderLeft: "4px solid #fbbf24",
                      }}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center text-[20px] flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)", boxShadow: "0 3px 12px rgba(251,191,36,.25)" }}>
                          🎁
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-extrabold" style={{ color: "#fbbf24" }}>{t.other_name}</div>
                          <div className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,.35)" }}>{t.group_name}</div>
                          <div className="text-[12px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,.3)" }}>{t.last_message}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                        {t.last_time && <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,.25)" }}>{t.last_time}</span>}
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md"
                          style={{ background: "rgba(251,191,36,.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,.1)" }}>
                          You → {t.other_name}
                        </span>
                        <span className="text-[16px]" style={{ color: "rgba(251,191,36,.3)" }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Divider */}
            {giverThreads.length > 0 && receiverThreads.length > 0 && (
              <div className="my-5" style={{ height: "1px", background: "rgba(255,255,255,.06)" }} />
            )}

            {/* ═══ RECEIVER SECTION (Green) ═══ */}
            {receiverThreads.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-[40px] h-[40px] rounded-xl flex items-center justify-center text-[20px]"
                    style={{ background: "rgba(34,197,94,.15)", boxShadow: "0 2px 10px rgba(34,197,94,.1)" }}>🎅</div>
                  <div>
                    <div className="text-[18px] font-bold" style={{ fontFamily: "'Fredoka', sans-serif", color: "#86efac" }}>Your Mystery Santa</div>
                    <div className="text-[11px] font-semibold" style={{ color: "rgba(34,197,94,.5)" }}>Someone drew your name — you don&apos;t know who!</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {receiverThreads.map((t, i) => (
                    <div key={`receiver-${i}`} onClick={() => setActiveThread(t)}
                      className="cursor-pointer flex items-center justify-between p-3.5 rounded-[14px] transition"
                      style={{
                        background: "linear-gradient(135deg,rgba(34,197,94,.06),rgba(22,163,74,.04))",
                        border: "1px solid rgba(34,197,94,.15)",
                        borderLeft: "4px solid #22c55e",
                      }}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center text-[20px] flex-shrink-0"
                          style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 3px 12px rgba(34,197,94,.25)" }}>
                          🎅
                        </div>
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
                            style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 2px 8px rgba(220,38,38,.3)" }}>
                            {t.unread}
                          </div>
                        )}
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md"
                          style={{ background: "rgba(34,197,94,.12)", color: "#86efac", border: "1px solid rgba(34,197,94,.1)" }}>
                          🎅 → You
                        </span>
                        <span className="text-[16px]" style={{ color: "rgba(34,197,94,.3)" }}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Privacy note */}
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