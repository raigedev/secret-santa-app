"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  addWishlistItem,
  editWishlistItem,
  deleteWishlistItem,
} from "@/app/dashboard/wishlist-actions";
import { confirmGiftReceived } from "./actions";
import { SecretSantaSkeleton } from "@/app/components/PageSkeleton";

type WishlistItem = {
  id: string;
  group_id: string;
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
  gift_received: boolean;
  gift_received_at: string | null;
};

export default function SecretSantaPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [assignments, setAssignments] = useState<RecipientData[]>([]);
  const [myItems, setMyItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addGroupId, setAddGroupId] = useState("");
  const [addName, setAddName] = useState("");
  const [addLink, setAddLink] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addPriority, setAddPriority] = useState(0);
  const [addLoading, setAddLoading] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPriority, setEditPriority] = useState(0);

  const [message, setMessage] = useState("");
  const [confirmingGroup, setConfirmingGroup] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const user = session.user;

      const { data: memberRows } = await supabase
        .from("group_members")
        .select("group_id, status")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      const groupIds = [...new Set((memberRows || []).map((r) => r.group_id))];

      if (groupIds.length === 0) {
        setAssignments([]);
        setMyItems([]);
        setLoading(false);
        return;
      }

      const [{ data: groupsData }, { data: myAssignments }, { data: receivedAssignments }] =
        await Promise.all([
          supabase.from("groups").select("id, name, event_date").in("id", groupIds),
          supabase
            .from("assignments")
            .select("group_id, receiver_id")
            .eq("giver_id", user.id)
            .in("group_id", groupIds),
          supabase
            .from("assignments")
            .select("group_id, gift_received, gift_received_at")
            .eq("receiver_id", user.id)
            .in("group_id", groupIds),
        ]);

      if (myAssignments && myAssignments.length > 0) {
        const receiverIds = myAssignments.map((a) => a.receiver_id);

        const [{ data: receiverMembers }, { data: receiverWishlists }] = await Promise.all([
          supabase
            .from("group_members")
            .select("group_id, user_id, nickname")
            .in("user_id", receiverIds)
            .in("group_id", groupIds)
            .eq("status", "accepted"),
          supabase
            .from("wishlists")
            .select("id, group_id, user_id, item_name, item_link, item_note, priority")
            .in("user_id", receiverIds)
            .in("group_id", groupIds),
        ]);

        const recipientData: RecipientData[] = myAssignments.map((a) => {
          const group = (groupsData || []).find((g) => g.id === a.group_id);
          const receiver = (receiverMembers || []).find(
            (m) => m.user_id === a.receiver_id && m.group_id === a.group_id
          );
          const wishlist = (receiverWishlists || [])
            .filter((w) => w.user_id === a.receiver_id && w.group_id === a.group_id)
            .map((w) => ({
              id: w.id,
              group_id: w.group_id,
              item_name: w.item_name,
              item_link: w.item_link || "",
              item_note: w.item_note || "",
              priority: w.priority || 0,
            }));

          // Check if I (as receiver in this group) got my gift
          const myReceived = (receivedAssignments || []).find((r) => r.group_id === a.group_id);

          return {
            group_id: a.group_id,
            group_name: group?.name || "Unknown Group",
            group_event_date: group?.event_date || "",
            receiver_nickname: receiver?.nickname || "Secret Participant",
            receiver_wishlist: wishlist,
            gift_received: myReceived?.gift_received || false,
            gift_received_at: myReceived?.gift_received_at || null,
          };
        });

        setAssignments(recipientData);
        if (!addGroupId && recipientData.length > 0) {
          setAddGroupId(recipientData[0].group_id);
        }
      } else {
        setAssignments([]);
      }

      const { data: myWishlistData } = await supabase
        .from("wishlists")
        .select("id, group_id, item_name, item_link, item_note, priority")
        .eq("user_id", user.id)
        .in("group_id", groupIds);

      setMyItems(
        (myWishlistData || []).map((w) => ({
          id: w.id,
          group_id: w.group_id,
          item_name: w.item_name,
          item_link: w.item_link || "",
          item_note: w.item_note || "",
          priority: w.priority || 0,
        }))
      );

      setLoading(false);
    };

    loadData();

    const channel = supabase
      .channel("santa-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlists" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router, addGroupId]);

  const handleAdd = async () => {
    if (!addName.trim()) {
      setMessage("Item name is required.");
      return;
    }
    if (!addGroupId) {
      setMessage("Select a group first.");
      return;
    }

    setAddLoading(true);
    setMessage("");

    const result = await addWishlistItem(
      addGroupId,
      addName,
      addLink,
      addNote,
      addPriority
    );

    setMessage(result.message);
    setAddLoading(false);

    if (result.success) {
      setAddName("");
      setAddLink("");
      setAddNote("");
      setAddPriority(0);
      setShowAdd(false);
    }
  };

  const handleEdit = async (itemId: string) => {
    if (!editName.trim()) {
      setMessage("Item name is required.");
      return;
    }

    setMessage("");
    const result = await editWishlistItem(
      itemId,
      editName,
      editLink,
      editNote,
      editPriority
    );
    setMessage(result.message);

    if (result.success) {
      setEditingId(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Delete this wishlist item?")) return;
    setMessage("");
    const result = await deleteWishlistItem(itemId);
    setMessage(result.message);
  };

  const handleConfirmGift = async (groupId: string) => {
    if (!confirm("Confirm that you received your gift? This can't be undone.")) return;
    setConfirmingGroup(groupId);
    const result = await confirmGiftReceived(groupId);
    if (!result.success) setMessage(result.message);
    setConfirmingGroup(null);
  };

  const startEdit = (item: WishlistItem) => {
    setEditingId(item.id);
    setEditName(item.item_name);
    setEditLink(item.item_link);
    setEditNote(item.item_note);
    setEditPriority(item.priority);
  };

  const getGroupName = (groupId: string) => {
    const a = assignments.find((x) => x.group_id === groupId);
    return a?.group_name || "Unknown";
  };

  if (loading) return <SecretSantaSkeleton />;

  const iconColors = [
    "rgba(37,99,235,.15)",
    "rgba(34,197,94,.15)",
    "rgba(251,191,36,.15)",
    "rgba(168,85,247,.15)",
  ];
  const iconEmojis = ["🏢", "👨‍👩‍👧‍👦", "🍻", "🎄"];

  return (
    <main
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background:
          "linear-gradient(180deg,#1a0a0a 0%,#2d1010 20%,#3d1515 50%,#2d1010 80%,#1a0a0a 100%)",
        fontFamily: "'Nunito', sans-serif",
        color: "#fff",
      }}
    >
      <div
        id="snowWrap"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      />
      <style>{`
        .snowflake{position:absolute;background:#fff;border-radius:50%;animation:fall linear infinite;}
        @keyframes fall{0%{transform:translateY(-10px) translateX(0);opacity:.6;}50%{transform:translateY(50vh) translateX(12px);}100%{transform:translateY(105vh) translateX(-6px);opacity:.1;}}
      `}</style>

      <div className="relative z-10 max-w-[720px] mx-auto px-4 py-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-5 px-4 py-2 rounded-lg transition"
          style={{
            color: "rgba(255,255,255,.6)",
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.1)",
            fontFamily: "inherit",
          }}
        >
          ← Back to Dashboard
        </button>

        <div className="text-center mb-7">
          <h1
            className="text-[32px] font-bold mb-1"
            style={{
              fontFamily: "'Fredoka', sans-serif",
              textShadow: "0 2px 8px rgba(0,0,0,.3)",
            }}
          >
            🎅 Your Secret Santa
          </h1>
          <p
            className="text-[14px] font-semibold"
            style={{ color: "rgba(255,255,255,.5)" }}
          >
            Your mystery recipients from all events
          </p>
          {assignments.length > 0 && (
            <div
              className="inline-flex items-center gap-1.5 text-[12px] font-extrabold mt-2.5 px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(220,38,38,.2)",
                color: "#fca5a5",
                border: "1px solid rgba(220,38,38,.15)",
              }}
            >
              🎁 {assignments.length} Recipient{assignments.length > 1 ? "s" : ""} across{" "}
              {assignments.length} group{assignments.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {assignments.length === 0 ? (
          <div
            className="text-center py-12 mb-7 rounded-[18px]"
            style={{
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div className="text-[48px] mb-3">🎲</div>
            <div
              className="text-[18px] font-bold"
              style={{
                fontFamily: "'Fredoka', sans-serif",
                color: "rgba(255,255,255,.7)",
              }}
            >
              No assignments yet
            </div>
            <p
              className="text-[13px] mt-1"
              style={{ color: "rgba(255,255,255,.35)" }}
            >
              Once a group owner draws names, your recipients will appear here!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mb-7">
            {assignments.map((a, i) => (
              <div
                key={i}
                className="rounded-[18px] overflow-hidden transition"
                style={{
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.08)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  className="flex items-center justify-between p-4"
                  style={{
                    background: "rgba(255,255,255,.03)",
                    borderBottom: "1px solid rgba(255,255,255,.06)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-[44px] h-[44px] rounded-xl flex items-center justify-center text-[22px]"
                      style={{ background: iconColors[i % iconColors.length] }}
                    >
                      {iconEmojis[i % iconEmojis.length]}
                    </div>
                    <div>
                      <div className="text-[16px] font-extrabold">{a.group_name}</div>
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: "rgba(255,255,255,.4)" }}
                      >
                        📅 {a.group_event_date}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[14px] font-extrabold text-white"
                    style={{
                      background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                      boxShadow: "0 4px 16px rgba(251,191,36,.3)",
                    }}
                  >
                    🎁→ {a.receiver_nickname}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p
                      className="text-[14px] font-extrabold"
                      style={{ color: "rgba(255,255,255,.7)" }}
                    >
                      🎅 {a.receiver_nickname}&apos;s wishlist
                    </p>
                    <span
                      className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,.08)",
                        color: "rgba(255,255,255,.4)",
                      }}
                    >
                      {a.receiver_wishlist.length} item
                      {a.receiver_wishlist.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {a.receiver_wishlist.length === 0 ? (
                    <div
                      className="text-center py-5 rounded-xl"
                      style={{
                        color: "rgba(255,255,255,.2)",
                        border: "1px dashed rgba(255,255,255,.08)",
                      }}
                    >
                      No wishlist items yet 😢
                      <br />
                      <span className="text-[11px]" style={{ opacity: 0.6 }}>
                        {a.receiver_nickname} hasn&apos;t added any gift ideas
                      </span>
                    </div>
                  ) : (
                    a.receiver_wishlist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-xl mb-2 transition"
                        style={{
                          background: "rgba(255,255,255,.04)",
                          border: "1px solid rgba(255,255,255,.06)",
                        }}
                      >
                        <span className="text-[16px]">
                          {item.priority > 0 ? "⭐" : "🎁"}
                        </span>
                        <div className="flex-1">
                          <div
                            className="text-[14px] font-bold"
                            style={{ color: "rgba(255,255,255,.9)" }}
                          >
                            {item.item_name}
                          </div>
                          {item.item_note && (
                            <div
                              className="text-[12px] mt-0.5"
                              style={{ color: "rgba(255,255,255,.45)" }}
                            >
                              {item.item_note}
                            </div>
                          )}
                          {item.item_link && (
                            <a
                              href={item.item_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold mt-0.5 inline-block"
                              style={{ color: "#fbbf24" }}
                            >
                              🔗{" "}
                              {item.item_link.length > 35
                                ? item.item_link.slice(0, 35) + "..."
                                : item.item_link}
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  <div
                    className="rounded-xl p-3.5 mt-3 flex items-center justify-between"
                    style={{
                      background: a.gift_received
                        ? "rgba(34,197,94,.06)"
                        : "rgba(251,191,36,.06)",
                      border: `1px solid ${
                        a.gift_received
                          ? "rgba(34,197,94,.12)"
                          : "rgba(251,191,36,.12)"
                      }`,
                    }}
                  >
                    <div>
                      <div
                        className="text-[13px] font-extrabold"
                        style={{ color: a.gift_received ? "#22c55e" : "#fbbf24" }}
                      >
                        {a.gift_received
                          ? "✅ Gift Received!"
                          : "🎁 Did you receive your gift?"}
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ color: "rgba(255,255,255,.35)" }}
                      >
                        {a.gift_received
                          ? `Confirmed on ${new Date(
                              a.gift_received_at || ""
                            ).toLocaleDateString()}`
                          : "Your Secret Santa bought you something! Confirm when you get it."}
                      </div>
                    </div>
                    {a.gift_received ? (
                      <div
                        className="px-4 py-2 rounded-xl text-[12px] font-bold"
                        style={{
                          background: "rgba(34,197,94,.1)",
                          color: "#22c55e",
                        }}
                      >
                        ✅ Confirmed
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirmGift(a.group_id)}
                        disabled={confirmingGroup === a.group_id}
                        className="px-4 py-2 rounded-xl text-[12px] font-extrabold text-white transition"
                        style={{
                          background: "linear-gradient(135deg,#22c55e,#16a34a)",
                          boxShadow: "0 3px 12px rgba(34,197,94,.3)",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {confirmingGroup === a.group_id
                          ? "Confirming..."
                          : "✅ I got my gift!"}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => router.push(`/group/${a.group_id}`)}
                    className="w-full text-center py-2.5 mt-3 rounded-lg text-[12px] font-bold transition"
                    style={{
                      color: "#fbbf24",
                      background: "rgba(251,191,36,.06)",
                      border: "1px solid rgba(251,191,36,.1)",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    View group →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className="rounded-[18px] overflow-hidden"
          style={{
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.08)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="flex items-center justify-between p-4"
            style={{
              background: "rgba(255,255,255,.03)",
              borderBottom: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-[38px] h-[38px] rounded-lg flex items-center justify-center text-[18px]"
                style={{ background: "rgba(220,38,38,.15)" }}
              >
                📝
              </div>
              <div>
                <div
                  className="text-[16px] font-extrabold"
                  style={{ color: "rgba(255,255,255,.85)" }}
                >
                  My Wishlist
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,.4)" }}
                >
                  Your Secret Santa sees these items
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="px-4 py-2 rounded-lg text-[12px] font-bold text-white transition"
              style={{
                background: "linear-gradient(135deg,#dc2626,#ef4444)",
                boxShadow: "0 2px 12px rgba(220,38,38,.25)",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + Add Item
            </button>
          </div>

          <div className="p-4">
            {message && (
              <p
                className={`text-[11px] font-bold mb-3 ${
                  message.includes("!") && !message.includes("required")
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {message}
              </p>
            )}

            {showAdd && (
              <div
                className="rounded-xl p-4 mb-4"
                style={{
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                }}
              >
                {assignments.length > 1 && (
                  <div className="mb-3">
                    <p
                      className="text-[10px] font-bold mb-1.5"
                      style={{ color: "rgba(255,255,255,.35)" }}
                    >
                      Add to which group?
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {assignments.map((a) => (
                        <button
                          key={a.group_id}
                          onClick={() => setAddGroupId(a.group_id)}
                          className="text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition"
                          style={{
                            background:
                              addGroupId === a.group_id
                                ? "rgba(220,38,38,.2)"
                                : "rgba(255,255,255,.04)",
                            color:
                              addGroupId === a.group_id
                                ? "#fca5a5"
                                : "rgba(255,255,255,.5)",
                            border: `1px solid ${
                              addGroupId === a.group_id
                                ? "rgba(220,38,38,.3)"
                                : "rgba(255,255,255,.08)"
                            }`,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {a.group_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Item name (e.g. Nintendo Switch)..."
                  className="w-full mb-2 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.1)",
                    color: "#fff",
                    fontFamily: "inherit",
                  }}
                />

                <div className="flex gap-2 mb-2">
                  <input
                    value={addLink}
                    onChange={(e) => setAddLink(e.target.value)}
                    placeholder="Link (optional)..."
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: "rgba(255,255,255,.05)",
                      border: "1px solid rgba(255,255,255,.1)",
                      color: "#fff",
                      fontFamily: "inherit",
                    }}
                  />
                  <input
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    placeholder="Note (optional)..."
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: "rgba(255,255,255,.05)",
                      border: "1px solid rgba(255,255,255,.1)",
                      color: "#fff",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label
                    className="flex items-center gap-2 text-[11px] font-bold"
                    style={{ color: "rgba(255,255,255,.4)" }}
                  >
                    <input
                      type="checkbox"
                      checked={addPriority > 0}
                      onChange={(e) => setAddPriority(e.target.checked ? 1 : 0)}
                      style={{ accentColor: "#fbbf24" }}
                    />
                    ⭐ Top priority
                  </label>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAdd(false)}
                      className="px-4 py-2 rounded-lg text-[11px] font-bold"
                      style={{
                        background: "rgba(255,255,255,.08)",
                        color: "rgba(255,255,255,.5)",
                        border: "none",
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={addLoading}
                      className="px-4 py-2 rounded-lg text-[11px] font-bold text-white"
                      style={{
                        background: "#22c55e",
                        border: "none",
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {addLoading ? "Saving..." : "✅ Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {myItems.length === 0 ? (
              <div
                className="text-center py-6 rounded-xl"
                style={{
                  color: "rgba(255,255,255,.2)",
                  border: "1px dashed rgba(255,255,255,.08)",
                }}
              >
                No items yet — add your first gift idea!
              </div>
            ) : (
              myItems.map((item) => (
                <div key={item.id}>
                  {editingId === item.id ? (
                    <div
                      className="rounded-xl p-3.5 mb-2"
                      style={{
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(59,130,246,.2)",
                      }}
                    >
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full mb-2 px-3 py-2 rounded-lg text-[13px] outline-none"
                        style={{
                          background: "rgba(255,255,255,.05)",
                          border: "1px solid rgba(255,255,255,.1)",
                          color: "#fff",
                          fontFamily: "inherit",
                        }}
                      />
                      <div className="flex gap-2 mb-2">
                        <input
                          value={editLink}
                          onChange={(e) => setEditLink(e.target.value)}
                          placeholder="Link..."
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: "rgba(255,255,255,.05)",
                            border: "1px solid rgba(255,255,255,.1)",
                            color: "#fff",
                            fontFamily: "inherit",
                          }}
                        />
                        <input
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Note..."
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: "rgba(255,255,255,.05)",
                            border: "1px solid rgba(255,255,255,.1)",
                            color: "#fff",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                          style={{
                            background: "rgba(255,255,255,.08)",
                            color: "rgba(255,255,255,.5)",
                            border: "none",
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEdit(item.id)}
                          className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white"
                          style={{
                            background: "#22c55e",
                            border: "none",
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          ✅ Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-3 rounded-xl mb-2 transition"
                      style={{
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <div className="flex-1">
                        <div
                          className="text-[13px] font-bold"
                          style={{ color: "rgba(255,255,255,.85)" }}
                        >
                          {item.priority > 0 ? "⭐ " : ""}
                          {item.item_name}
                        </div>
                        {item.item_note && (
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: "rgba(255,255,255,.4)" }}
                          >
                            {item.item_note}
                          </div>
                        )}
                        <div
                          className="text-[9px] font-bold mt-1 inline-block px-2 py-0.5 rounded"
                          style={{
                            color: "rgba(255,255,255,.25)",
                            background: "rgba(255,255,255,.04)",
                          }}
                        >
                          {getGroupName(item.group_id)}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => startEdit(item)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                          style={{
                            background: "rgba(59,130,246,.12)",
                            color: "#93c5fd",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                          style={{
                            background: "rgba(220,38,38,.12)",
                            color: "#fca5a5",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
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
        s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;animation-duration:${5 + Math.random() * 10}s;animation-delay:${Math.random() * 6}s;opacity:${0.2 + Math.random() * 0.3};`;
        sw.appendChild(s);
      }
    }

    return () => {
      const sw = document.getElementById("snowWrap");
      if (sw) sw.innerHTML = "";
    };
  }, []);

  return null;
}
