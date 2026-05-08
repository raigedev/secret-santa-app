"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProfileSkeleton } from "@/app/components/PageSkeleton";
import {
  clearClientSnapshots,
  hasFreshClientSnapshotMetadata,
  readClientSnapshot,
  writeClientSnapshot,
  type ClientSnapshotMetadata,
} from "@/lib/client-snapshot";
import { isNullableNumber, isNullableString, isRecord } from "@/lib/validation/common";
import {
  addWishlistItem,
  deleteWishlistItem,
  editWishlistItem,
} from "@/app/dashboard/wishlist-actions";
import {
  WISHLIST_CATEGORIES,
  WISHLIST_ITEMS_PER_GROUP_LIMIT,
} from "@/lib/wishlist/options";
import {
  realtimePayloadMatchesAnyValue,
  useSupabaseRealtimeRefresh,
  type RealtimeRefreshRule,
} from "@/lib/supabase/realtime-refresh";
import { isGroupWishlistActive } from "@/lib/groups/history";

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
type WishlistPageSnapshot = ClientSnapshotMetadata & {
  addGroupId: string;
  groups: GroupOption[];
  items: WishlistItem[];
};

const ITEM_NAME_MAX = 100;
const ITEM_NOTE_MAX = 200;
const ITEM_URL_MAX = 500;
const WISHLIST_PAGE_SNAPSHOT_STORAGE_PREFIX = "ss_wishlist_page_snapshot_v1:";
const WISHLIST_PAGE_FALLBACK_POLL_MS = 5 * 60 * 1000;
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

function getWishlistPageSnapshotStorageKey(userId: string): string {
  return `${WISHLIST_PAGE_SNAPSHOT_STORAGE_PREFIX}${userId}`;
}

function isWishlistPriority(value: unknown): value is WishlistPriority {
  return value === 0 || value === 1 || value === 2;
}

function isWishlistSnapshotGroup(value: unknown): value is GroupOption {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.eventDate === "string" &&
    isNullableNumber(value.budget) &&
    isNullableString(value.currency)
  );
}

function isWishlistSnapshotItem(value: unknown): value is WishlistItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.group_id === "string" &&
    typeof value.item_name === "string" &&
    typeof value.item_category === "string" &&
    typeof value.item_image_url === "string" &&
    typeof value.item_link === "string" &&
    typeof value.item_note === "string" &&
    isWishlistPriority(value.priority)
  );
}

function isWishlistPageSnapshot(
  value: unknown,
  userId: string
): value is WishlistPageSnapshot {
  return (
    hasFreshClientSnapshotMetadata(value, userId) &&
    typeof value.addGroupId === "string" &&
    Array.isArray(value.groups) &&
    value.groups.every(isWishlistSnapshotGroup) &&
    Array.isArray(value.items) &&
    value.items.every(isWishlistSnapshotItem)
  );
}

function resolveAddGroupId(
  currentGroupId: string,
  nextGroups: GroupOption[],
  nextItems: WishlistItem[]
): string {
  if (currentGroupId && nextGroups.some((group) => group.id === currentGroupId)) {
    return currentGroupId;
  }

  const itemCountByGroup = new Map<string, number>();
  for (const item of nextItems) {
    itemCountByGroup.set(
      item.group_id,
      (itemCountByGroup.get(item.group_id) || 0) + 1
    );
  }

  const firstGroupWithRoom =
    nextGroups.find(
      (group) =>
        (itemCountByGroup.get(group.id) || 0) <
        WISHLIST_ITEMS_PER_GROUP_LIMIT
    ) || null;

  return firstGroupWithRoom?.id || nextGroups[0]?.id || "";
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
  if (priority === 2) return "Top priority";
  if (priority === 1) return "Nice to have";
  return "Gift idea";
}

