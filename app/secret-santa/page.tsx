"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  addWishlistItem,
  deleteWishlistItem,
  editWishlistItem,
} from "@/app/dashboard/wishlist-actions";
import { confirmGiftReceived, updateGiftPrepStatus } from "./actions";
import { SecretSantaSkeleton } from "@/app/components/PageSkeleton";
import { WISHLIST_CATEGORIES } from "@/lib/wishlist/options";
import { formatPriceRange, normalizeOptionalPriceValue } from "@/lib/wishlist/pricing";
import { buildWishlistSuggestions } from "@/lib/wishlist/suggestions";

type WishlistItem = {
  id: string;
  group_id: string;
  item_name: string;
  item_category: string;
  item_image_url: string;
  item_link: string;
  item_note: string;
  preferred_price_min: number | null;
  preferred_price_max: number | null;
  priority: number;
};

type RecipientData = {
  group_id: string;
  group_name: string;
  group_event_date: string;
  group_budget: number | null;
  group_currency: string | null;
  receiver_nickname: string;
  receiver_wishlist: WishlistItem[];
  gift_prep_status: GiftPrepStatus | null;
  gift_prep_updated_at: string | null;
  gift_received: boolean;
  gift_received_at: string | null;
};

type ReceivedGiftData = {
  group_id: string;
  group_name: string;
  group_event_date: string;
  gift_received: boolean;
  gift_received_at: string | null;
};

type GroupOption = {
  id: string;
  name: string;
  eventDate: string;
  budget: number | null;
  currency: string | null;
};

type ActionMessage = {
  type: "success" | "error";
  text: string;
} | null;

type GroupRow = {
  id: string;
  name: string | null;
  event_date: string | null;
  budget: number | null;
  currency: string | null;
};

type AssignmentRow = {
  group_id: string;
  receiver_id: string;
  gift_prep_status: GiftPrepStatus | null;
  gift_prep_updated_at: string | null;
  gift_received: boolean | null;
  gift_received_at: string | null;
};

type ReceivedAssignmentRow = {
  group_id: string;
  gift_received: boolean | null;
  gift_received_at: string | null;
};

type MemberRow = {
  group_id: string;
  user_id: string;
  nickname: string | null;
};

type WishlistRow = {
  id: string;
  group_id: string;
  user_id: string;
  item_name: string;
  item_category: string | null;
  item_image_url: string | null;
  item_link: string | null;
  item_note: string | null;
  preferred_price_min: number | null;
  preferred_price_max: number | null;
  priority: number | null;
};

type GiftPrepStatus =
  | "planning"
  | "purchased"
  | "wrapped"
  | "ready_to_give";

const ITEM_NAME_MAX_LENGTH = 100;
const ITEM_NOTE_MAX_LENGTH = 200;
const ITEM_LINK_MAX_LENGTH = 500;
const ITEM_IMAGE_URL_MAX_LENGTH = 500;
const PAGE_BACKGROUND =
  "radial-gradient(circle at top, rgba(255,255,255,.28), transparent 32%), linear-gradient(180deg,#dfe7e4 0%,#d2dbd8 42%,#c9d4d4 100%)";
const PAGE_TEXT_COLOR = "#25363a";
const TEXT_MUTED = "#60757a";
const TEXT_SOFT = "#819397";
const SURFACE_BACKGROUND = "rgba(248,250,248,.82)";
const SURFACE_BORDER = "1px solid rgba(96,117,122,.16)";
const SURFACE_HEADER_BACKGROUND =
  "linear-gradient(180deg,rgba(245,248,246,.94),rgba(236,242,239,.96))";
const SURFACE_HEADER_BORDER = "1px solid rgba(96,117,122,.12)";
const SURFACE_SHADOW = "0 14px 34px rgba(34,55,59,.08)";
const INSET_BACKGROUND = "rgba(239,244,241,.86)";
const INSET_BORDER = "1px solid rgba(96,117,122,.12)";
const INPUT_BACKGROUND = "rgba(250,251,249,.9)";
const INPUT_BORDER = "1px solid rgba(96,117,122,.18)";
const INPUT_TEXT = "#314447";
const HOLIDAY_RED = "#9f4e42";
const HOLIDAY_GREEN = "#2f6b56";
const HOLIDAY_GOLD = "#a9873d";
const HOLIDAY_BLUE = "#58748e";

const GIFT_PREP_OPTIONS: Array<{
  value: GiftPrepStatus;
  label: string;
  helper: string;
}> = [
  {
    value: "planning",
    label: "Planning",
    helper: "You have started thinking through the gift.",
  },
  {
    value: "purchased",
    label: "Purchased",
    helper: "You already have the gift.",
  },
  {
    value: "wrapped",
    label: "Wrapped",
    helper: "The gift is packed and almost ready.",
  },
  {
    value: "ready_to_give",
    label: "Ready to Give",
    helper: "You are fully ready, no matter how you hand it off.",
  },
];

const GIFT_PREP_LABELS: Record<GiftPrepStatus, string> = {
  planning: "Planning",
  purchased: "Purchased",
  wrapped: "Wrapped",
  ready_to_give: "Ready to Give",
};

const ICON_COLORS = [
  "rgba(169,135,61,.16)",
  "rgba(47,107,86,.14)",
  "rgba(159,78,66,.14)",
  "rgba(88,116,142,.14)",
];

const ICON_EMOJIS = ["🏢", "👨‍👩‍👧‍👦", "🍻", "🎄"];

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// A composite lookup key keeps group-specific user data fast to resolve.
// This avoids repeatedly scanning arrays when building recipient cards.
function createGroupUserKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
}

// Normalize text before it is submitted so the UI and server action receive cleaner input.
// The server action is still the real security boundary.
function normalizeTextInput(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// Only allow standard web links to be submitted or rendered from this page.
// That gives the UI one more guardrail against unsupported protocols.
function normalizeOptionalUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return trimmed.slice(0, ITEM_LINK_MAX_LENGTH);
  } catch {
    return "";
  }
}

// Convert raw database rows into the smaller UI model used by the page.
function toWishlistItem(row: WishlistRow): WishlistItem {
  return {
    id: row.id,
    group_id: row.group_id,
    item_name: row.item_name,
    item_category: row.item_category || "",
    item_image_url: row.item_image_url || "",
    item_link: row.item_link || "",
    item_note: row.item_note || "",
    preferred_price_min: row.preferred_price_min ?? null,
    preferred_price_max: row.preferred_price_max ?? null,
    priority: row.priority || 0,
  };
}

function getWishlistCategoryStyle(category: string) {
  switch (category) {
    case "Tech":
      return { background: "rgba(59,130,246,.12)", color: "#1d4ed8" };
    case "Fashion":
      return { background: "rgba(236,72,153,.12)", color: "#be185d" };
    case "Beauty":
      return { background: "rgba(244,114,182,.12)", color: "#be185d" };
    case "Food":
      return { background: "rgba(249,115,22,.12)", color: "#c2410c" };
    case "Books":
      return { background: "rgba(168,85,247,.12)", color: "#7e22ce" };
    case "Games":
      return { background: "rgba(34,197,94,.12)", color: "#15803d" };
    case "Home":
      return { background: "rgba(14,165,233,.12)", color: "#0369a1" };
    case "Collectibles":
      return { background: "rgba(245,158,11,.12)", color: "#b45309" };
    case "Experience":
      return { background: "rgba(20,184,166,.12)", color: "#0f766e" };
    default:
      return { background: "rgba(148,163,184,.14)", color: "#475569" };
  }
}

