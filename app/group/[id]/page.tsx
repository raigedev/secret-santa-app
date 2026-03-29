"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InviteForm from "./InviteForm";
import NicknameForm from "./NicknameForm";
import ResendButton from "./ResendButton";
import { drawSecretSanta } from "./draw-action";
import { editGroup, deleteGroup, removeMember, leaveGroup } from "./actions";
import { GroupSkeleton } from "@/app/components/PageSkeleton";
import FadeIn from "@/app/components/FadeIn";

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
  budget: number | null;
  currency: string | null;
};

type Assignment = { receiver_nickname: string };

// ─── Canvas Garland Renderer ───
function drawGarlandCanvas(canvas: HTMLCanvasElement, orientation: "horizontal" | "vertical") {
  const parent = canvas.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  let w: number, h: number;
  if (orientation === "horizontal") { w = rect.width - 40; h = 48; }
  else { w = 48; h = rect.height - 60; }
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const greens = ["#1a6b2a", "#2d7a3a", "#3a8f4a", "#228b22", "#1b5e20", "#4caf50"];
  function drawNeedles(cx: number, cy: number, size: number, angle: number) {
    for (let i = 0; i < 8; i++) {
      const a = angle + (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const len = size * (0.6 + Math.random() * 0.5);
      const perpA = a + Math.PI / 2;
      const thickness = 1.5 + Math.random();
      const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(ex + Math.cos(perpA) * thickness, ey + Math.sin(perpA) * thickness);
      ctx.lineTo(cx + Math.cos(a) * len * 1.05, cy + Math.sin(a) * len * 1.05);
      ctx.lineTo(ex - Math.cos(perpA) * thickness, ey - Math.sin(perpA) * thickness);
      ctx.closePath(); ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)]; ctx.fill();
    }
  }
  function drawBerries(cx: number, cy: number) {
    const offsets = [[-4,-3],[3,-4],[0,3],[-3,2],[4,1]];
    for (let j = 0; j < 3 + Math.floor(Math.random() * 3); j++) {
      const o = offsets[j % offsets.length]; const r = 2.5 + Math.random() * 2;
      const grad = ctx.createRadialGradient(cx+o[0]-1,cy+o[1]-1,0,cx+o[0],cy+o[1],r);
      grad.addColorStop(0,"#ff4444"); grad.addColorStop(0.7,"#cc1b1b"); grad.addColorStop(1,"#8b0000");
      ctx.beginPath(); ctx.arc(cx+o[0],cy+o[1],r,0,Math.PI*2); ctx.fillStyle=grad; ctx.fill();
      ctx.beginPath(); ctx.arc(cx+o[0]-1,cy+o[1]-1,r*.3,0,Math.PI*2); ctx.fillStyle="rgba(255,255,255,.4)"; ctx.fill();
    }
  }
  function drawStar(cx: number, cy: number, size: number) {
    ctx.beginPath();
    for (let i=0;i<5;i++){const a=-Math.PI/2+(i*2*Math.PI)/5;const ai=a+Math.PI/5;ctx.lineTo(cx+Math.cos(a)*size,cy+Math.sin(a)*size);ctx.lineTo(cx+Math.cos(ai)*size*.4,cy+Math.sin(ai)*size*.4);}
    ctx.closePath();
    const grad=ctx.createRadialGradient(cx,cy,0,cx,cy,size);grad.addColorStop(0,"#ffe066");grad.addColorStop(.5,"#f0c030");grad.addColorStop(1,"#c8960f");
    ctx.fillStyle=grad; ctx.fill();
  }
  if (orientation === "horizontal") {
    const cy = 24;
    for (let x=10;x<w;x+=12+Math.random()*8) drawNeedles(x,cy+(Math.random()-.5)*6,12+Math.random()*6,Math.random()*Math.PI*2);
    for (let x=5;x<w;x+=15+Math.random()*10) drawNeedles(x,cy+(Math.random()-.5)*8,10+Math.random()*5,Math.random()*Math.PI*2);
    for (let x=30;x<w;x+=60+Math.random()*40) drawBerries(x,cy+(Math.random()-.5)*4);
    for (let x=80;x<w;x+=120+Math.random()*60) drawStar(x,cy-2+Math.random()*4,5+Math.random()*3);
  } else {
    const cx = 24;
    for (let y=10;y<h;y+=12+Math.random()*8) drawNeedles(cx+(Math.random()-.5)*6,y,12+Math.random()*6,Math.random()*Math.PI*2);
    for (let y=5;y<h;y+=15+Math.random()*10) drawNeedles(cx+(Math.random()-.5)*8,y,10+Math.random()*5,Math.random()*Math.PI*2);
    for (let y=30;y<h;y+=60+Math.random()*40) drawBerries(cx+(Math.random()-.5)*4,y);
    for (let y=80;y<h;y+=120+Math.random()*60) drawStar(cx-2+Math.random()*4,y,5+Math.random()*3);
  }
}

