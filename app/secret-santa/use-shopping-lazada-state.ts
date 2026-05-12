"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
import { readLocalStorageItem, writeLocalStorageItem } from "@/lib/client-snapshot";
import {
  type ShoppingRegion,
  type SuggestionInput,
  type WishlistFeaturedProductCard,
  type WishlistSuggestionOption,
  buildWishlistSuggestionOptions,
  detectShoppingRegionFromLocale,
  mergeWishlistSuggestionOptions,
  SHOPPING_REGION_OPTIONS,
} from "@/lib/wishlist/suggestions";

export type GiftPrepStatus = "planning" | "purchased" | "wrapped" | "ready_to_give";

export type WishlistItem = {
  id: string;
  group_id: string;
  item_name: string;
  item_category: string;
  item_link: string;
  item_note: string;
  priority: number;
};

export type RecipientData = {
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

export type LazadaFeaturedProductsState = {
  loading: boolean;
  products: WishlistFeaturedProductCard[];
};

export type AiSuggestionState = {
  loaded: boolean;
  loading: boolean;
  options: WishlistSuggestionOption[];
  usedAi: boolean;
};

type ShoppingRegionGroupOption = {
  currency: string | null;
};

type UseShoppingLazadaStateInput = {
  activeRecipientItemByAssignment: Record<string, string>;
  assignments: RecipientData[];
  availableGroups: ShoppingRegionGroupOption[];
};

const AI_SUGGESTION_REQUEST_TIMEOUT_MS = 18000;
const AI_SUGGESTION_BATCH_SIZE = 3;
const LAZADA_MATCH_BATCH_SIZE = 4;
const ITEM_LINK_MAX_LENGTH = 500;
const SHOPPING_REGION_STORAGE_KEY = "gift-shopping-region";

async function runLimitedBatches<T>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<void>,
  shouldStop: () => boolean
): Promise<void> {
  for (let index = 0; index < items.length && !shouldStop(); index += batchSize) {
    await Promise.all(items.slice(index, index + batchSize).map(worker));
  }
}

export function createLazadaMatchRequestKey(
  itemId: string,
  suggestionId: string,
  region: ShoppingRegion
): string {
  return `${itemId}:${suggestionId}:${region}`;
}

