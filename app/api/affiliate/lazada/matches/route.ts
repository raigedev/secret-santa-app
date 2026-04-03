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

function buildMatchFitLabel(score: number): string {
  if (score >= 0.92) {
    return "Closest match";
  }

  if (score >= 0.84) {
    return "Strong match";
  }

  return "Good match";
}

function buildMatchSubtitle(brand: string | null, category: string | null): string {
  const parts = [brand, category].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" - ");
  }

  return "Matched from the Lazada affiliate feed.";
}

function buildMatchWhyItFits(reasons: string[]): string {
  if (reasons.length === 0) {
    return "Matched from the Lazada affiliate feed using the wishlist wording.";
  }

  return `Matched from the Lazada affiliate feed: ${reasons.join(", ")}.`;
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
    limit: 3,
    minimumScore: 0.72,
  });

  const products: WishlistFeaturedProductCard[] = matches.map((match, index) => {
    const lazadaPrice = match.product.discountedPrice ?? match.product.salePrice;

    return {
      id: `lazada-match-${wishlistItemId}-${match.product.itemId}-${index}`,
      merchant: "lazada",
      merchantLabel: "Lazada",
      catalogSource: "catalog-product",
      productId: match.product.itemId,
      skuId: match.product.skuId || null,
      title: match.product.productName,
      subtitle: buildMatchSubtitle(match.product.brand, match.product.categoryLv1),
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
      fitLabel: buildMatchFitLabel(match.score),
      whyItFits: buildMatchWhyItFits(match.reasons),
      trackingLabel: "Direct product link",
    };
  });

  return NextResponse.json({ products });
}
