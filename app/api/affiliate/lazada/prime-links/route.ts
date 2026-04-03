import { NextRequest, NextResponse } from "next/server";

import { primeLazadaPromotionLinks } from "@/lib/affiliate/lazada";
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
import { createClient } from "@/lib/supabase/server";

const MAX_BATCH_INPUTS = 100;

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
        .filter((productId) => productId.length > 0)
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