// Keep important wishlist items visible first and make the order predictable.
function sortWishlistItems(items: WishlistItem[]): WishlistItem[] {
  return [...items].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.item_name.localeCompare(right.item_name);
  });
}

// Sort groups by event date and then by name so the UI stays stable and readable.
function buildAvailableGroups(groups: GroupRow[]): GroupOption[] {
  return groups
    .map((group) => ({
      id: group.id,
      name: group.name || "Unknown Group",
      eventDate: group.event_date || "",
      budget: group.budget ?? null,
      currency: group.currency || null,
    }))
    .sort((left, right) => {
      const leftTime = new Date(left.eventDate).getTime();
      const rightTime = new Date(right.eventDate).getTime();

      if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.name.localeCompare(right.name);
    });
}

// Build recipient cards from raw rows using maps instead of repeated find/filter calls.
function buildRecipientData(
  assignments: AssignmentRow[],
  groups: GroupOption[],
  receiverMembers: MemberRow[],
  receiverWishlists: WishlistRow[]
): RecipientData[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const membersByKey = new Map(
    receiverMembers.map((member) => [
      createGroupUserKey(member.group_id, member.user_id),
      member,
    ])
  );
  const wishlistsByKey = new Map<string, WishlistItem[]>();
  const groupOrder = new Map(groups.map((group, index) => [group.id, index]));

  for (const wishlist of receiverWishlists) {
    const key = createGroupUserKey(wishlist.group_id, wishlist.user_id);
    const currentItems = wishlistsByKey.get(key) || [];
    currentItems.push(toWishlistItem(wishlist));
    wishlistsByKey.set(key, currentItems);
  }

  return assignments
    .map((assignment) => {
      const group = groupsById.get(assignment.group_id);
      const receiver = membersByKey.get(
        createGroupUserKey(assignment.group_id, assignment.receiver_id)
      );

      return {
        group_id: assignment.group_id,
        group_name: group?.name || "Unknown Group",
        group_event_date: group?.eventDate || "",
        group_budget: group?.budget ?? null,
        group_currency: group?.currency ?? null,
        receiver_nickname: receiver?.nickname || "Secret Participant",
        receiver_wishlist: sortWishlistItems(
          wishlistsByKey.get(
            createGroupUserKey(assignment.group_id, assignment.receiver_id)
          ) || []
        ),
        gift_prep_status: assignment.gift_prep_status || null,
        gift_prep_updated_at: assignment.gift_prep_updated_at || null,
        gift_received: Boolean(assignment.gift_received),
        gift_received_at: assignment.gift_received_at || null,
      };
    })
    .sort((left, right) => {
      return (
        (groupOrder.get(left.group_id) ?? Number.MAX_SAFE_INTEGER) -
        (groupOrder.get(right.group_id) ?? Number.MAX_SAFE_INTEGER)
      );
    });
}

function buildReceivedGiftData(
  assignments: ReceivedAssignmentRow[],
  groups: GroupOption[]
): ReceivedGiftData[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const groupOrder = new Map(groups.map((group, index) => [group.id, index]));

  return assignments
    .map((assignment) => {
      const group = groupsById.get(assignment.group_id);

      return {
        group_id: assignment.group_id,
        group_name: group?.name || "Unknown Group",
        group_event_date: group?.eventDate || "",
        gift_received: Boolean(assignment.gift_received),
        gift_received_at: assignment.gift_received_at || null,
      };
    })
    .sort((left, right) => {
      return (
        (groupOrder.get(left.group_id) ?? Number.MAX_SAFE_INTEGER) -
        (groupOrder.get(right.group_id) ?? Number.MAX_SAFE_INTEGER)
      );
    });
}

// Group the user's own wishlist items cleanly so related entries stay together.
function buildMyWishlistItems(rows: WishlistRow[], groups: GroupOption[]): WishlistItem[] {
  const groupNamesById = new Map(groups.map((group) => [group.id, group.name]));

  return rows.map(toWishlistItem).sort((left, right) => {
    const groupCompare = (groupNamesById.get(left.group_id) || "Unknown Group").localeCompare(
      groupNamesById.get(right.group_id) || "Unknown Group"
    );

    if (groupCompare !== 0) {
      return groupCompare;
    }

    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.item_name.localeCompare(right.item_name);
  });
}

