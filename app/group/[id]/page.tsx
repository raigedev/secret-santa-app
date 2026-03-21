"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InviteForm from "./InviteForm";
import NicknameForm from "./NicknameForm";
import ResendButton from "./ResendButton";

type Member = {
  user_id: string | null;
  nickname: string | null;
  email: string | null;
  role: string;
  status: string;
};

type GroupData = {
  name: string;
  description: string | null;
  event_date: string;
  owner_id: string;
};

// ─── Canvas Garland Renderer ───
function drawGarland(canvas: HTMLCanvasElement, orientation: "horizontal" | "vertical") {
  const parent = canvas.parentElement;
  if (!parent) return;

  const rect = parent.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  let w: number, h: number;
  if (orientation === "horizontal") {
    w = rect.width - 40;
    h = 48;
  } else {
    w = 48;
    h = rect.height - 60;
  }

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const greens = ["#1a6b2a", "#2d7a3a", "#3a8f4a", "#228b22", "#1b5e20", "#4caf50"];

  function drawNeedles(cx: number, cy: number, size: number, angle: number) {
    for (let i = 0; i < 8; i++) {
      const a = angle + (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const len = size * (0.6 + Math.random() * 0.5);
      const perpA = a + Math.PI / 2;
      const thickness = 1.5 + Math.random();
      const ex = cx + Math.cos(a) * len;
      const ey = cy + Math.sin(a) * len;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex + Math.cos(perpA) * thickness, ey + Math.sin(perpA) * thickness);
      ctx.lineTo(cx + Math.cos(a) * len * 1.05, cy + Math.sin(a) * len * 1.05);
      ctx.lineTo(ex - Math.cos(perpA) * thickness, ey - Math.sin(perpA) * thickness);
      ctx.closePath();
      ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)];
      ctx.fill();
    }
  }

  function drawBerries(cx: number, cy: number) {
    const offsets = [[-4, -3], [3, -4], [0, 3], [-3, 2], [4, 1]];
    for (let j = 0; j < 3 + Math.floor(Math.random() * 3); j++) {
      const o = offsets[j % offsets.length];
      const r = 2.5 + Math.random() * 2;
      const grad = ctx.createRadialGradient(cx + o[0] - 1, cy + o[1] - 1, 0, cx + o[0], cy + o[1], r);
      grad.addColorStop(0, "#ff4444");
      grad.addColorStop(0.7, "#cc1b1b");
      grad.addColorStop(1, "#8b0000");
      ctx.beginPath();
      ctx.arc(cx + o[0], cy + o[1], r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + o[0] - 1, cy + o[1] - 1, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fill();
    }
  }

  function drawStar(cx: number, cy: number, size: number) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const aInner = a + Math.PI / 5;
      ctx.lineTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size);
      ctx.lineTo(cx + Math.cos(aInner) * size * 0.4, cy + Math.sin(aInner) * size * 0.4);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
    grad.addColorStop(0, "#ffe066");
    grad.addColorStop(0.5, "#f0c030");
    grad.addColorStop(1, "#c8960f");
    ctx.fillStyle = grad;
    ctx.fill();
  }

  if (orientation === "horizontal") {
    const cy = 24;
    for (let x = 10; x < w; x += 12 + Math.random() * 8)
      drawNeedles(x, cy + (Math.random() - 0.5) * 6, 12 + Math.random() * 6, Math.random() * Math.PI * 2);
    for (let x = 5; x < w; x += 15 + Math.random() * 10)
      drawNeedles(x, cy + (Math.random() - 0.5) * 8, 10 + Math.random() * 5, Math.random() * Math.PI * 2);
    for (let x = 30; x < w; x += 60 + Math.random() * 40)
      drawBerries(x, cy + (Math.random() - 0.5) * 4);
    for (let x = 80; x < w; x += 120 + Math.random() * 60)
      drawStar(x, cy - 2 + Math.random() * 4, 5 + Math.random() * 3);
  } else {
    const cx = 24;
    for (let y = 10; y < h; y += 12 + Math.random() * 8)
      drawNeedles(cx + (Math.random() - 0.5) * 6, y, 12 + Math.random() * 6, Math.random() * Math.PI * 2);
    for (let y = 5; y < h; y += 15 + Math.random() * 10)
      drawNeedles(cx + (Math.random() - 0.5) * 8, y, 10 + Math.random() * 5, Math.random() * Math.PI * 2);
    for (let y = 30; y < h; y += 60 + Math.random() * 40)
      drawBerries(cx + (Math.random() - 0.5) * 4, y);
    for (let y = 80; y < h; y += 120 + Math.random() * 60)
      drawStar(cx - 2 + Math.random() * 4, y, 5 + Math.random() * 3);
  }
}

