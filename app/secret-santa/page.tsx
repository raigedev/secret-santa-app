"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmGiftReceived, updateGiftPrepStatus } from "./actions";
import { SecretSantaSkeleton } from "@/app/components/PageSkeleton";
import { isLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
import { formatPriceRange } from "@/lib/wishlist/pricing";
import {
  type SuggestionInput,
  buildWishlistFeaturedLazadaProducts,
  buildWishlistMerchantLinks,
  buildWishlistSuggestionOptions,
  mergeWishlistSuggestionOptions,
  detectShoppingRegionFromLocale,
  SHOPPING_REGION_OPTIONS,
  type ShoppingRegion,
  type WishlistFeaturedProductCard,
  type WishlistSuggestionOption,
} from "@/lib/wishlist/suggestions";

type WishlistItem = {
  id: string;
  group_id: string;
  item_name: string;
  item_category: string;
  item_image_url: string;
  item_link: string;
  item_note: string;
  priority: number;
};
type WishlistPriorityLevel = 0 | 1 | 2;

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

type LazadaFeaturedProductsState = {
  loading: boolean;
  products: WishlistFeaturedProductCard[];
};

type AiSuggestionState = {
  loaded: boolean;
  loading: boolean;
  options: WishlistSuggestionOption[];
  usedAi: boolean;
};

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
  priority: number | null;
};

type GiftPrepStatus =
  | "planning"
  | "purchased"
  | "wrapped"
  | "ready_to_give";
type GuideTabId = "wishlist" | "direction" | "matches" | "prep";

const GUIDE_TABS: Array<{ id: GuideTabId; label: string }> = [
  { id: "wishlist", label: "Wishlist" },
  { id: "matches", label: "Shopping Picks" },
  { id: "direction", label: "Gift Guide" },
  { id: "prep", label: "Exchanges" },
];

const ITEM_LINK_MAX_LENGTH = 500;
const MAX_GROUP_ROUTE_PREFETCH = 8;
const AI_SUGGESTION_REQUEST_TIMEOUT_MS = 18000;
const MAX_VISIBLE_RECIPIENT_WISHLIST_ITEMS = 3;
const PAGE_BACKGROUND =
  "linear-gradient(145deg,rgba(255,171,169,.24) 0%,rgba(255,171,169,0) 34%), linear-gradient(215deg,rgba(215,250,219,.46) 0%,rgba(215,250,219,0) 42%), linear-gradient(180deg,#f9faf8 0%,#f2f4f2 52%,#dfe4e1 100%)";
const PAGE_TEXT_COLOR = "#2e3432";
const TEXT_MUTED = "#5b605e";
const TEXT_SOFT = "#777c7a";
const SURFACE_BACKGROUND = "rgba(255,255,255,.9)";
const SURFACE_BORDER = "1px solid rgba(174,179,177,.1)";
const SURFACE_HEADER_BACKGROUND =
  "linear-gradient(135deg,rgba(255,255,255,.9),rgba(236,239,236,.86))";
const SURFACE_HEADER_BORDER = "1px solid rgba(174,179,177,.08)";
const SURFACE_SHADOW = "0 28px 68px rgba(46,52,50,.07)";
const INPUT_BACKGROUND = "rgba(255,255,255,.92)";
const INPUT_BORDER = "1px solid rgba(174,179,177,.2)";
const INPUT_TEXT = "#2e3432";
const HOLIDAY_RED = "#a43c3f";
const HOLIDAY_GREEN = "#48664e";
const HOLIDAY_GOLD = "#7b5902";
const HOLIDAY_BLUE = "#58748e";
const LAZADA_AFFILIATE_DISCLOSURE =
  "Some Lazada links are affiliate links.";

function GiftMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4.75 10.25h14.5v8.5a1.5 1.5 0 0 1-1.5 1.5H6.25a1.5 1.5 0 0 1-1.5-1.5v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 10.25v10M3.5 7.25h17v3h-17v-3Z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.25c-2.6-3.2-6.4-1.9-5.2.7.7 1.5 3.2 1.2 5.2-.7Zm0 0c2.6-3.2 6.4-1.9 5.2.7-.7 1.5-3.2 1.2-5.2-.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SparkleMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 3.75 14.1 9.9 20.25 12l-6.15 2.1L12 20.25 9.9 14.1 3.75 12 9.9 9.9 12 3.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
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

function createLazadaMatchRequestKey(
  itemId: string,
  suggestionId: string,
  region: ShoppingRegion
): string {
  return `${itemId}:${suggestionId}:${region}`;
}

function buildRecipientSuggestionInput(
  assignment: RecipientData,
  item: WishlistItem
): SuggestionInput {
  return {
    groupId: assignment.group_id,
    wishlistItemId: item.id,
    itemName: item.item_name,
    itemCategory: item.item_category,
    itemNote: item.item_note,
    preferredPriceMin: null,
    preferredPriceMax: null,
    groupBudget: assignment.group_budget,
    currency: assignment.group_currency,
  };
}

function getActiveRecipientWishlistItemId(
  assignment: RecipientData,
  activeRecipientItemByAssignment: Record<string, string>
): string {
  return (
    activeRecipientItemByAssignment[assignment.group_id] ||
    assignment.receiver_wishlist[0]?.id ||
    ""
  );
}

function mergeSuggestionDisplayOrder(
  currentOrder: string[],
  nextOrder: string[]
): string[] {
  const nextOrderSet = new Set(nextOrder);
  const preservedIds = currentOrder.filter((id) => nextOrderSet.has(id));
  const additionalIds = nextOrder.filter((id) => !preservedIds.includes(id));

  return [...preservedIds, ...additionalIds];
}

function applySuggestionDisplayOrder(
  options: WishlistSuggestionOption[],
  orderedIds: string[]
): WishlistSuggestionOption[] {
  if (orderedIds.length === 0) {
    return options;
  }

  const optionsById = new Map(options.map((option) => [option.id, option]));
  const orderedOptions = orderedIds
    .map((id) => optionsById.get(id) || null)
    .filter((option): option is WishlistSuggestionOption => Boolean(option));
  const unorderedOptions = options.filter(
    (option) => !orderedIds.includes(option.id)
  );

  return [...orderedOptions, ...unorderedOptions];
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
    priority: normalizeWishlistPriorityLevel(row.priority),
  };
}

function normalizeWishlistPriorityLevel(priority: number | null | undefined): WishlistPriorityLevel {
  const numericPriority = Number(priority || 0);

  if (numericPriority >= 2) {
    return 2;
  }

  if (numericPriority >= 1) {
    return 1;
  }

  return 0;
}

