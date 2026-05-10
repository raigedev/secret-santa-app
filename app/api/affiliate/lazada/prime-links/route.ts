import { NextRequest, NextResponse } from "next/server";

import { primeLazadaPromotionLinks } from "@/lib/affiliate/lazada";
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
import { requireAuthenticatedAffiliateRoute } from "../_shared/authenticated-affiliate-route";

const MAX_BATCH_INPUTS = 100;
const LAZADA_PRODUCT_ID_PATTERN = /^[0-9]{1,20}$/;

type PrimeLinksBody = {
  productIds?: unknown;
  urls?: unknown;
};

function sanitizeProductIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((productId) => (typeof productId === "string" ? productId.trim() : ""))
        .filter((productId) => LAZADA_PRODUCT_ID_PATTERN.test(productId))
    )
  ).slice(0, MAX_BATCH_INPUTS);
}

function sanitizeUrls(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((url) => (typeof url === "string" ? normalizeLazadaProductPageUrl(url) : null))
        .filter((url): url is string => Boolean(url))
    )
  ).slice(0, MAX_BATCH_INPUTS);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedAffiliateRoute({
    action: "affiliate.lazada.prime_links",
    maxAttempts: 60,
    resourceId: "lazada",
    resourceType: "affiliate_redirect",
    windowSeconds: 3600,
  });

  if (!auth.ok) {
    return auth.response;
  }

  let payload: PrimeLinksBody;

  try {
    payload = (await request.json()) as PrimeLinksBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const productIds = sanitizeProductIds(payload.productIds);
  const urls = sanitizeUrls(payload.urls);

  if (productIds.length === 0 && urls.length === 0) {
    return NextResponse.json({
      primed: false,
      productIdsPrimed: 0,
      urlsPrimed: 0,
    });
  }

  try {
    const result = await primeLazadaPromotionLinks({
      productIds,
      urls,
    });

    return NextResponse.json({
      primed: result.ready,
      productIdsPrimed: result.productIdsPrimed,
      urlsPrimed: result.urlsPrimed,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to prime Lazada promotion links",
      },
      { status: 500 }
    );
  }
}