// Format all dates defensively so empty or invalid values never surface as "Invalid Date".
function formatDisplayDate(value: string | null): string {
  if (!value) {
    return "Date unavailable";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return DATE_FORMATTER.format(parsedDate);
}

function getGiftPrepLabel(status: GiftPrepStatus | null): string {
  if (!status) {
    return "No update yet";
  }

  return GIFT_PREP_LABELS[status];
}

function formatWishlistBudget(
  item: Pick<WishlistItem, "preferred_price_min" | "preferred_price_max">,
  currency: string | null
): string | null {
  return formatPriceRange(item.preferred_price_min, item.preferred_price_max, currency);
}

// Make success and error messages explicit instead of inferring them from punctuation.
function createActionMessage(result: {
  success: boolean;
  message: string;
}): ActionMessage {
  return {
    type: result.success ? "success" : "error",
    text: result.message,
  };
}

export default function SecretSantaPage() {
  const router = useRouter();

  // The Supabase client is created once for the lifetime of this page.
  // That keeps auth calls and realtime subscriptions stable across rerenders.
  const [supabase] = useState(() => createClient());

  // Remote data displayed throughout the page.
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>([]);
  const [assignments, setAssignments] = useState<RecipientData[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<ReceivedGiftData[]>([]);
  const [myItems, setMyItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state.
  const [showAdd, setShowAdd] = useState(false);
  const [addGroupId, setAddGroupId] = useState("");
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addImageUrl, setAddImageUrl] = useState("");
  const [addLink, setAddLink] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addPriceMin, setAddPriceMin] = useState("");
  const [addPriceMax, setAddPriceMax] = useState("");
  const [addPriority, setAddPriority] = useState(0);
  const [addLoading, setAddLoading] = useState(false);

  // Edit form state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPriceMin, setEditPriceMin] = useState("");
  const [editPriceMax, setEditPriceMax] = useState("");
  const [editPriority, setEditPriority] = useState(0);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // Page-level feedback and action state.
  const [message, setMessage] = useState<ActionMessage>(null);
  const [updatingPrepGroup, setUpdatingPrepGroup] = useState<string | null>(null);
  const [confirmingGroup, setConfirmingGroup] = useState<string | null>(null);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    // Load every dataset needed by the page in one place.
    // This centralizes error handling and prevents duplicated state sync logic.
    const loadData = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          router.replace("/login");
          return;
        }

        const user = session.user;

        const { data: memberRows, error: memberRowsError } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id)
          .eq("status", "accepted");

        if (memberRowsError) {
          throw memberRowsError;
        }

        const groupIds = [...new Set((memberRows || []).map((row) => row.group_id))];

        if (!isMounted) {
          return;
        }

        if (groupIds.length === 0) {
          setAvailableGroups([]);
          setAssignments([]);
          setReceivedGifts([]);
          setMyItems([]);
          setAddGroupId("");
          setLoading(false);
          return;
        }

        const [
          { data: groupsData, error: groupsError },
          { data: myAssignments, error: myAssignmentsError },
          { data: receivedAssignments, error: receivedAssignmentsError },
          { data: myWishlistData, error: myWishlistError },
        ] = await Promise.all([
          supabase
            .from("groups")
            .select("id, name, event_date, budget, currency")
            .in("id", groupIds),
          supabase
            .from("assignments")
            .select(
              "group_id, receiver_id, gift_prep_status, gift_prep_updated_at, gift_received, gift_received_at"
            )
            .eq("giver_id", user.id)
            .in("group_id", groupIds),
          supabase
            .from("assignments")
            .select("group_id, gift_received, gift_received_at")
            .eq("receiver_id", user.id)
            .in("group_id", groupIds),
          supabase
            .from("wishlists")
            .select(
              "id, group_id, user_id, item_name, item_category, item_image_url, item_link, item_note, preferred_price_min, preferred_price_max, priority"
            )
            .eq("user_id", user.id)
            .in("group_id", groupIds),
        ]);

        const primaryError =
          groupsError || myAssignmentsError || receivedAssignmentsError || myWishlistError;
        if (primaryError) {
          throw primaryError;
        }

        const groupOptions = buildAvailableGroups((groupsData || []) as GroupRow[]);
        let recipientData: RecipientData[] = [];
        const receivedGiftData = buildReceivedGiftData(
          (receivedAssignments || []) as ReceivedAssignmentRow[],
          groupOptions
        );

        if ((myAssignments || []).length > 0) {
          const receiverIds = [
            ...new Set((myAssignments || []).map((assignment) => assignment.receiver_id)),
          ];

          const [
            { data: receiverMembers, error: receiverMembersError },
            { data: receiverWishlists, error: receiverWishlistsError },
          ] = await Promise.all([
            supabase
              .from("group_members")
              .select("group_id, user_id, nickname")
              .in("user_id", receiverIds)
              .in("group_id", groupIds)
              .eq("status", "accepted"),
            supabase
              .from("wishlists")
              .select(
                "id, group_id, user_id, item_name, item_category, item_image_url, item_link, item_note, preferred_price_min, preferred_price_max, priority"
              )
              .in("user_id", receiverIds)
              .in("group_id", groupIds),
          ]);

          if (receiverMembersError || receiverWishlistsError) {
            throw receiverMembersError || receiverWishlistsError;
          }

          recipientData = buildRecipientData(
            (myAssignments || []) as AssignmentRow[],
            groupOptions,
            (receiverMembers || []) as MemberRow[],
            (receiverWishlists || []) as WishlistRow[]
          );
        }

        if (!isMounted) {
          return;
        }

        setAvailableGroups(groupOptions);
        setAssignments(recipientData);
        setReceivedGifts(receivedGiftData);
        setMyItems(buildMyWishlistItems((myWishlistData || []) as WishlistRow[], groupOptions));
        setAddGroupId((currentGroupId) => {
          const validGroupIds = new Set(groupOptions.map((group) => group.id));

          if (currentGroupId && validGroupIds.has(currentGroupId)) {
            return currentGroupId;
          }

          return groupOptions[0]?.id || "";
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setAvailableGroups([]);
        setAssignments([]);
        setReceivedGifts([]);
        setMyItems([]);
        setAddGroupId("");
        setMessage({
          type: "error",
          text: "Failed to load your Secret Santa data. Please refresh and try again.",
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const scheduleReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }

      // Several related rows can change for one group action, so batch the
      // follow-up reload into a single refresh of the page state.
      reloadTimer = setTimeout(() => {
        void loadData();
      }, 120);
    };

    void loadData();

    // Refresh visible data when related rows change in Supabase.
    const channel = supabase
      .channel("santa-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlists" },
        () => scheduleReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        () => scheduleReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => scheduleReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => scheduleReload()
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      void supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const handleAdd = async () => {
    const cleanName = normalizeTextInput(addName, ITEM_NAME_MAX_LENGTH);
    const cleanLink = normalizeOptionalUrl(addLink);
    const cleanImageUrl = normalizeOptionalUrl(addImageUrl);
    const cleanNote = normalizeTextInput(addNote, ITEM_NOTE_MAX_LENGTH);
    const cleanPriceMin = normalizeOptionalPriceValue(addPriceMin);
    const cleanPriceMax = normalizeOptionalPriceValue(addPriceMax);
    const validGroupIds = new Set(availableGroups.map((group) => group.id));

    if (!cleanName) {
      setMessage({ type: "error", text: "Item name is required." });
      return;
    }

    if (!addGroupId || !validGroupIds.has(addGroupId)) {
      setMessage({ type: "error", text: "Select a valid group first." });
      return;
    }

    if (addPriceMin.trim() && cleanPriceMin === null) {
      setMessage({ type: "error", text: "Enter a valid minimum price." });
      return;
    }

    if (addPriceMax.trim() && cleanPriceMax === null) {
      setMessage({ type: "error", text: "Enter a valid maximum price." });
      return;
    }

    if (cleanPriceMin !== null && cleanPriceMax !== null && cleanPriceMin > cleanPriceMax) {
      setMessage({
        type: "error",
        text: "Minimum price cannot be greater than maximum price.",
      });
      return;
    }

    setAddLoading(true);
    setMessage(null);

    try {
      const result = await addWishlistItem(
        addGroupId,
        cleanName,
        cleanLink,
        cleanNote,
        addPriority > 0 ? 1 : 0,
        addCategory,
        cleanImageUrl,
        addPriceMin,
        addPriceMax
      );

      setMessage(createActionMessage(result));

      if (result.success) {
        setAddName("");
        setAddCategory("");
        setAddImageUrl("");
        setAddLink("");
        setAddNote("");
        setAddPriceMin("");
        setAddPriceMax("");
        setAddPriority(0);
        setShowAdd(false);
      }
    } catch {
      setMessage({
        type: "error",
        text: "Failed to save the wishlist item. Please try again.",
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async (itemId: string) => {
    const cleanName = normalizeTextInput(editName, ITEM_NAME_MAX_LENGTH);
    const cleanLink = normalizeOptionalUrl(editLink);
    const cleanImageUrl = normalizeOptionalUrl(editImageUrl);
    const cleanNote = normalizeTextInput(editNote, ITEM_NOTE_MAX_LENGTH);
    const cleanPriceMin = normalizeOptionalPriceValue(editPriceMin);
    const cleanPriceMax = normalizeOptionalPriceValue(editPriceMax);

    if (!cleanName) {
      setMessage({ type: "error", text: "Item name is required." });
      return;
    }

    if (editPriceMin.trim() && cleanPriceMin === null) {
      setMessage({ type: "error", text: "Enter a valid minimum price." });
      return;
    }

    if (editPriceMax.trim() && cleanPriceMax === null) {
      setMessage({ type: "error", text: "Enter a valid maximum price." });
      return;
    }

    if (cleanPriceMin !== null && cleanPriceMax !== null && cleanPriceMin > cleanPriceMax) {
      setMessage({
        type: "error",
        text: "Minimum price cannot be greater than maximum price.",
      });
      return;
    }

    setEditLoadingId(itemId);
    setMessage(null);

    try {
      const result = await editWishlistItem(
        itemId,
        cleanName,
        cleanLink,
        cleanNote,
        editPriority > 0 ? 1 : 0,
        editCategory,
        cleanImageUrl,
        editPriceMin,
        editPriceMax
      );

      setMessage(createActionMessage(result));

      if (result.success) {
        setEditingId(null);
      }
    } catch {
      setMessage({
        type: "error",
        text: "Failed to update the wishlist item. Please try again.",
      });
    } finally {
      setEditLoadingId(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Delete this wishlist item?")) {
      return;
    }

    setDeleteLoadingId(itemId);
    setMessage(null);

    try {
      const result = await deleteWishlistItem(itemId);
      setMessage(createActionMessage(result));
    } catch {
      setMessage({
        type: "error",
        text: "Failed to delete the wishlist item. Please try again.",
      });
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleUpdateGiftPrep = async (
    groupId: string,
    status: GiftPrepStatus
  ) => {
    setUpdatingPrepGroup(groupId);
    setMessage(null);

    try {
      const result = await updateGiftPrepStatus(groupId, status);
      setMessage(createActionMessage(result));

      if (result.success) {
        const updatedAt = new Date().toISOString();

        setAssignments((currentAssignments) =>
          currentAssignments.map((assignment) =>
            assignment.group_id === groupId && assignment.gift_prep_status !== status
              ? {
                  ...assignment,
                  gift_prep_status: status,
                  gift_prep_updated_at: updatedAt,
                }
              : assignment
          )
        );
      }
    } catch {
      setMessage({
        type: "error",
        text: "Failed to update gift progress. Please try again.",
      });
    } finally {
      setUpdatingPrepGroup(null);
    }
  };

  const handleConfirmGift = async (groupId: string) => {
    if (!confirm("Confirm that you received your gift? This can't be undone.")) {
      return;
    }

    setConfirmingGroup(groupId);
    setMessage(null);

    try {
      const result = await confirmGiftReceived(groupId);
      setMessage(createActionMessage(result));

      if (result.success) {
        const confirmedAt = new Date().toISOString();

        setReceivedGifts((currentReceivedGifts) =>
          currentReceivedGifts.map((gift) =>
            gift.group_id === groupId && !gift.gift_received
              ? {
                  ...gift,
                  gift_received: true,
                  gift_received_at: gift.gift_received_at || confirmedAt,
                }
              : gift
          )
        );
      }
    } catch {
      setMessage({
        type: "error",
        text: "Failed to confirm gift receipt. Please try again.",
      });
    } finally {
      setConfirmingGroup(null);
    }
  };

  const startEdit = (item: WishlistItem) => {
    setEditingId(item.id);
    setEditName(item.item_name);
    setEditCategory(item.item_category);
    setEditImageUrl(item.item_image_url);
    setEditLink(item.item_link);
    setEditNote(item.item_note);
    setEditPriceMin(item.preferred_price_min?.toString() || "");
    setEditPriceMax(item.preferred_price_max?.toString() || "");
    setEditPriority(item.priority);
    setMessage(null);
  };

  const getGroupName = (groupId: string) => {
    return availableGroups.find((group) => group.id === groupId)?.name || "Unknown Group";
  };

  const getGroupCurrency = (groupId: string) => {
    return availableGroups.find((group) => group.id === groupId)?.currency || null;
  };

  if (loading) {
    return <SecretSantaSkeleton />;
  }

  const assignmentGroupCount = new Set(assignments.map((assignment) => assignment.group_id)).size;

  return (
    <main
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background: PAGE_BACKGROUND,
        fontFamily: "'Nunito', sans-serif",
        color: PAGE_TEXT_COLOR,
      }}
    >
      <div
        id="snowWrap"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      />
      <style>{`
        .snowflake{position:absolute;background:rgba(255,255,255,.72);box-shadow:0 0 8px rgba(255,255,255,.55);border-radius:50%;animation:fall linear infinite;}
        @keyframes fall{0%{transform:translateY(-10px) translateX(0);opacity:.6;}50%{transform:translateY(50vh) translateX(12px);}100%{transform:translateY(105vh) translateX(-6px);opacity:.1;}}
      `}</style>

      <div className="relative z-10 max-w-[720px] mx-auto px-4 py-6">
        {/* Primary navigation back to the dashboard. */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-5 px-4 py-2 rounded-lg transition"
          style={{
            color: TEXT_MUTED,
            background: "rgba(255,255,255,.72)",
            border: "1px solid rgba(163,127,90,.16)",
            boxShadow: "0 10px 24px rgba(103,72,52,.06)",
            fontFamily: "inherit",
          }}
        >
          ← Back to Dashboard
        </button>

        {/* Header content and recipient summary. */}
        <div className="text-center mb-7">
          <h1
            className="text-[32px] font-bold mb-1"
            style={{
              fontFamily: "'Fredoka', sans-serif",
              color: HOLIDAY_RED,
              textShadow: "0 2px 8px rgba(185,56,47,.08)",
            }}
          >
            🎅 Your Secret Santa
          </h1>
          <p
            className="text-[14px] font-semibold"
            style={{ color: TEXT_MUTED }}
          >
            Your mystery recipients from all events
          </p>
          {assignments.length > 0 && (
            <div
              className="inline-flex items-center gap-1.5 text-[12px] font-extrabold mt-2.5 px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(185,56,47,.1)",
                color: HOLIDAY_RED,
                border: "1px solid rgba(185,56,47,.16)",
              }}
            >
              🎁 {assignments.length} Recipient{assignments.length > 1 ? "s" : ""} across{" "}
              {assignmentGroupCount} group{assignmentGroupCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Structured status messaging keeps success and error feedback explicit. */}
        {message && (
          <p
            role="status"
            aria-live="polite"
            className={`text-[11px] font-bold mb-4 ${
              message.type === "success" ? "text-green-700" : "text-red-700"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* Recipient cards show assigned recipients, their wishlist items, and gift confirmation state. */}
        {assignments.length === 0 ? (
          <div
            className="text-center py-12 mb-7 rounded-[18px]"
            style={{
              background: SURFACE_BACKGROUND,
              border: SURFACE_BORDER,
              boxShadow: SURFACE_SHADOW,
            }}
          >
            <div className="text-[48px] mb-3">🎲</div>
            <div
              className="text-[18px] font-bold"
              style={{
                fontFamily: "'Fredoka', sans-serif",
                color: HOLIDAY_RED,
              }}
            >
              No assignments yet
            </div>
            <p
              className="text-[13px] mt-1"
              style={{ color: TEXT_MUTED }}
            >
              Once a group owner draws names, your recipients will appear here!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mb-7">
            {assignments.map((assignment, index) => (
              <div
                key={assignment.group_id}
                className="rounded-[18px] overflow-hidden transition"
                style={{
                  background: SURFACE_BACKGROUND,
                  border: SURFACE_BORDER,
                  boxShadow: SURFACE_SHADOW,
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  className="flex items-center justify-between p-4"
                  style={{
                    background: SURFACE_HEADER_BACKGROUND,
                    borderBottom: SURFACE_HEADER_BORDER,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-[44px] h-[44px] rounded-xl flex items-center justify-center text-[22px]"
                      style={{ background: ICON_COLORS[index % ICON_COLORS.length] }}
                    >
                      {ICON_EMOJIS[index % ICON_EMOJIS.length]}
                    </div>
                    <div>
                      <div className="text-[16px] font-extrabold">{assignment.group_name}</div>
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: TEXT_MUTED }}
                      >
                        📅 {formatDisplayDate(assignment.group_event_date)}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[14px] font-extrabold text-white"
                    style={{
                      background: "linear-gradient(135deg,#ccb57b,#a9873d)",
                      boxShadow: "0 4px 16px rgba(169,135,61,.2)",
                    }}
                  >
                    🎁→ {assignment.receiver_nickname}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p
                      className="text-[14px] font-extrabold"
                      style={{ color: HOLIDAY_GREEN }}
                    >
                      🎅 {assignment.receiver_nickname}&apos;s wishlist
                    </p>
                    <span
                      className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg"
                      style={{
                        background: "rgba(184,131,29,.12)",
                        color: HOLIDAY_GOLD,
                      }}
                    >
                      {assignment.receiver_wishlist.length} item
                      {assignment.receiver_wishlist.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {assignment.receiver_wishlist.length === 0 ? (
                    <div
                      className="text-center py-5 rounded-xl"
                      style={{
                        color: TEXT_SOFT,
                        background: "rgba(255,250,244,.8)",
                        border: "1px dashed rgba(163,127,90,.22)",
                      }}
                    >
                      No wishlist items yet 😢
                      <br />
                      <span className="text-[11px]" style={{ opacity: 0.6 }}>
                        {assignment.receiver_nickname} hasn&apos;t added any gift ideas
                      </span>
                    </div>
                  ) : (
                    assignment.receiver_wishlist.map((item) => {
                      const safeItemLink = normalizeOptionalUrl(item.item_link);
                      const safeItemImageUrl = normalizeOptionalUrl(item.item_image_url);
                      const categoryStyle = item.item_category
                        ? getWishlistCategoryStyle(item.item_category)
                        : null;
                      const budgetLabel = formatWishlistBudget(
                        item,
                        assignment.group_currency
                      );
                      const suggestions = buildWishlistSuggestions({
                        groupId: assignment.group_id,
                        wishlistItemId: item.id,
                        itemName: item.item_name,
                        itemCategory: item.item_category,
                        itemNote: item.item_note,
                        preferredPriceMin: item.preferred_price_min,
                        preferredPriceMax: item.preferred_price_max,
                        groupBudget: assignment.group_budget,
                        currency: assignment.group_currency,
                      });

                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-xl mb-2 transition"
                          style={{
                            background: INSET_BACKGROUND,
                            border: INSET_BORDER,
                          }}
                        >
                          <span className="hidden">
                            {item.priority > 0 ? "⭐" : "🎁"}
                          </span>
                          <div
                            className="w-[56px] h-[56px] rounded-xl flex items-center justify-center text-[18px] shrink-0"
                            style={{
                              background: "rgba(255,255,255,.78)",
                              border: "1px solid rgba(96,117,122,.12)",
                            }}
                          >
                            {safeItemImageUrl ? "IMG" : item.priority > 0 ? "TOP" : "GIFT"}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {item.priority > 0 && (
                                <span
                                  className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                  style={{
                                    background: "rgba(251,191,36,.16)",
                                    color: HOLIDAY_GOLD,
                                  }}
                                >
                                  ⭐ Top priority
                                </span>
                              )}
                              {item.item_category && categoryStyle && (
                                <span
                                  className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                  style={categoryStyle}
                                >
                                  {item.item_category}
                                </span>
                              )}
                              {budgetLabel && (
                                <span
                                  className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                  style={{
                                    background: "rgba(47,107,86,.12)",
                                    color: HOLIDAY_GREEN,
                                  }}
                                >
                                  Budget {budgetLabel}
                                </span>
                              )}
                            </div>
                            <div
                              className="text-[14px] font-bold"
                              style={{ color: PAGE_TEXT_COLOR }}
                            >
                              {item.item_name}
                            </div>
                            {item.item_note && (
                              <div
                                className="text-[12px] mt-0.5"
                                style={{ color: TEXT_MUTED }}
                              >
                                {item.item_note}
                              </div>
                            )}
                            {safeItemImageUrl && (
                              <a
                                href={safeItemImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={safeItemImageUrl}
                                className="text-[11px] font-semibold mt-1 inline-block"
                                style={{ color: HOLIDAY_BLUE }}
                              >
                                Open image {"->"}
                              </a>
                            )}
                            {safeItemLink && (
                              <a
                                href={safeItemLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={safeItemLink}
                                className="text-[11px] font-semibold mt-0.5 inline-block"
                                style={{ color: HOLIDAY_GOLD }}
                              >
                                🔗{" "}
                                {safeItemLink.length > 35
                                  ? `${safeItemLink.slice(0, 35)}...`
                                  : safeItemLink}
                              </a>
                            )}
                            <div
                              className="rounded-xl p-3 mt-3"
                              style={{
                                background: "rgba(47,107,86,.08)",
                                border: "1px solid rgba(47,107,86,.14)",
                              }}
                            >
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <div>
                                  <div
                                    className="text-[12px] font-extrabold"
                                    style={{ color: HOLIDAY_GREEN }}
                                  >
                                    Suggested Gifts
                                  </div>
                                  <div
                                    className="text-[11px] mt-0.5"
                                    style={{ color: TEXT_MUTED }}
                                  >
                                    Helpful search ideas on Lazada and Shopee based on this
                                    wishlist item.
                                  </div>
                                </div>
                                <span
                                  className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                  style={{
                                    background: "rgba(255,255,255,.78)",
                                    color: HOLIDAY_GREEN,
                                  }}
                                >
                                  Affiliate-ready
                                </span>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {suggestions.map((suggestion) => (
                                  <a
                                    key={suggestion.id}
                                    href={suggestion.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-xl p-3 transition"
                                    style={{
                                      background: "rgba(255,255,255,.82)",
                                      border: "1px solid rgba(96,117,122,.12)",
                                      color: PAGE_TEXT_COLOR,
                                      textDecoration: "none",
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                      <span
                                        className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                        style={{
                                          background:
                                            suggestion.merchant === "lazada"
                                              ? "rgba(245,158,11,.14)"
                                              : "rgba(238,77,45,.12)",
                                          color:
                                            suggestion.merchant === "lazada"
                                              ? "#b45309"
                                              : "#c2410c",
                                        }}
                                      >
                                        {suggestion.merchantLabel}
                                      </span>
                                      <span
                                        className="text-[10px] font-extrabold"
                                        style={{ color: HOLIDAY_GREEN }}
                                      >
                                        {suggestion.fitLabel}
                                      </span>
                                    </div>
                                    <div
                                      className="text-[13px] font-bold mb-1"
                                      style={{ color: PAGE_TEXT_COLOR }}
                                    >
                                      {suggestion.title}
                                    </div>
                                    <div
                                      className="text-[11px] leading-relaxed"
                                      style={{ color: TEXT_MUTED }}
                                    >
                                      {suggestion.subtitle}
                                    </div>
                                    <div
                                      className="text-[11px] font-semibold mt-2"
                                      style={{ color: HOLIDAY_GOLD }}
                                    >
                                      Search: {suggestion.searchQuery}
                                    </div>
                                    {suggestion.priceLabel && (
                                      <div
                                        className="text-[10px] font-bold mt-1"
                                        style={{ color: TEXT_MUTED }}
                                      >
                                        {suggestion.priceLabel}
                                      </div>
                                    )}
                                    <div
                                      className="text-[10px] font-semibold mt-2"
                                      style={{ color: HOLIDAY_BLUE }}
                                    >
                                      View on {suggestion.merchantLabel} {"->"}
                                    </div>
                                    <div
                                      className="text-[9px] mt-1"
                                      style={{ color: TEXT_SOFT }}
                                    >
                                      {suggestion.disclosure}
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div
                    className="rounded-xl p-3.5 mt-3"
                    style={{
                      background: "rgba(63,111,178,.09)",
                      border: "1px solid rgba(63,111,178,.16)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div
                          className="text-[13px] font-extrabold"
                          style={{ color: HOLIDAY_BLUE }}
                        >
                          Private gift prep
                        </div>
                        <div
                          className="text-[11px] mt-0.5"
                          style={{ color: TEXT_MUTED }}
                        >
                          Optional progress that only you can see.
                        </div>
                      </div>
                      <div
                        className="px-3 py-1 rounded-lg text-[10px] font-extrabold"
                        style={{
                          background: "rgba(63,111,178,.12)",
                          color: HOLIDAY_BLUE,
                        }}
                      >
                        Only you
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {GIFT_PREP_OPTIONS.map((option) => {
                        const isActive = assignment.gift_prep_status === option.value;
                        const isDisabled =
                          assignment.gift_received ||
                          updatingPrepGroup === assignment.group_id;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              handleUpdateGiftPrep(assignment.group_id, option.value)
                            }
                            disabled={isDisabled}
                            className="px-3 py-2 rounded-xl text-[11px] font-bold transition"
                            style={{
                              background: isActive
                                ? "linear-gradient(135deg,#7f97ad,#58748e)"
                                : "rgba(255,255,255,.75)",
                              color: isActive ? "#fff" : PAGE_TEXT_COLOR,
                              border: `1px solid ${
                                isActive
                                  ? "rgba(147,197,253,.4)"
                                  : "rgba(163,127,90,.16)"
                              }`,
                              cursor: assignment.gift_received
                                ? "not-allowed"
                                : updatingPrepGroup === assignment.group_id
                                  ? "wait"
                                  : "pointer",
                              fontFamily: "inherit",
                              opacity: isDisabled && !isActive ? 0.65 : 1,
                            }}
                            title={option.helper}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className="mt-3 rounded-lg px-3 py-2 text-[11px]"
                      style={{
                        background: "rgba(255,255,255,.72)",
                        color: PAGE_TEXT_COLOR,
                      }}
                    >
                      <span className="font-bold" style={{ color: HOLIDAY_BLUE }}>
                        Current:
                      </span>{" "}
                      {getGiftPrepLabel(assignment.gift_prep_status)}
                      {assignment.gift_prep_updated_at
                        ? ` • Updated ${formatDisplayDate(assignment.gift_prep_updated_at)}`
                        : " • Update it only if it helps you stay organized"}
                    </div>
                  </div>

                  <div
                    className="rounded-xl p-3.5 mt-3 flex items-center justify-between"
                    style={{
                      background: assignment.gift_received
                        ? "rgba(31,122,77,.09)"
                        : "rgba(184,131,29,.09)",
                      border: `1px solid ${
                        assignment.gift_received
                          ? "rgba(31,122,77,.16)"
                          : "rgba(184,131,29,.16)"
                      }`,
                    }}
                  >
                    <div>
                      <div
                        className="text-[13px] font-extrabold"
                        style={{
                          color: assignment.gift_received ? HOLIDAY_GREEN : HOLIDAY_GOLD,
                        }}
                      >
                        {assignment.gift_received
                          ? "✅ Recipient confirmed receipt"
                          : "🎁 Waiting for recipient confirmation"}
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ color: TEXT_MUTED }}
                      >
                        {assignment.gift_received
                          ? `${assignment.receiver_nickname} confirmed on ${formatDisplayDate(
                              assignment.gift_received_at
                            )}`
                          : "Your recipient will confirm once the gift reaches them."}
                      </div>
                    </div>
                    <div
                      className="px-4 py-2 rounded-xl text-[12px] font-bold"
                      style={{
                        background: assignment.gift_received
                          ? "rgba(31,122,77,.12)"
                          : "rgba(184,131,29,.12)",
                        color: assignment.gift_received ? HOLIDAY_GREEN : HOLIDAY_GOLD,
                      }}
                    >
                      {assignment.gift_received ? "Recipient confirmed" : "Pending"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/group/${assignment.group_id}`)}
                    className="w-full text-center py-2.5 mt-3 rounded-lg text-[12px] font-bold transition"
                    style={{
                      color: HOLIDAY_GOLD,
                      background: "rgba(255,255,255,.82)",
                      border: "1px solid rgba(184,131,29,.18)",
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

        {receivedGifts.length > 0 && (
          <div className="mb-7">
            <div className="text-center mb-4">
              <h2
                className="text-[22px] font-bold"
                style={{
                  fontFamily: "'Fredoka', sans-serif",
                  color: HOLIDAY_GREEN,
                  textShadow: "0 2px 8px rgba(31,122,77,.08)",
                }}
              >
                🎁 Gifts You Received
              </h2>
              <p
                className="text-[13px] font-semibold mt-1"
                style={{ color: TEXT_MUTED }}
              >
                Confirm your own gift here after it reaches you.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {receivedGifts.map((gift) => (
                <div
                  key={gift.group_id}
                  className="rounded-[18px] overflow-hidden"
                  style={{
                    background: SURFACE_BACKGROUND,
                    border: SURFACE_BORDER,
                    boxShadow: SURFACE_SHADOW,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <div
                    className="flex items-center justify-between p-4"
                    style={{
                      background: SURFACE_HEADER_BACKGROUND,
                      borderBottom: SURFACE_HEADER_BORDER,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-[44px] h-[44px] rounded-xl flex items-center justify-center text-[22px]"
                        style={{ background: "rgba(31,122,77,.12)" }}
                      >
                        🎄
                      </div>
                      <div>
                        <div className="text-[16px] font-extrabold">{gift.group_name}</div>
                        <div
                          className="text-[11px] font-semibold"
                          style={{ color: TEXT_MUTED }}
                        >
                          📅 {formatDisplayDate(gift.group_event_date)}
                        </div>
                      </div>
                    </div>
                    <div
                      className="px-4 py-2 rounded-xl text-[12px] font-extrabold"
                      style={{
                        background: gift.gift_received
                          ? "rgba(31,122,77,.12)"
                          : "rgba(184,131,29,.12)",
                        color: gift.gift_received ? HOLIDAY_GREEN : HOLIDAY_GOLD,
                      }}
                    >
                      {gift.gift_received ? "Confirmed" : "Waiting"}
                    </div>
                  </div>

                  <div className="p-4">
                    <div
                      className="rounded-xl p-3.5 flex items-center justify-between"
                      style={{
                        background: gift.gift_received
                          ? "rgba(31,122,77,.09)"
                          : "rgba(184,131,29,.09)",
                        border: `1px solid ${
                          gift.gift_received
                            ? "rgba(31,122,77,.16)"
                            : "rgba(184,131,29,.16)"
                        }`,
                      }}
                    >
                      <div>
                        <div
                          className="text-[13px] font-extrabold"
                          style={{ color: gift.gift_received ? HOLIDAY_GREEN : HOLIDAY_GOLD }}
                        >
                          {gift.gift_received
                            ? "✅ You already confirmed your gift"
                            : "🎁 Did you receive your gift?"}
                        </div>
                        <div
                          className="text-[11px] mt-0.5"
                          style={{ color: TEXT_MUTED }}
                        >
                          {gift.gift_received
                            ? `Confirmed on ${formatDisplayDate(gift.gift_received_at)}`
                            : "Use this only for the gift you received from your own Secret Santa."}
                        </div>
                      </div>

                      {gift.gift_received ? (
                        <div
                          className="px-4 py-2 rounded-xl text-[12px] font-bold"
                          style={{
                            background: "rgba(31,122,77,.12)",
                            color: HOLIDAY_GREEN,
                          }}
                        >
                          ✅ Confirmed
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConfirmGift(gift.group_id)}
                          disabled={confirmingGroup === gift.group_id}
                          className="px-4 py-2 rounded-xl text-[12px] font-extrabold text-white transition"
                          style={{
                            background: "linear-gradient(135deg,#5e9479,#2f6b56)",
                            boxShadow: "0 3px 12px rgba(47,107,86,.2)",
                            border: "none",
                            cursor: confirmingGroup === gift.group_id ? "wait" : "pointer",
                            fontFamily: "inherit",
                            opacity: confirmingGroup === gift.group_id ? 0.75 : 1,
                          }}
                        >
                          {confirmingGroup === gift.group_id
                            ? "Confirming..."
                            : "✅ I got my gift!"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* The user's own wishlist is managed independently from recipient assignments. */}
        <div
          className="rounded-[18px] overflow-hidden"
          style={{
            background: SURFACE_BACKGROUND,
            border: SURFACE_BORDER,
            boxShadow: SURFACE_SHADOW,
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="flex items-center justify-between p-4"
            style={{
              background: SURFACE_HEADER_BACKGROUND,
              borderBottom: SURFACE_HEADER_BORDER,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-[38px] h-[38px] rounded-lg flex items-center justify-center text-[18px]"
                style={{ background: "rgba(185,56,47,.12)" }}
              >
                📝
              </div>
              <div>
                <div
                  className="text-[16px] font-extrabold"
                  style={{ color: HOLIDAY_RED }}
                >
                  My Wishlist
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: TEXT_MUTED }}
                >
                  Your Secret Santa sees these items
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd((current) => !current)}
              disabled={availableGroups.length === 0}
              className="px-4 py-2 rounded-lg text-[12px] font-bold text-white transition"
              style={{
                background: "linear-gradient(135deg,#b96a5d,#9f4e42)",
                boxShadow: "0 2px 12px rgba(159,78,66,.18)",
                border: "none",
                cursor: availableGroups.length === 0 ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: availableGroups.length === 0 ? 0.6 : 1,
              }}
            >
              + Add Item
            </button>
          </div>

          <div className="p-4">
            {/* The add form keeps client-side input well shaped before calling server actions. */}
            {showAdd && (
              <div
                className="rounded-xl p-4 mb-4"
                style={{
                  background: INSET_BACKGROUND,
                  border: INSET_BORDER,
                }}
              >
                {availableGroups.length > 1 && (
                  <div className="mb-3">
                    <p
                      className="text-[10px] font-bold mb-1.5"
                      style={{ color: TEXT_MUTED }}
                    >
                      Add to which group?
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableGroups.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => setAddGroupId(group.id)}
                          className="text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition"
                          style={{
                            background:
                              addGroupId === group.id
                                ? "rgba(185,56,47,.12)"
                                : "rgba(255,255,255,.72)",
                            color:
                              addGroupId === group.id
                                ? HOLIDAY_RED
                                : TEXT_MUTED,
                            border: `1px solid ${
                              addGroupId === group.id
                                ? "rgba(185,56,47,.18)"
                                : "rgba(163,127,90,.16)"
                            }`,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {group.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <input
                  value={addName}
                  onChange={(event) => setAddName(event.target.value)}
                  maxLength={ITEM_NAME_MAX_LENGTH}
                  placeholder="Item name (e.g. Nintendo Switch)..."
                  className="w-full mb-2 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{
                    background: INPUT_BACKGROUND,
                    border: INPUT_BORDER,
                    color: INPUT_TEXT,
                    fontFamily: "inherit",
                  }}
                />

                <div className="flex gap-2 mb-2 flex-col sm:flex-row">
                  <select
                    value={addCategory}
                    onChange={(event) => setAddCategory(event.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: INPUT_BACKGROUND,
                      border: INPUT_BORDER,
                      color: INPUT_TEXT,
                      fontFamily: "inherit",
                    }}
                  >
                    <option value="">Category (optional)</option>
                    {WISHLIST_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    inputMode="url"
                    value={addImageUrl}
                    onChange={(event) => setAddImageUrl(event.target.value)}
                    maxLength={ITEM_IMAGE_URL_MAX_LENGTH}
                    placeholder="Image URL (optional)..."
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: INPUT_BACKGROUND,
                      border: INPUT_BORDER,
                      color: INPUT_TEXT,
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div className="flex gap-2 mb-2 flex-col sm:flex-row">
                  <input
                    type="url"
                    inputMode="url"
                    value={addLink}
                    onChange={(event) => setAddLink(event.target.value)}
                    maxLength={ITEM_LINK_MAX_LENGTH}
                    placeholder="Link (optional)..."
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: INPUT_BACKGROUND,
                      border: INPUT_BORDER,
                      color: INPUT_TEXT,
                      fontFamily: "inherit",
                    }}
                  />
                  <input
                    value={addNote}
                    onChange={(event) => setAddNote(event.target.value)}
                    maxLength={ITEM_NOTE_MAX_LENGTH}
                    placeholder="Note (optional)..."
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: INPUT_BACKGROUND,
                      border: INPUT_BORDER,
                      color: INPUT_TEXT,
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div className="flex gap-2 mb-2 flex-col sm:flex-row">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={addPriceMin}
                    onChange={(event) => setAddPriceMin(event.target.value)}
                    placeholder="Preferred min price (optional)..."
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: INPUT_BACKGROUND,
                      border: INPUT_BORDER,
                      color: INPUT_TEXT,
                      fontFamily: "inherit",
                    }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={addPriceMax}
                    onChange={(event) => setAddPriceMax(event.target.value)}
                    placeholder="Preferred max price (optional)..."
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{
                      background: INPUT_BACKGROUND,
                      border: INPUT_BORDER,
                      color: INPUT_TEXT,
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label
                    className="flex items-center gap-2 text-[11px] font-bold"
                    style={{ color: TEXT_MUTED }}
                  >
                    <input
                      type="checkbox"
                      checked={addPriority > 0}
                      onChange={(event) => setAddPriority(event.target.checked ? 1 : 0)}
                      style={{ accentColor: "#fbbf24" }}
                    />
                    ⭐ Top priority
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAdd(false)}
                      className="px-4 py-2 rounded-lg text-[11px] font-bold"
                      style={{
                        background: "rgba(255,255,255,.78)",
                        color: TEXT_MUTED,
                        border: "1px solid rgba(163,127,90,.14)",
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={addLoading}
                      className="px-4 py-2 rounded-lg text-[11px] font-bold text-white"
                      style={{
                        background: HOLIDAY_GREEN,
                        border: "none",
                        fontFamily: "inherit",
                        cursor: addLoading ? "wait" : "pointer",
                        opacity: addLoading ? 0.75 : 1,
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
                  color: TEXT_SOFT,
                  background: "rgba(255,250,244,.8)",
                  border: "1px dashed rgba(163,127,90,.2)",
                }}
              >
                No items yet — add your first gift idea!
              </div>
            ) : (
              myItems.map((item) => {
                const myBudgetLabel = formatWishlistBudget(
                  item,
                  getGroupCurrency(item.group_id)
                );

                return (
                <div key={item.id}>
                  {editingId === item.id ? (
                    <div
                      className="rounded-xl p-3.5 mb-2"
                      style={{
                        background: INSET_BACKGROUND,
                        border: "1px solid rgba(63,111,178,.18)",
                      }}
                    >
                      <input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        maxLength={ITEM_NAME_MAX_LENGTH}
                        className="w-full mb-2 px-3 py-2 rounded-lg text-[13px] outline-none"
                        style={{
                          background: INPUT_BACKGROUND,
                          border: INPUT_BORDER,
                          color: INPUT_TEXT,
                          fontFamily: "inherit",
                        }}
                      />
                      <div className="flex gap-2 mb-2 flex-col sm:flex-row">
                        <select
                          value={editCategory}
                          onChange={(event) => setEditCategory(event.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: INPUT_BACKGROUND,
                            border: INPUT_BORDER,
                            color: INPUT_TEXT,
                            fontFamily: "inherit",
                          }}
                        >
                          <option value="">Category (optional)</option>
                          {WISHLIST_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                        <input
                          type="url"
                          inputMode="url"
                          value={editImageUrl}
                          onChange={(event) => setEditImageUrl(event.target.value)}
                          maxLength={ITEM_IMAGE_URL_MAX_LENGTH}
                          placeholder="Image URL..."
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: INPUT_BACKGROUND,
                            border: INPUT_BORDER,
                            color: INPUT_TEXT,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <div className="flex gap-2 mb-2 flex-col sm:flex-row">
                        <input
                          type="url"
                          inputMode="url"
                          value={editLink}
                          onChange={(event) => setEditLink(event.target.value)}
                          maxLength={ITEM_LINK_MAX_LENGTH}
                          placeholder="Link..."
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: INPUT_BACKGROUND,
                            border: INPUT_BORDER,
                            color: INPUT_TEXT,
                            fontFamily: "inherit",
                          }}
                        />
                        <input
                          value={editNote}
                          onChange={(event) => setEditNote(event.target.value)}
                          maxLength={ITEM_NOTE_MAX_LENGTH}
                          placeholder="Note..."
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: INPUT_BACKGROUND,
                            border: INPUT_BORDER,
                            color: INPUT_TEXT,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <div className="flex gap-2 mb-2 flex-col sm:flex-row">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={editPriceMin}
                          onChange={(event) => setEditPriceMin(event.target.value)}
                          placeholder="Preferred min price..."
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: INPUT_BACKGROUND,
                            border: INPUT_BORDER,
                            color: INPUT_TEXT,
                            fontFamily: "inherit",
                          }}
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={editPriceMax}
                          onChange={(event) => setEditPriceMax(event.target.value)}
                          placeholder="Preferred max price..."
                          className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{
                            background: INPUT_BACKGROUND,
                            border: INPUT_BORDER,
                            color: INPUT_TEXT,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <label
                        className="flex items-center gap-2 text-[11px] font-bold mb-3"
                        style={{ color: TEXT_MUTED }}
                      >
                        <input
                          type="checkbox"
                          checked={editPriority > 0}
                          onChange={(event) => setEditPriority(event.target.checked ? 1 : 0)}
                          style={{ accentColor: "#fbbf24" }}
                        />
                        ⭐ Top priority
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                          style={{
                            background: "rgba(255,255,255,.78)",
                            color: TEXT_MUTED,
                            border: "1px solid rgba(163,127,90,.14)",
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(item.id)}
                          disabled={editLoadingId === item.id}
                          className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white"
                          style={{
                            background: HOLIDAY_GREEN,
                            border: "none",
                            fontFamily: "inherit",
                            cursor: editLoadingId === item.id ? "wait" : "pointer",
                            opacity: editLoadingId === item.id ? 0.75 : 1,
                          }}
                        >
                          {editLoadingId === item.id ? "Saving..." : "✅ Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-start justify-between gap-3 p-3 rounded-xl mb-2 transition"
                      style={{
                        background: INSET_BACKGROUND,
                        border: INSET_BORDER,
                      }}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className="w-[56px] h-[56px] rounded-xl flex items-center justify-center text-[18px] shrink-0"
                          style={{
                            background: "rgba(255,255,255,.78)",
                            border: "1px solid rgba(96,117,122,.12)",
                          }}
                        >
                          {normalizeOptionalUrl(item.item_image_url) ? "IMG" : item.priority > 0 ? "TOP" : "GIFT"}
                        </div>
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {item.priority > 0 && (
                            <span
                              className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                              style={{
                                background: "rgba(251,191,36,.16)",
                                color: HOLIDAY_GOLD,
                              }}
                            >
                              ⭐ Top priority
                            </span>
                          )}
                          {item.item_category && (
                            <span
                              className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                              style={getWishlistCategoryStyle(item.item_category)}
                            >
                              {item.item_category}
                            </span>
                          )}
                          {myBudgetLabel && (
                            <span
                              className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                              style={{
                                background: "rgba(47,107,86,.12)",
                                color: HOLIDAY_GREEN,
                              }}
                            >
                              Budget {myBudgetLabel}
                            </span>
                          )}
                        </div>
                        <div
                          className="text-[13px] font-bold"
                          style={{ color: PAGE_TEXT_COLOR }}
                        >
                          {item.item_name}
                        </div>
                        {item.item_note && (
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: TEXT_MUTED }}
                          >
                            {item.item_note}
                          </div>
                        )}
                        <div
                          className="text-[9px] font-bold mt-1 inline-block px-2 py-0.5 rounded"
                          style={{
                            color: TEXT_MUTED,
                            background: "rgba(255,255,255,.72)",
                          }}
                        >
                          {getGroupName(item.group_id)}
                        </div>
                        {normalizeOptionalUrl(item.item_image_url) && (
                          <a
                            href={normalizeOptionalUrl(item.item_image_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.item_image_url}
                            className="text-[11px] font-semibold mt-1 inline-block"
                            style={{ color: HOLIDAY_BLUE }}
                          >
                            Open image {"->"}
                          </a>
                        )}
                        {normalizeOptionalUrl(item.item_link) && (
                          <a
                            href={normalizeOptionalUrl(item.item_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.item_link}
                            className="text-[11px] font-semibold mt-1 inline-block"
                            style={{ color: HOLIDAY_GOLD }}
                          >
                            Open link {"->"}
                          </a>
                        )}
                      </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
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
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleteLoadingId === item.id}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                          style={{
                            background: "rgba(220,38,38,.12)",
                            color: "#fca5a5",
                            border: "none",
                            cursor: deleteLoadingId === item.id ? "wait" : "pointer",
                            fontFamily: "inherit",
                            opacity: deleteLoadingId === item.id ? 0.75 : 1,
                          }}
                        >
                          {deleteLoadingId === item.id ? "..." : "🗑️"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })
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
    const snowWrapper = document.getElementById("snowWrap");

    if (snowWrapper && snowWrapper.children.length === 0) {
      // Use a fragment so all snowflakes are appended in a single DOM write.
      const fragment = document.createDocumentFragment();

      for (let index = 0; index < 50; index += 1) {
        const snowflake = document.createElement("div");
        const size = 2 + Math.random() * 3;

        snowflake.className = "snowflake";
        snowflake.style.cssText = [
          `width:${size}px`,
          `height:${size}px`,
          `left:${Math.random() * 100}%`,
          `animation-duration:${5 + Math.random() * 10}s`,
          `animation-delay:${Math.random() * 6}s`,
          `opacity:${0.2 + Math.random() * 0.3}`,
        ].join(";");

        fragment.appendChild(snowflake);
      }

      snowWrapper.appendChild(fragment);
    }

    // replaceChildren avoids parsing an empty HTML string and directly clears the container.
    return () => {
      const currentWrapper = document.getElementById("snowWrap");
      currentWrapper?.replaceChildren();
    };
  }, []);

  return null;
}




