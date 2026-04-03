import { NextRequest, NextResponse } from "next/server";

import { findBestLazadaFeedMatches } from "@/lib/affiliate/lazada-feed";
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

type MatchCardRole = "alternate" | "closest" | "premium";

function getMatchProductPrice(
  match: { product: { discountedPrice: number | null; salePrice: number | null } }
): number | null {
  return match.product.discountedPrice ?? match.product.salePrice;
}

function buildRoleOrderedMatches<T extends { product: { itemId: string; discountedPrice: number | null; salePrice: number | null } }>(
  matches: T[]
): Array<{ match: T; role: MatchCardRole }> {
  const uniqueMatches = matches.filter(
    (match, index, array) =>
      array.findIndex((candidate) => candidate.product.itemId === match.product.itemId) === index
  );

  if (uniqueMatches.length === 0) {
    return [];
  }

  const closest = uniqueMatches[0];
  const remaining = uniqueMatches.slice(1);
  const basePrice = getMatchProductPrice(closest);

  let alternate: T | null = null;
  let premium: T | null = null;

  if (remaining.length > 0) {
    alternate =
      remaining.find((candidate) => {
        const candidatePrice = getMatchProductPrice(candidate);

        if (basePrice === null || candidatePrice === null) {
          return true;
        }

        return candidatePrice <= basePrice * 1.2;
      }) || remaining[0];
  }

  const premiumPool = remaining.filter(
    (candidate) => candidate.product.itemId !== alternate?.product.itemId
  );

  if (premiumPool.length > 0) {
    premium =
      [...premiumPool].sort((left, right) => {
        const leftPrice = getMatchProductPrice(left) ?? Number.NEGATIVE_INFINITY;
        const rightPrice = getMatchProductPrice(right) ?? Number.NEGATIVE_INFINITY;

        if (rightPrice !== leftPrice) {
          return rightPrice - leftPrice;
        }

        return 0;
      })[0] || null;
  }

  const ordered: Array<{ match: T; role: MatchCardRole }> = [
    { match: closest, role: "closest" },
  ];

  if (alternate) {
    ordered.push({ match: alternate, role: "alternate" });
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

  if (role === "alternate") {
    return "Alternate option";
  }

  return "Higher-budget option";
}

function buildMatchSubtitle(role: MatchCardRole): string {
  if (role === "closest") {
    return "Best overall fit for the wishlist wording.";
  }

  if (role === "alternate") {
    return "A similar option if you want a different take first.";
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

  if (role === "alternate") {
    if (productPrice !== null && basePrice !== null && productPrice < basePrice) {
      return "This keeps the same idea but gives you a lighter price option to consider.";
    }

    return "This keeps the same idea while giving you a different style or price point.";
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

  const budgetAlignedMatches =
    groupBudget !== null
      ? matches.filter((match) => {
          const price = getMatchProductPrice(match);
          return price !== null && price >= groupBudget;
        })
      : matches;

  const orderedMatches = buildRoleOrderedMatches(budgetAlignedMatches);
  const basePrice = orderedMatches[0] ? getMatchProductPrice(orderedMatches[0].match) : null;

  const products: WishlistFeaturedProductCard[] = orderedMatches.map(({ match, role }, index) => {
    const lazadaPrice = getMatchProductPrice(match);

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

  return NextResponse.json({ products });
}