function drawHeroPine(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement?.offsetWidth || 600;
  canvas.width = w * dpr; canvas.height = 36 * dpr;
  canvas.style.width = "100%"; canvas.style.height = "36px";
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const greens = ["#1a6b2a","#2d7a3a","#3a8f4a","#228b22","#1b5e20"];
  for (let x = 5; x < w; x += 10 + Math.random() * 6) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2; const len = 6 + Math.random() * 5;
      const cy = 18 + (Math.random() - .5) * 10; const pa = a + Math.PI / 2;
      const t = 1 + Math.random();
      const ex = x + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
      ctx.beginPath(); ctx.moveTo(x, cy);
      ctx.lineTo(ex + Math.cos(pa) * t, ey + Math.sin(pa) * t);
      ctx.lineTo(x + Math.cos(a) * len * 1.05, cy + Math.sin(a) * len * 1.05);
      ctx.lineTo(ex - Math.cos(pa) * t, ey - Math.sin(pa) * t);
      ctx.closePath(); ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)]; ctx.fill();
    }
  }
  for (let x = 30; x < w; x += 70 + Math.random() * 40) {
    for (let j = 0; j < 3; j++) {
      const r = 2 + Math.random() * 1.5; const ox = (Math.random() - .5) * 8; const oy = (Math.random() - .5) * 6;
      const g = ctx.createRadialGradient(x+ox-1,18+oy-1,0,x+ox,18+oy,r);
      g.addColorStop(0,"#ff4444"); g.addColorStop(1,"#8b0000");
      ctx.beginPath(); ctx.arc(x+ox,18+oy,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    }
  }
}

const BUDGET_OPTIONS = [10, 15, 25, 50, 100];
const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD" },
  { code: "EUR", symbol: "€", label: "EUR" },
  { code: "GBP", symbol: "£", label: "GBP" },
  { code: "PHP", symbol: "₱", label: "PHP" },
  { code: "JPY", symbol: "¥", label: "JPY" },
  { code: "AUD", symbol: "A$", label: "AUD" },
  { code: "CAD", symbol: "C$", label: "CAD" },
];

