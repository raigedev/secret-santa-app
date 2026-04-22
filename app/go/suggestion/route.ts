import { NextRequest, NextResponse } from "next/server";

import {
  buildLazadaClickToken,
  createLazadaClickToken,
  resolveLazadaSearchRouteLinkTarget,
  resolveLazadaSuggestionLinkTarget,
} from "@/lib/affiliate/lazada";
import type { LazadaAffiliateAttributionContext } from "@/lib/affiliate/lazada";
import { insertAffiliateClick } from "@/lib/affiliate/click-tracking";
import { recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { extractRequestClientIp } from "@/lib/security/web";
import { createClient } from "@/lib/supabase/server";
import {
  AFFILIATE_READY_MERCHANTS,
  buildMerchantDestinationUrl,
  ShoppingRegion,
  SuggestionMerchant,
} from "@/lib/wishlist/suggestions";

const ALLOWED_MERCHANTS: SuggestionMerchant[] = AFFILIATE_READY_MERCHANTS;

function isSuggestionMerchant(value: string | null): value is SuggestionMerchant {
  return Boolean(value) && ALLOWED_MERCHANTS.includes(value as SuggestionMerchant);
}

function isShoppingRegion(value: string | null): value is ShoppingRegion {
  return ["AU", "CA", "GLOBAL", "JP", "PH", "UK", "US"].includes(value || "");
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
  const itemNote = searchParams.get("itemNote")?.trim() || "";
  const preferredPriceMinRaw = searchParams.get("preferredPriceMin");
  const preferredPriceMaxRaw = searchParams.get("preferredPriceMax");
  const groupBudgetRaw = searchParams.get("groupBudget");
  const trackingLabel = searchParams.get("trackingLabel")?.trim() || null;
  const selectedQuery = searchParams.get("selectedQuery")?.trim() || searchQuery;
  const requestedRegion = searchParams.get("region");
  const region: ShoppingRegion = isShoppingRegion(requestedRegion)
    ? requestedRegion
    : "GLOBAL";

  if (
    !isSuggestionMerchant(merchant) ||
    !groupId ||
    !wishlistItemId ||
    searchQuery.length === 0
  ) {
    return NextResponse.redirect(new URL("/secret-santa", request.url));
  }

  const clientIp = extractRequestClientIp(request.headers) || "unknown";
  const rateLimit = await enforceRateLimit({
    action: "affiliate.redirect.suggestion",
    maxAttempts: 100,
    resourceId: wishlistItemId,
    resourceType: "affiliate_redirect",
    subject: `${merchant}:${clientIp}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return new NextResponse(rateLimit.message, {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)),
      },
    });
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

  const preferredPriceMin =
    preferredPriceMinRaw !== null && preferredPriceMinRaw.trim().length > 0
      ? Number(preferredPriceMinRaw)
      : null;
  const preferredPriceMax =
    preferredPriceMaxRaw !== null && preferredPriceMaxRaw.trim().length > 0
      ? Number(preferredPriceMaxRaw)
      : null;
  const groupBudget =
    groupBudgetRaw !== null && groupBudgetRaw.trim().length > 0 ? Number(groupBudgetRaw) : null;

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
            groupBudget: Number.isFinite(groupBudget) ? groupBudget : null,
            itemCategory,
            itemName,
            itemNote,
            productId,
            preferredPriceMax: Number.isFinite(preferredPriceMax) ? preferredPriceMax : null,
            preferredPriceMin: Number.isFinite(preferredPriceMin) ? preferredPriceMin : null,
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

  let actorUserId: string | null = null;
  const loggedSuggestionTitle =
    lazadaResolution?.resolvedTitle?.trim() || suggestionTitle;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    actorUserId = user?.id || null;

    await insertAffiliateClick({
      user_id: actorUserId,
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
      actorUserId,
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
