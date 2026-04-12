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

const ITEM_LINK_MAX_LENGTH = 500;
const MAX_GROUP_ROUTE_PREFETCH = 8;
const AI_SUGGESTION_REQUEST_TIMEOUT_MS = 18000;
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

function getFeaturedLazadaCardTypeLabel(product: WishlistFeaturedProductCard): string {
  return product.catalogSource === "catalog-product" ? "Direct product" : "Lazada search";
}

function getFeaturedLazadaRoleLabel(
  product: WishlistFeaturedProductCard,
  index: number
): string {
  if (product.catalogSource === "catalog-product") {
    return product.fitLabel || "Matched product";
  }

  if (index === 0) {
    return "Closest to request";
  }

  if (index === 1) {
    return "Step-up option";
  }

  return "Highest-price option";
}

function getFeaturedLazadaButtonLabel(product: WishlistFeaturedProductCard): string {
  return product.catalogSource === "catalog-product" ? "Open on Lazada" : "See more on Lazada";
}

function getFeaturedLazadaCollectionLabel(params: {
  allSearchBacked: boolean;
  hasMixed: boolean;
  usingMatchedProducts: boolean;
}): string {
  if (params.hasMixed) {
    return "Direct picks + more results";
  }

  if (params.usingMatchedProducts) {
    return "Direct Lazada picks";
  }

  if (params.allSearchBacked) {
    return "Lazada search results";
  }

  return "Lazada picks";
}

function getFeaturedLazadaCollectionDescription(params: {
  allSearchBacked: boolean;
  hasMixed: boolean;
  usingMatchedProducts: boolean;
}): string {
  if (params.hasMixed) {
    return "Start with the strongest direct picks here, then open broader Lazada results if you want more variety.";
  }

  if (params.usingMatchedProducts) {
    return "These cards open direct Lazada listings that best match the option you picked.";
  }

  if (params.allSearchBacked) {
    return "These cards open Lazada result pages so you can browse more matching options.";
  }

  return "Use these cards to compare the clearest Lazada options for this gift.";
}

function getFeaturedLazadaSourceMeta(product: WishlistFeaturedProductCard): {
  background: string;
  color: string;
  label: string;
} {
  if (product.catalogSource === "catalog-product") {
    return {
      background: "rgba(59,130,246,.1)",
      color: "#1d4ed8",
      label: "Direct pick",
    };
  }

  return {
    background: "rgba(169,135,61,.1)",
    color: HOLIDAY_GOLD,
    label: "Search results",
  };
}

function getFeaturedLazadaPriceCaption(product: WishlistFeaturedProductCard): string {
  if (product.priceLabel) {
    return product.catalogSource === "catalog-product"
      ? "Current affiliate-feed price"
      : "Guide price for this option";
  }

  return product.catalogSource === "catalog-product"
    ? "Direct Lazada listing"
    : "More Lazada results";
}

function getFeaturedLazadaOpenBehaviorCopy(product: WishlistFeaturedProductCard): string {
  return product.catalogSource === "catalog-product"
    ? "Opens this item on Lazada."
    : "Opens Lazada results with more choices.";
}

function getFeaturedLazadaCardSurfaceStyle(product: WishlistFeaturedProductCard): {
  background: string;
  border: string;
  boxShadow: string;
  behaviorBackground: string;
  behaviorColor: string;
} {
  if (product.catalogSource === "catalog-product") {
    return {
      background:
        "linear-gradient(180deg,rgba(255,255,255,.98),rgba(241,247,252,.95))",
      border: "1px solid rgba(88,116,142,.16)",
      boxShadow: "0 12px 28px rgba(88,116,142,.08)",
      behaviorBackground: "rgba(88,116,142,.08)",
      behaviorColor: HOLIDAY_BLUE,
    };
  }

  return {
    background:
      "linear-gradient(180deg,rgba(255,255,255,.98),rgba(251,248,242,.95))",
    border: "1px solid rgba(169,135,61,.18)",
    boxShadow: "0 12px 28px rgba(169,135,61,.08)",
    behaviorBackground: "rgba(169,135,61,.1)",
    behaviorColor: HOLIDAY_GOLD,
  };
}

