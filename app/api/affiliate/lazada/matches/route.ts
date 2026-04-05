import { NextRequest, NextResponse } from "next/server";

import {
  findBestLazadaFeedMatches,
  getLazadaFeedMatchConfidence,
  getLazadaFeedProductPrice,
  type LazadaFeedMatch,
} from "@/lib/affiliate/lazada-feed";
import { primeLazadaPromotionLinks } from "@/lib/affiliate/lazada";
import { getLazadaStarterProducts } from "@/lib/affiliate/lazada-catalog";
import { createClient } from "@/lib/supabase/server";
import { formatPriceRange } from "@/lib/wishlist/pricing";
import {
  buildTrackedSuggestionHref,
  type ShoppingRegion,
  type WishlistFeaturedProductCard,
} from "@/lib/wishlist/suggestions";

type MatchProductsBody = {
  groupBudget?: unknown;
  groupId?: unknown;
  itemCategory?: unknown;
  itemName?: unknown;
  itemNote?: unknown;
  preferredPriceMax?: unknown;
  preferredPriceMin?: unknown;
  region?: unknown;
  searchQuery?: unknown;
  wishlistItemId?: unknown;
};

function sanitizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isShoppingRegion(value: string): value is ShoppingRegion {
  return ["AU", "CA", "GLOBAL", "JP", "PH", "UK", "US"].includes(value);
}

type MatchCardRole = "closest" | "premium" | "step-up";
type SearchAngleIntent =
  | "accessory"
  | "budget"
  | "exact"
  | "gift-ready"
  | "generic"
  | "premium";

function normalizeAngleQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectSearchAngleIntent(searchQuery: string, itemName: string): SearchAngleIntent {
  const normalizedQuery = normalizeAngleQuery(searchQuery);
  const normalizedItemName = normalizeAngleQuery(itemName);

  if (normalizedQuery === normalizedItemName) {
    return "exact";
  }

  if (/\b(accessories|accessory|bundle|case|stand|mount|adapter|cable|cover)\b/.test(normalizedQuery)) {
    return "accessory";
  }

  if (/\b(gift set|gift box|gift pack|bundle|kit|set)\b/.test(normalizedQuery)) {
    return "gift-ready";
  }

  if (/\b(budget|affordable|entry|starter|cheap)\b/.test(normalizedQuery)) {
    return "budget";
  }

  if (/\b(premium|high end|highest|luxury|upgrade|pro|max|ultra)\b/.test(normalizedQuery)) {
    return "premium";
  }

  return "generic";
}