// ─── MODAL OVERLAY (declared outside render to avoid ESLint error) ───
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="rounded-[20px] p-7 max-w-[420px] w-full" style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
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
  const [drawLoading, setDrawLoading] = useState(false);
  const [drawMessage, setDrawMessage] = useState("");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [drawDone, setDrawDone] = useState(false);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editBudget, setEditBudget] = useState(25);
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editCustom, setEditCustom] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  // Leave / Remove
  const [actionSaving, setActionSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Canvas refs
  const topRef = useRef<HTMLCanvasElement>(null);
  const bottomRef = useRef<HTMLCanvasElement>(null);
  const leftRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);
  const heroPineRef = useRef<HTMLCanvasElement>(null);

  const renderGarlands = () => {
    if (topRef.current) drawGarlandCanvas(topRef.current, "horizontal");
    if (bottomRef.current) drawGarlandCanvas(bottomRef.current, "horizontal");
    if (leftRef.current) drawGarlandCanvas(leftRef.current, "vertical");
    if (rightRef.current) drawGarlandCanvas(rightRef.current, "vertical");
    if (heroPineRef.current) drawHeroPine(heroPineRef.current);
  };

  useEffect(() => {
    if (!id) return;

    const loadGroupData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const user = session.user;
      setCurrentUserId(user.id);

      const { data: group, error: groupError } = await supabase
        .from("groups").select("name, description, event_date, owner_id, budget, currency")
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

      const { data: myAssignment } = await supabase
        .from("assignments").select("receiver_id")
        .eq("group_id", id).eq("giver_id", user.id).maybeSingle();

      if (myAssignment) {
        setDrawDone(true);
        const receiver = (membersData ?? []).find((m) => m.user_id === myAssignment.receiver_id);
        setAssignment({ receiver_nickname: receiver?.nickname || "Secret Participant" });
      }

      setLoading(false);
      setTimeout(renderGarlands, 100);
    };

    loadGroupData();

    const channel = supabase
      .channel(`group-${id}-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${id}` }, () => loadGroupData())
      .on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `id=eq.${id}` }, () => loadGroupData())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments", filter: `group_id=eq.${id}` }, () => loadGroupData())
      .subscribe();

    window.addEventListener("resize", renderGarlands);

    const snowWrap = document.getElementById("snowWrap");
    if (snowWrap && snowWrap.children.length === 0) {
      for (let i = 0; i < 50; i++) {
        const s = document.createElement("div"); s.className = "snowflake";
        const sz = 2 + Math.random() * 3;
        s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;animation-duration:${5+Math.random()*10}s;animation-delay:${Math.random()*6}s;opacity:${.3+Math.random()*.5};`;
        snowWrap.appendChild(s);
      }
    }

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("resize", renderGarlands);
      const sw = document.getElementById("snowWrap"); if (sw) sw.innerHTML = "";
    };
  }, [id, supabase, router]);

  const handleDraw = async () => {
    if (!confirm("Are you sure? The draw is FINAL and cannot be undone.")) return;
    setDrawLoading(true); setDrawMessage("");
    const result = await drawSecretSanta(id);
    setDrawMessage(result.message); setDrawLoading(false);
  };

  const openEditModal = () => {
    if (!groupData) return;
    setEditName(groupData.name);
    setEditDesc(groupData.description || "");
    setEditDate(groupData.event_date);
    setEditBudget(groupData.budget || 25);
    setEditCurrency(groupData.currency || "USD");
    setEditCustom(!BUDGET_OPTIONS.includes(groupData.budget || 25));
    setEditMsg("");
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    setEditSaving(true); setEditMsg("");
    const result = await editGroup(id, editName, editDesc, editDate, editBudget, editCurrency);
    setEditMsg(result.message);
    setEditSaving(false);
    if (result.success) setTimeout(() => setShowEditModal(false), 800);
  };

  const handleDelete = async () => {
    setDeleteSaving(true); setDeleteMsg("");
    const result = await deleteGroup(id, deleteConfirm);
    setDeleteMsg(result.message);
    setDeleteSaving(false);
    if (result.success) router.push("/dashboard");
  };

  const handleRemoveMember = async () => {
    if (!removingMember?.user_id) return;
    setActionSaving(true); setActionMsg("");
    const result = await removeMember(id, removingMember.user_id);
    setActionMsg(result.message);
    setActionSaving(false);
    if (result.success) setTimeout(() => setRemovingMember(null), 800);
  };

  const handleLeave = async () => {
    setActionSaving(true); setActionMsg("");
    const result = await leaveGroup(id);
    setActionMsg(result.message);
    setActionSaving(false);
    if (result.success) router.push("/dashboard");
  };

  if (loading) return <GroupSkeleton />;

  if (error || !groupData) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg,#eef4fb,#dce8f5)" }}>
      <p className="text-lg font-semibold text-red-600">{error || "Group not found"}</p>
    </main>
  );

  const acceptedMembers = members.filter((m) => m.status === "accepted");
  const pendingMembers = members.filter((m) => m.status === "pending");
  const declinedMembers = members.filter((m) => m.status === "declined");
  const allAccepted = pendingMembers.length === 0 && declinedMembers.length === 0 && acceptedMembers.length >= 3;
  const currSym = CURRENCIES.find((c) => c.code === (groupData.currency || "USD"))?.symbol || "$";

  return (
    <main className="min-h-screen relative overflow-x-hidden" style={{ background: "linear-gradient(180deg,#eef4fb 0%,#dce8f5 35%,#d0e0f0 65%,#e8dce0 100%)", fontFamily: "'Nunito', sans-serif" }}>
      <div id="snowWrap" className="fixed inset-0 pointer-events-none z-0 overflow-hidden" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka:wght@500;600;700&display=swap');
        @keyframes glow{0%{opacity:.4;transform:scale(.85);}100%{opacity:1;transform:scale(1.15);}}
        @keyframes fall{0%{transform:translateY(-10px) translateX(0);opacity:.8;}50%{transform:translateY(50vh) translateX(15px);}100%{transform:translateY(105vh) translateX(-8px);opacity:.2;}}
        .snowflake{position:absolute;background:#fff;border-radius:50%;animation:fall linear infinite;}
        @keyframes revealBounce{0%{opacity:0;transform:scale(.8);}50%{transform:scale(1.05);}100%{opacity:1;transform:scale(1);}}
        @keyframes shimmer{0%{transform:translateX(-100%);}100%{transform:translateX(100%);}}
      `}</style>

      {/* ═══ MODALS ═══ */}

      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)}>
          <h3 className="text-[20px] font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}>✏️ Edit Group</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-extrabold block mb-1" style={{ color: "#374151" }}>Group Name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100}
                className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none" style={{ border: "2px solid #e5e7eb", fontFamily: "inherit" }} />
            </div>
            <div>
              <label className="text-[12px] font-extrabold block mb-1" style={{ color: "#374151" }}>Description</label>
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={300}
                className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none" style={{ border: "2px solid #e5e7eb", fontFamily: "inherit" }} />
            </div>
            <div>
              <label className="text-[12px] font-extrabold block mb-1" style={{ color: "#374151" }}>Event Date</label>
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none" style={{ border: "2px solid #e5e7eb", fontFamily: "inherit" }} />
            </div>
            <div>
              <label className="text-[12px] font-extrabold block mb-1" style={{ color: "#374151" }}>Budget</label>
              <div className="flex gap-1.5 flex-wrap">
                {BUDGET_OPTIONS.map((amt) => (
                  <button key={amt} type="button" onClick={() => { setEditBudget(amt); setEditCustom(false); }}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-bold"
                    style={{ border: `2px solid ${!editCustom && editBudget === amt ? "#c0392b" : "#e5e7eb"}`, background: !editCustom && editBudget === amt ? "#fef2f2" : "#fff", color: !editCustom && editBudget === amt ? "#c0392b" : "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>
                    {currSym}{amt}
                  </button>
                ))}
                <button type="button" onClick={() => setEditCustom(true)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold"
                  style={{ border: `2px solid ${editCustom ? "#c0392b" : "#e5e7eb"}`, background: editCustom ? "#fef2f2" : "#fff", color: editCustom ? "#c0392b" : "#6b7280", cursor: "pointer", fontFamily: "inherit", borderStyle: "dashed" }}>
                  Custom
                </button>
              </div>
              {editCustom && (
                <input type="number" value={editBudget} onChange={(e) => setEditBudget(parseInt(e.target.value) || 0)}
                  className="mt-2 w-28 px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: "2px solid #c0392b", fontFamily: "inherit" }} />
              )}
            </div>
            {editMsg && <p className={`text-[12px] font-bold ${editMsg.includes("updated") ? "text-green-600" : "text-red-600"}`}>{editMsg}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg text-[13px] font-bold" style={{ background: "#f3f4f6", color: "#6b7280", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleEditSave} disabled={editSaving} className="px-5 py-2 rounded-lg text-[13px] font-extrabold text-white"
                style={{ background: editSaving ? "#9ca3af" : "linear-gradient(135deg,#c0392b,#e74c3c)", border: "none", cursor: editSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal onClose={() => setShowDeleteModal(false)}>
          <div className="text-center">
            <div className="text-[48px] mb-2">⚠️</div>
            <h3 className="text-[20px] font-bold mb-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#dc2626" }}>Delete this group?</h3>
            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: "#6b7280" }}>
              This will permanently delete <strong style={{ color: "#1f2937" }}>&quot;{groupData.name}&quot;</strong>, all assignments, wishlists, and messages. This cannot be undone.
            </p>
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={`Type "${groupData.name}" to confirm`}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] text-center outline-none mb-3" style={{ border: "2px solid #e5e7eb", fontFamily: "inherit" }} />
            {deleteMsg && <p className="text-[12px] font-bold text-red-600 mb-2">{deleteMsg}</p>}
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 rounded-lg text-[13px] font-bold" style={{ background: "#f3f4f6", color: "#6b7280", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleteSaving} className="px-5 py-2 rounded-lg text-[13px] font-extrabold"
                style={{ background: "rgba(220,38,38,.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,.15)", cursor: deleteSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {deleteSaving ? "Deleting..." : "🗑️ Delete Forever"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showLeaveModal && (
        <Modal onClose={() => setShowLeaveModal(false)}>
          <div className="text-center">
            <div className="text-[48px] mb-2">🚪</div>
            <h3 className="text-[20px] font-bold mb-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#f59e0b" }}>Leave this group?</h3>
            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: "#6b7280" }}>
              You&apos;ll be removed from <strong style={{ color: "#1f2937" }}>&quot;{groupData.name}&quot;</strong>. You&apos;ll lose access to assignments, wishlists, and chat. You can be re-invited later.
            </p>
            {actionMsg && <p className="text-[12px] font-bold text-red-600 mb-2">{actionMsg}</p>}
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowLeaveModal(false)} className="px-4 py-2 rounded-lg text-[13px] font-bold" style={{ background: "#f3f4f6", color: "#6b7280", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Stay</button>
              <button onClick={handleLeave} disabled={actionSaving} className="px-5 py-2 rounded-lg text-[13px] font-extrabold text-white"
                style={{ background: actionSaving ? "#9ca3af" : "linear-gradient(135deg,#b45309,#f59e0b)", border: "none", cursor: actionSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {actionSaving ? "Leaving..." : "🚪 Leave Group"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {removingMember && (
        <Modal onClose={() => setRemovingMember(null)}>
          <div className="text-center">
            <div className="text-[48px] mb-2">👋</div>
            <h3 className="text-[20px] font-bold mb-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#dc2626" }}>Remove {removingMember.nickname}?</h3>
            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: "#6b7280" }}>
              <strong style={{ color: "#1f2937" }}>{removingMember.nickname}</strong> will be removed from the group. If names have already been drawn, the draw will need to be redone.
            </p>
            {actionMsg && <p className="text-[12px] font-bold mb-2" style={{ color: actionMsg.includes("removed") ? "#16a34a" : "#dc2626" }}>{actionMsg}</p>}
            <div className="flex gap-2 justify-center">
              <button onClick={() => setRemovingMember(null)} className="px-4 py-2 rounded-lg text-[13px] font-bold" style={{ background: "#f3f4f6", color: "#6b7280", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleRemoveMember} disabled={actionSaving} className="px-5 py-2 rounded-lg text-[13px] font-extrabold"
                style={{ background: "rgba(220,38,38,.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,.15)", cursor: actionSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {actionSaving ? "Removing..." : "✕ Remove Member"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ PAGE CONTENT ═══ */}
      <FadeIn className="relative z-10 max-w-[740px] mx-auto px-4 py-6">

        <button data-fade onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-3.5 px-4 py-2 rounded-lg transition"
          style={{ color: "#4a6fa5", background: "rgba(255,255,255,.6)", border: "1px solid rgba(74,111,165,.15)", fontFamily: "inherit" }}>
          ← Back to Dashboard
        </button>

        <div data-fade className="flex justify-center gap-3.5 mb-4">
          {["#dc2626","#3b82f6","#fff","#dc2626","#f59e0b","#3b82f6","#fff","#dc2626","#3b82f6","#f59e0b","#fff","#dc2626"].map((c, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}`, animation: "glow 2s ease-in-out infinite alternate", animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>

        <div data-fade className="relative" style={{ marginTop: "36px", padding: "52px" }}>
          <div className="absolute top-[18px] left-[30px] right-[30px] h-1 z-[4] rounded-sm" style={{ background: "linear-gradient(90deg,rgba(192,57,43,.7),rgba(231,76,60,.8),rgba(192,57,43,.7))" }} />
          <div className="absolute bottom-[18px] left-[30px] right-[30px] h-1 z-[4] rounded-sm" style={{ background: "linear-gradient(90deg,rgba(192,57,43,.7),rgba(231,76,60,.8),rgba(192,57,43,.7))" }} />
          <div className="absolute left-[18px] top-[40px] bottom-[40px] w-1 z-[4] rounded-sm" style={{ background: "linear-gradient(180deg,rgba(192,57,43,.7),rgba(231,76,60,.8),rgba(192,57,43,.7))" }} />
          <div className="absolute right-[18px] top-[40px] bottom-[40px] w-1 z-[4] rounded-sm" style={{ background: "linear-gradient(180deg,rgba(192,57,43,.7),rgba(231,76,60,.8),rgba(192,57,43,.7))" }} />

          <canvas ref={topRef} className="absolute z-[3] top-[-6px] left-[20px] right-[20px]" style={{ height: "48px" }} />
          <canvas ref={bottomRef} className="absolute z-[3] bottom-[-6px] left-[20px] right-[20px]" style={{ height: "48px", transform: "scaleY(-1)" }} />
          <canvas ref={leftRef} className="absolute z-[3] left-[-6px] top-[30px] bottom-[30px]" style={{ width: "48px" }} />
          <canvas ref={rightRef} className="absolute z-[3] right-[-6px] top-[30px] bottom-[30px]" style={{ width: "48px" }} />

          <div className="absolute top-[-16px] left-[-16px] z-[15] text-[28px] drop-shadow-lg">🔴</div>
          <div className="absolute top-[-16px] right-[-16px] z-[15] text-[28px] drop-shadow-lg">⭐</div>
          <div className="absolute bottom-[-16px] left-[-16px] z-[15] text-[28px] drop-shadow-lg">⭐</div>
          <div className="absolute bottom-[-16px] right-[-16px] z-[15] text-[28px] drop-shadow-lg">🔴</div>

          <div className="absolute top-[-34px] left-1/2 -translate-x-1/2 z-20 drop-shadow-lg">
            <svg width="90" height="55" viewBox="0 0 90 55">
              <ellipse cx="24" cy="35" rx="11" ry="13" fill="#c8960f"/><ellipse cx="24" cy="35" rx="9" ry="11" fill="#f0c030"/>
              <ellipse cx="24" cy="35" rx="6" ry="8" fill="#f5d45a" opacity=".5"/><circle cx="24" cy="44" r="3.5" fill="#a67c00"/>
              <ellipse cx="66" cy="35" rx="11" ry="13" fill="#c8960f"/><ellipse cx="66" cy="35" rx="9" ry="11" fill="#f0c030"/>
              <ellipse cx="66" cy="35" rx="6" ry="8" fill="#f5d45a" opacity=".5"/><circle cx="66" cy="44" r="3.5" fill="#a67c00"/>
              <path d="M45,20 Q30,6 18,16 Q30,24 45,20Z" fill="#b5301a"/>
              <path d="M45,20 Q60,6 72,16 Q60,24 45,20Z" fill="#dc3c28"/>
              <path d="M38,22 Q30,42 24,46" stroke="#b5301a" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
              <path d="M52,22 Q60,42 66,46" stroke="#dc3c28" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
              <circle cx="45" cy="20" r="6" fill="#c0392b"/><circle cx="45" cy="20" r="4" fill="#e74c3c"/>
              <circle cx="43" cy="18" r="1.5" fill="rgba(255,255,255,.3)"/>
            </svg>
          </div>

          <div className="relative z-[2] rounded-[18px] overflow-hidden" style={{ background: "linear-gradient(170deg,#fdfbf7,#f9f3eb)", border: "2px solid #1a6b2a", boxShadow: "0 10px 40px rgba(0,0,0,.08),0 0 0 5px rgba(26,107,42,.05)" }}>
            <div className="overflow-hidden rounded-t-[16px]">
              <div className="relative overflow-hidden" style={{ height: "36px", background: "linear-gradient(135deg,#14532d,#166534)" }}>
                <canvas ref={heroPineRef} className="absolute inset-0" style={{ width: "100%", height: "36px" }} />
              </div>
              <div style={{ height: "5px", background: "linear-gradient(90deg,transparent,#c0392b 10%,#e74c3c 50%,#c0392b 90%,transparent)" }} />
              <div className="text-center" style={{ marginTop: "-8px", position: "relative", zIndex: 2 }}>
                <svg width="60" height="38" viewBox="0 0 60 38" className="inline-block drop-shadow-md">
                  <ellipse cx="16" cy="24" rx="8" ry="10" fill="#c8960f"/><ellipse cx="16" cy="24" rx="6" ry="8" fill="#f0c030"/>
                  <circle cx="16" cy="31" r="2.5" fill="#a67c00"/>
                  <ellipse cx="44" cy="24" rx="8" ry="10" fill="#c8960f"/><ellipse cx="44" cy="24" rx="6" ry="8" fill="#f0c030"/>
                  <circle cx="44" cy="31" r="2.5" fill="#a67c00"/>
                  <path d="M30,12 Q20,4 13,10 Q20,16 30,12Z" fill="#b5301a"/>
                  <path d="M30,12 Q40,4 47,10 Q40,16 30,12Z" fill="#dc3c28"/>
                  <circle cx="30" cy="12" r="4" fill="#c0392b"/><circle cx="30" cy="12" r="2.5" fill="#e74c3c"/>
                </svg>
              </div>

              <div className="px-6 pt-2 pb-5">
                <div className="text-center mb-3" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: "26px", fontWeight: 700, color: "#7f1d1d" }}>🎁 {groupData.name}</div>
                {groupData.description && (
                  <div className="rounded-xl overflow-hidden" style={{ background: "rgba(127,29,29,.04)", border: "1px solid rgba(127,29,29,.08)" }}>
                    <div className="flex items-center gap-1.5 px-3.5 py-2" style={{ background: "rgba(127,29,29,.04)", borderBottom: "1px solid rgba(127,29,29,.06)", fontSize: "10px", fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: ".08em" }}>📋 Rules & Description</div>
                    <div className="px-3.5 py-2.5" style={{ fontSize: "13px", color: "#4b5563", lineHeight: 1.6 }}>{groupData.description}</div>
                  </div>
                )}
              </div>

              <div className="flex items-center px-5 py-3.5" style={{ background: "rgba(127,29,29,.04)", borderTop: "1px solid rgba(127,29,29,.06)" }}>
                {[
                  { icon: "📅", value: groupData.event_date, label: "Event Date" },
                  { icon: "👥", value: `${members.length} Members`, label: "Participants" },
                  { icon: "💰", value: groupData.budget ? `${currSym}${groupData.budget}` : "No limit", label: "Budget" },
                  { icon: "🎲", value: drawDone ? "Drawn ✓" : "Not Yet", label: "Draw Status" },
                ].map((stat, i) => (
                  <div key={i} className="flex-1 flex items-center gap-2">
                    {i > 0 && <div className="w-px h-7 mx-1" style={{ background: "rgba(127,29,29,.08)" }} />}
                    <div className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center text-[12px]" style={{ background: "rgba(127,29,29,.06)" }}>{stat.icon}</div>
                    <div>
                      <div className="text-[11px] font-bold text-gray-700">{stat.value}</div>
                      <div className="text-[9px] font-semibold text-gray-400">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-7 pt-5">

              {isOwner && (
                <div className="flex gap-2 justify-center mb-4 flex-wrap">
                  <button onClick={openEditModal} className="px-4 py-2 rounded-lg text-[11px] font-bold transition"
                    style={{ background: "rgba(59,130,246,.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,.15)", cursor: "pointer", fontFamily: "inherit" }}>
                    ✏️ Edit Group
                  </button>
                  <button onClick={() => { setDeleteConfirm(""); setDeleteMsg(""); setShowDeleteModal(true); }}
                    className="px-4 py-2 rounded-lg text-[11px] font-bold transition"
                    style={{ background: "rgba(220,38,38,.06)", color: "#ef4444", border: "1px solid rgba(220,38,38,.12)", cursor: "pointer", fontFamily: "inherit" }}>
                    🗑️ Delete Group
                  </button>
                </div>
              )}

              {!isOwner && (
                <div className="flex justify-center mb-4">
                  <button onClick={() => { setActionMsg(""); setShowLeaveModal(true); }}
                    className="px-4 py-2 rounded-lg text-[11px] font-bold transition"
                    style={{ background: "rgba(245,158,11,.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.12)", cursor: "pointer", fontFamily: "inherit" }}>
                    🚪 Leave Group
                  </button>
                </div>
              )}

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

              <div className="text-center my-5 py-5 rounded-2xl" style={{ background: "rgba(127,29,29,.03)", border: "1px solid rgba(127,29,29,.08)" }}>
                {drawDone && assignment ? (
                  <div>
                    <div className="text-lg font-bold mb-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#1d4ed8" }}>🎲 Names Have Been Drawn!</div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg mb-4" style={{ background: "#dbeafe", color: "#1d4ed8" }}>🎲 Draw complete — assignments are final</div>
                    <div className="rounded-2xl p-6 mx-4 text-white" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)", boxShadow: "0 4px 20px rgba(251,191,36,.3)", animation: "revealBounce .6s ease" }}>
                      <div className="text-sm opacity-85 mb-1">🎁 You are giving a gift to:</div>
                      <div className="text-3xl font-bold" style={{ fontFamily: "'Fredoka', sans-serif", textShadow: "0 2px 4px rgba(0,0,0,.15)" }}>🎄 {assignment.receiver_nickname} 🎄</div>
                      <div className="text-xs opacity-75 mt-2">This is secret — only you can see this!</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-lg font-bold mb-2" style={{ fontFamily: "'Fredoka', sans-serif", color: "#7f1d1d" }}>🎲 Secret Santa Draw</div>
                    {allAccepted ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg mb-3" style={{ background: "#dcfce7", color: "#15803d" }}>✅ All {acceptedMembers.length} members accepted — Ready to draw!</div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg mb-3" style={{ background: "#fef3c7", color: "#92400e" }}>⏳ Waiting for all members to accept...</div>
                    )}
                    <div className="flex flex-wrap gap-2 justify-center my-4 px-4">
                      {acceptedMembers.map((m, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.9)", color: "#1f2937" }}>
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#4ade80,#22c55e)" }}>{(m.nickname || "P")[0].toUpperCase()}</div>
                          {m.nickname || `Member ${i + 1}`}
                        </div>
                      ))}
                    </div>
                    {isOwner && (
                      <div>
                        <p className="text-xs text-gray-500 mb-3 px-8 leading-relaxed">This will randomly assign each member someone to give a gift to. The draw is <strong>final</strong> and cannot be undone.</p>
                        <button onClick={handleDraw} disabled={!allAccepted || drawLoading}
                          className="relative overflow-hidden px-8 py-3 rounded-xl text-base font-extrabold text-white transition"
                          style={{ background: allAccepted && !drawLoading ? "linear-gradient(135deg,#7f1d1d,#991b1b)" : "#9ca3af", boxShadow: allAccepted && !drawLoading ? "0 4px 20px rgba(127,29,29,.3)" : "none", cursor: allAccepted && !drawLoading ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                          {drawLoading ? "🎰 Drawing..." : "🎲 Draw Names"}
                          {allAccepted && !drawLoading && <span className="absolute inset-0" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)", animation: "shimmer 2s infinite" }} />}
                        </button>
                      </div>
                    )}
                    {!isOwner && <p className="text-xs text-gray-500 mt-2">Waiting for the group owner to draw names...</p>}
                    {drawMessage && <p className={`text-sm font-bold mt-3 ${drawMessage.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>{drawMessage}</p>}
                  </div>
                )}
              </div>

              {isOwner && !drawDone && <InviteForm groupId={id} />}

              <div className="flex items-center gap-1.5 mb-2.5" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: "16px", fontWeight: 700, color: "#15803d" }}>🎄 Participants</div>
              {acceptedMembers.length === 0 ? (
                <p className="text-gray-500 text-center text-sm mb-4">No accepted members yet.</p>
              ) : (
                <div className="flex flex-col gap-2 mb-4">
                  {acceptedMembers.map((m, index) => {
                    const isCurrentUser = currentUserId === m.user_id;
                    return (
                      <div key={m.user_id || index} className="rounded-xl p-3 transition hover:-translate-y-0.5" style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.85)", borderLeft: `4px solid ${isCurrentUser ? "#f59e0b" : "#22c55e"}` }}>
                        {isCurrentUser ? (
                          <div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>{(m.nickname || "Y")[0].toUpperCase()}</div>
                                <div className="text-sm font-bold text-gray-800">You</div>
                              </div>
                              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full text-white" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>You ✓</span>
                            </div>
                            {!drawDone && <NicknameForm groupId={id} currentNickname={m.nickname || ""} />}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,#4ade80,#22c55e)" }}>{(m.nickname || "P")[0].toUpperCase()}</div>
                              <div><div className="text-sm font-bold text-gray-800">{m.nickname || `Participant ${index + 1}`}</div><div className="text-[11px] text-gray-500 font-semibold">Joined</div></div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isOwner && !drawDone && (
                                <button onClick={() => { setActionMsg(""); setRemovingMember(m); }}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
                                  style={{ background: "rgba(220,38,38,.06)", color: "#ef4444", border: "1px solid rgba(220,38,38,.12)", cursor: "pointer", fontFamily: "inherit" }}>
                                  ✕ Remove
                                </button>
                              )}
                              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full" style={{ background: "#dcfce7", color: "#15803d" }}>Accepted ✓</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {pendingMembers.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 mb-2.5" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: "16px", fontWeight: 700, color: "#92400e" }}>⏳ Waiting for Response</div>
                  <div className="flex flex-col gap-2 mb-4">
                    {pendingMembers.map((m, index) => (
                      <div key={m.email || index} className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.85)", borderLeft: "4px solid #fbbf24" }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,#d1d5db,#9ca3af)" }}>?</div>
                          <div><div className="text-sm font-bold text-gray-800">{m.nickname || `Participant ${index + 1}`}</div><div className="text-[11px] text-gray-500 font-semibold">Hasn&apos;t responded yet</div></div>
                        </div>
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>Pending</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isOwner && !drawDone && declinedMembers.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 mb-2.5" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: "16px", fontWeight: 700, color: "#dc2626" }}>❌ Declined</div>
                  <div className="flex flex-col gap-2 mb-4">
                    {declinedMembers.map((m, index) => (
                      <div key={m.email || index} className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.85)", borderLeft: "4px solid #ef4444" }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,#f87171,#ef4444)" }}>✗</div>
                          <div><div className="text-sm font-bold text-gray-800">{m.nickname || `Participant ${index + 1}`}</div><div className="text-[11px] text-gray-500 font-semibold">Declined the invitation</div></div>
                        </div>
                        <ResendButton groupId={id} memberEmail={m.email || ""} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!drawDone && pendingMembers.length > 0 && isOwner && (
                <div className="rounded-xl p-3.5 flex items-start gap-2 text-xs leading-relaxed" style={{ background: "rgba(59,130,246,.04)", border: "1px solid rgba(59,130,246,.1)", color: "#4a6fa5" }}>
                  <span className="text-base">💡</span>
                  <div><strong className="text-blue-700">Pending members</strong> need to log in and accept from their dashboard. <strong className="text-blue-700">Declined members</strong> can be re-invited with the Resend button.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </FadeIn>
    </main>
  );
}