export function buildRecipientSuggestionInput(
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

export function applySuggestionDisplayOrder(
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

export function getActiveRecipientWishlistItemId(
  assignment: RecipientData,
  activeRecipientItemByAssignment: Record<string, string>
): string {
  return (
    activeRecipientItemByAssignment[assignment.group_id] ||
    assignment.receiver_wishlist[0]?.id ||
    ""
  );
}

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

export function useShoppingLazadaState({
  activeRecipientItemByAssignment,
  assignments,
  availableGroups,
}: UseShoppingLazadaStateInput) {
  const [selectedRecipientSuggestionByItem, setSelectedRecipientSuggestionByItem] = useState<
    Record<string, string>
  >({});
  const [aiSuggestionStateByItem, setAiSuggestionStateByItem] = useState<
    Record<string, AiSuggestionState>
  >({});
  const [suggestionDisplayOrderByItem, setSuggestionDisplayOrderByItem] = useState<
    Record<string, string[]>
  >({});
  const [matchedLazadaProductsByKey, setMatchedLazadaProductsByKey] = useState<
    Record<string, LazadaFeaturedProductsState>
  >({});
  const [shoppingRegion, setShoppingRegion] = useState<ShoppingRegion>("GLOBAL");
  const [shoppingRegionInitialized, setShoppingRegionInitialized] = useState(false);

  // These refs mirror state that async effects read after network boundaries.
  // Keeping the latest value in a ref prevents duplicate requests without
  // making every in-flight state update restart the same effect.
  const aiSuggestionStartedItemsRef = useRef<Set<string>>(new Set());
  const lazadaPrimedKeysRef = useRef<Set<string>>(new Set());
  const selectedRecipientSuggestionByItemRef = useRef(selectedRecipientSuggestionByItem);
  const suggestionDisplayOrderByItemRef = useRef(suggestionDisplayOrderByItem);
  const matchedLazadaProductsByKeyRef = useRef(matchedLazadaProductsByKey);

  useEffect(() => {
    if (shoppingRegionInitialized) {
      return;
    }

    const savedRegion = readLocalStorageItem(SHOPPING_REGION_STORAGE_KEY);
    const nextRegion =
      savedRegion && SHOPPING_REGION_OPTIONS.some((option) => option.value === savedRegion)
        ? (savedRegion as ShoppingRegion)
        : detectShoppingRegionFromLocale(navigator.language, availableGroups[0]?.currency || null);

    setShoppingRegion((current) => (current === nextRegion ? current : nextRegion));
    setShoppingRegionInitialized(true);
  }, [availableGroups, shoppingRegionInitialized]);

  useEffect(() => {
    if (!shoppingRegionInitialized) {
      return;
    }

    writeLocalStorageItem(SHOPPING_REGION_STORAGE_KEY, shoppingRegion);
  }, [shoppingRegion, shoppingRegionInitialized]);

  useEffect(() => {
    selectedRecipientSuggestionByItemRef.current = selectedRecipientSuggestionByItem;
  }, [selectedRecipientSuggestionByItem]);

  useEffect(() => {
    suggestionDisplayOrderByItemRef.current = suggestionDisplayOrderByItem;
  }, [suggestionDisplayOrderByItem]);

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

    // AI suggestions are only loaded for the visible item on each recipient
    // card. That keeps provider calls bounded when a giver has several
    // recipients with long wishlists.
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
        aiSuggestionStartedItemsRef.current.delete(targetItem.id);

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

    void runLimitedBatches(
      pendingTargets,
      AI_SUGGESTION_BATCH_SIZE,
      ({ assignment, item }) => loadAiSuggestions(assignment, item),
      () => cancelled
    );

    return () => {
      cancelled = true;
    };
  }, [activeRecipientItemByAssignment, assignments, shoppingRegion]);

  useEffect(() => {
    let changed = false;
    const current = suggestionDisplayOrderByItemRef.current;
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

    if (changed) {
      suggestionDisplayOrderByItemRef.current = nextState;
      setSuggestionDisplayOrderByItem(nextState);
    }
  }, [aiSuggestionStateByItem, assignments, shoppingRegion]);

  useEffect(() => {
    let changed = false;
    const current = selectedRecipientSuggestionByItemRef.current;
    const nextState = { ...current };
    const displayOrderByItem = suggestionDisplayOrderByItemRef.current;
    const activeItemIds = new Set<string>();

    for (const assignment of assignments) {
      for (const wishlistItem of assignment.receiver_wishlist) {
        activeItemIds.add(wishlistItem.id);

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
            aiSuggestionState?.options || [],
            nextState[wishlistItem.id] || ""
          ),
          displayOrderByItem[wishlistItem.id] || []
        );
        const currentSuggestionId = nextState[wishlistItem.id] || "";

        if (
          currentSuggestionId &&
          suggestionOptions.some((suggestion) => suggestion.id === currentSuggestionId)
        ) {
          continue;
        }

        const defaultSuggestionId =
          suggestionOptions.find((suggestion) => suggestion.id.trim().length > 0)?.id ||
          "";

        if (!defaultSuggestionId) {
          if (Object.prototype.hasOwnProperty.call(nextState, wishlistItem.id)) {
            delete nextState[wishlistItem.id];
            changed = true;
          }

          continue;
        }

        if (nextState[wishlistItem.id] !== defaultSuggestionId) {
          nextState[wishlistItem.id] = defaultSuggestionId;
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

    if (changed) {
      selectedRecipientSuggestionByItemRef.current = nextState;
      setSelectedRecipientSuggestionByItem(nextState);
    }
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

    // Lazada matching depends on the selected shopping angle. The request key
    // includes item, angle, and region so changing one card does not overwrite
    // another card's in-flight result.
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

        if (existingMatchState) {
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

    const currentMatchedState = matchedLazadaProductsByKeyRef.current;
    let matchedStateChanged = false;
    const nextMatchedState = { ...currentMatchedState };

    for (const request of pendingRequests) {
      if (!nextMatchedState[request.requestKey]) {
        nextMatchedState[request.requestKey] = {
          loading: true,
          products: [],
        };
        matchedStateChanged = true;
      }
    }

    if (matchedStateChanged) {
      matchedLazadaProductsByKeyRef.current = nextMatchedState;
      setMatchedLazadaProductsByKey(nextMatchedState);
    }

    const loadLazadaMatches = async () => {
      await runLimitedBatches(
        pendingRequests,
        LAZADA_MATCH_BATCH_SIZE,
        async (requestEntry) => {
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

            setMatchedLazadaProductsByKey((current) => {
              const nextState = {
                ...current,
                [requestEntry.requestKey]: {
                  loading: false,
                  products: Array.isArray(payload.products) ? payload.products : [],
                },
              };

              matchedLazadaProductsByKeyRef.current = nextState;
              return nextState;
            });
          } catch {
            if (cancelled) {
              return;
            }

            setMatchedLazadaProductsByKey((current) => {
              const nextState = {
                ...current,
                [requestEntry.requestKey]: {
                  loading: false,
                  products: [],
                },
              };

              matchedLazadaProductsByKeyRef.current = nextState;
              return nextState;
            });
          } finally {
            window.clearTimeout(timeoutId);
          }
        },
        () => cancelled
      );
    };

    void loadLazadaMatches();

    return () => {
      cancelled = true;
      setMatchedLazadaProductsByKey((current) => {
        let changed = false;
        const nextState = { ...current };

        for (const request of pendingRequests) {
          if (nextState[request.requestKey]?.loading) {
            delete nextState[request.requestKey];
            changed = true;
          }
        }

        if (changed) {
          matchedLazadaProductsByKeyRef.current = nextState;
        }

        return changed ? nextState : current;
      });
    };
  }, [
    aiSuggestionStateByItem,
    assignments,
    selectedRecipientSuggestionByItem,
    shoppingRegion,
    suggestionDisplayOrderByItem,
  ]);

  const selectRecipientSuggestion = useCallback((itemId: string, suggestionId: string) => {
    setSelectedRecipientSuggestionByItem((current) => {
      if (current[itemId] === suggestionId) {
        return current;
      }

      const nextState = {
        ...current,
        [itemId]: suggestionId,
      };

      selectedRecipientSuggestionByItemRef.current = nextState;
      return nextState;
    });
  }, []);

  const handleShoppingRegionChange = useCallback((nextRegion: ShoppingRegion) => {
    setShoppingRegionInitialized(true);
    setShoppingRegion((current) => (current === nextRegion ? current : nextRegion));
  }, []);

  return {
    aiSuggestionStateByItem,
    handleShoppingRegionChange,
    matchedLazadaProductsByKey,
    selectedRecipientSuggestionByItem,
    selectRecipientSuggestion,
    shoppingRegion,
    suggestionDisplayOrderByItem,
  };
}