function priorityTone(priority: WishlistPriority) {
  if (priority === 2) {
    return {
      badge: "bg-[#a43c3f]/10 text-[#a43c3f]",
      accent: "#a43c3f",
      ribbon: "from-[#a43c3f] to-[#943034]",
    };
  }

  if (priority === 1) {
    return {
      badge: "bg-[#d9ae56]/20 text-[#7b5902]",
      accent: "#7b5902",
      ribbon: "from-[#d9ae56] to-[#7b5902]",
    };
  }

  return {
    badge: "bg-[#48664e]/10 text-[#48664e]",
    accent: "#48664e",
    ribbon: "from-[#48664e] to-[#3c5a43]",
  };
}

function GiftIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4.75 10.25h14.5v8.25a1.75 1.75 0 0 1-1.75 1.75h-11a1.75 1.75 0 0 1-1.75-1.75v-8.25Z" fill="#a43c3f" />
      <path d="M3.75 7.5c0-.97.78-1.75 1.75-1.75h13c.97 0 1.75.78 1.75 1.75v2.75H3.75V7.5Z" fill="#ffaba9" />
      <path d="M12 5.75v14.5M4.25 10.25h15.5" stroke="#fff7f6" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11.8 5.7C9.6 5.55 7.9 4.45 7.9 3.35c0-.78.58-1.35 1.38-1.35 1.32 0 2.25 1.55 2.52 3.7ZM12.2 5.7c2.2-.15 3.9-1.25 3.9-2.35 0-.78-.58-1.35-1.38-1.35-1.32 0-2.25 1.55-2.52 3.7Z" stroke="#a43c3f" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13l-5.6-2 5.6-2L12 3.5Z" fill="currentColor" />
    </svg>
  );
}

function SnowflakeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 3v18M5.6 6.2l12.8 11.6M18.4 6.2 5.6 17.8M8 4.8 12 8l4-3.2M8 19.2l4-3.2 4 3.2M4.8 8l3.2 4-3.2 4M19.2 8 16 12l3.2 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 10h11M11 5.5 15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function WishlistPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const prefetched = useRef<Set<string>>(new Set());
  const hasLoadedOnceRef = useRef(false);
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
  const [userId, setUserId] = useState<string | null>(null);
  const groupIdsRef = useRef<Set<string>>(new Set());

  const realtimeRules = useMemo<readonly RealtimeRefreshRule[]>(() => {
    if (!userId) {
      return [];
    }

    return [
      {
        table: "wishlists",
        filter: `user_id=eq.${userId}`,
      },
      {
        table: "group_members",
        filter: `user_id=eq.${userId}`,
      },
      {
        table: "groups",
        shouldRefresh: (payload) =>
          realtimePayloadMatchesAnyValue(payload, "id", groupIdsRef.current, {
            refreshWhenUnknown: true,
          }),
      },
    ];
  }, [userId]);

  useEffect(() => {
    for (const route of ["/dashboard", "/secret-santa", "/secret-santa-chat"]) {
      if (!prefetched.current.has(route)) {
        prefetched.current.add(route);
        router.prefetch(route);
      }
    }
  }, [router]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      }

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const user = session?.user || null;
        if (!user) {
          setUserId(null);
          groupIdsRef.current = new Set();
          clearClientSnapshots(WISHLIST_PAGE_SNAPSHOT_STORAGE_PREFIX);
          router.push("/login");
          return;
        }

        setUserId(user.id);

        if (!hasLoadedOnceRef.current) {
          const cachedWishlist = readClientSnapshot(
            getWishlistPageSnapshotStorageKey(user.id),
            user.id,
            isWishlistPageSnapshot
          );

          if (cachedWishlist) {
            const activeCachedGroups = cachedWishlist.groups.filter((group) =>
              isGroupWishlistActive(group.eventDate)
            );
            const activeCachedGroupIds = new Set(activeCachedGroups.map((group) => group.id));
            const activeCachedItems = cachedWishlist.items.filter((item) =>
              activeCachedGroupIds.has(item.group_id)
            );
            setGroups(activeCachedGroups);
            setItems(activeCachedItems);
            setAddGroupId(resolveAddGroupId(cachedWishlist.addGroupId, activeCachedGroups, activeCachedItems));
            hasLoadedOnceRef.current = true;
            setLoading(false);
          }
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
          groupIdsRef.current = new Set();
          setGroups([]);
          setItems([]);
          setAddGroupId("");
          writeClientSnapshot(getWishlistPageSnapshotStorageKey(user.id), {
            addGroupId: "",
            createdAt: Date.now(),
            groups: [],
            items: [],
            userId: user.id,
          });
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

        const activeGroupRows = ((groupRows || []) as GroupRow[]).filter((group) =>
          isGroupWishlistActive(group.event_date)
        );
        const nextGroups = activeGroupRows.map(toGroupOption).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        groupIdsRef.current = new Set(nextGroups.map((group) => group.id));
        const activeGroupIds = groupIdsRef.current;
        const groupNames = new Map(nextGroups.map((group) => [group.id, group.name]));
        const nextItems = ((wishlistRows || []) as WishlistRow[])
          .filter((row) => activeGroupIds.has(row.group_id))
          .map(toWishlistItem)
          .sort((a, b) => {
            const groupCompare = (groupNames.get(a.group_id) || "").localeCompare(groupNames.get(b.group_id) || "");
            if (groupCompare !== 0) return groupCompare;
            if (b.priority !== a.priority) return b.priority - a.priority;
            return a.item_name.localeCompare(b.item_name);
          });

        setGroups(nextGroups);
        setItems(nextItems);
        setAddGroupId((current) => {
          const nextAddGroupId = resolveAddGroupId(current, nextGroups, nextItems);
          writeClientSnapshot(getWishlistPageSnapshotStorageKey(user.id), {
            addGroupId: nextAddGroupId,
            createdAt: Date.now(),
            groups: nextGroups,
            items: nextItems,
            userId: user.id,
          });
          return nextAddGroupId;
        });
      } catch {
        if (!active) return;
        setMessage({ type: "error", text: "We could not load your wishlist. Refresh the page and try again." });
      } finally {
        if (active) {
          hasLoadedOnceRef.current = true;
          setLoading(false);
        }
      }
    };

    loadDataRef.current = loadData;
    void loadData();
    return () => {
      active = false;
      loadDataRef.current = null;
    };
  }, [router, supabase]);

  useSupabaseRealtimeRefresh({
    channelName: userId ? `wishlist-page-${userId}` : "wishlist-page-disabled",
    enabled: Boolean(userId),
    onRefresh: () => loadDataRef.current?.(),
    pollMs: WISHLIST_PAGE_FALLBACK_POLL_MS,
    rules: realtimeRules,
    supabase,
  });

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

    if (selectedGroupAtLimit) {
      setMessage({
        type: "error",
        text: `You can add up to ${WISHLIST_ITEMS_PER_GROUP_LIMIT} wishlist items per group.`,
      });
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
      setMessage({ type: "error", text: "We could not save this wishlist item. Please try again." });
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
      setMessage({ type: "error", text: "We could not update this wishlist item. Please try again." });
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
      setMessage({ type: "error", text: "We could not delete this wishlist item. Please try again." });
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
  const selectedGroup = groups.find((group) => group.id === addGroupId) || null;
  const selectedGroupItemCount = useMemo(
    () => items.filter((item) => item.group_id === addGroupId).length,
    [addGroupId, items]
  );
  const selectedGroupAtLimit =
    selectedGroupItemCount >= WISHLIST_ITEMS_PER_GROUP_LIMIT;
  const selectedGroupProgress = Math.min(
    100,
    Math.round((selectedGroupItemCount / WISHLIST_ITEMS_PER_GROUP_LIMIT) * 100)
  );

  if (loading) return <ProfileSkeleton />;

  return (
    <main
      className="relative min-h-screen overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8"
      style={{
        background:
          "radial-gradient(circle at 12% 12%,rgba(255,171,169,.55),transparent 24%),radial-gradient(circle at 86% 10%,rgba(215,250,219,.72),transparent 28%),linear-gradient(180deg,#f9faf8 0%,#eef3ef 44%,#dfe7e4 100%)",
        color: "#2e3432",
        fontFamily: "'Be Vietnam Pro','Nunito',sans-serif",
      }}
    >
      <div className="pointer-events-none fixed inset-0 opacity-55">
        <div className="absolute left-[7%] top-[14%] h-2 w-2 rounded-full bg-white" />
        <div className="absolute left-[24%] top-[5%] h-1.5 w-1.5 rounded-full bg-white" />
        <div className="absolute right-[16%] top-[18%] h-2.5 w-2.5 rounded-full bg-white" />
        <div className="absolute bottom-[16%] left-[12%] h-2 w-2 rounded-full bg-white" />
        <div className="absolute bottom-[25%] right-[9%] h-1.5 w-1.5 rounded-full bg-white" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="holiday-panel-strong relative overflow-hidden rounded-[36px] p-6 sm:p-8 lg:p-10">
            <div className="absolute right-[-46px] top-[-42px] h-40 w-40 rounded-full bg-[#ffaba9]/35" />
            <div className="absolute bottom-[-80px] right-[12%] h-48 w-48 rounded-full bg-[#d7fadb]/70" />
            <div className="relative">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-[#fff7f6] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#a43c3f]">
                <GiftIcon className="h-5 w-5" />
                My Wishlist
              </div>
              <h1 className="max-w-3xl font-[Plus_Jakarta_Sans] text-4xl font-black tracking-[-0.06em] text-[#2e3432] sm:text-6xl">
                My Wishlist
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#5b605e] sm:text-lg">
                Add gift ideas to help your Santa choose something you will love.
              </p>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[42px] bg-[linear-gradient(145deg,#a43c3f,#812227)] p-6 text-white shadow-[0_28px_80px_rgba(164,60,63,0.22)] sm:p-8">
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/12" />
            <div className="absolute bottom-6 right-8 text-white/25">
              <SnowflakeIcon className="h-24 w-24" />
            </div>
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/70">Gift clues ready</p>
              <h2 className="mt-4 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-tighter">
                Your Santa shops from the details you add.
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/78">
                Add sizes, colors, photos, links, and notes. Clear clues lower the chance of wrong guesses.
              </p>
              <div className="mt-7 rounded-[28px] bg-white/12 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3 text-sm font-black">
                  <span>{selectedGroup?.name || "Selected group"}</span>
                  <span>{selectedGroupItemCount}/{WISHLIST_ITEMS_PER_GROUP_LIMIT}</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/16">
                  <div
                    className="h-full rounded-full bg-[#fcce72] transition-all"
                    style={{ width: `${selectedGroupProgress}%` }}
                  />
                </div>
                <p className="mt-3 text-xs font-semibold text-white/70">
                  {selectedGroupAtLimit ? "This group wishlist is full." : "There is still room for more clues."}
                </p>
              </div>
            </div>
          </aside>
        </section>

        {message && (
          <div
            className={`rounded-3xl px-5 py-4 text-sm font-bold shadow-[0_16px_38px_rgba(46,52,50,0.06)] ${
              message.type === "success"
                ? "bg-[#d7fadb] text-[#314e38]"
                : "bg-[#fff7f6] text-[#aa371c]"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <div className="holiday-panel-strong overflow-hidden rounded-[38px] p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7b5902]">Gift workshop</p>
                  <h2 className="mt-2 font-[Plus_Jakarta_Sans] text-2xl font-black tracking-[-0.04em] text-[#2e3432]">
                    Add an idea
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#5b605e]">
                    Save up to {WISHLIST_ITEMS_PER_GROUP_LIMIT} wishlist items per group.
                  </p>
                </div>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[22px] bg-[#fff7f6] text-[#a43c3f]">
                  <GiftIcon className="h-8 w-8" />
                </div>
              </div>

              {groups.length === 0 ? (
                <div className="rounded-[28px] bg-[#fcce72]/25 px-5 py-6 text-sm leading-6 text-[#5f4500]">
                  Join a group before adding wishlist items.
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#777c7a]">Group</span>
                    <select
                      value={addGroupId}
                      onChange={(event) => setAddGroupId(event.target.value)}
                      className="w-full rounded-[20px] bg-[#e5e9e6] px-4 py-3 text-sm font-bold text-[#2e3432] outline-none transition focus:bg-white focus:ring-2 focus:ring-[#a43c3f]/20"
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="holiday-panel-soft rounded-3xl p-4">
                    <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.16em] text-[#5b605e]">
                      <span>Wishlist spots</span>
                      <span>{selectedGroupItemCount}/{WISHLIST_ITEMS_PER_GROUP_LIMIT}</span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full rounded-full ${selectedGroupAtLimit ? "bg-[#a43c3f]" : "bg-[#48664e]"}`}
                        style={{ width: `${selectedGroupProgress}%` }}
                      />
                    </div>
                  </div>

                  <input
                    value={addName}
                    onChange={(event) => setAddName(event.target.value)}
                    maxLength={ITEM_NAME_MAX}
                    placeholder="Item name, brand, or model"
                    className="w-full rounded-[20px] bg-[#e5e9e6] px-4 py-3 text-sm font-bold text-[#2e3432] outline-none placeholder:text-[#777c7a] focus:bg-white focus:ring-2 focus:ring-[#a43c3f]/20"
                  />

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <select
                      value={addCategory}
                      onChange={(event) => setAddCategory(event.target.value)}
                      className="w-full rounded-[20px] bg-[#e5e9e6] px-4 py-3 text-sm font-bold text-[#2e3432] outline-none focus:bg-white focus:ring-2 focus:ring-[#a43c3f]/20"
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
                      className="w-full rounded-[20px] bg-[#e5e9e6] px-4 py-3 text-sm font-bold text-[#2e3432] outline-none focus:bg-white focus:ring-2 focus:ring-[#a43c3f]/20"
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="url"
                    inputMode="url"
                    value={addLink}
                    onChange={(event) => setAddLink(event.target.value)}
                    maxLength={ITEM_URL_MAX}
                    placeholder="Product or inspiration link (optional)"
                    className="w-full rounded-[20px] bg-[#e5e9e6] px-4 py-3 text-sm font-bold text-[#2e3432] outline-none placeholder:text-[#777c7a] focus:bg-white focus:ring-2 focus:ring-[#a43c3f]/20"
                  />
                  <input
                    type="url"
                    inputMode="url"
                    value={addImageUrl}
                    onChange={(event) => setAddImageUrl(event.target.value)}
                    maxLength={ITEM_URL_MAX}
                    placeholder="Image link (optional)"
                    className="w-full rounded-[20px] bg-[#e5e9e6] px-4 py-3 text-sm font-bold text-[#2e3432] outline-none placeholder:text-[#777c7a] focus:bg-white focus:ring-2 focus:ring-[#a43c3f]/20"
                  />
                  <input
                    value={addNote}
                    onChange={(event) => setAddNote(event.target.value)}
                    maxLength={ITEM_NOTE_MAX}
                    placeholder="Size, color, or note (optional)"
                    className="w-full rounded-[20px] bg-[#e5e9e6] px-4 py-3 text-sm font-bold text-[#2e3432] outline-none placeholder:text-[#777c7a] focus:bg-white focus:ring-2 focus:ring-[#a43c3f]/20"
                  />

                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={adding || selectedGroupAtLimit}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#a43c3f,#943034)] px-5 py-3.5 text-sm font-black text-white shadow-[0_18px_42px_rgba(164,60,63,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adding
                      ? "Saving..."
                      : selectedGroupAtLimit
                        ? "Group full"
                        : "Add to Wishlist"}
                    <ArrowRightIcon />
                  </button>
                </div>
              )}
            </div>
          </aside>

          <div className="space-y-5">
            {groupedItems.map((group) => {
              const budget = formatBudget(group.budget, group.currency);
              const progress = Math.min(
                100,
                Math.round((group.items.length / WISHLIST_ITEMS_PER_GROUP_LIMIT) * 100)
              );

              return (
                <section
                  key={group.id}
                  className="holiday-panel-strong overflow-hidden rounded-[38px]"
                >
                  <div className="relative overflow-hidden bg-[#f2f4f2]/62 p-5 sm:p-6">
                    <div className="absolute right-6 top-5 text-[#a43c3f]/12">
                      <SnowflakeIcon className="h-20 w-20" />
                    </div>
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#48664e]">Exchange shelf</p>
                        <h2 className="mt-2 font-[Plus_Jakarta_Sans] text-3xl font-black tracking-tighter text-[#2e3432]">
                          {group.name}
                        </h2>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#5b605e]">
                          <span className="rounded-full bg-white px-3 py-1.5">
                            Gift date: {formatDate(group.eventDate)}
                          </span>
                          {budget && (
                            <span className="rounded-full bg-white px-3 py-1.5">
                              Budget: {budget}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="holiday-panel-row min-w-40 rounded-3xl p-4">
                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-[#777c7a]">
                          <span>Filled</span>
                          <span>{group.items.length}/{WISHLIST_ITEMS_PER_GROUP_LIMIT}</span>
                        </div>
                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e5e9e6]">
                          <div className="h-full rounded-full bg-[#a43c3f]" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    {group.items.length === 0 ? (
                      <div className="rounded-[30px] bg-[#fcce72]/22 px-5 py-8 text-center text-sm leading-6 text-[#5f4500]">
                        <SparkleIcon className="mx-auto mb-3 h-7 w-7" />
                        No wishlist items in this group yet. Add a few clear ideas so your Santa has a place to start.
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {group.items.map((item) => {
                          const tone = priorityTone(item.priority);

                          return editingId === item.id ? (
                            <div key={item.id} className="holiday-panel-soft rounded-[30px] p-4 sm:p-5">
                              <div className="mb-4 flex items-center gap-3">
                                <div className="grid h-11 w-11 place-items-center rounded-[18px] bg-white text-[#a43c3f]">
                                  <GiftIcon className="h-6 w-6" />
                                </div>
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#777c7a]">Editing wishlist item</p>
                                  <h3 className="text-lg font-black text-[#2e3432]">Update item</h3>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <input
                                  value={editName}
                                  onChange={(event) => setEditName(event.target.value)}
                                  maxLength={ITEM_NAME_MAX}
                                  className="w-full rounded-[18px] bg-white px-4 py-3 text-sm font-bold text-[#2e3432] outline-none focus:ring-2 focus:ring-[#a43c3f]/20"
                                />
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <select
                                    value={editCategory}
                                    onChange={(event) => setEditCategory(event.target.value)}
                                    className="rounded-[18px] bg-white px-4 py-3 text-sm font-bold text-[#2e3432] outline-none focus:ring-2 focus:ring-[#a43c3f]/20"
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
                                    className="rounded-[18px] bg-white px-4 py-3 text-sm font-bold text-[#2e3432] outline-none focus:ring-2 focus:ring-[#a43c3f]/20"
                                  >
                                    {PRIORITY_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <input
                                  type="url"
                                  inputMode="url"
                                  value={editLink}
                                  onChange={(event) => setEditLink(event.target.value)}
                                  maxLength={ITEM_URL_MAX}
                                  placeholder="Product or inspiration link"
                                  className="w-full rounded-[18px] bg-white px-4 py-3 text-sm font-bold text-[#2e3432] outline-none placeholder:text-[#777c7a] focus:ring-2 focus:ring-[#a43c3f]/20"
                                />
                                <input
                                  type="url"
                                  inputMode="url"
                                  value={editImageUrl}
                                  onChange={(event) => setEditImageUrl(event.target.value)}
                                  maxLength={ITEM_URL_MAX}
                                  placeholder="Image link"
                                  className="w-full rounded-[18px] bg-white px-4 py-3 text-sm font-bold text-[#2e3432] outline-none placeholder:text-[#777c7a] focus:ring-2 focus:ring-[#a43c3f]/20"
                                />
                                <input
                                  value={editNote}
                                  onChange={(event) => setEditNote(event.target.value)}
                                  maxLength={ITEM_NOTE_MAX}
                                  placeholder="Short note"
                                  className="w-full rounded-[18px] bg-white px-4 py-3 text-sm font-bold text-[#2e3432] outline-none placeholder:text-[#777c7a] focus:ring-2 focus:ring-[#a43c3f]/20"
                                />
                                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#5b605e]"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(item.id)}
                                    disabled={savingEditId === item.id}
                                    className="rounded-full bg-[#48664e] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
                                  >
                                    {savingEditId === item.id ? "Saving..." : "Save changes"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <article key={item.id} className="holiday-panel-soft group relative overflow-hidden rounded-[26px] p-5 transition hover:-translate-y-0.5">
                              <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${tone.ribbon}`} />
                              <div className="grid gap-4 md:grid-cols-[112px_minmax(0,1fr)_170px] md:items-center">
                                <div className="grid aspect-square place-items-center overflow-hidden rounded-[22px] bg-white text-[#a43c3f] shadow-[0_14px_34px_rgba(46,52,50,0.06)]">
                                  {item.item_image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.item_image_url}
                                      alt={item.item_name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <GiftIcon className="h-11 w-11" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="break-words font-[Plus_Jakarta_Sans] text-xl font-black tracking-[-0.04em] text-[#2e3432]">
                                    {item.item_name}
                                  </h3>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${tone.badge}`}>
                                      {priorityLabel(item.priority)}
                                    </span>
                                    {item.item_category && (
                                      <span className="rounded-full bg-[#ecefec] px-3 py-1.5 text-xs font-bold text-[#5b605e]">
                                        {item.item_category}
                                      </span>
                                    )}
                                  </div>
                                  {item.item_note && (
                                    <p className="holiday-panel-row mt-4 rounded-[22px] px-4 py-3 text-sm leading-6 text-[#5b605e]">
                                      {item.item_note}
                                    </p>
                                  )}
                                  {item.item_link && (
                                    <a
                                      href={item.item_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="holiday-panel-row mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-[#48664e]"
                                    >
                                      Reference link
                                      <ArrowRightIcon />
                                    </a>
                                  )}
                                </div>
                                <div className="holiday-panel-row rounded-[22px] px-4 py-3">
                                  <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${
                                    item.item_note && (item.item_link || item.item_image_url)
                                      ? "bg-[#d7fadb] text-[#314e38]"
                                      : "bg-[#fff7f6] text-[#a43c3f]"
                                  }`}>
                                    {item.item_note && (item.item_link || item.item_image_url)
                                      ? "Ready for Santa"
                                      : "Needs size or color"}
                                  </span>
                                  <p className="mt-3 text-xs font-bold text-[#64748b]">
                                    {formatBudget(group.budget, group.currency)
                                      ? `Budget fit: ${formatBudget(group.budget, group.currency)}`
                                      : "Budget set by group"}
                                  </p>
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => startEdit(item)}
                                      className="rounded-full bg-[#ecefec] px-4 py-2 text-xs font-black text-[#48664e]"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(item.id)}
                                      disabled={deletingId === item.id}
                                      className="rounded-full bg-[#fff7f6] px-4 py-2 text-xs font-black text-[#a43c3f] disabled:opacity-50"
                                    >
                                      {deletingId === item.id ? "Deleting..." : "Delete"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
