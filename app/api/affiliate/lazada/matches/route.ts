import { NextRequest, NextResponse } from "next/server";

import {
  findBestLazadaFeedMatches,
  getLazadaFeedProductPrice,
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

function sortMatchesByPriceAscending<
  T extends { product: { discountedPrice: number | null; salePrice: number | null } },
>(matches: T[]): T[] {
  return [...matches].sort((left, right) => {
    const leftPrice = getLazadaFeedProductPrice(left.product) ?? Number.POSITIVE_INFINITY;
    const rightPrice = getLazadaFeedProductPrice(right.product) ?? Number.POSITIVE_INFINITY;

    return leftPrice - rightPrice;
  });
}

function sortMatchesByPriceDescending<
  T extends { product: { discountedPrice: number | null; salePrice: number | null } },
>(matches: T[]): T[] {
  return [...matches].sort((left, right) => {
    const leftPrice = getLazadaFeedProductPrice(left.product) ?? Number.NEGATIVE_INFINITY;
    const rightPrice = getLazadaFeedProductPrice(right.product) ?? Number.NEGATIVE_INFINITY;

    return rightPrice - leftPrice;
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
  const orderedMatches = buildRoleOrderedMatches(matches, premiumMatches, groupBudget);
  const premiumFloor = groupBudget ?? preferredPriceMin ?? 0;
  const premiumStepUpMatch =
    orderedMatches.length === 0
      ? sortMatchesByPriceAscending(premiumMatches).find((candidate) => {
          const candidatePrice = getLazadaFeedProductPrice(candidate.product);

          return candidatePrice !== null && candidatePrice > premiumFloor;
        }) || null
      : null;
  const premiumOnlyMatch =
    orderedMatches.length === 0
      ? sortMatchesByPriceDescending(premiumMatches).find(
          (candidate) => candidate.product.itemId !== premiumStepUpMatch?.product.itemId
        ) ||
        (premiumStepUpMatch
          ? null
          : sortMatchesByPriceDescending(premiumMatches)[0] || null)
      : null;
  const fallbackRoleMatches: Array<{
    match: (typeof premiumMatches)[number];
    role: MatchCardRole;
  }> = [];

  if (premiumStepUpMatch) {
    fallbackRoleMatches.push({
      match: premiumStepUpMatch,
      role: "step-up",
    });
  }

  if (premiumOnlyMatch) {
    fallbackRoleMatches.push({
      match: premiumOnlyMatch,
      role: "premium",
    });
  }

  const effectiveRoleMatches =
    orderedMatches.length > 0
      ? orderedMatches
      : fallbackRoleMatches;
  const basePrice = effectiveRoleMatches[0]
    ? getLazadaFeedProductPrice(effectiveRoleMatches[0].match.product)
    : null;

  if (effectiveRoleMatches.length > 0) {
    try {
      await primeLazadaPromotionLinks({
        productIds: effectiveRoleMatches.map(({ match }) => match.product.itemId),
      });
    } catch {
      // Priming only improves click performance. The suggestion route still resolves links on click.
    }
  }

  const products: WishlistFeaturedProductCard[] = effectiveRoleMatches.map(({ match, role }, index) => {
    const lazadaPrice = getLazadaFeedProductPrice(match.product);

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
          groupBudget,
          itemCategory,
          itemName,
          itemNote,
          productId: match.product.itemId,
          preferredPriceMax,
          preferredPriceMin,
          skuId: match.product.skuId || null,
        }
      ),
      searchQuery: match.product.productName,
      priceLabel: lazadaPrice !== null ? formatPriceRange(lazadaPrice, lazadaPrice, "PHP") : null,
      fitLabel: buildMatchFitLabel(role),
      whyItFits: buildMatchWhyItFits(role, match.reasons, lazadaPrice, basePrice),
      trackingLabel: "Matched product",
    };
  });

  if (orderedMatches.length === 0 && products.length > 0) {
    const fallbackProducts = getLazadaStarterProducts({
      itemName,
      itemCategory,
      itemNote,
      searchQuery,
      preferredPriceMin,
      preferredPriceMax,
      groupBudget,
    });
    const searchFallbackCards: WishlistFeaturedProductCard[] = fallbackProducts
      .filter((product) => product.source === "search-backed")
      .slice(0, 1)
      .map((product, index) => ({
        id: `fallback-lazada-${wishlistItemId}-${product.id}-${index}`,
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
          groupId,
          wishlistItemId,
          product.searchQuery,
          product.title,
          region,
          {
            catalogSource: "search-backed",
            groupBudget,
            itemCategory,
            itemName,
            itemNote,
            preferredPriceMax,
            preferredPriceMin,
          }
        ),
        searchQuery: product.searchQuery,
        priceLabel:
          groupBudget !== null
            ? `Budget target: ${formatPriceRange(groupBudget, groupBudget, "PHP")}`
            : null,
        fitLabel: index === 0 ? "Closest to request" : "Step-up option",
        whyItFits: product.whyItFits,
        trackingLabel: "Search route",
      }));

    return NextResponse.json({
      products: [...searchFallbackCards, ...products].slice(0, 3),
    });
  }

  return NextResponse.json({ products });
}