export default function GroupDetails() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [supabase] = useState(() => createClient());
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topRef = useRef<HTMLCanvasElement>(null);
  const bottomRef = useRef<HTMLCanvasElement>(null);
  const leftRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);

  const renderGarlands = () => {
    if (topRef.current) drawGarland(topRef.current, "horizontal");
    if (bottomRef.current) drawGarland(bottomRef.current, "horizontal");
    if (leftRef.current) drawGarland(leftRef.current, "vertical");
    if (rightRef.current) drawGarland(rightRef.current, "vertical");
  };

  useEffect(() => {
    if (!id) return;

    const loadGroupData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.id);

      const { data: group, error: groupError } = await supabase
        .from("groups").select("name, description, event_date, owner_id")
        .eq("id", id).maybeSingle();

      if (groupError) { setError("Error loading group"); setLoading(false); return; }
      if (!group) { setError("Group not found"); setLoading(false); return; }

      setGroupData(group);
      setIsOwner(user.id === group.owner_id);

      const { data: membersData, error: membersError } = await supabase
        .from("group_members").select("user_id, nickname, email, role, status")
        .eq("group_id", id);

      if (membersError) { setError("Error loading members"); setLoading(false); return; }
      setMembers((membersData ?? []) as Member[]);
      setLoading(false);

      setTimeout(renderGarlands, 100);
    };

    loadGroupData();

    // Real-time subscription
    const channel = supabase
      .channel(`group-${id}-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${id}` }, () => loadGroupData())
      .on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `id=eq.${id}` }, () => loadGroupData())
      .subscribe();

    window.addEventListener("resize", renderGarlands);

    // ─── Snow effect ───
    const snowWrap = document.getElementById("snowWrap");
    if (snowWrap && snowWrap.children.length === 0) {
      for (let i = 0; i < 50; i++) {
        const s = document.createElement("div");
        s.className = "snowflake";
        const sz = 2 + Math.random() * 3;
        s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;animation-duration:${5 + Math.random() * 10}s;animation-delay:${Math.random() * 6}s;opacity:${0.3 + Math.random() * 0.5};`;
        snowWrap.appendChild(s);
      }
    }

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("resize", renderGarlands);
      const sw = document.getElementById("snowWrap");
      if (sw) sw.innerHTML = "";
    };
  }, [id, supabase, router]);

  const handleDeleteGroup = async () => {
    if (!confirm("Are you sure you want to delete this group? This cannot be undone.")) return;
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) alert("Failed to delete group: " + error.message);
    else router.push("/dashboard");
  };

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg,#eef4fb,#dce8f5,#d0e0f0,#e8dce0)" }}>
      <p className="text-lg font-semibold text-blue-700">Loading group...</p>
    </main>
  );

  if (error || !groupData) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg,#eef4fb,#dce8f5)" }}>
      <p className="text-lg font-semibold text-red-600">{error || "Group not found"}</p>
    </main>
  );

  const acceptedMembers = members.filter((m) => m.status === "accepted");
  const pendingMembers = members.filter((m) => m.status === "pending");
  const declinedMembers = members.filter((m) => m.status === "declined");

  return (
    <main className="min-h-screen relative overflow-x-hidden" style={{ background: "linear-gradient(180deg,#eef4fb 0%,#dce8f5 35%,#d0e0f0 65%,#e8dce0 100%)", fontFamily: "'Nunito', sans-serif" }}>

      {/* Snow container */}
      <div id="snowWrap" className="fixed inset-0 pointer-events-none z-0 overflow-hidden" />

      {/* Snow + glow CSS */}
      <style>{`
        @keyframes glow { 0% { opacity:.4; transform:scale(.85); } 100% { opacity:1; transform:scale(1.15); } }
        @keyframes fall { 0% { transform:translateY(-10px) translateX(0); opacity:.8; } 50% { transform:translateY(50vh) translateX(15px); } 100% { transform:translateY(105vh) translateX(-8px); opacity:.2; } }
        .snowflake { position:absolute; background:#fff; border-radius:50%; animation:fall linear infinite; }
      `}</style>

      <div className="relative z-10 max-w-[740px] mx-auto px-4 py-6">

        {/* Back button */}
        <button onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-3.5 px-4 py-2 rounded-lg transition"
          style={{ color: "#4a6fa5", background: "rgba(255,255,255,.6)", border: "1px solid rgba(74,111,165,.15)", backdropFilter: "blur(8px)" }}>
          ← Back to Dashboard
        </button>

        {/* Christmas Lights */}
        <div className="flex justify-center gap-3.5 mb-4">
          {["#dc2626","#3b82f6","#fff","#dc2626","#f59e0b","#3b82f6","#fff","#dc2626","#3b82f6","#f59e0b","#fff","#dc2626"].map((c, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{
              background: c, boxShadow: `0 0 8px ${c}`,
              animation: "glow 2s ease-in-out infinite alternate", animationDelay: `${i * 0.15}s`
            }} />
          ))}
        </div>

        {/* ═══ GARLAND FRAME ═══ */}
        <div className="relative" style={{ marginTop: "36px", padding: "52px" }}>

          {/* Ribbons */}
          <div className="absolute top-[18px] left-[30px] right-[30px] h-1 z-[4] rounded-sm" style={{ background: "linear-gradient(90deg,rgba(192,57,43,.7),rgba(231,76,60,.8),rgba(192,57,43,.7))" }} />
          <div className="absolute bottom-[18px] left-[30px] right-[30px] h-1 z-[4] rounded-sm" style={{ background: "linear-gradient(90deg,rgba(192,57,43,.7),rgba(231,76,60,.8),rgba(192,57,43,.7))" }} />
          <div className="absolute left-[18px] top-[40px] bottom-[40px] w-1 z-[4] rounded-sm" style={{ background: "linear-gradient(180deg,rgba(192,57,43,.7),rgba(231,76,60,.8),rgba(192,57,43,.7))" }} />
          <div className="absolute right-[18px] top-[40px] bottom-[40px] w-1 z-[4] rounded-sm" style={{ background: "linear-gradient(180deg,rgba(192,57,43,.7),rgba(231,76,60,.8),rgba(192,57,43,.7))" }} />

          {/* Canvas garlands */}
          <canvas ref={topRef} className="absolute z-[3] top-[-6px] left-[20px] right-[20px]" style={{ height: "48px" }} />
          <canvas ref={bottomRef} className="absolute z-[3] bottom-[-6px] left-[20px] right-[20px]" style={{ height: "48px", transform: "scaleY(-1)" }} />
          <canvas ref={leftRef} className="absolute z-[3] left-[-6px] top-[30px] bottom-[30px]" style={{ width: "48px" }} />
          <canvas ref={rightRef} className="absolute z-[3] right-[-6px] top-[30px] bottom-[30px]" style={{ width: "48px" }} />

          {/* Corner ornaments */}
          <div className="absolute top-[-16px] left-[-16px] z-[15] text-[28px] drop-shadow-lg">🔴</div>
          <div className="absolute top-[-16px] right-[-16px] z-[15] text-[28px] drop-shadow-lg">⭐</div>
          <div className="absolute bottom-[-16px] left-[-16px] z-[15] text-[28px] drop-shadow-lg">⭐</div>
          <div className="absolute bottom-[-16px] right-[-16px] z-[15] text-[28px] drop-shadow-lg">🔴</div>

          {/* SVG Bow + Bells */}
          <div className="absolute top-[-34px] left-1/2 -translate-x-1/2 z-20 drop-shadow-lg">
            <svg width="90" height="55" viewBox="0 0 90 55">
              <ellipse cx="24" cy="35" rx="11" ry="13" fill="#c8960f"/><ellipse cx="24" cy="35" rx="9" ry="11" fill="#f0c030"/>
              <ellipse cx="24" cy="35" rx="6" ry="8" fill="#f5d45a" opacity=".5"/>
              <circle cx="24" cy="44" r="3.5" fill="#a67c00"/>
              <ellipse cx="66" cy="35" rx="11" ry="13" fill="#c8960f"/><ellipse cx="66" cy="35" rx="9" ry="11" fill="#f0c030"/>
              <ellipse cx="66" cy="35" rx="6" ry="8" fill="#f5d45a" opacity=".5"/>
              <circle cx="66" cy="44" r="3.5" fill="#a67c00"/>
              <path d="M45,20 Q30,6 18,16 Q30,24 45,20Z" fill="#b5301a"/>
              <path d="M45,20 Q60,6 72,16 Q60,24 45,20Z" fill="#dc3c28"/>
              <path d="M38,22 Q30,42 24,46" stroke="#b5301a" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
              <path d="M52,22 Q60,42 66,46" stroke="#dc3c28" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
              <circle cx="45" cy="20" r="6" fill="#c0392b"/>
              <circle cx="45" cy="20" r="4" fill="#e74c3c"/>
              <circle cx="43" cy="18" r="1.5" fill="rgba(255,255,255,.3)"/>
            </svg>
          </div>

          {/* ═══ INNER CARD ═══ */}
          <div className="relative z-[2] rounded-[18px] p-7" style={{
            background: "linear-gradient(170deg,#fdfbf7,#f9f3eb)",
            border: "2px solid #1a6b2a",
            boxShadow: "0 10px 40px rgba(0,0,0,.08),0 0 0 5px rgba(26,107,42,.05)"
          }}>

            {/* Hero */}
            <div className="rounded-2xl p-5 mb-4 relative overflow-hidden" style={{
              background: "linear-gradient(135deg,#c0392b,#e74c3c)",
              boxShadow: "0 4px 20px rgba(192,57,43,.2)"
            }}>
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="flex gap-3 items-start flex-1">
                  <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: "rgba(255,255,255,.18)", border: "2px solid rgba(255,255,255,.25)" }}>🎁</div>
                  <div>
                    <div className="text-2xl font-bold text-white" style={{ fontFamily: "'Fredoka', sans-serif", textShadow: "0 2px 4px rgba(0,0,0,.15)" }}>
                      {groupData.name}
                    </div>
                    {groupData.description && <div className="text-sm text-white/80 mb-1.5">{groupData.description}</div>}
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,255,255,.15)" }}>
                        📅 {groupData.event_date}
                      </span>
                      <span className="text-xs font-semibold text-white px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,255,255,.15)" }}>
                        👥 {members.length} members
                      </span>
                    </div>
                  </div>
                </div>
                {isOwner && (
                  <button onClick={handleDeleteGroup}
                    className="px-3 py-2 rounded-lg text-xs font-bold transition"
                    style={{ background: "rgba(0,0,0,.15)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.1)" }}>
                    🗑️ Delete
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { n: acceptedMembers.length, l: "Accepted", c: "#15803d", b: "#22c55e" },
                { n: pendingMembers.length, l: "Pending", c: "#b45309", b: "#f59e0b" },
                { n: declinedMembers.length, l: "Declined", c: "#dc2626", b: "#dc2626" },
                { n: members.length, l: "Total", c: "#1d4ed8", b: "#2563eb" },
              ].map((s, i) => (
                <div key={i} className="rounded-[14px] py-3 px-2 text-center relative overflow-hidden" style={{ background: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.9)" }}>
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[14px]" style={{ background: s.b }} />
                  <div className="text-2xl font-bold leading-none" style={{ fontFamily: "'Fredoka', sans-serif", color: s.c }}>{s.n}</div>
                  <div className="text-[9px] font-bold text-gray-500 mt-0.5 uppercase tracking-wide">{s.l}</div>
                </div>
              ))}
            </div>

            {/* Invite (owner only) */}
            {isOwner && <InviteForm groupId={id} />}

            {/* Accepted */}
            <div className="flex items-center gap-1.5 mb-2.5" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: "16px", fontWeight: 700, color: "#15803d" }}>
              🎄 Participants
            </div>
            {acceptedMembers.length === 0 ? (
              <p className="text-gray-500 text-center text-sm mb-4">No accepted members yet.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {acceptedMembers.map((m, index) => {
                  const isCurrentUser = currentUserId === m.user_id;
                  return (
                    <div key={m.user_id || index}
                      className="rounded-xl p-3 transition hover:-translate-y-0.5"
                      style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.85)", borderLeft: `4px solid ${isCurrentUser ? "#f59e0b" : "#22c55e"}` }}>
                      {isCurrentUser ? (
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                                style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>
                                {(m.nickname || "Y")[0].toUpperCase()}
                              </div>
                              <div className="text-sm font-bold text-gray-800">You</div>
                            </div>
                            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full text-white"
                              style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>You ✓</span>
                          </div>
                          <NicknameForm groupId={id} currentNickname={m.nickname || ""} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                              style={{ background: "linear-gradient(135deg,#4ade80,#22c55e)" }}>
                              {(m.nickname || "P")[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-800">{m.nickname || `Participant ${index + 1}`}</div>
                              <div className="text-[11px] text-gray-500 font-semibold">Joined</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full" style={{ background: "#dcfce7", color: "#15803d" }}>Accepted ✓</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pending */}
            {pendingMembers.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mb-2.5" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: "16px", fontWeight: 700, color: "#92400e" }}>
                  ⏳ Waiting for Response
                </div>
                <div className="flex flex-col gap-2 mb-4">
                  {pendingMembers.map((m, index) => (
                    <div key={m.email || index}
                      className="rounded-xl p-3 flex items-center justify-between"
                      style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.85)", borderLeft: "4px solid #fbbf24" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                          style={{ background: "linear-gradient(135deg,#d1d5db,#9ca3af)" }}>?</div>
                        <div>
                          <div className="text-sm font-bold text-gray-800">{m.nickname || `Participant ${index + 1}`}</div>
                          <div className="text-[11px] text-gray-500 font-semibold">Hasn&apos;t responded yet</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>Pending</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Declined (owner only) */}
            {isOwner && declinedMembers.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mb-2.5" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: "16px", fontWeight: 700, color: "#dc2626" }}>
                  ❌ Declined
                </div>
                <div className="flex flex-col gap-2 mb-4">
                  {declinedMembers.map((m, index) => (
                    <div key={m.email || index}
                      className="rounded-xl p-3 flex items-center justify-between"
                      style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.85)", borderLeft: "4px solid #ef4444" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white"
                          style={{ background: "linear-gradient(135deg,#f87171,#ef4444)" }}>✗</div>
                        <div>
                          <div className="text-sm font-bold text-gray-800">{m.nickname || `Participant ${index + 1}`}</div>
                          <div className="text-[11px] text-gray-500 font-semibold">Declined the invitation</div>
                        </div>
                      </div>
                      <ResendButton groupId={id} memberEmail={m.email || ""} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Info box */}
            {pendingMembers.length > 0 && isOwner && (
              <div className="rounded-xl p-3.5 flex items-start gap-2 text-xs leading-relaxed"
                style={{ background: "rgba(59,130,246,.04)", border: "1px solid rgba(59,130,246,.1)", color: "#4a6fa5" }}>
                <span className="text-base">💡</span>
                <div><strong className="text-blue-700">Pending members</strong> need to log in and accept from their dashboard. <strong className="text-blue-700">Declined members</strong> can be re-invited with the Resend button.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}