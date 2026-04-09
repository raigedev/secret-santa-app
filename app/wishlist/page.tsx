"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProfileSkeleton } from "@/app/components/PageSkeleton";
import {
  addWishlistItem,
  deleteWishlistItem,
  editWishlistItem,
} from "@/app/dashboard/wishlist-actions";
import { WISHLIST_CATEGORIES } from "@/lib/wishlist/options";

type WishlistPriority = 0 | 1 | 2;

type GroupRow = {
  id: string;
  name: string | null;
  event_date: string | null;
  budget: number | null;
  currency: string | null;
};

type GroupOption = {
  id: string;
  name: string;
  eventDate: string;
  budget: number | null;
  currency: string | null;
};

type WishlistRow = {
  id: string;
  group_id: string;
  item_name: string;
  item_category: string | null;
  item_image_url: string | null;
  item_link: string | null;
  item_note: string | null;
  priority: number | null;
};

type WishlistItem = {
  id: string;
  group_id: string;
  item_name: string;
  item_category: string;
  item_image_url: string;
  item_link: string;
  item_note: string;
  priority: WishlistPriority;
};

type Message = { type: "success" | "error"; text: string } | null;

const ITEM_NAME_MAX = 100;
const ITEM_NOTE_MAX = 200;
const ITEM_URL_MAX = 500;
const PRIORITY_OPTIONS: Array<{ value: WishlistPriority; label: string }> = [
  { value: 2, label: "Want most" },
  { value: 1, label: "Nice to have" },
  { value: 0, label: "Just an idea" },
];

function clampPriority(value: number | null | undefined): WishlistPriority {
  const numeric = Number(value || 0);
  if (numeric >= 2) return 2;
  if (numeric >= 1) return 1;
  return 0;
}

function cleanText(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return trimmed.slice(0, ITEM_URL_MAX);
  } catch {
    return "";
  }
}

function toGroupOption(group: GroupRow): GroupOption {
  return {
    id: group.id,
    name: group.name || "Unknown Group",
    eventDate: group.event_date || "",
    budget: group.budget ?? null,
    currency: group.currency || null,
  };
}

