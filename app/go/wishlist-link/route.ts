import { NextRequest, NextResponse } from "next/server";

import {
  buildLazadaClickToken,
  createLazadaClickToken,
  resolveLazadaWishlistItemLinkTarget,
} from "@/lib/affiliate/lazada";
import type { LazadaAffiliateAttributionContext } from "@/lib/affiliate/lazada";
import { insertAffiliateClick } from "@/lib/affiliate/click-tracking";
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
import { recordServerFailure } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { extractRequestClientIp } from "@/lib/security/web";
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

  const clientIp = extractRequestClientIp(request.headers) || "unknown";
  const rateLimit = await enforceRateLimit({
    action: "affiliate.redirect.wishlist_link",
    maxAttempts: 100,
    resourceId: wishlistItemId,
    resourceType: "affiliate_redirect",
    subject: `wishlist-link:${clientIp}`,
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

  let actorUserId: string | null = null;

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
      actorUserId,
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
