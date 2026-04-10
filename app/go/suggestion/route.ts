import { NextRequest, NextResponse } from "next/server";

import {
  buildLazadaClickToken,
  resolveLazadaSearchRouteLinkTarget,
  resolveLazadaSuggestionLinkTarget,
} from "@/lib/affiliate/lazada";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

  let targetUrl = buildMerchantDestinationUrl(merchant, searchQuery, region);
  let lazadaResolution:
    | {
        mode: string;
        reason: string;
      }
    | null = null;
  const clickToken =
    merchant === "lazada"
      ? buildLazadaClickToken({
          catalogSource,
          fitLabel,
          groupId,
          productId,
          searchQuery,
          selectedQuery,
          skuId,
          trackingLabel,
          wishlistItemId,
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
            attribution: {
              catalogSource,
              fitLabel,
              groupId,
              trackingLabel,
              wishlistItemId,
            },
            fallbackUrl: targetUrl,
            searchQuery,
          })
        : await resolveLazadaSuggestionLinkTarget({
            attribution: {
              catalogSource,
              fitLabel,
              groupId,
              trackingLabel,
              wishlistItemId,
            },
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
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabaseAdmin.from("affiliate_clicks").insert({
      user_id: user?.id || null,
      group_id: groupId,
      wishlist_item_id: wishlistItemId,
      merchant,
      suggestion_title: suggestionTitle.slice(0, 120),
      catalog_source: catalogSource,
      click_token: clickToken,
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
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 200),
      selected_query: selectedQuery.slice(0, 200),
      target_url: targetUrl.slice(0, 1000),
      tracking_label: trackingLabel,
    });
  } catch {
    // Click tracking should never block the user from reaching the merchant page.
  }

  return NextResponse.redirect(targetUrl);
}
