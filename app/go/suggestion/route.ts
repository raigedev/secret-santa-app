import { NextRequest, NextResponse } from "next/server";

import {
  buildLazadaClickToken,
  createLazadaClickToken,
  resolveLazadaSearchRouteLinkTarget,
  resolveLazadaSuggestionLinkTarget,
} from "@/lib/affiliate/lazada";
import type { LazadaAffiliateAttributionContext } from "@/lib/affiliate/lazada";
import { insertAffiliateClick } from "@/lib/affiliate/click-tracking";
import { requireWishlistAffiliateRedirectAccess } from "@/lib/affiliate/redirect-route";
import { recordServerFailure } from "@/lib/security/audit";
import {
  AFFILIATE_READY_MERCHANTS,
  buildMerchantDestinationUrl,
  ShoppingRegion,
  SuggestionMerchant,
} from "@/lib/wishlist/suggestions";
import { isSupportedShoppingRegion, isUuid } from "@/lib/validation/common";

const ALLOWED_MERCHANTS: SuggestionMerchant[] = AFFILIATE_READY_MERCHANTS;

function isSuggestionMerchant(value: string | null): value is SuggestionMerchant {
  return Boolean(value) && ALLOWED_MERCHANTS.includes(value as SuggestionMerchant);
}

// Suggestion clicks are routed through the app so we can log them before handing the user
// off to Amazon, Lazada, or Shopee. The route only builds destinations for known partner
// merchants, which avoids turning it into a generic open redirect endpoint.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const merchant = searchParams.get("merchant");
  const groupId = searchParams.get("groupId");
  const wishlistItemId = searchParams.get("itemId");
  const searchQuery = searchParams.get("q")?.trim() || "";
  const suggestionTitle = searchParams.get("title")?.trim() || "Suggested gift";
  const productId = searchParams.get("productId")?.trim() || null;
  const skuId = searchParams.get("skuId")?.trim() || null;
  const catalogSource = searchParams.get("catalogSource")?.trim() || null;
  const fitLabel = searchParams.get("fitLabel")?.trim() || null;
  const itemName = searchParams.get("itemName")?.trim() || searchQuery;
  const itemCategory = searchParams.get("itemCategory")?.trim() || "";
  const itemNote = "";
  const trackingLabel = searchParams.get("trackingLabel")?.trim() || null;
  const selectedQuery = searchParams.get("selectedQuery")?.trim() || searchQuery;
  const requestedRegion = searchParams.get("region");
  const region: ShoppingRegion = isSupportedShoppingRegion(requestedRegion)
    ? requestedRegion
    : "GLOBAL";

  if (
    !isSuggestionMerchant(merchant) ||
    !isUuid(groupId) ||
    !isUuid(wishlistItemId) ||
    searchQuery.length === 0
  ) {
    return NextResponse.redirect(new URL("/secret-santa", request.url));
  }

  const redirectAccess = await requireWishlistAffiliateRedirectAccess({
    accessFailureEventType: "affiliate.redirect.suggestion.access_lookup_failed",
    auditDetails: { merchant },
    groupId,
    path: "/go/suggestion",
    rateLimitAction: "affiliate.redirect.suggestion",
    rateLimitSubjectPrefix: merchant,
    request,
    wishlistItemId,
  });

  if (!redirectAccess.allowed) {
    return redirectAccess.response;
  }

  let targetUrl = buildMerchantDestinationUrl(merchant, searchQuery, region);
  let lazadaResolution:
    | {
        mode: string;
        reason: string;
        resolvedProductId: string | null;
        resolvedTitle: string | null;
      }
    | null = null;
  const clickToken = merchant === "lazada" ? createLazadaClickToken() : null;
  const lazadaAttribution: Omit<LazadaAffiliateAttributionContext, "searchQuery"> = {
    catalogSource,
    clickToken,
    fitLabel,
    groupId,
    productId,
    selectedQuery,
    skuId,
    trackingLabel,
    wishlistItemId,
  };
  const savedClickToken =
    merchant === "lazada"
      ? buildLazadaClickToken({
          searchQuery,
          ...lazadaAttribution,
        })
      : null;

  if (merchant === "lazada") {
    const lazadaTarget =
      catalogSource === "search-backed"
        ? await resolveLazadaSearchRouteLinkTarget({
            attribution: lazadaAttribution,
            fallbackUrl: targetUrl,
            searchQuery,
          })
        : await resolveLazadaSuggestionLinkTarget({
            attribution: lazadaAttribution,
            fallbackUrl: targetUrl,
            groupBudget: null,
            itemCategory,
            itemName,
            itemNote,
            productId,
            preferredPriceMax: null,
            preferredPriceMin: null,
            searchQuery,
          });

    targetUrl = lazadaTarget.targetUrl;
    lazadaResolution = {
      mode: lazadaTarget.mode,
      reason: lazadaTarget.reason,
      resolvedProductId: lazadaTarget.resolvedProductId,
      resolvedTitle: lazadaTarget.resolvedTitle,
    };
  }

  const loggedSuggestionTitle =
    lazadaResolution?.resolvedTitle?.trim() || suggestionTitle;

  try {
    await insertAffiliateClick({
      user_id: redirectAccess.userId,
      group_id: groupId,
      wishlist_item_id: wishlistItemId,
      merchant,
      suggestion_title: loggedSuggestionTitle.slice(0, 120),
      catalog_source: catalogSource,
      click_token: savedClickToken,
      fit_label: fitLabel,
      resolution_mode: lazadaResolution?.mode || null,
      resolution_reason: lazadaResolution?.reason || null,
      search_query: [
        searchQuery,
        productId,
        skuId,
        catalogSource,
        fitLabel,
        trackingLabel,
        lazadaResolution?.mode,
        lazadaResolution?.reason,
        lazadaResolution?.resolvedProductId,
        lazadaResolution?.resolvedTitle,
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 200),
      selected_query: selectedQuery.slice(0, 200),
      target_url: targetUrl.slice(0, 1000),
      tracking_label: trackingLabel,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown affiliate suggestion click tracking error.";

    await recordServerFailure({
      actorUserId: redirectAccess.userId,
      details: {
        groupId,
        merchant,
        path: "/go/suggestion",
        wishlistItemId,
      },
      errorMessage: message,
      eventType: "affiliate.redirect.suggestion.click_insert_failed",
      resourceId: wishlistItemId,
      resourceType: "affiliate_redirect",
    });
  }

  return NextResponse.redirect(targetUrl);
}
