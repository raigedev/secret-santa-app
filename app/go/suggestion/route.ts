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
import { resolveTrustedAppOrigin } from "@/lib/security/app-origin";
import {
  AFFILIATE_READY_MERCHANTS,
  buildMerchantDestinationUrl,
  ShoppingRegion,
  SuggestionMerchant,
} from "@/lib/wishlist/suggestions";
import { isSupportedShoppingRegion, isUuid } from "@/lib/validation/common";

const ALLOWED_MERCHANTS: SuggestionMerchant[] = AFFILIATE_READY_MERCHANTS;
const MAX_SUGGESTION_SEARCH_QUERY_LENGTH = 160;
const MAX_SUGGESTION_LABEL_LENGTH = 120;
const MAX_SUGGESTION_METADATA_LENGTH = 80;

function isSuggestionMerchant(value: string | null): value is SuggestionMerchant {
  return Boolean(value) && ALLOWED_MERCHANTS.includes(value as SuggestionMerchant);
}

function readBoundedSearchParam(
  searchParams: URLSearchParams,
  key: string,
  maxLength: number
): string | null {
  const value = searchParams.get(key)?.trim() || "";

  if (value.length > maxLength) {
    return null;
  }

  return value;
}

function readBoundedOptionalSearchParam(
  searchParams: URLSearchParams,
  key: string,
  maxLength: number
): string | null {
  const value = readBoundedSearchParam(searchParams, key, maxLength);

  return value && value.length > 0 ? value : null;
}

// Suggestion clicks are routed through the app so we can log them before handing the user
// off to Amazon, Lazada, or Shopee. The route only builds destinations for known partner
// merchants, which avoids turning it into a generic open redirect endpoint.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const merchant = searchParams.get("merchant");
  const groupId = searchParams.get("groupId");
  const wishlistItemId = searchParams.get("itemId");
  const searchQuery = readBoundedSearchParam(
    searchParams,
    "q",
    MAX_SUGGESTION_SEARCH_QUERY_LENGTH
  );
  const suggestionTitle =
    readBoundedSearchParam(searchParams, "title", MAX_SUGGESTION_LABEL_LENGTH) ||
    "Suggested gift";
  const productId = readBoundedOptionalSearchParam(
    searchParams,
    "productId",
    MAX_SUGGESTION_METADATA_LENGTH
  );
  const skuId = readBoundedOptionalSearchParam(
    searchParams,
    "skuId",
    MAX_SUGGESTION_METADATA_LENGTH
  );
  const catalogSource = readBoundedOptionalSearchParam(
    searchParams,
    "catalogSource",
    MAX_SUGGESTION_METADATA_LENGTH
  );
  const fitLabel = readBoundedOptionalSearchParam(
    searchParams,
    "fitLabel",
    MAX_SUGGESTION_LABEL_LENGTH
  );
  const itemName =
    readBoundedSearchParam(searchParams, "itemName", MAX_SUGGESTION_LABEL_LENGTH) ||
    searchQuery ||
    "";
  const itemCategory =
    readBoundedSearchParam(searchParams, "itemCategory", MAX_SUGGESTION_LABEL_LENGTH) || "";
  const itemNote = "";
  const trackingLabel = readBoundedOptionalSearchParam(
    searchParams,
    "trackingLabel",
    MAX_SUGGESTION_LABEL_LENGTH
  );
  const selectedQuery =
    readBoundedSearchParam(searchParams, "selectedQuery", MAX_SUGGESTION_SEARCH_QUERY_LENGTH) ||
    searchQuery ||
    "";
  const requestedRegion = searchParams.get("region");
  const region: ShoppingRegion = isSupportedShoppingRegion(requestedRegion)
    ? requestedRegion
    : "GLOBAL";

  if (
    !isSuggestionMerchant(merchant) ||
    !isUuid(groupId) ||
    !isUuid(wishlistItemId) ||
    !searchQuery ||
    searchQuery.length === 0
  ) {
    return NextResponse.redirect(
      new URL("/secret-santa", resolveTrustedAppOrigin(request.nextUrl))
    );
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
