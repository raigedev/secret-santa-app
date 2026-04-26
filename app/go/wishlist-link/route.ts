import { NextRequest, NextResponse } from "next/server";

import {
  buildLazadaClickToken,
  createLazadaClickToken,
  resolveLazadaWishlistItemLinkTarget,
} from "@/lib/affiliate/lazada";
import type { LazadaAffiliateAttributionContext } from "@/lib/affiliate/lazada";
import { insertAffiliateClick } from "@/lib/affiliate/click-tracking";
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
import { requireWishlistAffiliateRedirectAccess } from "@/lib/affiliate/redirect-route";
import { recordServerFailure } from "@/lib/security/audit";
import { isUuid } from "@/lib/validation/common";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const groupId = searchParams.get("groupId");
  const wishlistItemId = searchParams.get("itemId");
  const itemName = searchParams.get("name")?.trim() || "Wishlist item";
  const itemUrl = searchParams.get("url")?.trim() || "";

  const normalizedItemUrl = normalizeLazadaProductPageUrl(itemUrl);

  if (
    !isUuid(groupId) ||
    !isUuid(wishlistItemId) ||
    !normalizedItemUrl
  ) {
    return NextResponse.redirect(new URL("/secret-santa", request.url));
  }

  const redirectAccess = await requireWishlistAffiliateRedirectAccess({
    accessFailureEventType: "affiliate.redirect.wishlist_link.access_lookup_failed",
    groupId,
    path: "/go/wishlist-link",
    rateLimitAction: "affiliate.redirect.wishlist_link",
    rateLimitSubjectPrefix: "wishlist-link",
    request,
    wishlistItemId,
  });

  if (!redirectAccess.allowed) {
    return redirectAccess.response;
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
    await insertAffiliateClick({
      user_id: redirectAccess.userId,
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown affiliate wishlist click tracking error.";

    await recordServerFailure({
      actorUserId: redirectAccess.userId,
      details: {
        groupId,
        path: "/go/wishlist-link",
        wishlistItemId,
      },
      errorMessage: message,
      eventType: "affiliate.redirect.wishlist_link.click_insert_failed",
      resourceId: wishlistItemId,
      resourceType: "affiliate_redirect",
    });
  }

  return NextResponse.redirect(lazadaTarget.targetUrl);
}