function toWishlistItem(row: WishlistRow): WishlistItem {
  return {
    id: row.id,
    group_id: row.group_id,
    item_name: row.item_name,
    item_category: row.item_category || "",
    item_image_url: row.item_image_url || "",
    item_link: row.item_link || "",
    item_note: row.item_note || "",
    priority: clampPriority(row.priority),
  };
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatBudget(budget: number | null, currency: string | null) {
  if (budget === null) return null;
  const amount = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(budget);
  return (currency || "PHP").toUpperCase() === "PHP" ? `P ${amount}` : `${currency || "PHP"} ${amount}`;
}

function priorityLabel(priority: WishlistPriority) {
  if (priority === 2) return "Want most";
  if (priority === 1) return "Nice to have";
  return "Just an idea";
}

export default function WishlistPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const prefetched = useRef<Set<string>>(new Set());
  const loadDataRef = useRef<(() => Promise<void>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [message, setMessage] = useState<Message>(null);
  const [addGroupId, setAddGroupId] = useState("");
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addImageUrl, setAddImageUrl] = useState("");
  const [addLink, setAddLink] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addPriority, setAddPriority] = useState<WishlistPriority>(0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPriority, setEditPriority] = useState<WishlistPriority>(0);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    for (const route of ["/dashboard", "/secret-santa"]) {
      if (!prefetched.current.has(route)) {
        prefetched.current.add(route);
        router.prefetch(route);
      }
    }
  }, [router]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const { data: memberships, error: membershipError } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)
          .eq("status", "accepted");

        if (membershipError) throw membershipError;

        const groupIds = (memberships || []).map((row) => row.group_id);

        if (groupIds.length === 0) {
          if (!active) return;
          setGroups([]);
          setItems([]);
          setAddGroupId("");
          return;
        }

        const [{ data: groupRows, error: groupError }, { data: wishlistRows, error: wishlistError }] =
          await Promise.all([
            supabase.from("groups").select("id, name, event_date, budget, currency").in("id", groupIds),
            supabase
              .from("wishlists")
              .select("id, group_id, item_name, item_category, item_image_url, item_link, item_note, priority")
              .eq("user_id", user.id)
              .in("group_id", groupIds),
          ]);

        if (groupError || wishlistError) throw groupError || wishlistError;
        if (!active) return;

        const nextGroups = ((groupRows || []) as GroupRow[]).map(toGroupOption).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        const groupNames = new Map(nextGroups.map((group) => [group.id, group.name]));
        const nextItems = ((wishlistRows || []) as WishlistRow[])
          .map(toWishlistItem)
          .sort((a, b) => {
            const groupCompare = (groupNames.get(a.group_id) || "").localeCompare(groupNames.get(b.group_id) || "");
            if (groupCompare !== 0) return groupCompare;
            if (b.priority !== a.priority) return b.priority - a.priority;
            return a.item_name.localeCompare(b.item_name);
          });

        setGroups(nextGroups);
        setItems(nextItems);
        setAddGroupId((current) => (current && nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id || ""));
      } catch {
        if (!active) return;
        setMessage({ type: "error", text: "Failed to load your wishlist. Please refresh and try again." });
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDataRef.current = loadData;
    void loadData();
    return () => {
      active = false;
      loadDataRef.current = null;
    };
  }, [router, supabase]);

  const handleAdd = async () => {
    const cleanName = cleanText(addName, ITEM_NAME_MAX);

    if (!cleanName) {
      setMessage({ type: "error", text: "Item name is required." });
      return;
    }

    if (!addGroupId || !groups.some((group) => group.id === addGroupId)) {
      setMessage({ type: "error", text: "Pick a valid group first." });
      return;
    }

    setAdding(true);
    setMessage(null);

    try {
      const result = await addWishlistItem(
        addGroupId,
        cleanName,
        cleanUrl(addLink),
        cleanText(addNote, ITEM_NOTE_MAX),
        clampPriority(addPriority),
        addCategory,
        cleanUrl(addImageUrl)
      );

      setMessage({ type: result.success ? "success" : "error", text: result.message });

      if (result.success) {
        setAddName("");
        setAddCategory("");
        setAddImageUrl("");
        setAddLink("");
        setAddNote("");
        setAddPriority(0);
        await loadDataRef.current?.();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save the wishlist item. Please try again." });
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (itemId: string) => {
    const cleanName = cleanText(editName, ITEM_NAME_MAX);

    if (!cleanName) {
      setMessage({ type: "error", text: "Item name is required." });
      return;
    }

    setSavingEditId(itemId);
    setMessage(null);

    try {
      const result = await editWishlistItem(
        itemId,
        cleanName,
        cleanUrl(editLink),
        cleanText(editNote, ITEM_NOTE_MAX),
        clampPriority(editPriority),
        editCategory,
        cleanUrl(editImageUrl)
      );

      setMessage({ type: result.success ? "success" : "error", text: result.message });

      if (result.success) {
        setEditingId(null);
        await loadDataRef.current?.();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update the wishlist item. Please try again." });
    } finally {
      setSavingEditId(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Delete this wishlist item?")) {
      return;
    }

    setDeletingId(itemId);
    setMessage(null);

    try {
      const result = await deleteWishlistItem(itemId);
      setMessage({ type: result.success ? "success" : "error", text: result.message });
      if (result.success) {
        await loadDataRef.current?.();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete the wishlist item. Please try again." });
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (item: WishlistItem) => {
    setEditingId(item.id);
    setEditName(item.item_name);
    setEditCategory(item.item_category);
    setEditImageUrl(item.item_image_url);
    setEditLink(item.item_link);
    setEditNote(item.item_note);
    setEditPriority(item.priority);
    setMessage(null);
  };

  const groupedItems = useMemo(
    () => groups.map((group) => ({ ...group, items: items.filter((item) => item.group_id === group.id) })),
    [groups, items]
  );

  if (loading) return <ProfileSkeleton />;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,.28),transparent_32%),linear-gradient(180deg,#dfe7e4_0%,#d2dbd8_42%,#c9d4d4_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-[14px] border border-slate-300/70 bg-white/85 px-5 py-3 text-[13px] font-extrabold text-slate-600 shadow-[0_10px_20px_rgba(34,55,59,0.06)] transition sm:w-auto"
          >
            ← Back to Dashboard
          </button>
          <button
            type="button"
            onClick={() => router.push("/secret-santa")}
            className="w-full rounded-[14px] bg-[linear-gradient(135deg,#5e9479,#2f6b56)] px-5 py-3 text-[13px] font-extrabold text-white shadow-[0_10px_22px_rgba(47,107,86,0.16)] transition sm:w-auto"
          >
            Open Gift Planning
          </button>
        </div>

        <div className="mb-6 text-center">
          <div className="text-[42px]">📝</div>
          <h1 className="text-[34px] font-black tracking-[-0.03em] text-[#9f4e42] sm:text-[42px]">My Wishlist</h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-slate-600 sm:text-[16px]">
            This page is for <strong>your own wishlist</strong>. It helps your Secret Santa know
            what you want, while <strong>/secret-santa</strong> stays focused on shopping for your
            assigned recipient.
          </p>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[20px] border border-slate-300/60 bg-white/80 p-4 shadow-[0_14px_34px_rgba(34,55,59,0.08)]">
            <div className="text-[11px] font-extrabold tracking-[0.24em] text-slate-400">TOTAL ITEMS</div>
            <div className="mt-2 text-[32px] font-black text-slate-800">{items.length}</div>
            <div className="mt-1 text-[12px] text-slate-500">Gift ideas across all your accepted groups.</div>
          </div>
          <div className="rounded-[20px] border border-slate-300/60 bg-white/80 p-4 shadow-[0_14px_34px_rgba(34,55,59,0.08)]">
            <div className="text-[11px] font-extrabold tracking-[0.24em] text-slate-400">ACTIVE GROUPS</div>
            <div className="mt-2 text-[32px] font-black text-slate-800">{groups.length}</div>
            <div className="mt-1 text-[12px] text-slate-500">Groups where your wishlist can be seen.</div>
          </div>
          <div className="rounded-[20px] border border-slate-300/60 bg-white/80 p-4 shadow-[0_14px_34px_rgba(34,55,59,0.08)]">
            <div className="text-[11px] font-extrabold tracking-[0.24em] text-slate-400">TOP PRIORITY</div>
            <div className="mt-2 text-[32px] font-black text-slate-800">
              {items.filter((item) => item.priority === 2).length}
            </div>
            <div className="mt-1 text-[12px] text-slate-500">Items marked as “Want most”.</div>
          </div>
        </div>

        {message && (
          <div
            className={`mb-5 rounded-[18px] px-4 py-3 text-[13px] font-semibold ${
              message.type === "success"
                ? "border border-emerald-700/15 bg-emerald-700/10 text-emerald-800"
                : "border border-rose-700/15 bg-rose-700/10 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-6 overflow-hidden rounded-[22px] border border-slate-300/60 bg-white/80 shadow-[0_14px_34px_rgba(34,55,59,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/50 bg-[linear-gradient(180deg,rgba(245,248,246,.94),rgba(236,242,239,.96))] p-4">
            <div>
              <div className="text-[17px] font-extrabold text-[#2f6b56]">Add a wishlist item</div>
              <div className="mt-1 text-[12px] text-slate-500">
                Keep your own wishlist here so your Secret Santa has clearer guidance.
              </div>
            </div>
          </div>

          <div className="p-4">
            {groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-300/60 bg-amber-50/70 px-4 py-5 text-[13px] text-slate-600">
                Join a group first before adding wishlist items.
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-300/60 bg-slate-50/70 p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Group
                </div>
                <select
                  value={addGroupId}
                  onChange={(event) => setAddGroupId(event.target.value)}
                  className="mb-3 w-full rounded-lg border border-slate-300/70 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none"
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>

                <input
                  value={addName}
                  onChange={(event) => setAddName(event.target.value)}
                  maxLength={ITEM_NAME_MAX}
                  placeholder="Item name (e.g. Nintendo Switch)"
                  className="mb-2 w-full rounded-lg border border-slate-300/70 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none"
                />

                <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={addCategory}
                    onChange={(event) => setAddCategory(event.target.value)}
                    className="flex-1 rounded-lg border border-slate-300/70 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none"
                  >
                    <option value="">Category (optional)</option>
                    {WISHLIST_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <select
                    value={addPriority}
                    onChange={(event) => setAddPriority(Number(event.target.value) as WishlistPriority)}
                    className="flex-1 rounded-lg border border-slate-300/70 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    inputMode="url"
                    value={addLink}
                    onChange={(event) => setAddLink(event.target.value)}
                    maxLength={ITEM_URL_MAX}
                    placeholder="Reference link (optional)"
                    className="flex-1 rounded-lg border border-slate-300/70 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none"
                  />
                  <input
                    type="url"
                    inputMode="url"
                    value={addImageUrl}
                    onChange={(event) => setAddImageUrl(event.target.value)}
                    maxLength={ITEM_URL_MAX}
                    placeholder="Image URL (optional)"
                    className="flex-1 rounded-lg border border-slate-300/70 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none"
                  />
                </div>

                <input
                  value={addNote}
                  onChange={(event) => setAddNote(event.target.value)}
                  maxLength={ITEM_NOTE_MAX}
                  placeholder="Short note (optional)"
                  className="mb-3 w-full rounded-lg border border-slate-300/70 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={adding}
                    className="rounded-lg bg-[#2f6b56] px-4 py-2 text-[12px] font-extrabold text-white transition"
                  >
                    {adding ? "Saving..." : "Save item"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {groupedItems.map((group) => (
            <div
              key={group.id}
              className="overflow-hidden rounded-[22px] border border-slate-300/60 bg-white/80 shadow-[0_14px_34px_rgba(34,55,59,0.08)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/50 bg-[linear-gradient(180deg,rgba(245,248,246,.94),rgba(236,242,239,.96))] p-4">
                <div>
                  <div className="text-[18px] font-extrabold text-slate-800">{group.name}</div>
                  <div className="mt-1 text-[12px] text-slate-500">
                    Event date: {formatDate(group.eventDate)}
                    {formatBudget(group.budget, group.currency)
                      ? ` · Budget: ${formatBudget(group.budget, group.currency)}`
                      : ""}
                  </div>
                </div>
                <div className="rounded-full bg-emerald-700/10 px-3 py-1 text-[11px] font-extrabold text-emerald-800">
                  {group.items.length} item{group.items.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="p-4">
                {group.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-amber-300/60 bg-amber-50/70 px-4 py-5 text-[13px] text-slate-600">
                    No wishlist items in this group yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {group.items.map((item) =>
                      editingId === item.id ? (
                        <div key={item.id} className="rounded-2xl border border-blue-300/40 bg-slate-50/80 p-4">
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            maxLength={ITEM_NAME_MAX}
                            className="mb-2 w-full rounded-lg border border-slate-300/70 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none"
                          />
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                            <select
                              value={editCategory}
                              onChange={(event) => setEditCategory(event.target.value)}
                              className="flex-1 rounded-lg border border-slate-300/70 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none"
                            >
                              <option value="">Category (optional)</option>
                              {WISHLIST_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                            <select
                              value={editPriority}
                              onChange={(event) =>
                                setEditPriority(Number(event.target.value) as WishlistPriority)
                              }
                              className="flex-1 rounded-lg border border-slate-300/70 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none"
                            >
                              {PRIORITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                            <input
                              type="url"
                              inputMode="url"
                              value={editLink}
                              onChange={(event) => setEditLink(event.target.value)}
                              maxLength={ITEM_URL_MAX}
                              placeholder="Reference link"
                              className="flex-1 rounded-lg border border-slate-300/70 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none"
                            />
                            <input
                              type="url"
                              inputMode="url"
                              value={editImageUrl}
                              onChange={(event) => setEditImageUrl(event.target.value)}
                              maxLength={ITEM_URL_MAX}
                              placeholder="Image URL"
                              className="flex-1 rounded-lg border border-slate-300/70 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none"
                            />
                          </div>
                          <input
                            value={editNote}
                            onChange={(event) => setEditNote(event.target.value)}
                            maxLength={ITEM_NOTE_MAX}
                            placeholder="Short note"
                            className="mb-3 w-full rounded-lg border border-slate-300/70 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-slate-300/70 bg-white px-4 py-2 text-[11px] font-bold text-slate-500"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(item.id)}
                              disabled={savingEditId === item.id}
                              className="rounded-lg bg-slate-600 px-4 py-2 text-[11px] font-extrabold text-white"
                            >
                              {savingEditId === item.id ? "Saving..." : "Save changes"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-300/50 bg-white/85 p-4 shadow-[0_8px_18px_rgba(34,55,59,0.05)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-[16px] font-extrabold text-slate-800">
                                  {item.item_name}
                                </div>
                                <span className="rounded-full bg-rose-700/10 px-2.5 py-1 text-[10px] font-extrabold text-rose-700">
                                  {priorityLabel(item.priority)}
                                </span>
                                {item.item_category && (
                                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                                    {item.item_category}
                                  </span>
                                )}
                              </div>
                              {item.item_note && (
                                <div className="mt-2 text-[13px] text-slate-600">{item.item_note}</div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.item_link && (
                                  <a
                                    href={item.item_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600"
                                  >
                                    Reference link →
                                  </a>
                                )}
                                {item.item_image_url && (
                                  <a
                                    href={item.item_image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg bg-emerald-700/10 px-3 py-1.5 text-[11px] font-bold text-emerald-700"
                                  >
                                    Open image →
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="rounded-lg bg-blue-500/10 px-3 py-1.5 text-[11px] font-bold text-blue-700"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                disabled={deletingId === item.id}
                                className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-700"
                              >
                                {deletingId === item.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