function buildRecipientWishlistProductHref(
  groupId: string,
  wishlistItemId: string,
  itemName: string,
  itemUrl: string
): string {
  const params = new URLSearchParams({
    groupId,
    itemId: wishlistItemId,
    name: itemName,
    url: itemUrl,
  });

  return `/go/wishlist-link?${params.toString()}`;
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
  const [expandedRecipientItemId, setExpandedRecipientItemId] = useState<string | null>(null);
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
    if (shoppingRegion !== "PH" || !expandedRecipientItemId) {
      return;
    }

    let targetAssignment: RecipientData | null = null;
    let targetItem: WishlistItem | null = null;

    for (const assignment of assignments) {
      const matchingItem =
        assignment.receiver_wishlist.find((wishlistItem) => wishlistItem.id === expandedRecipientItemId) ||
        null;

      if (matchingItem) {
        targetAssignment = assignment;
        targetItem = matchingItem;
        break;
      }
    }

    if (!targetAssignment || !targetItem) {
      return;
    }

    if (aiSuggestionStartedItemsRef.current.has(targetItem.id)) {
      return;
    }

    aiSuggestionStartedItemsRef.current.add(targetItem.id);

    let cancelled = false;
    let activeController: AbortController | null = null;

    setAiSuggestionStateByItem((current) => ({
      ...current,
      [targetItem.id]: {
        loaded: false,
        loading: true,
        options: current[targetItem.id]?.options || [],
        usedAi: false,
      },
    }));

    const loadAiSuggestions = async () => {
      const suggestionInput = buildRecipientSuggestionInput(targetAssignment!, targetItem!);
      const controller = new AbortController();
      activeController = controller;
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

    void loadAiSuggestions();

    return () => {
      cancelled = true;
      activeController?.abort();
    };
  }, [assignments, expandedRecipientItemId, shoppingRegion]);

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

        if (matchedLazadaProductsByKeyRef.current[requestKey]) {
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

  // The giver decides when they want help with a wishlist item.
  // Expanding the card reveals the more specific suggestion angles for that item.
  const toggleRecipientItemIdeas = (itemId: string) => {
    setExpandedRecipientItemId((current) => (current === itemId ? null : itemId));
  };

  // We keep the selected angle per item so switching between wishlist cards
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

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        {/* Primary navigation back to the dashboard. */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition sm:w-auto"
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
          className="rounded-[18px] p-4 mb-4"
          style={{
            background: "rgba(248,250,248,.74)",
            border: "1px solid rgba(96,117,122,.12)",
            boxShadow: "0 10px 24px rgba(34,55,59,.05)",
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div
                className="text-[14px] font-extrabold"
                style={{ color: HOLIDAY_GREEN }}
              >
                Shopping setup
              </div>
              <div
                className="text-[11px] mt-1 leading-relaxed"
                style={{ color: TEXT_MUTED }}
              >
                We&apos;ll use this region for Lazada suggestions and store links
                across the page.
              </div>
            </div>
            <span
              className="text-[10px] font-extrabold px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(255,255,255,.78)",
                color: HOLIDAY_GREEN,
              }}
            >
              Easy to change anytime
            </span>
          </div>

          <div className="mt-4 max-w-[320px]">
            <label className="block">
              <div
                className="text-[11px] font-bold mb-1"
                style={{ color: PAGE_TEXT_COLOR }}
              >
                Online shop region
              </div>
              <select
                value={shoppingRegion}
                onChange={(event) =>
                  setShoppingRegion(event.target.value as ShoppingRegion)
                }
                className="w-full rounded-xl px-3 py-2 text-[12px] font-semibold"
                style={{
                  background: INPUT_BACKGROUND,
                  border: INPUT_BORDER,
                  color: INPUT_TEXT,
                  fontFamily: "inherit",
                }}
              >
                {SHOPPING_REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="text-[10px] mt-1" style={{ color: TEXT_SOFT }}>
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
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    background: SURFACE_HEADER_BACKGROUND,
                    borderBottom: SURFACE_HEADER_BORDER,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px]"
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
                      const lazadaWishlistProductHref =
                        safeItemLink && isLazadaProductPageUrl(safeItemLink)
                          ? buildRecipientWishlistProductHref(
                              assignment.group_id,
                              item.id,
                              item.item_name,
                              safeItemLink
                            )
                          : "";
                      const safeItemImageUrl = normalizeOptionalUrl(item.item_image_url);
                      const categoryStyle = item.item_category
                        ? getWishlistCategoryStyle(item.item_category)
                        : null;
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
                      // Keep the merchant step hidden until the giver explicitly
                      // picks a direction for this wishlist item. That makes the
                      // flow feel more guided for broad asks like "tablet".
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
                      const premiumOnlyMatchedProducts =
                        rawMatchedLazadaProducts.length === 1 &&
                        rawMatchedLazadaProducts[0]?.catalogSource === "catalog-product" &&
                        rawMatchedLazadaProducts[0]?.fitLabel === "Highest-price option"
                          ? rawMatchedLazadaProducts
                          : [];
                      const featuredLazadaProducts =
                        lazadaMatchesLoading
                          ? []
                          : premiumOnlyMatchedProducts.length > 0
                            ? [
                                ...fallbackFeaturedLazadaProducts.slice(0, 2),
                                premiumOnlyMatchedProducts[0],
                              ]
                            : rawMatchedLazadaProducts.length > 0
                              ? rawMatchedLazadaProducts
                            : fallbackFeaturedLazadaProducts;
                      const hasDirectFeaturedLazadaProducts = featuredLazadaProducts.some(
                        (product) => product.catalogSource === "catalog-product"
                      );
                      const allFeaturedLazadaProductsSearchBacked =
                        featuredLazadaProducts.length > 0 &&
                        featuredLazadaProducts.every(
                          (product) => product.catalogSource !== "catalog-product"
                        );
                      const usingMatchedLazadaProducts = hasDirectFeaturedLazadaProducts;
                      const hasMixedFeaturedLazadaProducts =
                        hasDirectFeaturedLazadaProducts &&
                        featuredLazadaProducts.some(
                          (product) => product.catalogSource !== "catalog-product"
                        );
                      const isIdeaPanelOpen = expandedRecipientItemId === item.id;

                      return (
                        <div
                          key={item.id}
                          className="rounded-[18px] p-4 mb-3 transition"
                          style={{
                            background: INSET_BACKGROUND,
                            border: INSET_BORDER,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-14 h-14 rounded-2xl flex items-center justify-center text-[18px] shrink-0"
                              style={{
                                background: "rgba(255,255,255,.88)",
                                border: "1px solid rgba(96,117,122,.12)",
                                boxShadow: "0 8px 18px rgba(34,55,59,.05)",
                              }}
                            >
                              {safeItemImageUrl ? "IMG" : priorityMeta.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div
                                    className="text-[15px] font-extrabold leading-tight"
                                    style={{ color: PAGE_TEXT_COLOR }}
                                  >
                                    {item.item_name}
                                  </div>
                                  {item.item_note && (
                                    <div
                                      className="text-[12px] mt-1 leading-relaxed"
                                      style={{ color: TEXT_MUTED }}
                                    >
                                      {item.item_note}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                  <span
                                    className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                    style={{
                                      background: priorityMeta.badgeBackground,
                                      color: priorityMeta.badgeColor,
                                    }}
                                  >
                                    {priorityMeta.icon} {priorityMeta.label}
                                  </span>
                                  {item.item_category && categoryStyle && (
                                    <span
                                      className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                      style={categoryStyle}
                                    >
                                      {item.item_category}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {(safeItemImageUrl || safeItemLink) && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {safeItemImageUrl && (
                                    <a
                                      href={safeItemImageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={safeItemImageUrl}
                                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center"
                                      style={{
                                        color: HOLIDAY_BLUE,
                                        background: "rgba(88,116,142,.08)",
                                        textDecoration: "none",
                                      }}
                                    >
                                      Open image {"->"}
                                    </a>
                                  )}
                                  {safeItemLink && (
                                    <a
                                      href={lazadaWishlistProductHref || safeItemLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={safeItemLink}
                                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center"
                                      style={{
                                        color: HOLIDAY_GOLD,
                                        background: "rgba(169,135,61,.08)",
                                        textDecoration: "none",
                                      }}
                                    >
                                      {lazadaWishlistProductHref ? "Buy on Lazada" : "Reference link"}{" "}
                                      {"->"}
                                    </a>
                                  )}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleRecipientItemIdeas(item.id)}
                                className="mt-3 px-3 py-2 rounded-xl text-[11px] font-extrabold transition"
                                style={{
                                  background: "rgba(47,107,86,.1)",
                                  color: HOLIDAY_GREEN,
                                  border: "1px solid rgba(47,107,86,.16)",
                                  fontFamily: "inherit",
                                  cursor: "pointer",
                                }}
                              >
                                {isIdeaPanelOpen ? "Hide shopping ideas" : "Explore shopping ideas"}
                              </button>
                            </div>
                          </div>

                          {isIdeaPanelOpen && (
                            <div
                              className="mt-4 pt-4"
                              style={{ borderTop: "1px solid rgba(96,117,122,.12)" }}
                            >
                              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                                <div>
                                  <div
                                    className="text-[12px] font-extrabold"
                                    style={{ color: HOLIDAY_GREEN }}
                                  >
                                    Pick a shopping option
                                  </div>
                                  <div
                                    className="text-[11px] mt-0.5"
                                    style={{ color: TEXT_MUTED }}
                                  >
                                    Choose the version that feels closest to what you want to buy,
                                    then we&apos;ll show the best Lazada picks for it.
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {shoppingRegion === "PH" && aiSuggestionState?.loading && (
                                    <span
                                      className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                      style={{
                                        background: "rgba(88,116,142,.1)",
                                        color: HOLIDAY_BLUE,
                                      }}
                                    >
                                      Getting more ideas...
                                    </span>
                                  )}
                                  {shoppingRegion === "PH" &&
                                    !aiSuggestionState?.loading &&
                                    aiSuggestionState?.usedAi && (
                                      <span
                                        className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                        style={{
                                          background: "rgba(169,135,61,.12)",
                                          color: HOLIDAY_GOLD,
                                        }}
                                      >
                                        AI helped
                                      </span>
                                    )}
                                </div>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-2">
                                {suggestionOptions.map((suggestion) => {
                                  const isSelected = suggestion.id === selectedSuggestionId;

                                  return (
                                    <button
                                      key={suggestion.id}
                                      type="button"
                                      onClick={() =>
                                        selectRecipientSuggestion(item.id, suggestion.id)
                                      }
                                      className="w-full rounded-2xl p-3 text-left transition"
                                      style={{
                                        background: isSelected
                                          ? "rgba(47,107,86,.12)"
                                          : "rgba(255,255,255,.78)",
                                        border: isSelected
                                          ? "1px solid rgba(47,107,86,.24)"
                                          : "1px solid rgba(96,117,122,.12)",
                                        boxShadow: isSelected
                                          ? "0 8px 18px rgba(47,107,86,.08)"
                                          : "none",
                                        fontFamily: "inherit",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div
                                          className="text-[13px] font-extrabold"
                                          style={{ color: PAGE_TEXT_COLOR }}
                                        >
                                        {suggestion.title}
                                      </div>
                                      <span
                                        className="text-[10px] font-extrabold px-2 py-1 rounded-full"
                                        style={{
                                          color: isSelected
                                            ? HOLIDAY_GREEN
                                            : suggestion.source === "ai"
                                              ? HOLIDAY_BLUE
                                              : TEXT_MUTED,
                                          background: isSelected
                                            ? "rgba(47,107,86,.12)"
                                            : suggestion.source === "ai"
                                              ? "rgba(88,116,142,.08)"
                                              : "rgba(96,117,122,.08)",
                                        }}
                                      >
                                        {isSelected
                                          ? "Selected"
                                          : suggestion.source === "ai"
                                            ? "AI idea"
                                            : suggestion.fitLabel}
                                      </span>
                                      </div>
                                      <div
                                        className="text-[11px] mt-1"
                                        style={{ color: TEXT_MUTED }}
                                      >
                                        {suggestion.subtitle}
                                      </div>
                                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                                        <span
                                          className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                          style={{
                                            color: HOLIDAY_BLUE,
                                            background: "rgba(88,116,142,.08)",
                                          }}
                                        >
                                          Search: {suggestion.searchQuery}
                                        </span>
                                        {suggestion.priceLabel && (
                                          <span
                                            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                            style={{
                                              color: HOLIDAY_GOLD,
                                              background: "rgba(169,135,61,.08)",
                                            }}
                                          >
                                            {suggestion.priceLabel}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {!selectedSuggestion && (
                                <div
                                  className="mt-4 rounded-2xl p-3"
                                  style={{
                                    background: "rgba(255,255,255,.76)",
                                    border: "1px dashed rgba(96,117,122,.18)",
                                  }}
                                >
                                  <div
                                    className="text-[12px] font-extrabold"
                                    style={{ color: HOLIDAY_GREEN }}
                                  >
                                    Pick one option above first
                                  </div>
                                  <div
                                    className="text-[11px] mt-1 leading-relaxed"
                                    style={{ color: TEXT_MUTED }}
                                  >
                                    Pick one option for <strong>{item.item_name}</strong> and
                                    we&apos;ll load the best Lazada picks plus a few extra store
                                    links underneath.
                                  </div>
                                </div>
                              )}

                              {selectedSuggestion && (
                                <div className="mt-4">
                                  <div className="grid gap-3">
                                    <div
                                      className="rounded-2xl p-3"
                                      style={{
                                        background: "rgba(255,255,255,.62)",
                                        border: "1px solid rgba(96,117,122,.12)",
                                      }}
                                    >
                                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                                        <div>
                                          <div
                                            className="text-[12px] font-extrabold"
                                            style={{ color: HOLIDAY_GREEN }}
                                          >
                                            Shop this option
                                          </div>
                                          <div
                                            className="text-[11px] mt-0.5"
                                            style={{ color: TEXT_MUTED }}
                                          >
                                            Start with Lazada, then open other stores if you want
                                            more choices.
                                          </div>
                                        </div>
                                        <span
                                          className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                          style={{
                                            background: "rgba(255,255,255,.78)",
                                            color: HOLIDAY_GREEN,
                                          }}
                                        >
                                          {
                                            SHOPPING_REGION_OPTIONS.find(
                                              (option) => option.value === shoppingRegion
                                            )?.label
                                          }
                                        </span>
                                      </div>

                                      <div
                                        className="rounded-2xl p-3 mb-3"
                                        style={{
                                          background: "rgba(255,255,255,.76)",
                                          border: "1px solid rgba(96,117,122,.1)",
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-3 flex-wrap">
                                          <div className="min-w-0">
                                            <div
                                              className="text-[9px] font-extrabold uppercase tracking-[0.08em]"
                                              style={{ color: HOLIDAY_GREEN }}
                                            >
                                              Picked option
                                            </div>
                                            <div
                                              className="text-[14px] font-extrabold mt-1"
                                              style={{ color: PAGE_TEXT_COLOR }}
                                            >
                                              {selectedSuggestion.title}
                                            </div>
                                            <div
                                              className="text-[11px] mt-1 leading-relaxed"
                                              style={{ color: TEXT_MUTED }}
                                            >
                                              {selectedSuggestion.subtitle}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {selectedSuggestion.priceLabel && (
                                              <span
                                                className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                                style={{
                                                  color: HOLIDAY_GOLD,
                                                  background: "rgba(169,135,61,.08)",
                                                }}
                                              >
                                                {selectedSuggestion.priceLabel}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid gap-2 sm:grid-cols-2 mb-3">
                                        <div
                                          className="rounded-2xl px-3 py-2"
                                          style={{
                                            background: "rgba(88,116,142,.06)",
                                            border: "1px solid rgba(88,116,142,.08)",
                                          }}
                                        >
                                          <div
                                            className="text-[9px] font-extrabold uppercase tracking-[0.08em]"
                                            style={{ color: HOLIDAY_BLUE }}
                                          >
                                            Lazada query
                                          </div>
                                          <div
                                            className="text-[12px] font-semibold mt-1"
                                            style={{ color: PAGE_TEXT_COLOR }}
                                          >
                                            {selectedSuggestion.searchQuery}
                                          </div>
                                        </div>
                                        <div
                                          className="rounded-2xl px-3 py-2"
                                          style={{
                                            background: "rgba(169,135,61,.06)",
                                            border: "1px solid rgba(169,135,61,.08)",
                                          }}
                                        >
                                          <div
                                            className="text-[9px] font-extrabold uppercase tracking-[0.08em]"
                                            style={{ color: HOLIDAY_GOLD }}
                                          >
                                            Budget
                                          </div>
                                          <div
                                            className="text-[12px] font-semibold mt-1"
                                            style={{ color: PAGE_TEXT_COLOR }}
                                          >
                                            {selectedSuggestion.priceLabel || "No fixed budget guide"}
                                          </div>
                                          <div
                                            className="text-[10px] mt-1"
                                            style={{ color: TEXT_MUTED }}
                                          >
                                            {
                                              SHOPPING_REGION_OPTIONS.find(
                                                (option) => option.value === shoppingRegion
                                              )?.label
                                            }
                                          </div>
                                        </div>
                                      </div>

                                      {lazadaMatchedProductsState?.loading && (
                                        <div
                                          className="mb-3 flex items-center gap-2 text-[10px] font-semibold"
                                          style={{ color: TEXT_SOFT }}
                                        >
                                          <span
                                            className="inline-block h-2 w-2 rounded-full"
                                            style={{
                                              background: HOLIDAY_BLUE,
                                              boxShadow:
                                                "0 0 0 4px rgba(88,116,142,.12)",
                                            }}
                                          />
                                          Finding better Lazada matches...
                                        </div>
                                      )}

                                      {lazadaMatchedProductsState?.loading &&
                                        fallbackFeaturedLazadaProducts.length > 0 && (
                                          <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            {fallbackFeaturedLazadaProducts.map((product) => (
                                              <div
                                                key={`loading-${product.id}`}
                                                className="rounded-[22px] p-4"
                                                style={{
                                                  background:
                                                    "linear-gradient(180deg,rgba(255,255,255,.9),rgba(245,248,246,.86))",
                                                  border:
                                                    "1px solid rgba(96,117,122,.1)",
                                                  boxShadow:
                                                    "0 10px 24px rgba(34,55,59,.04)",
                                                }}
                                              >
                                                <div
                                                  className="h-6 w-32 rounded-full"
                                                  style={{
                                                    background:
                                                      "rgba(47,107,86,.08)",
                                                  }}
                                                />
                                                <div
                                                  className="mt-3 h-29.5 rounded-[18px]"
                                                  style={{
                                                    background:
                                                      "linear-gradient(180deg,rgba(239,244,241,.82),rgba(229,236,233,.76))",
                                                    border:
                                                      "1px solid rgba(96,117,122,.08)",
                                                  }}
                                                />
                                                <div
                                                  className="mt-3 h-5 rounded-lg"
                                                  style={{
                                                    background:
                                                      "rgba(96,117,122,.1)",
                                                  }}
                                                />
                                                <div
                                                  className="mt-2 h-4 rounded-lg"
                                                  style={{
                                                    width: "85%",
                                                    background:
                                                      "rgba(96,117,122,.08)",
                                                  }}
                                                />
                                                <div
                                                  className="mt-4 h-10 rounded-2xl"
                                                  style={{
                                                    background:
                                                      "rgba(88,116,142,.12)",
                                                  }}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                      {featuredLazadaProducts.length > 0 && (
                                        <div className="mb-3">
                                          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                                            <div
                                              className="text-[11px] font-extrabold"
                                              style={{ color: HOLIDAY_GREEN }}
                                            >
                                              Best Lazada picks
                                            </div>
                                            <span
                                              className="text-[10px] font-extrabold px-2.5 py-1 rounded-full"
                                              style={{
                                                background: "rgba(88,116,142,.08)",
                                                color: HOLIDAY_BLUE,
                                              }}
                                            >
                                              {getFeaturedLazadaCollectionLabel({
                                                allSearchBacked:
                                                  allFeaturedLazadaProductsSearchBacked,
                                                hasMixed: hasMixedFeaturedLazadaProducts,
                                                usingMatchedProducts:
                                                  usingMatchedLazadaProducts,
                                              })}
                                            </span>
                                          </div>

                                          <div
                                            className="text-[11px] mb-3 leading-relaxed rounded-2xl px-3 py-2"
                                            style={{
                                              color: TEXT_SOFT,
                                              background: "rgba(255,255,255,.72)",
                                              border: "1px solid rgba(96,117,122,.08)",
                                            }}
                                          >
                                            {getFeaturedLazadaCollectionDescription({
                                              allSearchBacked:
                                                allFeaturedLazadaProductsSearchBacked,
                                              hasMixed: hasMixedFeaturedLazadaProducts,
                                              usingMatchedProducts:
                                                usingMatchedLazadaProducts,
                                            })}
                                          </div>

                                          {hasDirectFeaturedLazadaProducts &&
                                            activeGroupBudgetLabel && (
                                              <div
                                                className="text-[10px] mb-2 font-semibold rounded-2xl px-3 py-2"
                                                style={{
                                                  color: HOLIDAY_GOLD,
                                                  background: "rgba(169,135,61,.06)",
                                                  border: "1px solid rgba(169,135,61,.08)",
                                                }}
                                              >
                                                Direct listings are shown near your{" "}
                                                {activeGroupBudgetLabel} budget, with one
                                                higher-budget step-up when the feed has a stronger option.
                                              </div>
                                            )}

                                          {hasDirectFeaturedLazadaProducts && (
                                            <div
                                              className="text-[10px] mb-3 leading-relaxed"
                                              style={{ color: TEXT_SOFT }}
                                            >
                                              Prices come from the Lazada affiliate feed and can
                                              differ from live listings after vouchers, seller
                                              changes, or variant selection.
                                            </div>
                                          )}

                                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            {featuredLazadaProducts.map((product, index) => {
                                              const safeProductImageUrl = normalizeOptionalUrl(
                                                product.imageUrl || ""
                                              );
                                              const conciseSubtitle = summarizeCardCopy(
                                                product.subtitle,
                                                60
                                              );
                                              const conciseReason = summarizeCardCopy(
                                                product.whyItFits,
                                                92
                                              );
                                              const cardTypeLabel =
                                                getFeaturedLazadaCardTypeLabel(product);
                                              const roleLabel = getFeaturedLazadaRoleLabel(
                                                product,
                                                index
                                              );
                                              const buttonLabel =
                                                getFeaturedLazadaButtonLabel(product);
                                              const sourceMeta =
                                                getFeaturedLazadaSourceMeta(product);
                                              const priceCaption =
                                                getFeaturedLazadaPriceCaption(product);
                                              const openBehaviorCopy =
                                                getFeaturedLazadaOpenBehaviorCopy(product);
                                              const cardSurface =
                                                getFeaturedLazadaCardSurfaceStyle(product);
                                              const showVisualPreview = Boolean(
                                                safeProductImageUrl || product.catalogSource === "catalog-product"
                                              );

                                              return (
                                                <div
                                                  key={product.id}
                                                  className="rounded-[22px] p-4 transition flex flex-col h-full"
                                                  style={{
                                                    background: cardSurface.background,
                                                    border: cardSurface.border,
                                                    color: PAGE_TEXT_COLOR,
                                                    boxShadow: cardSurface.boxShadow,
                                                    minHeight: 360,
                                                    cursor: "default",
                                                  }}
                                                >
                                                  <div style={{ pointerEvents: "none" }}>
                                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span
                                                        className="text-[10px] font-extrabold px-2.5 py-1 rounded-full"
                                                        style={{
                                                          color: HOLIDAY_GREEN,
                                                          background: "rgba(47,107,86,.1)",
                                                        }}
                                                      >
                                                        {roleLabel}
                                                      </span>
                                                      <span
                                                        className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                                        style={{
                                                          color: sourceMeta.color,
                                                          background: sourceMeta.background,
                                                        }}
                                                      >
                                                        {sourceMeta.label}
                                                      </span>
                                                    </div>
                                                    <div className="text-right">
                                                      <div
                                                        className="text-[11px] font-bold"
                                                        style={{
                                                          color: product.priceLabel
                                                            ? HOLIDAY_GOLD
                                                            : TEXT_MUTED,
                                                        }}
                                                      >
                                                        {product.priceLabel || cardTypeLabel}
                                                      </div>
                                                      <div
                                                        className="text-[10px] mt-0.5"
                                                        style={{ color: TEXT_SOFT }}
                                                      >
                                                        {priceCaption}
                                                      </div>
                                                    </div>
                                                  </div>

                                                  {showVisualPreview && (
                                                    <div
                                                      className="mt-3 rounded-[18px] overflow-hidden flex items-center justify-center"
                                                      style={{
                                                        minHeight: 118,
                                                        background:
                                                          "linear-gradient(180deg,rgba(239,244,241,.9),rgba(229,236,233,.86))",
                                                        border: "1px solid rgba(96,117,122,.08)",
                                                      }}
                                                    >
                                                      {safeProductImageUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                          src={safeProductImageUrl}
                                                          alt={product.title}
                                                          className="w-full h-29.5 object-contain"
                                                        />
                                                      ) : (
                                                        <div
                                                          className="text-[12px] font-bold text-center px-4"
                                                          style={{ color: TEXT_MUTED }}
                                                        >
                                                          {cardTypeLabel}
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}

                                                  <div
                                                    className="text-[16px] font-extrabold mt-3 leading-snug"
                                                    style={{
                                                      color: PAGE_TEXT_COLOR,
                                                      display: "-webkit-box",
                                                      WebkitLineClamp: 2,
                                                      WebkitBoxOrient: "vertical",
                                                      overflow: "hidden",
                                                    }}
                                                  >
                                                    {product.title}
                                                  </div>

                                                    <div
                                                      className="text-[11px] mt-1 leading-relaxed"
                                                      style={{ color: TEXT_MUTED }}
                                                    >
                                                      {conciseSubtitle}
                                                    </div>

                                                    <div
                                                      className="text-[10px] font-semibold mt-3 rounded-2xl px-3 py-2 leading-relaxed"
                                                      style={{
                                                        color: cardSurface.behaviorColor,
                                                        background: cardSurface.behaviorBackground,
                                                      }}
                                                    >
                                                      {openBehaviorCopy}
                                                    </div>

                                                  <div className="mt-3 flex-1">
                                                    <div
                                                      className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                                                      style={{ color: HOLIDAY_BLUE }}
                                                    >
                                                      Why this fits
                                                    </div>
                                                    <div
                                                      className="text-[11px] mt-1 leading-relaxed"
                                                      style={{ color: TEXT_SOFT }}
                                                    >
                                                      {conciseReason}
                                                    </div>
                                                  </div>
                                                  </div>

                                                  <div
                                                    className="mt-4 pt-3"
                                                    style={{
                                                      borderTop:
                                                        "1px solid rgba(96,117,122,.08)",
                                                    }}
                                                  >
                                                    <a
                                                      href={product.href}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[12px] font-extrabold leading-none whitespace-nowrap"
                                                      style={{
                                                        background:
                                                          "linear-gradient(180deg,#5f7f9b 0%, #4c6d89 100%)",
                                                        color: "#f8fbfc",
                                                        boxShadow:
                                                          "0 10px 18px rgba(88,116,142,.18)",
                                                        border:
                                                          "1px solid rgba(76,109,137,.28)",
                                                        textDecoration: "none",
                                                      }}
                                                    >
                                                      <span>{buttonLabel}</span>
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
                                        </div>
                                      )}

                                      {featuredLazadaProducts.length > 0 && (
                                        <div
                                          className="text-[11px] mb-3 leading-relaxed rounded-2xl px-3 py-2"
                                          style={{
                                            color: TEXT_SOFT,
                                            background: "rgba(255,255,255,.72)",
                                            border: "1px solid rgba(96,117,122,.08)",
                                          }}
                                          >
                                          {hasMixedFeaturedLazadaProducts
                                            ? "Start with the direct picks, then use the wider Lazada results if you want more variety."
                                            : usingMatchedLazadaProducts
                                              ? "These are the strongest direct Lazada listings we currently trust for this option."
                                              : "These stay as broader Lazada results because we do not yet have direct listings we trust for this option."}
                                        </div>
                                      )}

                                      <div
                                        className="text-[11px] font-extrabold mb-2"
                                        style={{ color: HOLIDAY_GREEN }}
                                      >
                                        More places to shop
                                      </div>
                                      <div className="grid gap-2">
                                        {merchantLinks.map((merchantLink) => (
                                          <a
                                            key={merchantLink.id}
                                            href={merchantLink.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="rounded-2xl p-3 transition"
                                            style={{
                                              background: "rgba(255,255,255,.88)",
                                              border: "1px solid rgba(96,117,122,.12)",
                                              color: PAGE_TEXT_COLOR,
                                              textDecoration: "none",
                                              boxShadow: "0 8px 18px rgba(34,55,59,.05)",
                                            }}
                                          >
                                            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                                              <span
                                                className="text-[10px] font-extrabold px-2 py-1 rounded-lg"
                                                style={getMerchantBadgeStyle(
                                                  merchantLink.merchant,
                                                  merchantLink.isAffiliateReady
                                                )}
                                              >
                                                {merchantLink.merchantLabel}
                                              </span>
                                              <span
                                                className="text-[10px] font-extrabold"
                                                style={{ color: HOLIDAY_GREEN }}
                                              >
                                                {merchantLink.fitLabel}
                                              </span>
                                            </div>
                                            <div
                                              className="text-[13px] font-extrabold"
                                              style={{ color: PAGE_TEXT_COLOR }}
                                            >
                                              {merchantLink.title}
                                            </div>
                                            <div
                                              className="text-[11px] mt-1"
                                              style={{ color: TEXT_MUTED }}
                                            >
                                              {merchantLink.subtitle}
                                            </div>
                                            {merchantLink.priceLabel && (
                                              <div
                                                className="text-[10px] font-bold mt-2"
                                                style={{ color: HOLIDAY_GOLD }}
                                              >
                                                {merchantLink.priceLabel}
                                              </div>
                                            )}
                                            <div
                                              className="flex items-center justify-between gap-2 mt-3 flex-wrap"
                                            >
                                              <div
                                                className="text-[11px] font-semibold"
                                                style={{ color: HOLIDAY_BLUE }}
                                              >
                                                View on {merchantLink.merchantLabel} {"->"}
                                              </div>
                                              <span
                                                className="text-[9px] font-bold"
                                                style={{
                                                  color: merchantLink.isAffiliateReady
                                                    ? HOLIDAY_GOLD
                                                    : TEXT_SOFT,
                                                }}
                                              >
                                                {merchantLink.isAffiliateReady
                                                  ? "Partner link"
                                                  : "Search link"}
                                              </span>
                                            </div>
                                          </a>
                                        ))}
                                      </div>

                                      <div
                                        className="text-[9px] mt-3"
                                        style={{ color: TEXT_SOFT }}
                                      >
                                        {selectedSuggestion.disclosure}
                                      </div>
                                    </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
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






