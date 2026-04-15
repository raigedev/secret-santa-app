import { NextRequest, NextResponse } from "next/server";

import {
  buildLazadaClickToken,
  createLazadaClickToken,
  resolveLazadaWishlistItemLinkTarget,
} from "@/lib/affiliate/lazada";
import type { LazadaAffiliateAttributionContext } from "@/lib/affiliate/lazada";
import { insertAffiliateClick } from "@/lib/affiliate/click-tracking";
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const groupId = searchParams.get("groupId");
  const wishlistItemId = searchParams.get("itemId");
  const itemName = searchParams.get("name")?.trim() || "Wishlist item";
  const itemUrl = searchParams.get("url")?.trim() || "";

  const normalizedItemUrl = normalizeLazadaProductPageUrl(itemUrl);

  if (!groupId || !wishlistItemId || !normalizedItemUrl) {
    return NextResponse.redirect(new URL("/secret-santa", request.url));
  }

  const uniqueClickToken = createLazadaClickToken();
  const lazadaAttribution: Omit<LazadaAffiliateAttributionContext, "searchQuery"> = {
    catalogSource: "wishlist-product",
    clickToken: uniqueClickToken,
    fitLabel: "Wishlist item",
    groupId,
    selectedQuery: itemName,
    trackingLabel: "Partner link",
    wishlistItemId,
  };
  const lazadaTarget = await resolveLazadaWishlistItemLinkTarget({
    attribution: lazadaAttribution,
    fallbackUrl: normalizedItemUrl,
    itemName,
    itemUrl: normalizedItemUrl,
  });
  const savedClickToken = buildLazadaClickToken({
    searchQuery: itemName,
    ...lazadaAttribution,
  });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await insertAffiliateClick({
      user_id: user?.id || null,
      group_id: groupId,
      wishlist_item_id: wishlistItemId,
      merchant: "lazada",
      catalog_source: "wishlist-product",
      click_token: savedClickToken,
      fit_label: "Wishlist item",
      resolution_mode: lazadaTarget.mode,
      resolution_reason: lazadaTarget.reason,
      selected_query: itemName.slice(0, 200),
      suggestion_title: itemName.slice(0, 120),
      search_query: [
        normalizedItemUrl,
        "wishlist-product",
        "Wishlist item",
        "Partner link",
        lazadaTarget.mode,
        lazadaTarget.reason,
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 200),
      target_url: lazadaTarget.targetUrl.slice(0, 1000),
      tracking_label: "Partner link",
    });
  } catch {
    // Tracking should never block the shopper from reaching Lazada.
  }

  return NextResponse.redirect(lazadaTarget.targetUrl);
}