function doesProductMatchKeywordGroup(
  productName: string,
  keywords: string[]
): boolean {
  const haystack = productName.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function filterMatchesByKeywords<
  T extends { product: { productName: string } },
>(matches: T[], keywords: string[]): T[] {
  return matches.filter((match) =>
    doesProductMatchKeywordGroup(match.product.productName, keywords)
  );
}

function filterMatchesByMinimumPrice<
  T extends { product: { discountedPrice: number | null; salePrice: number | null } },
>(matches: T[], minimumPrice: number): T[] {
  return matches.filter((match) => {
    const price = getLazadaFeedProductPrice(match.product);
    return price !== null && price >= minimumPrice;
  });
}

function filterMatchesByMaximumPrice<
  T extends { product: { discountedPrice: number | null; salePrice: number | null } },
>(matches: T[], maximumPrice: number): T[] {
  return matches.filter((match) => {
    const price = getLazadaFeedProductPrice(match.product);
    return price !== null && price <= maximumPrice;
  });
}

function sortMatchesByPriceAscending<
  T extends { product: { discountedPrice: number | null; salePrice: number | null } },
>(matches: T[]): T[] {
  return [...matches].sort((left, right) => {
    const leftPrice = getLazadaFeedProductPrice(left.product) ?? Number.POSITIVE_INFINITY;
    const rightPrice = getLazadaFeedProductPrice(right.product) ?? Number.POSITIVE_INFINITY;

    return leftPrice - rightPrice;
  });
}

function buildRoleOrderedMatches<T extends { product: { itemId: string; discountedPrice: number | null; salePrice: number | null } }>(
  primaryMatches: T[],
  premiumCandidates?: T[],
  groupBudget?: number | null
): Array<{ match: T; role: MatchCardRole }> {
  const uniqueMatches = primaryMatches.filter(
    (match, index, array) =>
      array.findIndex((candidate) => candidate.product.itemId === match.product.itemId) === index
  );

  if (uniqueMatches.length === 0) {
    return [];
  }

  const closest = uniqueMatches[0];
  const basePrice = getLazadaFeedProductPrice(closest.product);

  let stepUp: T | null = null;
  let premium: T | null = null;

  const premiumPoolSource = (premiumCandidates || primaryMatches).filter(
    (candidate, index, array) =>
      array.findIndex((existing) => existing.product.itemId === candidate.product.itemId) === index
  );
  const budgetFloor = Math.max(groupBudget ?? 0, basePrice ?? 0);
  const stepUpPool = premiumPoolSource.filter((candidate) => {
    if (candidate.product.itemId === closest.product.itemId) {
      return false;
    }

    const candidatePrice = getLazadaFeedProductPrice(candidate.product);

    if (candidatePrice === null) {
      return false;
    }

    return candidatePrice > budgetFloor;
  });

  if (stepUpPool.length > 0) {
    stepUp =
      [...stepUpPool].sort((left, right) => {
        const leftPrice = getLazadaFeedProductPrice(left.product) ?? Number.POSITIVE_INFINITY;
        const rightPrice = getLazadaFeedProductPrice(right.product) ?? Number.POSITIVE_INFINITY;

        return leftPrice - rightPrice;
      })[0] || null;
  }

  const premiumPool = premiumPoolSource.filter(
    (candidate) =>
      candidate.product.itemId !== closest.product.itemId &&
      candidate.product.itemId !== stepUp?.product.itemId
  );

  if (premiumPool.length > 0) {
    premium =
      [...premiumPool].sort((left, right) => {
        const leftPrice = getLazadaFeedProductPrice(left.product) ?? Number.NEGATIVE_INFINITY;
        const rightPrice = getLazadaFeedProductPrice(right.product) ?? Number.NEGATIVE_INFINITY;

        if (rightPrice !== leftPrice) {
          return rightPrice - leftPrice;
        }

        return 0;
      })[0] || null;
  }

  const ordered: Array<{ match: T; role: MatchCardRole }> = [
    { match: closest, role: "closest" },
  ];

  if (stepUp) {
    ordered.push({ match: stepUp, role: "step-up" });
  }

  if (premium) {
    ordered.push({ match: premium, role: "premium" });
  }

  return ordered.slice(0, 3);
}

function buildMatchFitLabel(role: MatchCardRole): string {
  if (role === "closest") {
    return "Closest match";
  }

  if (role === "step-up") {
    return "Step-up option";
  }

  return "Highest-price option";
}

function buildMatchSubtitle(role: MatchCardRole): string {
  if (role === "closest") {
    return "Best overall fit for the wishlist wording.";
  }

  if (role === "step-up") {
    return "A sensible spend-more option if you want something stronger.";
  }

  return "A pricier step-up if you want a more premium pick.";
}

function buildMatchWhyItFits(
  role: MatchCardRole,
  reasons: string[],
  productPrice: number | null,
  basePrice: number | null
): string {
  if (role === "closest") {
    return "This is the strongest overall match for the wishlist wording and gift theme.";
  }

  if (role === "step-up") {
    if (productPrice !== null && basePrice !== null && productPrice > basePrice) {
      return "This stays in the same gift direction while stepping up to a more substantial price point.";
    }

    return "This is the next sensible spend-up option in the same gift direction.";
  }

  if (productPrice !== null && basePrice !== null && productPrice > basePrice) {
    return "This is the more premium step-up if you are comfortable spending more.";
  }

  if (reasons.includes("price fit")) {
    return "This is a stronger spend-up option without drifting too far from the original gift idea.";
  }

  return "This is the higher-end option for the same general gift direction.";
}

function isAcceptableDirectMatch(
  match: LazadaFeedMatch,
  role: MatchCardRole,
  searchAngleIntent: SearchAngleIntent
): boolean {
  const confidence = getLazadaFeedMatchConfidence(match);
  const hasSemanticAnchor =
    match.reasons.includes("search overlap") ||
    match.reasons.includes("item title overlap") ||
    match.reasons.includes("core intent match");

  if (!hasSemanticAnchor) {
    return false;
  }

  if (role === "closest") {
    if (searchAngleIntent === "premium" || searchAngleIntent === "accessory" || searchAngleIntent === "gift-ready") {
      return confidence !== "low";
    }

    return confidence === "high";
  }

  return confidence !== "low";
}

function getConfidentRoleMatches(
  roleMatches: Array<{ match: LazadaFeedMatch; role: MatchCardRole }>,
  searchAngleIntent: SearchAngleIntent
): Array<{ match: LazadaFeedMatch; role: MatchCardRole }> {
  const closest = roleMatches.find((entry) => entry.role === "closest");

  if (!closest || !isAcceptableDirectMatch(closest.match, closest.role, searchAngleIntent)) {
    return [];
  }

  const confidentMatches: Array<{ match: LazadaFeedMatch; role: MatchCardRole }> = [closest];
  const stepUp = roleMatches.find((entry) => entry.role === "step-up");
  const premium = roleMatches.find((entry) => entry.role === "premium");

  if (stepUp && isAcceptableDirectMatch(stepUp.match, stepUp.role, searchAngleIntent)) {
    confidentMatches.push(stepUp);
  }

  if (premium && isAcceptableDirectMatch(premium.match, premium.role, searchAngleIntent)) {
    confidentMatches.push(premium);
  }

  return confidentMatches;
}

function buildSearchFallbackCards(input: {
  groupBudget: number | null;
  groupId: string;
  itemCategory: string;
  itemName: string;
  itemNote: string;
  limit: number;
  preferredPriceMax: number | null;
  preferredPriceMin: number | null;
  region: ShoppingRegion;
  searchQuery: string;
  wishlistItemId: string;
  excludeSearchQueries?: string[];
}): WishlistFeaturedProductCard[] {
  const normalizedSelectedQuery = normalizeAngleQuery(input.searchQuery);
  const excludedQueries = new Set(
    (input.excludeSearchQueries || []).map((query) => normalizeAngleQuery(query))
  );
  const fallbackProducts = getLazadaStarterProducts({
    itemName: input.itemName,
    itemCategory: input.itemCategory,
    itemNote: input.itemNote,
    searchQuery: input.searchQuery,
    preferredPriceMin: input.preferredPriceMin,
    preferredPriceMax: input.preferredPriceMax,
    groupBudget: input.groupBudget,
  })
    .filter((product) => product.source === "search-backed")
    .sort((left, right) => {
      const leftSelected = normalizeAngleQuery(left.searchQuery) === normalizedSelectedQuery ? 0 : 1;
      const rightSelected = normalizeAngleQuery(right.searchQuery) === normalizedSelectedQuery ? 0 : 1;

      if (leftSelected !== rightSelected) {
        return leftSelected - rightSelected;
      }

      return 0;
    })
    .filter((product) => !excludedQueries.has(normalizeAngleQuery(product.searchQuery)))
    .slice(0, input.limit);

  return fallbackProducts.map((product, index) => {
    const fitLabel =
      normalizeAngleQuery(product.searchQuery) === normalizedSelectedQuery
        ? "Selected angle"
        : index === 0
          ? "Closest to request"
          : "Search route";
    const trackingLabel = "Search route";

    return {
      id: `fallback-lazada-${input.wishlistItemId}-${product.id}-${index}`,
      merchant: "lazada",
      merchantLabel: "Lazada",
      catalogSource: "search-backed",
      imageUrl: null,
      productId: null,
      skuId: null,
      title: product.title,
      subtitle: product.subtitle,
      href: buildTrackedSuggestionHref(
        "lazada",
        input.groupId,
        input.wishlistItemId,
        product.searchQuery,
        product.title,
        input.region,
        {
          catalogSource: "search-backed",
          fitLabel,
          groupBudget: input.groupBudget,
          itemCategory: input.itemCategory,
          itemName: input.itemName,
          itemNote: input.itemNote,
          preferredPriceMax: input.preferredPriceMax,
          preferredPriceMin: input.preferredPriceMin,
          trackingLabel,
        }
      ),
      searchQuery: product.searchQuery,
      priceLabel:
        input.groupBudget !== null
          ? `Budget target: ${formatPriceRange(input.groupBudget, input.groupBudget, "PHP")}`
          : null,
      fitLabel,
      whyItFits: product.whyItFits,
      trackingLabel,
    };
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: MatchProductsBody;

  try {
    payload = (await request.json()) as MatchProductsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const groupId = sanitizeString(payload.groupId);
  const wishlistItemId = sanitizeString(payload.wishlistItemId);
  const itemName = sanitizeString(payload.itemName);
  const itemCategory = sanitizeString(payload.itemCategory);
  const itemNote = sanitizeString(payload.itemNote);
  const searchQuery = sanitizeString(payload.searchQuery);
  const region = sanitizeString(payload.region);

  if (
    !groupId ||
    !wishlistItemId ||
    !itemName ||
    !searchQuery ||
    !isShoppingRegion(region) ||
    region !== "PH"
  ) {
    return NextResponse.json({ products: [] satisfies WishlistFeaturedProductCard[] });
  }

  const preferredPriceMin = sanitizeOptionalNumber(payload.preferredPriceMin);
  const preferredPriceMax = sanitizeOptionalNumber(payload.preferredPriceMax);
  const groupBudget = sanitizeOptionalNumber(payload.groupBudget);
  const searchAngleIntent = detectSearchAngleIntent(searchQuery, itemName);

  const matches = findBestLazadaFeedMatches({
    itemName,
    itemCategory,
    itemNote,
    searchQuery,
    preferredPriceMin,
    preferredPriceMax,
    groupBudget,
    limit: 8,
    minimumScore: 0.5,
  });
  const premiumMatches = findBestLazadaFeedMatches({
    itemName,
    itemCategory,
    itemNote,
    searchQuery,
    budgetMode: "minimum-only",
    preferredPriceMin,
    preferredPriceMax,
    groupBudget,
    limit: 12,
    minimumScore: 0.5,
  });
  let primaryMatches = matches;
  let premiumCandidates = premiumMatches;

  if (searchAngleIntent === "budget") {
    const budgetCap =
      preferredPriceMax ??
      (groupBudget !== null ? Math.max(groupBudget, groupBudget + 200) : null);

    if (budgetCap !== null) {
      const lowerPriceMatches = filterMatchesByMaximumPrice(matches, budgetCap);

      if (lowerPriceMatches.length > 0) {
        primaryMatches = sortMatchesByPriceAscending(lowerPriceMatches);
      }
    }
  }

  if (searchAngleIntent === "premium") {
    const premiumFloor =
      groupBudget !== null
        ? Math.max(groupBudget * 1.5, groupBudget + 300)
        : preferredPriceMin !== null
          ? Math.max(preferredPriceMin * 1.5, preferredPriceMin + 300)
          : 0;

    const strongerPremiumMatches = filterMatchesByMinimumPrice(
      premiumMatches,
      premiumFloor
    );

    primaryMatches = strongerPremiumMatches.length > 0 ? strongerPremiumMatches : [];
    premiumCandidates = strongerPremiumMatches.length > 0 ? strongerPremiumMatches : [];
  }

  if (searchAngleIntent === "gift-ready") {
    const giftMatches = filterMatchesByKeywords(matches, [
      "gift",
      "set",
      "bundle",
      "kit",
      "box",
      "pack",
    ]);
    primaryMatches = giftMatches;
    premiumCandidates = giftMatches;
  }

  if (searchAngleIntent === "accessory") {
    const accessoryMatches = filterMatchesByKeywords(matches, [
      "accessor",
      "case",
      "stand",
      "mount",
      "adapter",
      "cable",
      "cover",
      "bundle",
      "kit",
    ]);
    primaryMatches = accessoryMatches;
    premiumCandidates = accessoryMatches;
  }

  const orderedMatches = buildRoleOrderedMatches(primaryMatches, premiumCandidates, groupBudget);
  const confidentRoleMatches = getConfidentRoleMatches(orderedMatches, searchAngleIntent);
  const basePrice = confidentRoleMatches[0]
    ? getLazadaFeedProductPrice(confidentRoleMatches[0].match.product)
    : null;

  if (confidentRoleMatches.length > 0) {
    try {
      await primeLazadaPromotionLinks({
        productIds: confidentRoleMatches.map(({ match }) => match.product.itemId),
      });
    } catch {
      // Priming only improves click performance. The suggestion route still resolves links on click.
    }
  }

  const directProducts: WishlistFeaturedProductCard[] = confidentRoleMatches.map(
    ({ match, role }, index) => {
      const lazadaPrice = getLazadaFeedProductPrice(match.product);
      const fitLabel = buildMatchFitLabel(role);
      const trackingLabel = "Matched product";

      return {
        id: `lazada-match-${wishlistItemId}-${match.product.itemId}-${index}`,
        merchant: "lazada",
        merchantLabel: "Lazada",
        catalogSource: "catalog-product",
        imageUrl: match.product.pictureUrl,
        productId: match.product.itemId,
        skuId: match.product.skuId || null,
        title: match.product.productName,
        subtitle: buildMatchSubtitle(role),
        href: buildTrackedSuggestionHref(
          "lazada",
          groupId,
          wishlistItemId,
          match.product.productName,
          match.product.productName,
          region,
          {
            catalogSource: "catalog-product",
            fitLabel,
            groupBudget,
            itemCategory,
            itemName,
            itemNote,
            productId: match.product.itemId,
            preferredPriceMax,
            preferredPriceMin,
            skuId: match.product.skuId || null,
            trackingLabel,
          }
        ),
        searchQuery: match.product.productName,
        priceLabel:
          lazadaPrice !== null ? formatPriceRange(lazadaPrice, lazadaPrice, "PHP") : null,
        fitLabel,
        whyItFits: buildMatchWhyItFits(role, match.reasons, lazadaPrice, basePrice),
        trackingLabel,
      };
    }
  );

  const searchFallbackCards = buildSearchFallbackCards({
    groupBudget,
    groupId,
    itemCategory,
    itemName,
    itemNote,
    limit: Math.max(3 - directProducts.length, 0),
    preferredPriceMax,
    preferredPriceMin,
    region,
    searchQuery,
    wishlistItemId,
    excludeSearchQueries: directProducts.length > 0 ? [searchQuery] : [],
  });

  const products =
    directProducts.length > 0
      ? [...directProducts, ...searchFallbackCards].slice(0, 3)
      : buildSearchFallbackCards({
          groupBudget,
          groupId,
          itemCategory,
          itemName,
          itemNote,
          limit: 3,
          preferredPriceMax,
          preferredPriceMin,
          region,
          searchQuery,
          wishlistItemId,
        });

  return NextResponse.json({ products });
}