function getWishlistPriorityMeta(priority: number): {
  badgeBackground: string;
  badgeColor: string;
  icon: string;
  label: string;
} {
  const normalizedPriority = normalizeWishlistPriorityLevel(priority);

  if (normalizedPriority === 2) {
    return {
      icon: "🔴",
      label: "Want most",
      badgeBackground: "rgba(185,56,47,.12)",
      badgeColor: HOLIDAY_RED,
    };
  }

  if (normalizedPriority === 1) {
    return {
      icon: "🟡",
      label: "Nice to have",
      badgeBackground: "rgba(251,191,36,.16)",
      badgeColor: HOLIDAY_GOLD,
    };
  }

  return {
    icon: "🟢",
    label: "Just an idea",
    badgeBackground: "rgba(47,107,86,.12)",
    badgeColor: HOLIDAY_GREEN,
  };
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
        receiver_nickname: receiver?.nickname || "Secret Member",
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

function summarizeCardCopy(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 3, 0)).trimEnd()}...`;
}

function toDisplayTitle(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => {
      if (/^[A-Z0-9]+$/.test(word) && word.length <= 4) {
        return word;
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function getShoppingFocusDisplayLabel(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  return toDisplayTitle(normalized.replace(/^budget-friendly\b/i, "Budget"));
}

function getFriendlyLazadaLabel(value: string | null | undefined): string {
  const label = value?.trim();

  if (!label) {
    return "";
  }

  const normalized = label.toLowerCase();

  if (normalized === "search-backed fallback" || normalized === "search-backed route") {
    return "Browse similar items";
  }

  if (normalized === "safe fallback") {
    return "More ideas";
  }

  if (normalized === "budget-safe") {
    return "Budget-friendly";
  }

  if (normalized === "matched lazada product") {
    return "Ready on Lazada";
  }

  if (normalized === "matched product") {
    return "Product match";
  }

  if (normalized === "selected angle") {
    return "Chosen focus";
  }

  if (normalized === "wishlist wording") {
    return "Wishlist clue";
  }

  if (normalized === "search route") {
    return "Lazada search";
  }

  if (normalized === "use your budget target") {
    return "Budget guided";
  }

  if (normalized === "usually within target") {
    return "Within budget";
  }

  if (normalized === "usually under target") {
    return "Under budget";
  }

  if (normalized === "usually above target") {
    return "Above budget";
  }

  if (normalized === "flexible pricing") {
    return "Flexible price";
  }

  return label;
}

function getFeaturedLazadaCardTypeLabel(product: WishlistFeaturedProductCard): string {
  return getFriendlyLazadaLabel(
    product.recommendationCaption ||
    (product.catalogSource === "catalog-product"
      ? "Ready on Lazada"
      : "Browse similar items")
  );
}

function getFeaturedLazadaRoleLabel(index: number): string {
  if (index === 0) {
    return "Best Match";
  }

  if (index === 1) {
    return "Budget Pick";
  }

  return "Premium Option";
}

function getFeaturedLazadaToneStyle(
  product: WishlistFeaturedProductCard
): {
  badgeBackground: string;
  badgeColor: string;
  chipBackground: string;
  chipColor: string;
  panelBackground: string;
} {
  switch (product.recommendationTone) {
    case "berry":
      return {
        badgeBackground: "rgba(164,60,63,.12)",
        badgeColor: HOLIDAY_RED,
        chipBackground: "rgba(164,60,63,.08)",
        chipColor: HOLIDAY_RED,
        panelBackground: "rgba(255,244,244,.82)",
      };
    case "gold":
      return {
        badgeBackground: "rgba(252,206,114,.34)",
        badgeColor: "#7b5902",
        chipBackground: "rgba(252,206,114,.28)",
        chipColor: "#6b4d00",
        panelBackground: "rgba(255,248,237,.84)",
      };
    case "ink":
      return {
        badgeBackground: "rgba(46,52,50,.08)",
        badgeColor: PAGE_TEXT_COLOR,
        chipBackground: "rgba(46,52,50,.06)",
        chipColor: PAGE_TEXT_COLOR,
        panelBackground: "rgba(246,247,246,.9)",
      };
    default:
      return {
        badgeBackground: "rgba(72,102,78,.12)",
        badgeColor: HOLIDAY_GREEN,
        chipBackground: "rgba(72,102,78,.08)",
        chipColor: HOLIDAY_GREEN,
        panelBackground: "rgba(240,246,241,.88)",
      };
  }
}

function getCuratedLazadaToneStyle(index: number): {
  badgeBackground: string;
  badgeColor: string;
  chipBackground: string;
  chipColor: string;
  panelBackground: string;
} {
  if (index === 1) {
    return {
      badgeBackground: "#f7e8bd",
      badgeColor: "#7b5902",
      chipBackground: "rgba(252,206,114,.22)",
      chipColor: "#6b4d00",
      panelBackground: "rgba(255,248,237,.84)",
    };
  }

  if (index >= 2) {
    return {
      badgeBackground: "#e6e8e5",
      badgeColor: PAGE_TEXT_COLOR,
      chipBackground: "rgba(46,52,50,.06)",
      chipColor: PAGE_TEXT_COLOR,
      panelBackground: "rgba(246,247,246,.9)",
    };
  }

  return {
    badgeBackground: "#e5eee7",
    badgeColor: HOLIDAY_GREEN,
    chipBackground: "rgba(72,102,78,.08)",
    chipColor: HOLIDAY_GREEN,
    panelBackground: "rgba(240,246,241,.88)",
  };
}

function getFeaturedLazadaButtonLabel(product: WishlistFeaturedProductCard): string {
  return product.catalogSource === "catalog-product" ? "Open Lazada" : "Browse Lazada";
}

function getDisplayableLazadaProducts(
  products: WishlistFeaturedProductCard[]
): WishlistFeaturedProductCard[] {
  return products;
}

function getFirstProductImageUrl(products: WishlistFeaturedProductCard[]): string {
  for (const product of products) {
    const imageUrl = normalizeOptionalUrl(product.imageUrl || "");

    if (imageUrl) {
      return imageUrl;
    }
  }

  return "";
}

function getWishlistMatchedImageUrl(input: {
  itemId: string;
  matchedProductsByKey: Record<string, LazadaFeaturedProductsState>;
  preferredMatchKey: string;
  region: ShoppingRegion;
}): string {
  const orderedKeys = [
    input.preferredMatchKey,
    ...Object.keys(input.matchedProductsByKey).filter(
      (key) =>
        key !== input.preferredMatchKey &&
        key.startsWith(`${input.itemId}:`) &&
        key.endsWith(`:${input.region}`)
    ),
  ].filter((key) => key.length > 0);

  for (const matchKey of orderedKeys) {
    const imageUrl = getFirstProductImageUrl(
      input.matchedProductsByKey[matchKey]?.products || []
    );

    if (imageUrl) {
      return imageUrl;
    }
  }

  return "";
}

function getMerchantBadgeStyle(
  merchant: string,
  isPartnerLink: boolean
): {
  background: string;
  color: string;
} {
  if (!isPartnerLink) {
    return {
      background: "rgba(88,116,142,.1)",
      color: HOLIDAY_BLUE,
    };
  }

  switch (merchant) {
    case "amazon":
      return {
        background: "rgba(245,158,11,.14)",
        color: "#92400e",
      };
    case "lazada":
      return {
        background: "rgba(245,158,11,.14)",
        color: "#b45309",
      };
    case "shopee":
      return {
        background: "rgba(238,77,45,.12)",
        color: "#c2410c",
      };
    default:
      return {
        background: "rgba(47,107,86,.12)",
        color: HOLIDAY_GREEN,
      };
  }
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
  const [loading, setLoading] = useState(true);

  // Page-level feedback and action state.
  const [message, setMessage] = useState<ActionMessage>(null);
  const [updatingPrepGroup, setUpdatingPrepGroup] = useState<string | null>(null);
  const [confirmingGroup, setConfirmingGroup] = useState<string | null>(null);
  const [activeRecipientItemByAssignment, setActiveRecipientItemByAssignment] = useState<
    Record<string, string>
  >({});
  const [
    expandedRecipientWishlistByAssignment,
    setExpandedRecipientWishlistByAssignment,
  ] = useState<Record<string, boolean>>({});
  const [activeGuideTabByAssignment, setActiveGuideTabByAssignment] = useState<
    Record<string, GuideTabId>
  >({});
  const [selectedRecipientSuggestionByItem, setSelectedRecipientSuggestionByItem] = useState<
    Record<string, string>
  >({});
  const [aiSuggestionStateByItem, setAiSuggestionStateByItem] = useState<
    Record<string, AiSuggestionState>
  >({});
  const [suggestionDisplayOrderByItem, setSuggestionDisplayOrderByItem] = useState<
    Record<string, string[]>
  >({});
  const aiSuggestionStartedItemsRef = useRef<Set<string>>(new Set());
  const [matchedLazadaProductsByKey, setMatchedLazadaProductsByKey] = useState<
    Record<string, LazadaFeaturedProductsState>
  >({});
  // These shopping preferences are page-level on purpose so the giver can set
  // them once and reuse them across every giftee item on the screen.
  const [shoppingRegion, setShoppingRegion] = useState<ShoppingRegion>("GLOBAL");
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const lazadaPrimedKeysRef = useRef<Set<string>>(new Set());
  const matchedLazadaProductsByKeyRef = useRef(matchedLazadaProductsByKey);

  useEffect(() => {
    if (!prefetchedRoutesRef.current.has("/dashboard")) {
      prefetchedRoutesRef.current.add("/dashboard");
      router.prefetch("/dashboard");
    }

    if (!prefetchedRoutesRef.current.has("/wishlist")) {
      prefetchedRoutesRef.current.add("/wishlist");
      router.prefetch("/wishlist");
    }
  }, [router]);

  useEffect(() => {
    if (!prefetchedRoutesRef.current.has("/secret-santa-chat")) {
      prefetchedRoutesRef.current.add("/secret-santa-chat");
      router.prefetch("/secret-santa-chat");
    }

    const groupIds = new Set<string>();

    for (const group of availableGroups) {
      groupIds.add(group.id);
    }

    for (const assignment of assignments) {
      groupIds.add(assignment.group_id);
    }

    // Prefetch only the first few likely navigation targets to avoid warming
    // dozens of routes on large group lists.
    for (const groupId of Array.from(groupIds).slice(0, MAX_GROUP_ROUTE_PREFETCH)) {
      const route = `/group/${groupId}`;

      if (prefetchedRoutesRef.current.has(route)) {
        continue;
      }

      prefetchedRoutesRef.current.add(route);
      router.prefetch(route);
    }
  }, [router, availableGroups, assignments]);

  useEffect(() => {
    const savedRegion = window.localStorage.getItem("secret-santa-shopping-region");

    if (savedRegion && SHOPPING_REGION_OPTIONS.some((option) => option.value === savedRegion)) {
      setShoppingRegion(savedRegion as ShoppingRegion);
    } else {
      setShoppingRegion(
        detectShoppingRegionFromLocale(navigator.language, availableGroups[0]?.currency || null)
      );
    }
  }, [availableGroups]);

  useEffect(() => {
    window.localStorage.setItem("secret-santa-shopping-region", shoppingRegion);
  }, [shoppingRegion]);

  useEffect(() => {
    matchedLazadaProductsByKeyRef.current = matchedLazadaProductsByKey;
  }, [matchedLazadaProductsByKey]);

  useEffect(() => {
    const urlsToPrime = new Set<string>();

    for (const assignment of assignments) {
      for (const item of assignment.receiver_wishlist) {
        const safeItemLink = normalizeOptionalUrl(item.item_link);

        if (safeItemLink && isLazadaProductPageUrl(safeItemLink)) {
          urlsToPrime.add(safeItemLink);
        }
      }
    }
    const unprimedUrls = Array.from(urlsToPrime).filter(
      (url) => !lazadaPrimedKeysRef.current.has(`url:${url}`)
    );

    if (unprimedUrls.length === 0) {
      return;
    }

    let cancelled = false;

    const primeLazadaLinks = async () => {
      try {
        const response = await fetch("/api/affiliate/lazada/prime-links", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            urls: unprimedUrls,
          }),
        });

        if (!response.ok || cancelled) {
          return;
        }

        for (const url of unprimedUrls) {
          lazadaPrimedKeysRef.current.add(`url:${url}`);
        }
      } catch {
        // Priming is a performance improvement only. Click-time resolution still works.
      }
    };

    void primeLazadaLinks();

    return () => {
      cancelled = true;
    };
  }, [assignments]);

  useEffect(() => {
    if (shoppingRegion !== "PH") {
      return;
    }

    const pendingTargets: Array<{
      assignment: RecipientData;
      item: WishlistItem;
    }> = [];

    for (const assignment of assignments) {
      const activeItemId = getActiveRecipientWishlistItemId(
        assignment,
        activeRecipientItemByAssignment
      );

      if (!activeItemId) {
        continue;
      }

      const matchingItem =
        assignment.receiver_wishlist.find(
          (wishlistItem) => wishlistItem.id === activeItemId
        ) || null;

      if (!matchingItem || aiSuggestionStartedItemsRef.current.has(matchingItem.id)) {
        continue;
      }

      pendingTargets.push({
        assignment,
        item: matchingItem,
      });
    }

    if (pendingTargets.length === 0) {
      return;
    }

    for (const pendingTarget of pendingTargets) {
      aiSuggestionStartedItemsRef.current.add(pendingTarget.item.id);
    }

    let cancelled = false;

    setAiSuggestionStateByItem((current) => {
      const nextState = { ...current };

      for (const pendingTarget of pendingTargets) {
        nextState[pendingTarget.item.id] = {
          loaded: false,
          loading: true,
          options: current[pendingTarget.item.id]?.options || [],
          usedAi: false,
        };
      }

      return nextState;
    });

    const loadAiSuggestions = async (
      targetAssignment: RecipientData,
      targetItem: WishlistItem
    ) => {
      const suggestionInput = buildRecipientSuggestionInput(targetAssignment, targetItem);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), AI_SUGGESTION_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch("/api/ai/wishlist-suggestions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            ...suggestionInput,
            region: shoppingRegion,
          }),
        });

        const payload = response.ok
          ? ((await response.json()) as {
              suggestions?: WishlistSuggestionOption[];
              usedAi?: boolean;
            })
          : { suggestions: [], usedAi: false };

        if (cancelled) {
          return;
        }

        setAiSuggestionStateByItem((current) => ({
          ...current,
          [targetItem.id]: {
            loaded: true,
            loading: false,
            options: Array.isArray(payload.suggestions) ? payload.suggestions : [],
            usedAi: Boolean(payload.usedAi),
          },
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setAiSuggestionStateByItem((current) => ({
          ...current,
          [targetItem.id]: {
            loaded: true,
            loading: false,
            options: [],
            usedAi: false,
          },
        }));
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void Promise.all(
      pendingTargets.map(({ assignment, item }) =>
        loadAiSuggestions(assignment, item)
      )
    );

    return () => {
      cancelled = true;
    };
  }, [activeRecipientItemByAssignment, assignments, shoppingRegion]);

  useEffect(() => {
    setSuggestionDisplayOrderByItem((current) => {
      let changed = false;
      const nextState = { ...current };
      const activeItemIds = new Set<string>();

      for (const assignment of assignments) {
        for (const item of assignment.receiver_wishlist) {
          activeItemIds.add(item.id);

          const aiSuggestionState = aiSuggestionStateByItem[item.id] || null;

          if (shoppingRegion === "PH" && aiSuggestionState?.loading) {
            continue;
          }

          const suggestionInput = buildRecipientSuggestionInput(assignment, item);
          const nextOrder = mergeWishlistSuggestionOptions(
            buildWishlistSuggestionOptions(suggestionInput),
            aiSuggestionState?.options || []
          ).map((suggestion) => suggestion.id);

          if (nextOrder.length === 0) {
            continue;
          }

          const currentOrder = current[item.id] || [];
          const mergedOrder = mergeSuggestionDisplayOrder(currentOrder, nextOrder);

          if (
            currentOrder.length !== mergedOrder.length ||
            currentOrder.some((id, index) => id !== mergedOrder[index])
          ) {
            nextState[item.id] = mergedOrder;
            changed = true;
          }
        }
      }

      for (const itemId of Object.keys(nextState)) {
        if (!activeItemIds.has(itemId)) {
          delete nextState[itemId];
          changed = true;
        }
      }

      return changed ? nextState : current;
    });
  }, [aiSuggestionStateByItem, assignments, shoppingRegion]);

  useEffect(() => {
    setSelectedRecipientSuggestionByItem((current) => {
      let changed = false;
      const nextState = { ...current };

      for (const assignment of assignments) {
        for (const wishlistItem of assignment.receiver_wishlist) {
          if (nextState[wishlistItem.id]) {
            continue;
          }

          const aiSuggestionState = aiSuggestionStateByItem[wishlistItem.id] || null;

          if (shoppingRegion === "PH" && aiSuggestionState?.loading) {
            continue;
          }

          const suggestionInput = buildRecipientSuggestionInput(
            assignment,
            wishlistItem
          );
          const suggestionOptions = applySuggestionDisplayOrder(
            mergeWishlistSuggestionOptions(
              buildWishlistSuggestionOptions(suggestionInput),
              aiSuggestionState?.options || []
            ),
            suggestionDisplayOrderByItem[wishlistItem.id] || []
          );
          const defaultSuggestion = suggestionOptions[0] || null;

          if (defaultSuggestion) {
            nextState[wishlistItem.id] = defaultSuggestion.id;
            changed = true;
          }
        }
      }

      return changed ? nextState : current;
    });
  }, [
    aiSuggestionStateByItem,
    assignments,
    shoppingRegion,
    suggestionDisplayOrderByItem,
  ]);

  useEffect(() => {
    if (shoppingRegion !== "PH") {
      return;
    }

    const pendingRequests: Array<{
      body: Record<string, string | number | null>;
      requestKey: string;
    }> = [];

    for (const assignment of assignments) {
      for (const item of assignment.receiver_wishlist) {
        const selectedSuggestionId = selectedRecipientSuggestionByItem[item.id] || "";

        if (!selectedSuggestionId) {
          continue;
        }

        const suggestionInput = buildRecipientSuggestionInput(assignment, item);
        const suggestionOptions = applySuggestionDisplayOrder(
          mergeWishlistSuggestionOptions(
            buildWishlistSuggestionOptions(suggestionInput),
            aiSuggestionStateByItem[item.id]?.options || [],
            selectedSuggestionId
          ),
          suggestionDisplayOrderByItem[item.id] || []
        );
        const selectedSuggestion =
          suggestionOptions.find((suggestion) => suggestion.id === selectedSuggestionId) || null;

        if (!selectedSuggestion) {
          continue;
        }

        const requestKey = createLazadaMatchRequestKey(
          item.id,
          selectedSuggestion.id,
          shoppingRegion
        );

        const existingMatchState = matchedLazadaProductsByKeyRef.current[requestKey];

        if (existingMatchState && !existingMatchState.loading) {
          continue;
        }

        pendingRequests.push({
          requestKey,
          body: {
            groupBudget: assignment.group_budget,
            groupId: assignment.group_id,
            itemCategory: item.item_category,
            itemName: item.item_name,
            itemNote: item.item_note,
            preferredPriceMax: null,
            preferredPriceMin: null,
            region: shoppingRegion,
            searchQuery: selectedSuggestion.searchQuery,
            wishlistItemId: item.id,
          },
        });
      }
    }

    if (pendingRequests.length === 0) {
      return;
    }

    let cancelled = false;

    setMatchedLazadaProductsByKey((current) => {
      const nextState = { ...current };

      for (const request of pendingRequests) {
        if (!nextState[request.requestKey]) {
          nextState[request.requestKey] = {
            loading: true,
            products: [],
          };
        }
      }

      return nextState;
    });

    const loadLazadaMatches = async () => {
      await Promise.all(
        pendingRequests.map(async (requestEntry) => {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 12000);

          try {
            const response = await fetch("/api/affiliate/lazada/matches", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              signal: controller.signal,
              body: JSON.stringify(requestEntry.body),
            });

            const payload = response.ok
              ? ((await response.json()) as {
                  products?: WishlistFeaturedProductCard[];
                })
              : { products: [] };

            if (cancelled) {
              return;
            }

            setMatchedLazadaProductsByKey((current) => ({
              ...current,
              [requestEntry.requestKey]: {
                loading: false,
                products: Array.isArray(payload.products) ? payload.products : [],
              },
            }));
          } catch {
            if (cancelled) {
              return;
            }

            setMatchedLazadaProductsByKey((current) => ({
              ...current,
              [requestEntry.requestKey]: {
                loading: false,
                products: [],
              },
            }));
          } finally {
            window.clearTimeout(timeoutId);
          }
        })
      );
    };

    void loadLazadaMatches();

    return () => {
      cancelled = true;
    };
  }, [
    aiSuggestionStateByItem,
    assignments,
    selectedRecipientSuggestionByItem,
    shoppingRegion,
    suggestionDisplayOrderByItem,
  ]);

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
          setLoading(false);
          return;
        }

        const [
          { data: groupsData, error: groupsError },
          { data: myAssignments, error: myAssignmentsError },
          { data: receivedAssignments, error: receivedAssignmentsError },
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
        ]);

        const primaryError = groupsError || myAssignmentsError || receivedAssignmentsError;
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
      } catch {
        if (!isMounted) {
          return;
        }

        setAvailableGroups([]);
        setAssignments([]);
        setReceivedGifts([]);
        setMessage({
          type: "error",
          text: "We could not load your Secret Santa details. Please refresh the page.",
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
        text: "We could not update your gift progress. Please try again.",
      });
    } finally {
      setUpdatingPrepGroup(null);
    }
  };

  const handleConfirmGift = async (groupId: string) => {
    if (!confirm("Confirm that you received your gift? You cannot undo this later.")) {
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
        text: "We could not confirm your gift yet. Please try again.",
      });
    } finally {
      setConfirmingGroup(null);
    }
  };

  // Each recipient card keeps one active wishlist item in view.
  // That lets the item list stay visible while the shopping panel updates beside it.
  const selectRecipientWishlistItem = (groupId: string, itemId: string) => {
    setActiveRecipientItemByAssignment((current) => ({
      ...current,
      [groupId]: itemId,
    }));
  };

  const selectGuideTab = (groupId: string, tabId: GuideTabId) => {
    setActiveGuideTabByAssignment((current) => ({
      ...current,
      [groupId]: tabId,
    }));
  };

  const toggleRecipientWishlistExpansion = (groupId: string) => {
    setExpandedRecipientWishlistByAssignment((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  // We keep the selected option per item so switching between wishlist cards
  // does not throw away what the giver was comparing.
  const selectRecipientSuggestion = (itemId: string, suggestionId: string) => {
    setSelectedRecipientSuggestionByItem((current) => ({
      ...current,
      [itemId]: suggestionId,
    }));
  };

  if (loading) {
    return <SecretSantaSkeleton />;
  }

  const assignmentGroupCount = new Set(assignments.map((assignment) => assignment.group_id)).size;
  const pageRegionLabel =
    SHOPPING_REGION_OPTIONS.find((option) => option.value === shoppingRegion)?.label ||
    shoppingRegion;

  return (
    <main
      className="min-h-screen relative overflow-x-clip"
      style={{
        background: PAGE_BACKGROUND,
        fontFamily: "'Be Vietnam Pro', 'Nunito', sans-serif",
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

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
        {/* Primary navigation back to the dashboard. */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold transition hover:-translate-y-0.5 sm:w-auto"
          style={{
            color: HOLIDAY_GREEN,
            background: "rgba(255,255,255,.74)",
            border: "1px solid rgba(174,179,177,.14)",
            boxShadow: "0 18px 42px rgba(46,52,50,.06)",
            backdropFilter: "blur(18px)",
            fontFamily: "inherit",
          }}
        >
          ← Back to Dashboard
        </button>

        <section
          className="relative mb-4 overflow-hidden rounded-[30px] p-4 sm:p-5 lg:p-6"
          style={{
            background:
              "linear-gradient(135deg,rgba(255,255,255,.94),rgba(236,239,236,.86) 48%,rgba(255,245,229,.74))",
            border: "1px solid rgba(174,179,177,.09)",
            boxShadow: "0 22px 54px rgba(46,52,50,.07)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div>
              <div
                className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase"
                style={{
                  background: "rgba(215,250,219,.72)",
                  color: HOLIDAY_GREEN,
                }}
              >
                <GiftMark className="h-4 w-4" />
                Gift room
              </div>
              <h1
                className="max-w-none text-[32px] font-black leading-[0.98] sm:text-[42px] lg:text-[42px] xl:text-[48px] min-[1180px]:whitespace-nowrap"
                style={{
                  fontFamily: "'Plus Jakarta Sans', 'Fredoka', sans-serif",
                  color: PAGE_TEXT_COLOR,
                }}
              >
                Find a Secret Santa gift they will like.
              </h1>
              <p
                className="mt-2 max-w-2xl text-[13px] font-semibold leading-relaxed sm:text-[15px]"
                style={{ color: TEXT_MUTED }}
              >
                Pick one wishlist idea, choose a shopping option, then open Lazada with your
                recipient and budget still in view.
              </p>
            </div>

            <div
              className="relative rounded-[22px] p-4"
              style={{
                background: "rgba(255,255,255,.72)",
                border: "1px solid rgba(174,179,177,.12)",
                boxShadow: "0 14px 34px rgba(46,52,50,.05)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase"
                  style={{ background: "rgba(164,60,63,.1)", color: HOLIDAY_RED }}
                >
                  Today&apos;s list
                </span>
                <SparkleMark className="h-5 w-5" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[26px] font-black leading-none">
                    {assignments.length}
                  </div>
                  <div className="mt-1 text-[11px] font-bold" style={{ color: TEXT_MUTED }}>
                    recipient{assignments.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div>
                  <div className="text-[26px] font-black leading-none">
                    {assignmentGroupCount}
                  </div>
                  <div className="mt-1 text-[11px] font-bold" style={{ color: TEXT_MUTED }}>
                    group{assignmentGroupCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Header content and recipient summary. */}
        <div className="hidden">
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
            Plan gifts for your recipients across every event
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

        <div
          className="mb-5 rounded-[28px] p-4 sm:p-5"
          style={{
            background:
              "linear-gradient(135deg,rgba(236,239,236,.82),rgba(255,255,255,.78))",
            border: "1px solid rgba(174,179,177,.13)",
            boxShadow: "0 18px 42px rgba(46,52,50,.05)",
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: "rgba(164,60,63,.1)",
                  color: HOLIDAY_RED,
                }}
              >
                <GiftMark className="h-5 w-5" />
              </div>
              <div>
                <div
                  className="text-[15px] font-extrabold"
                  style={{ color: HOLIDAY_GREEN }}
                >
                  Shopping region
                </div>
                <div
                  className="mt-1 max-w-2xl text-[12px] leading-relaxed"
                  style={{ color: TEXT_MUTED }}
                >
                  Using {pageRegionLabel} for Lazada gift ideas and backup store links.
                </div>
              </div>
            </div>

            <label className="block w-full lg:max-w-[340px]">
              <div
                className="mb-1 text-[10px] font-extrabold uppercase"
                style={{ color: TEXT_MUTED }}
              >
                Online shop region
              </div>
              <select
                value={shoppingRegion}
                onChange={(event) =>
                  setShoppingRegion(event.target.value as ShoppingRegion)
                }
                className="w-full rounded-full px-4 py-3 text-[13px] font-extrabold"
                style={{
                  background: INPUT_BACKGROUND,
                  border: INPUT_BORDER,
                  color: INPUT_TEXT,
                  fontFamily: "inherit",
                  boxShadow: "0 12px 28px rgba(46,52,50,.04)",
                }}
              >
                {SHOPPING_REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[11px]" style={{ color: TEXT_SOFT }}>
                {
                  SHOPPING_REGION_OPTIONS.find(
                    (option) => option.value === shoppingRegion
                  )?.helper
                }
              </div>
            </label>
          </div>
        </div>

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
              When a group owner draws names, the people you are gifting will appear here.
            </p>
          </div>
        ) : (
          <div className="mb-8 flex flex-col gap-10">
            {assignments.map((assignment, index) => (
              <div
                key={assignment.group_id}
                className="overflow-visible rounded-[34px] transition"
                style={{
                  background: "rgba(249,250,248,.36)",
                  boxShadow: "0 22px 58px rgba(46,52,50,.045)",
                  backdropFilter: "blur(18px)",
                }}
              >
                <div
                  className="flex flex-col gap-4 rounded-t-[34px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                  style={{
                    background: "rgba(255,255,255,.66)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-[22px] text-[24px]"
                      style={{ background: ICON_COLORS[index % ICON_COLORS.length] }}
                    >
                      {ICON_EMOJIS[index % ICON_EMOJIS.length]}
                    </div>
                    <div>
                      <div
                        className="text-[20px] font-black leading-tight"
                        style={{ fontFamily: "'Plus Jakarta Sans', 'Fredoka', sans-serif" }}
                      >
                        {assignment.group_name}
                      </div>
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: TEXT_MUTED }}
                      >
                        📅 {formatDisplayDate(assignment.group_event_date)}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold text-white"
                    style={{
                      background: "linear-gradient(135deg,#a43c3f,#7b5902)",
                      boxShadow: "0 16px 34px rgba(164,60,63,.16)",
                    }}
                  >
                    🎁→ {assignment.receiver_nickname}
                  </div>
                </div>

                <div className="min-w-0 p-4 sm:p-6">
                  <nav
                    aria-label={`${assignment.receiver_nickname} gift guide sections`}
                    className="mb-6 flex gap-7 overflow-x-auto px-1 pb-2 text-[13px] font-extrabold"
                    style={{ color: HOLIDAY_GREEN }}
                  >
                    {GUIDE_TABS.map((tab) => {
                      const isActive =
                        (activeGuideTabByAssignment[assignment.group_id] ||
                          "matches") === tab.id;

                      return (
                        <a
                          key={tab.id}
                          href={`#${tab.id}-${assignment.group_id}`}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => selectGuideTab(assignment.group_id, tab.id)}
                          className="relative shrink-0 pb-2"
                          style={{
                            color: isActive ? HOLIDAY_RED : HOLIDAY_GREEN,
                            textDecoration: "none",
                          }}
                        >
                          {tab.label}
                          {isActive && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                              style={{ background: HOLIDAY_RED }}
                            />
                          )}
                        </a>
                      );
                    })}
                  </nav>
                  <div className="hidden">
                    <p
                      className="text-[15px] font-extrabold"
                      style={{ color: HOLIDAY_GREEN }}
                    >
                      🎅 {assignment.receiver_nickname}&apos;s wishlist
                    </p>
                    <span
                      className="rounded-full px-3 py-1 text-[10px] font-extrabold"
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
                    (() => {
                      const activeItemId = getActiveRecipientWishlistItemId(
                        assignment,
                        activeRecipientItemByAssignment
                      );
                      const activeItem =
                        assignment.receiver_wishlist.find(
                          (wishlistItem) => wishlistItem.id === activeItemId
                        ) ||
                        assignment.receiver_wishlist[0] ||
                        null;

                      if (!activeItem) {
                        return null;
                      }

                      const item = activeItem;
                      const safeItemImageUrl = normalizeOptionalUrl(item.item_image_url);
                      const priorityMeta = getWishlistPriorityMeta(item.priority);
                      const selectedSuggestionId =
                        selectedRecipientSuggestionByItem[item.id] || "";
                      const suggestionInput = buildRecipientSuggestionInput(assignment, item);
                      const aiSuggestionState = aiSuggestionStateByItem[item.id] || null;
                      const suggestionOptions = applySuggestionDisplayOrder(
                        mergeWishlistSuggestionOptions(
                          buildWishlistSuggestionOptions(suggestionInput),
                          aiSuggestionState?.options || [],
                          selectedSuggestionId
                        ),
                        suggestionDisplayOrderByItem[item.id] || []
                      );
                      const selectedSuggestion =
                        suggestionOptions.find(
                          (suggestion) => suggestion.id === selectedSuggestionId
                        ) || null;
                      const merchantLinks = selectedSuggestion
                        ? buildWishlistMerchantLinks(
                            selectedSuggestion,
                            assignment.group_id,
                            item.id,
                            shoppingRegion
                          )
                        : [];
                      const backupMerchantLinks = merchantLinks.filter(
                        (merchantLink) => merchantLink.merchant !== "lazada"
                      );
                      const fallbackFeaturedLazadaProducts = selectedSuggestion
                        ? buildWishlistFeaturedLazadaProducts({
                            option: selectedSuggestion,
                            groupId: assignment.group_id,
                            wishlistItemId: item.id,
                            itemName: item.item_name,
                            itemCategory: item.item_category,
                            itemNote: item.item_note,
                            preferredPriceMin: null,
                            preferredPriceMax: null,
                            groupBudget: assignment.group_budget,
                            currency: assignment.group_currency,
                            region: shoppingRegion,
                          })
                        : [];
                      const lazadaMatchRequestKey = selectedSuggestion
                        ? createLazadaMatchRequestKey(
                            item.id,
                            selectedSuggestion.id,
                            shoppingRegion
                          )
                        : "";
                      const lazadaMatchedProductsState = lazadaMatchRequestKey
                        ? matchedLazadaProductsByKey[lazadaMatchRequestKey] || null
                        : null;
                      const lazadaMatchesLoading = Boolean(
                        lazadaMatchedProductsState?.loading
                      );
                      const activeGroupBudgetLabel =
                        assignment.group_budget !== null
                          ? formatPriceRange(
                              assignment.group_budget,
                              assignment.group_budget,
                              assignment.group_currency
                            )
                          : null;
                      const rawMatchedLazadaProducts =
                        lazadaMatchedProductsState?.products || [];
                      const displayableMatchedLazadaProducts =
                        getDisplayableLazadaProducts(rawMatchedLazadaProducts);
                      const displayableFallbackLazadaProducts =
                        getDisplayableLazadaProducts(fallbackFeaturedLazadaProducts);
                      const featuredLazadaProducts =
                        lazadaMatchesLoading
                          ? []
                          : displayableMatchedLazadaProducts.length > 0
                            ? displayableMatchedLazadaProducts
                            : displayableFallbackLazadaProducts;
                      const isWishlistExpanded = Boolean(
                        expandedRecipientWishlistByAssignment[assignment.group_id]
                      );
                      const topWishlistItems = isWishlistExpanded
                        ? assignment.receiver_wishlist
                        : assignment.receiver_wishlist.slice(
                            0,
                            MAX_VISIBLE_RECIPIENT_WISHLIST_ITEMS
                          );
                      const visibleWishlistItems = isWishlistExpanded
                        ? topWishlistItems
                        : topWishlistItems.some(
                              (wishlistItem) => wishlistItem.id === item.id
                            )
                          ? topWishlistItems
                          : [item, ...topWishlistItems].slice(
                              0,
                              MAX_VISIBLE_RECIPIENT_WISHLIST_ITEMS
                            );
                      const primaryFeaturedLazadaProduct =
                        (lazadaMatchesLoading
                          ? displayableFallbackLazadaProducts[0]
                          : featuredLazadaProducts[0]) || null;
                      const heroLazadaImageUrl = normalizeOptionalUrl(
                        primaryFeaturedLazadaProduct?.imageUrl || safeItemImageUrl
                      );
                      const heroLazadaTitle =
                        primaryFeaturedLazadaProduct?.title || item.item_name;
                      const heroLazadaCopy = summarizeCardCopy(
                        primaryFeaturedLazadaProduct?.whyItFits ||
                          primaryFeaturedLazadaProduct?.subtitle ||
                          item.item_note ||
                          `Start with ${item.item_name}, then compare the strongest Lazada options for this recipient.`,
                        150
                      );
                      const heroLazadaPriceLabel =
                        primaryFeaturedLazadaProduct?.priceLabel ||
                        selectedSuggestion?.priceLabel ||
                        activeGroupBudgetLabel ||
                        "";
                      const heroLazadaTags = [
                        getFriendlyLazadaLabel(
                          primaryFeaturedLazadaProduct?.fitLabel ||
                            selectedSuggestion?.fitLabel ||
                            ""
                        ),
                        heroLazadaPriceLabel,
                      ]
                        .filter(
                          (tag): tag is string =>
                            typeof tag === "string" && tag.trim().length > 0
                        )
                        .slice(0, 3);
                      const heroLazadaHref =
                        primaryFeaturedLazadaProduct?.href || null;
                      const heroLazadaButtonLabel = primaryFeaturedLazadaProduct
                        ? getFeaturedLazadaButtonLabel(primaryFeaturedLazadaProduct)
                        : "Browse Lazada";
                      const directLazadaMatchCount =
                        displayableMatchedLazadaProducts.filter(
                          (product) => product.catalogSource === "catalog-product"
                        ).length;
                      const heroLazadaRoleLabel = "Most Wanted";
                      const heroLazadaCaption =
                        getFriendlyLazadaLabel(
                          primaryFeaturedLazadaProduct?.recommendationCaption ||
                            (primaryFeaturedLazadaProduct?.catalogSource ===
                            "catalog-product"
                              ? "Ready on Lazada"
                              : "Browse similar items")
                        );
                      const heroLazadaToneStyle = primaryFeaturedLazadaProduct
                        ? getFeaturedLazadaToneStyle(primaryFeaturedLazadaProduct)
                        : null;
                      const heroLazadaAssistantNote = lazadaMatchesLoading
                        ? "Ready-to-browse picks stay visible while we check the live Lazada catalog."
                        : directLazadaMatchCount > 0
                          ? `Live Lazada feed found ${directLazadaMatchCount} direct ${
                              directLazadaMatchCount === 1
                                ? "product match"
                                : "product matches"
                            } for this focus.`
                          : "No exact product match yet, so these picks open Lazada with helpful search terms.";
                      const curatedLazadaCardPool = [
                        ...featuredLazadaProducts,
                        ...displayableMatchedLazadaProducts,
                        ...displayableFallbackLazadaProducts,
                      ].filter(
                        (product, index, array) =>
                          array.findIndex(
                            (candidate) =>
                              candidate.id === product.id ||
                              candidate.href === product.href
                          ) === index
                      );
                      const curatedLazadaCards = curatedLazadaCardPool
                        .filter((product) => {
                          if (!primaryFeaturedLazadaProduct) {
                            return true;
                          }

                          return (
                            product.id !== primaryFeaturedLazadaProduct.id &&
                            product.href !== primaryFeaturedLazadaProduct.href
                          );
                        })
                        .slice(0, 3);
                      const curatedFallbackImageUrl =
                        getFirstProductImageUrl([
                          ...displayableMatchedLazadaProducts,
                          ...featuredLazadaProducts,
                          ...displayableFallbackLazadaProducts,
                        ]) ||
                        heroLazadaImageUrl ||
                        safeItemImageUrl;

                      return (
                        <div
                          className="grid min-w-0 gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]"
                          style={{ alignItems: "start" }}
                        >
                          <div
                            id={`wishlist-${assignment.group_id}`}
                            data-testid="recipient-wishlist-rail"
                            className="self-start space-y-4 rounded-[44px] p-5 sm:p-7 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain"
                            style={{
                              background: "rgba(236,239,236,.92)",
                              boxShadow: "0 24px 56px rgba(46,52,50,.05)",
                            }}
                          >
                            <div className="mb-4 flex items-center justify-between gap-4">
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                                  style={{ color: HOLIDAY_GREEN }}
                                >
                                  <GiftMark className="h-5 w-5" />
                                </span>
                                <div
                                  className="min-w-0 truncate whitespace-nowrap text-[18px] font-black leading-tight"
                                  style={{
                                    color: PAGE_TEXT_COLOR,
                                    fontFamily:
                                      "'Plus Jakarta Sans', 'Fredoka', sans-serif",
                                  }}
                                >
                                  {assignment.receiver_nickname}&apos;s Wishlist
                                </div>
                              </div>
                              <span
                                className="shrink-0 rounded-full px-3 py-1 text-[10px] font-extrabold"
                                style={{
                                  background: "rgba(255,255,255,.72)",
                                  color: HOLIDAY_GREEN,
                                }}
                              >
                                {assignment.receiver_wishlist.length}
                              </span>
                            </div>

                            {visibleWishlistItems.map((wishlistItem) => {
                              const isActiveItem = wishlistItem.id === item.id;
                              const wishlistPriorityMeta =
                                getWishlistPriorityMeta(wishlistItem.priority);
                              const wishlistImageUrl = normalizeOptionalUrl(
                                wishlistItem.item_image_url
                              );
                              const wishlistSuggestionId =
                                selectedRecipientSuggestionByItem[wishlistItem.id] || "";
                              const wishlistMatchKey = wishlistSuggestionId
                                ? createLazadaMatchRequestKey(
                                    wishlistItem.id,
                                    wishlistSuggestionId,
                                    shoppingRegion
                                  )
                                : "";
                              const wishlistMatchedState = wishlistMatchKey
                                ? matchedLazadaProductsByKey[wishlistMatchKey] || null
                                : null;
                              const wishlistMatchedImageUrl =
                                getWishlistMatchedImageUrl({
                                  itemId: wishlistItem.id,
                                  matchedProductsByKey: matchedLazadaProductsByKey,
                                  preferredMatchKey: wishlistMatchKey,
                                  region: shoppingRegion,
                                });
                              const wishlistAiSuggestionState =
                                aiSuggestionStateByItem[wishlistItem.id] || null;
                              const resolvedWishlistImageUrl =
                                wishlistImageUrl || wishlistMatchedImageUrl;
                              const wishlistImageLoading = Boolean(
                                !resolvedWishlistImageUrl &&
                                  (wishlistMatchedState?.loading ||
                                    wishlistAiSuggestionState?.loading)
                              );

                              return (
                                <button
                                  key={wishlistItem.id}
                                  type="button"
                                  onClick={() =>
                                    selectRecipientWishlistItem(
                                      assignment.group_id,
                                      wishlistItem.id
                                    )
                                  }
                                  className="w-full rounded-[30px] p-4 text-left transition hover:-translate-y-0.5 sm:p-5"
                                  style={{
                                    background: isActiveItem
                                      ? "#ffffff"
                                      : "rgba(255,255,255,.48)",
                                    outline: isActiveItem
                                      ? "1px solid rgba(164,60,63,.2)"
                                      : "1px solid rgba(255,255,255,.58)",
                                    boxShadow: isActiveItem
                                      ? "0 18px 38px rgba(164,60,63,.08)"
                                      : "none",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                  }}
                                >
                                  <div className="flex items-center gap-4">
                                    <div
                                      className="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-[19px] sm:h-[72px] sm:w-[72px]"
                                      style={{
                                        background: "rgba(255,255,255,.88)",
                                        border: "1px solid rgba(174,179,177,.08)",
                                      }}
                                    >
                                      {resolvedWishlistImageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={resolvedWishlistImageUrl}
                                          alt={wishlistItem.item_name}
                                          className="h-full w-full object-contain p-1.5"
                                        />
                                      ) : wishlistImageLoading ? (
                                        <span
                                          aria-label={`Finding image for ${wishlistItem.item_name}`}
                                          className="block h-full w-full animate-pulse rounded-[9px]"
                                          role="img"
                                          style={{
                                            background:
                                              "linear-gradient(135deg,rgba(255,255,255,.7),rgba(224,230,225,.9),rgba(255,255,255,.68))",
                                          }}
                                        />
                                      ) : (
                                        wishlistPriorityMeta.icon
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div
                                            className="text-[15px] font-extrabold leading-tight"
                                            style={{
                                              color: PAGE_TEXT_COLOR,
                                              display: "-webkit-box",
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: "vertical",
                                              overflow: "hidden",
                                            }}
                                          >
                                            {wishlistItem.item_name}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="mt-2 flex items-center gap-2">
                                        <span
                                          className="rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.04em]"
                                          style={{
                                            background:
                                              wishlistPriorityMeta.badgeBackground,
                                            color: wishlistPriorityMeta.badgeColor,
                                          }}
                                        >
                                          {wishlistPriorityMeta.label}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}

                            {assignment.receiver_wishlist.length >
                              MAX_VISIBLE_RECIPIENT_WISHLIST_ITEMS && (
                              <button
                                type="button"
                                onClick={() =>
                                  toggleRecipientWishlistExpansion(
                                    assignment.group_id
                                  )
                                }
                                className="mx-auto flex items-center gap-2 rounded-full px-4 py-3 text-[12px] font-extrabold transition hover:-translate-y-0.5"
                                style={{
                                  color: HOLIDAY_GREEN,
                                  fontFamily: "inherit",
                                }}
                              >
                                {isWishlistExpanded ? "Show less" : "See more"}
                                <span aria-hidden="true" className="text-[13px]">
                                  {isWishlistExpanded ? "^" : "v"}
                                </span>
                              </button>
                            )}
                          </div>

                          <div
                            id={`matches-${assignment.group_id}`}
                            className="min-w-0 self-start"
                          >
                            <div className="min-w-0 space-y-8">
                              <div className="min-w-0">
                                <h2
                                  className="text-[28px] font-extrabold leading-tight sm:text-[38px]"
                                  style={{
                                    color: PAGE_TEXT_COLOR,
                                    fontFamily:
                                      "'Plus Jakarta Sans', 'Fredoka', sans-serif",
                                  }}
                                >
                                  Shopping Picks
                                </h2>
                                <p
                                  className="mt-2 max-w-3xl text-[14px] font-medium leading-relaxed sm:text-[16px]"
                                  style={{ color: TEXT_MUTED }}
                                >
                                  Gift ideas for {assignment.receiver_nickname}, based on
                                  their wishlist, your selected option, and the group budget.
                                </p>
                                <p
                                  className="mt-1 text-[11px] font-semibold leading-relaxed sm:text-[12px]"
                                  style={{ color: TEXT_MUTED }}
                                >
                                  {LAZADA_AFFILIATE_DISCLOSURE}
                                </p>
                              </div>

                              <div className="grid min-w-0 gap-3">
                                <section
                                  id={`direction-${assignment.group_id}`}
                                  className="min-w-0 overflow-hidden rounded-[22px] p-3 sm:p-4"
                                  style={{
                                    background:
                                      "linear-gradient(135deg,rgba(242,244,242,.94),rgba(255,255,255,.88))",
                                    color: PAGE_TEXT_COLOR,
                                    boxShadow: "0 18px 42px rgba(46,52,50,.04)",
                                  }}
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <h3
                                        className="text-[15px] font-extrabold"
                                        style={{ color: HOLIDAY_GREEN }}
                                      >
                                        Shopping option
                                      </h3>
                                      <p
                                        className="mt-0.5 max-w-2xl text-[11px] leading-relaxed"
                                        style={{ color: TEXT_MUTED }}
                                      >
                                        {selectedSuggestion
                                          ? `Browsing around: ${selectedSuggestion.title}`
                                          : "Choose the kind of gift ideas you want to see."}
                                      </p>
                                    </div>
                                    <span
                                      className="w-fit rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase"
                                      style={{
                                        background: "rgba(72,102,78,.08)",
                                        color: HOLIDAY_GREEN,
                                      }}
                                    >
                                      Choose one
                                    </span>
                                  </div>

                                  <div
                                    data-testid="shopping-focus-options"
                                    className="mt-3 flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                  >
                                    {suggestionOptions.map((suggestion) => {
                                      const isSelected =
                                        suggestion.id === selectedSuggestionId;
                                      const shoppingFocusLabel =
                                        getShoppingFocusDisplayLabel(suggestion.title);

                                      return (
                                        <button
                                          key={suggestion.id}
                                          type="button"
                                          aria-label={`${shoppingFocusLabel}${
                                            isSelected ? ", selected" : ""
                                          }`}
                                          aria-pressed={isSelected}
                                          onClick={() =>
                                            selectRecipientSuggestion(
                                              item.id,
                                              suggestion.id
                                            )
                                          }
                                          className="relative inline-flex min-h-[40px] min-w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-4"
                                          style={{
                                            background: "#ffffff",
                                            borderColor: isSelected
                                              ? "rgba(164,60,63,.28)"
                                              : "rgba(174,179,177,.13)",
                                            boxShadow: isSelected
                                              ? "0 14px 28px rgba(164,60,63,.1)"
                                              : "none",
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                            outlineColor: HOLIDAY_RED,
                                          }}
                                        >
                                          <div
                                            className="max-w-[8.5rem] truncate text-[12px] font-extrabold leading-tight sm:max-w-[9.5rem] xl:max-w-[10.5rem]"
                                            style={{
                                              color: isSelected
                                                ? HOLIDAY_RED
                                                : PAGE_TEXT_COLOR,
                                            }}
                                          >
                                            {shoppingFocusLabel}
                                          </div>
                                          {isSelected && (
                                            <span
                                              aria-hidden="true"
                                              className="absolute inset-x-4 bottom-1.5 h-0.5 rounded-full"
                                              style={{ background: HOLIDAY_RED }}
                                            />
                                          )}
                                          {!isSelected && (
                                            <span
                                              className="shrink-0 rounded-full px-2 py-1 text-[9px] font-extrabold"
                                              style={{
                                                color: TEXT_MUTED,
                                                background: "transparent",
                                              }}
                                            >
                                              Try this
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </section>

                                <div className="min-w-0 space-y-4">
                                  <div
                                    data-testid="featured-lazada-card"
                                    className="group min-w-0 overflow-hidden rounded-[22px]"
                                    style={{
                                      background:
                                        "linear-gradient(135deg,rgba(255,255,255,.98),rgba(247,249,247,.92))",
                                      boxShadow: "0 14px 34px rgba(46,52,50,.04)",
                                    }}
                                  >
                                    <div className="grid min-w-0 gap-0 md:grid-cols-[minmax(112px,140px)_minmax(0,1fr)]">
                                    <div
                                      className="relative flex min-h-[108px] min-w-0 items-center justify-center overflow-hidden bg-white p-2 text-[30px] sm:min-h-[116px] lg:min-h-[124px]"
                                      style={{
                                        borderRight: "1px solid rgba(174,179,177,.08)",
                                      }}
                                    >
                                      {heroLazadaImageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={heroLazadaImageUrl}
                                          alt={heroLazadaTitle}
                                          className="h-full max-h-[108px] w-full object-contain object-center transition duration-700 group-hover:scale-[1.02] sm:max-h-[116px] lg:max-h-[124px]"
                                        />
                                      ) : (
                                        <div
                                          className="flex h-full w-full items-center justify-center"
                                          style={{ color: HOLIDAY_GOLD }}
                                        >
                                          <SparkleMark className="h-10 w-10" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex min-w-0 flex-col justify-center p-3.5 sm:p-4">
                                      <div
                                        data-testid="featured-lazada-role-label"
                                        className="mb-2 flex w-fit self-start items-center gap-2 text-[12px] font-extrabold uppercase leading-none tracking-[0.04em] sm:text-[13px]"
                                        style={{
                                          color: "#7b5902",
                                        }}
                                      >
                                        <span aria-hidden="true">★</span>
                                        {heroLazadaRoleLabel}
                                      </div>
                                      <div
                                        className="mb-3 inline-flex w-fit rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase leading-none"
                                        style={{
                                          background: "rgba(255,255,255,.8)",
                                          color: TEXT_MUTED,
                                        }}
                                      >
                                        {heroLazadaCaption}
                                      </div>
                                      <div className="min-w-0">
                                        <h3
                                          className="text-[16px] font-extrabold leading-[1.08] sm:text-[18px] lg:text-[19px]"
                                          style={{
                                            color: PAGE_TEXT_COLOR,
                                            fontFamily:
                                              "'Plus Jakarta Sans', 'Fredoka', sans-serif",
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            overflowWrap: "anywhere",
                                          }}
                                        >
                                          {heroLazadaTitle}
                                        </h3>
                                        <p
                                          className="mt-1.5 text-[11px] font-medium leading-relaxed sm:text-[12px]"
                                          style={{
                                            color: TEXT_MUTED,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 1,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            overflowWrap: "anywhere",
                                          }}
                                        >
                                          {heroLazadaCopy}
                                        </p>
                                      </div>
                                      <div
                                        className="mt-2 truncate text-[10px] font-semibold"
                                        style={{
                                          color: TEXT_MUTED,
                                        }}
                                      >
                                        {heroLazadaAssistantNote}
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {heroLazadaTags.length > 0 ? (
                                          heroLazadaTags.map((tag) => (
                                            <span
                                              key={tag}
                                              className="max-w-full rounded-full px-3 py-1.5 text-[10px] font-extrabold leading-none"
                                              style={{
                                                background:
                                                  heroLazadaToneStyle?.chipBackground ||
                                                  "rgba(252,206,114,.88)",
                                                color:
                                                  heroLazadaToneStyle?.chipColor || "#5f4500",
                                                overflowWrap: "anywhere",
                                              }}
                                            >
                                              {tag}
                                            </span>
                                          ))
                                        ) : (
                                          <span
                                            className="max-w-full rounded-full px-3 py-1.5 text-[10px] font-extrabold leading-none"
                                            style={{
                                              background: priorityMeta.badgeBackground,
                                              color: priorityMeta.badgeColor,
                                              overflowWrap: "anywhere",
                                            }}
                                          >
                                            {priorityMeta.label}
                                          </span>
                                        )}
                                      </div>
                                      {heroLazadaHref && (
                                        <div className="mt-3">
                                          <a
                                            href={heroLazadaHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-extrabold leading-none transition hover:scale-[1.01] sm:w-auto"
                                            style={{
                                              background:
                                                "linear-gradient(135deg,#a43c3f 0%, #7f252b 100%)",
                                              color: "#f8fbfc",
                                              boxShadow:
                                                "0 12px 24px rgba(164,60,63,.18)",
                                              textDecoration: "none",
                                            }}
                                          >
                                            <span>{heroLazadaButtonLabel}</span>
                                            <span
                                              aria-hidden="true"
                                              className="text-[14px]"
                                            >
                                              {"->"}
                                            </span>
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  </div>
                                </div>

                                {selectedSuggestion && (
                                    <div className="min-w-0 space-y-4">

                                      {lazadaMatchedProductsState?.loading && (
                                        <div
                                          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold"
                                          style={{
                                            background: "rgba(88,116,142,.08)",
                                            color: TEXT_MUTED,
                                            width: "fit-content",
                                          }}
                                        >
                                          <span
                                            className="inline-block h-2 w-2 rounded-full"
                                            style={{
                                              background: HOLIDAY_BLUE,
                                              boxShadow:
                                                "0 0 0 4px rgba(88,116,142,.12)",
                                            }}
                                          />
                                          Checking current Lazada products. You can still browse these picks.
                                        </div>
                                      )}

                                      {curatedLazadaCards.length > 0 && (
                                        <section className="min-w-0">
                                          <div className="mb-3 flex flex-col gap-1">
                                            <h3
                                              className="text-[18px] font-extrabold leading-tight sm:text-[22px]"
                                              style={{
                                                color: PAGE_TEXT_COLOR,
                                                fontFamily:
                                                  "'Plus Jakarta Sans', 'Fredoka', sans-serif",
                                              }}
                                            >
                                              Curated Shopping Ideas
                                            </h3>
                                            <p
                                              className="text-[12px] font-medium leading-relaxed sm:text-[13px]"
                                              style={{ color: TEXT_MUTED }}
                                            >
                                              Gift ideas based on their wishlist, your selected option, and the group budget.
                                            </p>
                                          </div>

                                          <div
                                            data-testid="curated-shopping-grid"
                                            className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3"
                                          >
                                            {curatedLazadaCards.map((product, index) => {
                                              const conciseSubtitle = summarizeCardCopy(
                                                product.whyItFits || product.subtitle,
                                                92
                                              );
                                              const cardTypeLabel =
                                                getFeaturedLazadaCardTypeLabel(product);
                                              const roleLabel = getFeaturedLazadaRoleLabel(
                                                index
                                              );
                                              const buttonLabel =
                                                getFeaturedLazadaButtonLabel(product);
                                              const productImageUrl = normalizeOptionalUrl(
                                                product.imageUrl ||
                                                  curatedFallbackImageUrl
                                              );
                                              const toneStyle =
                                                getCuratedLazadaToneStyle(index);

                                              return (
                                                <div
                                                  key={product.id}
                                                  data-testid="curated-shopping-card"
                                                  className="flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] transition hover:-translate-y-0.5"
                                                  style={{
                                                    background: "#ffffff",
                                                    color: PAGE_TEXT_COLOR,
                                                    boxShadow:
                                                      "0 14px 34px rgba(46,52,50,.04)",
                                                    cursor: "default",
                                                  }}
                                                >
                                                  <div className="flex min-h-[44px] min-w-0 items-start justify-between gap-2 px-4 pt-4">
                                                    <span
                                                      className="min-w-0 max-w-[58%] truncate rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase leading-tight"
                                                      style={{
                                                        color: toneStyle.badgeColor,
                                                        background:
                                                          toneStyle.badgeBackground,
                                                        boxShadow:
                                                          "0 8px 18px rgba(46,52,50,.06)",
                                                      }}
                                                    >
                                                      {roleLabel}
                                                    </span>
                                                    <div
                                                      className="ml-auto shrink-0 rounded-full px-3 py-1.5 text-right text-[13px] font-extrabold leading-tight"
                                                      style={{
                                                        color: product.priceLabel
                                                          ? PAGE_TEXT_COLOR
                                                          : TEXT_MUTED,
                                                        background:
                                                          "rgba(249,250,248,.94)",
                                                        boxShadow:
                                                          "0 8px 18px rgba(46,52,50,.06)",
                                                        maxWidth: "9rem",
                                                        overflowWrap: "break-word",
                                                      }}
                                                    >
                                                      {product.priceLabel || cardTypeLabel}
                                                    </div>
                                                  </div>
                                                  <div
                                                    className="flex aspect-[16/9] min-w-0 items-center justify-center overflow-hidden bg-white p-3"
                                                    style={{
                                                      borderBottom:
                                                        "1px solid rgba(174,179,177,.08)",
                                                    }}
                                                  >
                                                    {productImageUrl ? (
                                                      // eslint-disable-next-line @next/next/no-img-element
                                                      <img
                                                        src={productImageUrl}
                                                        alt={product.title}
                                                        className="relative z-0 h-full max-h-[138px] w-full object-contain object-center transition duration-700 hover:scale-[1.03]"
                                                      />
                                                    ) : (
                                                      <div
                                                        className="flex h-full w-full items-center justify-center"
                                                        style={{ color: HOLIDAY_GOLD }}
                                                      >
                                                        <SparkleMark className="h-9 w-9" />
                                                      </div>
                                                    )}
                                                  </div>
                                                  <div
                                                        className="flex flex-1 flex-col p-4"
                                                  >
                                                    <div
                                                      className="text-[10px] font-extrabold uppercase tracking-[0.16em]"
                                                      style={{ color: toneStyle.badgeColor }}
                                                    >
                                                      {cardTypeLabel}
                                                    </div>
                                                    <div
                                                      className="mt-1.5 text-[16px] font-extrabold leading-tight"
                                                      style={{
                                                        color: PAGE_TEXT_COLOR,
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                        overflowWrap: "break-word",
                                                      }}
                                                    >
                                                      {product.title}
                                                    </div>

                                                    <div
                                                      className="mt-2 flex-1 text-[12px] leading-relaxed"
                                                      style={{
                                                        color: TEXT_MUTED,
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                        overflowWrap: "break-word",
                                                      }}
                                                    >
                                                      {conciseSubtitle}
                                                    </div>
                                                  </div>

                                                  <div className="mt-4">
                                                      <a
                                                        href={product.href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                      className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-[12px] font-extrabold leading-none transition hover:scale-[1.01]"
                                                      style={{
                                                        background:
                                                          "linear-gradient(135deg,#a43c3f 0%, #7f252b 100%)",
                                                        color: "#f8fbfc",
                                                        boxShadow:
                                                          "0 12px 24px rgba(164,60,63,.18)",
                                                        border: "none",
                                                        textDecoration: "none",
                                                      }}
                                                    >
                                                      <span className="min-w-0">
                                                        {buttonLabel}
                                                      </span>
                                                      <span
                                                        aria-hidden="true"
                                                        className="text-[14px]"
                                                      >
                                                        →
                                                      </span>
                                                    </a>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </section>
                                      )}

                                      {backupMerchantLinks.length > 0 && (
                                        <details
                                          open
                                          className="rounded-[34px] p-6"
                                          style={{
                                            background:
                                              "linear-gradient(180deg,rgba(242,244,242,.92),rgba(236,239,236,.9))",
                                            color: PAGE_TEXT_COLOR,
                                          }}
                                        >
                                          <summary className="flex cursor-pointer list-none flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex min-w-0 items-center gap-4">
                                              <div
                                                className="flex h-11 w-11 items-center justify-center rounded-full"
                                                style={{
                                                  background: "#ffffff",
                                                  color: HOLIDAY_GREEN,
                                                }}
                                              >
                                                <GiftMark className="h-5 w-5" />
                                              </div>
                                              <div className="min-w-0">
                                                <div
                                                  className="text-[15px] font-extrabold"
                                                  style={{ color: PAGE_TEXT_COLOR }}
                                                >
                                                  Other places to shop
                                                </div>
                                                <div
                                                  className="mt-0.5 text-[11px]"
                                                  style={{ color: TEXT_MUTED }}
                                                >
                                                  Check availability on other platforms
                                                </div>
                                              </div>
                                            </div>
                                            <span
                                              aria-hidden="true"
                                              className="text-[16px]"
                                              style={{ color: TEXT_MUTED }}
                                            >
                                              v
                                            </span>
                                          </summary>
                                          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            {backupMerchantLinks.map((merchantLink) => {
                                              const merchantBadgeStyle =
                                                getMerchantBadgeStyle(
                                                  merchantLink.merchant,
                                                  merchantLink.isAffiliateReady
                                                );

                                              return (
                                                <a
                                                  key={merchantLink.id}
                                                  href={merchantLink.href}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex min-w-0 items-center justify-between gap-4 rounded-[22px] px-5 py-4 text-[12px] font-extrabold transition hover:-translate-y-0.5"
                                                  style={{
                                                    background: "#ffffff",
                                                    color: PAGE_TEXT_COLOR,
                                                    textDecoration: "none",
                                                    boxShadow:
                                                      "0 12px 24px rgba(46,52,50,.035)",
                                                  }}
                                                >
                                                  <span className="flex min-w-0 items-center gap-3">
                                                    <span
                                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                                                      style={merchantBadgeStyle}
                                                    >
                                                      {merchantLink.merchantLabel.slice(0, 1)}
                                                    </span>
                                                    <span className="truncate">
                                                      {merchantLink.merchantLabel}
                                                    </span>
                                                  </span>
                                                  <span
                                                    aria-hidden="true"
                                                    style={{ color: TEXT_MUTED }}
                                                  >
                                                    {"->"}
                                                  </span>
                                                </a>
                                              );
                                            })}
                                          </div>
                                        </details>
                                      )}

                                      <div
                                        className="text-[9px] mt-3"
                                        style={{ color: TEXT_SOFT }}
                                      >
                                        {selectedSuggestion.disclosure}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()

                  )}

                  <div
                    id={`prep-${assignment.group_id}`}
                    className="mt-4 rounded-[28px] p-4"
                    style={{
                      background:
                        "linear-gradient(135deg,rgba(215,250,219,.32),rgba(255,255,255,.78))",
                      border: "1px solid rgba(72,102,78,.16)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div
                          className="text-[14px] font-extrabold"
                          style={{ color: HOLIDAY_GREEN }}
                        >
                          Gift progress
                        </div>
                        <div
                          className="mt-1 text-[12px]"
                          style={{ color: TEXT_MUTED }}
                        >
                          Only you can see this progress.
                        </div>
                      </div>
                      <div
                        className="rounded-full px-3 py-1 text-[10px] font-extrabold"
                        style={{
                          background: "rgba(255,255,255,.76)",
                          color: HOLIDAY_GREEN,
                        }}
                      >
                        Only you
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-4">
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
                            className="rounded-2xl px-3 py-3 text-[11px] font-extrabold transition"
                            style={{
                              background: isActive
                                ? "linear-gradient(135deg,#48664e,#3c5a43)"
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
                      className="mt-3 rounded-2xl px-4 py-3 text-[12px]"
                      style={{
                        background: "rgba(255,255,255,.72)",
                        color: PAGE_TEXT_COLOR,
                      }}
                    >
                      <span className="font-bold" style={{ color: HOLIDAY_GREEN }}>
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
                          : "🎁 Waiting for your recipient to confirm"}
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ color: TEXT_MUTED }}
                      >
                        {assignment.gift_received
                          ? `${assignment.receiver_nickname} confirmed on ${formatDisplayDate(
                              assignment.gift_received_at
                            )}`
                          : "Your recipient can confirm after the gift reaches them."}
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
                Confirm here after you receive your gift.
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
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      background: SURFACE_HEADER_BACKGROUND,
                      borderBottom: SURFACE_HEADER_BORDER,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px]"
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
                            : "Use this only after you receive your own Secret Santa gift."}
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






