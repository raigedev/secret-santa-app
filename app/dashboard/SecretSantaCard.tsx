"use client";

// ═══════════════════════════════════════
// SECRET SANTA CARD — Dashboard Component
// ═══════════════════════════════════════
// Clickable card that expands to show all your
// Secret Santa assignments from every group,
// plus your own wishlist management.
//
// Security: Core#1 input sanitization, Core#3 least privilege,
// Playbook#19 server-side checks via wishlist-actions

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addWishlistItem,
  editWishlistItem,
  deleteWishlistItem,
} from "./wishlist-actions";

type WishlistItem = {
  id: string;
  item_name: string;
  item_link: string;
  item_note: string;
  priority: number;
};

type RecipientData = {
  group_id: string;
  group_name: string;
  group_event_date: string;
  receiver_nickname: string;
  receiver_wishlist: WishlistItem[];
};

type Props = {
  assignments: RecipientData[];
  myWishlistItems: WishlistItem[];
  myGroupIds: string[];
};

export default function SecretSantaCard({
  assignments,
  myWishlistItems,
  myGroupIds,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newPriority, setNewPriority] = useState(0);
  const [addGroupId, setAddGroupId] = useState(myGroupIds[0] || "");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPriority, setEditPriority] = useState(0);

  const [message, setMessage] = useState("");

  const hasAssignments = assignments.length > 0;

  // ─── Add item handler ───
  const handleAdd = async () => {
    if (!newName.trim()) { setMessage("Item name is required."); return; }
    setAddLoading(true);
    setMessage("");
    const result = await addWishlistItem(addGroupId, newName, newLink, newNote, newPriority);
    setMessage(result.message);
    setAddLoading(false);
    if (result.success) {
      setNewName(""); setNewLink(""); setNewNote(""); setNewPriority(0);
      setShowAddForm(false);
    }
  };

  // ─── Edit item handler ───
  const handleEdit = async (itemId: string) => {
    if (!editName.trim()) { setMessage("Item name is required."); return; }
    setMessage("");
    const result = await editWishlistItem(itemId, editName, editLink, editNote, editPriority);
    setMessage(result.message);
    if (result.success) setEditingId(null);
  };

  // ─── Delete item handler ───
  const handleDelete = async (itemId: string) => {
    if (!confirm("Delete this wishlist item?")) return;
    setMessage("");
    const result = await deleteWishlistItem(itemId);
    setMessage(result.message);
  };

  // ─── Start editing ───
  const startEdit = (item: WishlistItem) => {
    setEditingId(item.id);
    setEditName(item.item_name);
    setEditLink(item.item_link);
    setEditNote(item.item_note);
    setEditPriority(item.priority);
  };

  // ═══ NO ASSIGNMENTS — Placeholder card ═══
  if (!hasAssignments) {
    return (
      <div className="text-white rounded-t-[2rem] rounded-b-xl hover:scale-105 transition transform relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #F87171, #EF4444)", boxShadow: "0 0 20px rgba(239, 68, 68, 0.7)" }}>
        <div className="bg-white text-red-700 font-bold py-2 text-center rounded-t-[2rem]">🎅 Your Secret Santa</div>
        <div className="p-4 text-center">
          <p className="text-sm" style={{ color: "#334155" }}>Assignments will appear here</p>
          <div className="mt-4 flex justify-center gap-2 text-xl">🎁 🌲 🍬</div>
        </div>
      </div>
    );
  }

  // ═══ HAS ASSIGNMENTS — Closed card ═══
  if (!expanded) {
    return (
      <div onClick={() => setExpanded(true)}
        className="cursor-pointer rounded-[16px] overflow-hidden transition hover:scale-[1.04]"
        style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 4px 20px rgba(220,38,38,.3)" }}>
        <div className="bg-white py-2.5 px-4 text-center font-extrabold text-[14px] rounded-t-[16px] relative" style={{ color: "#dc2626" }}>
          🎅 Your Secret Santa
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full"
            style={{ background: "rgba(220,38,38,.1)", color: "#dc2626" }}>
            {assignments.length} recipient{assignments.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="p-4 text-center text-white">
          <p className="text-[13px] font-bold opacity-90 mb-2">You have assignments!</p>
          <div className="flex justify-center gap-1.5 flex-wrap">
            {assignments.map((a, i) => (
              <span key={i} className="text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,.2)" }}>
                🎁 {a.receiver_nickname}
              </span>
            ))}
          </div>
          <p className="text-[11px] opacity-60 font-bold mt-3">Tap to view ▼</p>
        </div>
      </div>
    );
  }

  // ═══ EXPANDED — Full view ═══
  return (
    <div className="col-span-full rounded-[20px] overflow-hidden"
      style={{ background: "linear-gradient(135deg,#7f1d1d,#991b1b)", boxShadow: "0 8px 36px rgba(127,29,29,.25)", animation: "expandIn .3s ease" }}>

      <style>{`@keyframes expandIn{0%{opacity:0;transform:scale(.97);}100%{opacity:1;transform:scale(1);}}`}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ background: "rgba(255,255,255,.93)" }}>
        <div className="flex items-center gap-2" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: "18px", fontWeight: 700, color: "#7f1d1d" }}>
          🎅 Your Secret Santa
          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full" style={{ background: "rgba(127,29,29,.08)", color: "#991b1b" }}>
            {assignments.length} recipient{assignments.length > 1 ? "s" : ""}
          </span>
        </div>
        <button onClick={() => setExpanded(false)}
          className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition"
          style={{ background: "rgba(127,29,29,.06)", color: "#991b1b" }}>
          ✕ Close
        </button>
      </div>

      {/* Recipient cards */}
      <div className="p-4 flex flex-col gap-3">
        {assignments.map((a, i) => (
          <div key={i} className="rounded-[14px] overflow-hidden transition"
            style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>

            {/* Recipient header */}
            <div className="flex items-center justify-between p-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[16px]"
                  style={{ background: `rgba(${i % 3 === 0 ? '37,99,235' : i % 3 === 1 ? '34,197,94' : '251,191,36'},.15)` }}>
                  {i % 3 === 0 ? "🏢" : i % 3 === 1 ? "👨‍👩‍👧‍👦" : "🍻"}
                </div>
                <div>
                  <div className="text-[13px] font-extrabold text-white">{a.group_name}</div>
                  <div className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,.4)" }}>📅 {a.group_event_date}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 px-3.5 py-1.5 rounded-[10px] text-[12px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)", boxShadow: "0 2px 8px rgba(251,191,36,.25)" }}>
                🎁→ {a.receiver_nickname}
              </div>
            </div>

            {/* Recipient wishlist */}
            <div className="p-3.5">
              <p className="text-[10px] font-bold mb-1.5" style={{ color: "rgba(255,255,255,.4)" }}>
                🎅 {a.receiver_nickname}&apos;s wishlist:
              </p>
              {a.receiver_wishlist.length === 0 ? (
                <div className="text-center py-2.5 text-[10px] font-semibold rounded-lg"
                  style={{ color: "rgba(255,255,255,.25)", border: "1px dashed rgba(255,255,255,.08)" }}>
                  No wishlist items yet 😢
                </div>
              ) : (
                a.receiver_wishlist.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg mb-1"
                    style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.05)" }}>
                    <span className="text-[11px]">{item.priority > 0 ? "⭐" : "🎁"}</span>
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,.85)" }}>{item.item_name}</div>
                      {item.item_note && <div className="text-[10px]" style={{ color: "rgba(255,255,255,.4)" }}>{item.item_note}</div>}
                      {item.item_link && <a href={item.item_link} target="_blank" rel="noopener noreferrer" className="text-[9px] font-semibold" style={{ color: "#fbbf24" }}>🔗 {item.item_link.slice(0, 30)}...</a>}
                    </div>
                  </div>
                ))
              )}
              <button onClick={() => router.push(`/group/${a.group_id}`)}
                className="w-full text-center py-1.5 mt-1.5 rounded-md text-[10px] font-bold transition"
                style={{ color: "#fbbf24", background: "rgba(251,191,36,.06)" }}>
                View group →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ MY WISHLIST STRIP ═══ */}
      <div onClick={() => setWishlistOpen(!wishlistOpen)}
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer"
        style={{ background: "rgba(0,0,0,.12)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-[32px] h-[32px] rounded-lg flex items-center justify-center text-[14px]"
            style={{ background: "rgba(220,38,38,.15)" }}>📝</div>
          <div>
            <div className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,.8)" }}>My Wishlist</div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,.4)" }}>Your Secret Santa sees this</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-extrabold px-3 py-1 rounded-lg" style={{ color: "rgba(255,255,255,.5)", background: "rgba(255,255,255,.08)" }}>
            {myWishlistItems.length} item{myWishlistItems.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,.5)" }}>
            {wishlistOpen ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* ═══ MY WISHLIST PANEL ═══ */}
      {wishlistOpen && (
        <div className="px-5 py-4" style={{ background: "rgba(0,0,0,.08)" }}>

          {/* Header + Add button */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-extrabold" style={{ color: "rgba(255,255,255,.85)" }}>📝 My Wishlist Items</p>
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 2px 8px rgba(220,38,38,.2)" }}>
              + Add Item
            </button>
          </div>

          {/* Group selector for add */}
          {showAddForm && myGroupIds.length > 1 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold mb-1" style={{ color: "rgba(255,255,255,.4)" }}>Add to which group?</p>
              <div className="flex gap-1.5 flex-wrap">
                {assignments.map((a) => (
                  <button key={a.group_id}
                    onClick={() => setAddGroupId(a.group_id)}
                    className="text-[10px] font-bold px-3 py-1 rounded-md transition"
                    style={{
                      background: addGroupId === a.group_id ? "rgba(220,38,38,.3)" : "rgba(255,255,255,.06)",
                      color: addGroupId === a.group_id ? "#fff" : "rgba(255,255,255,.5)",
                      border: `1px solid ${addGroupId === a.group_id ? "rgba(220,38,38,.4)" : "rgba(255,255,255,.08)"}`,
                    }}>
                    {a.group_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add form */}
          {showAddForm && (
            <div className="rounded-lg p-3 mb-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Item name (e.g. Nintendo Switch)..."
                className="w-full mb-1.5 px-2.5 py-2 rounded-md text-[12px] outline-none"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontFamily: "inherit" }} />
              <div className="flex gap-1.5 mb-1.5">
                <input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="Link (optional)..."
                  className="flex-1 px-2.5 py-2 rounded-md text-[12px] outline-none"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontFamily: "inherit" }} />
                <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Note (optional)..."
                  className="flex-1 px-2.5 py-2 rounded-md text-[12px] outline-none"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontFamily: "inherit" }} />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[10px] font-bold" style={{ color: "rgba(255,255,255,.4)" }}>
                  <input type="checkbox" checked={newPriority > 0} onChange={(e) => setNewPriority(e.target.checked ? 1 : 0)} />
                  ⭐ Mark as top priority
                </label>
                <div className="flex gap-1.5">
                  <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 rounded-md text-[10px] font-bold"
                    style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", border: "none", fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
                  <button onClick={handleAdd} disabled={addLoading}
                    className="px-3.5 py-1.5 rounded-md text-[10px] font-bold text-white"
                    style={{ background: "#22c55e", border: "none", fontFamily: "inherit", cursor: "pointer" }}>
                    {addLoading ? "Saving..." : "✅ Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <p className={`text-[11px] font-bold mb-2 ${message.includes("!") && !message.includes("required") ? "text-green-400" : "text-red-400"}`}>
              {message}
            </p>
          )}

          {/* Existing items */}
          {myWishlistItems.length === 0 ? (
            <div className="text-center py-4 text-[11px] font-semibold rounded-lg"
              style={{ color: "rgba(255,255,255,.25)", border: "1px dashed rgba(255,255,255,.08)" }}>
              No items yet — add your first gift idea!
            </div>
          ) : (
            myWishlistItems.map((item) => (
              <div key={item.id}>
                {editingId === item.id ? (
                  /* Edit form */
                  <div className="rounded-lg p-3 mb-1.5" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(59,130,246,.2)" }}>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="w-full mb-1.5 px-2.5 py-2 rounded-md text-[12px] outline-none"
                      style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontFamily: "inherit" }} />
                    <div className="flex gap-1.5 mb-1.5">
                      <input value={editLink} onChange={(e) => setEditLink(e.target.value)} placeholder="Link..."
                        className="flex-1 px-2.5 py-2 rounded-md text-[12px] outline-none"
                        style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontFamily: "inherit" }} />
                      <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Note..."
                        className="flex-1 px-2.5 py-2 rounded-md text-[12px] outline-none"
                        style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontFamily: "inherit" }} />
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-md text-[10px] font-bold"
                        style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", border: "none", fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
                      <button onClick={() => handleEdit(item.id)} className="px-3.5 py-1.5 rounded-md text-[10px] font-bold text-white"
                        style={{ background: "#22c55e", border: "none", fontFamily: "inherit", cursor: "pointer" }}>✅ Save</button>
                    </div>
                  </div>
                ) : (
                  /* Display item */
                  <div className="flex items-center justify-between p-2.5 rounded-lg mb-1.5"
                    style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div className="flex-1">
                      <div className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,.85)" }}>
                        {item.priority > 0 ? "⭐ " : ""}{item.item_name}
                      </div>
                      {item.item_note && <div className="text-[10px]" style={{ color: "rgba(255,255,255,.4)" }}>{item.item_note}</div>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(item)} className="px-2 py-1 rounded text-[10px] font-bold"
                        style={{ background: "rgba(59,130,246,.15)", color: "#93c5fd", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✏️</button>
                      <button onClick={() => handleDelete(item.id)} className="px-2 py-1 rounded text-[10px] font-bold"
                        style={{ background: "rgba(220,38,38,.15)", color: "#fca5a5", border: "none", cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}