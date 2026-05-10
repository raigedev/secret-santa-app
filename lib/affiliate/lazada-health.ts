import "server-only";

import { getLazadaOpenApiStatus } from "@/lib/affiliate/lazada";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AffiliateHealthClickRow = {
  click_token: string | null;
  created_at: string;
  id: string;
  resolution_mode: string | null;
  target_url: string | null;
};

type AffiliateConversionPayload = Record<string, unknown>;

export type AffiliateConversionRow = {
  affiliate_click_id: string | null;
  id: string;
  amount: number | string | null;
  click_token: string | null;
  conversion_status: string | null;
  external_order_id: string | null;
  payout: number | string | null;
  raw_payload?: AffiliateConversionPayload | null;
  received_at: string;
};

export type LazadaHealthStatus = {
  checkedAt: string;
  clicksLast24Hours: number;
  ignoredTestConversions: number;
  latestClickAt: string | null;
  missingTokenRecentClicks: number;
  openApiMissingEnvVars: string[];
  openApiReady: boolean;
  postbackSecretConfigured: boolean;
  promotionLinkRecentClicks: number;
  sampledRecentClicks: number;
  status: "healthy" | "watch" | "attention";
  tokenMatchedRecentClicks: number;
  tokenMismatchedRecentClicks: number;
  totalConversions: number;
  unmappedConversions: number;
};

function normalizePayloadDisplayValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizePayloadDisplayValue(item);

      if (normalized) {
        return normalized;
      }
    }
  }

  if (typeof value === "object") {
    const nested = value as Record<string, unknown>;

    return (
      normalizePayloadDisplayValue(nested.productName) ||
      normalizePayloadDisplayValue(nested.product_name) ||
      normalizePayloadDisplayValue(nested.itemName) ||
      normalizePayloadDisplayValue(nested.item_name) ||
      normalizePayloadDisplayValue(nested.title) ||
      normalizePayloadDisplayValue(nested.name) ||
      null
    );
  }

  return null;
}

function getPayloadDisplayValue(
  payload: AffiliateConversionPayload | null | undefined,
  keys: string[]
): string | null {
  if (!payload) {
    return null;
  }

  for (const key of keys) {
    const normalized = normalizePayloadDisplayValue(payload[key]);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function extractConversionProductSummary(
  payload: AffiliateConversionPayload | null | undefined
): {
  productId: string | null;
  skuId: string | null;
  title: string | null;
} {
  return {
    productId: getPayloadDisplayValue(payload, [
      "productId",
      "product_id",
      "itemId",
      "item_id",
      "goodsId",
      "goods_id",
    ]),
    skuId: getPayloadDisplayValue(payload, ["skuId", "sku_id", "sku", "skuid"]),
    title: getPayloadDisplayValue(payload, [
      "productName",
      "product_name",
      "productTitle",
      "product_title",
      "itemName",
      "item_name",
      "goodsName",
      "goods_name",
      "skuName",
      "sku_name",
      "title",
      "name",
    ]),
  };
}

function readLazadaClickTokenFromTarget(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return parsed.searchParams.get("subId6") || parsed.searchParams.get("sub_id6");
  } catch {
    return null;
  }
}

export function isLikelyTestConversion(row: AffiliateConversionRow): boolean {
  const orderId = row.external_order_id?.trim().toLowerCase() || "";
  const clickToken = row.click_token?.trim().toLowerCase() || "";
  const status = row.conversion_status?.trim().toLowerCase() || "";

  return (
    status.startsWith("debug") ||
    status.startsWith("test") ||
    orderId.startsWith("test") ||
    orderId.startsWith("debug") ||
    clickToken === "test" ||
    clickToken === "debug" ||
    clickToken.startsWith("test-") ||
    clickToken.startsWith("debug-")
  );
}

function buildHealthStatus(input: {
  checkedAt: string;
  clicksLast24Hours: number;
  ignoredTestConversions: number;
  latestClicks: AffiliateHealthClickRow[];
  openApiMissingEnvVars: string[];
  openApiReady: boolean;
  postbackSecretConfigured: boolean;
  totalConversions: number;
  unmappedConversions: number;
}): LazadaHealthStatus {
  let missingTokenRecentClicks = 0;
  let promotionLinkRecentClicks = 0;
  let tokenMatchedRecentClicks = 0;
  let tokenMismatchedRecentClicks = 0;

  for (const click of input.latestClicks) {
    const targetClickToken = readLazadaClickTokenFromTarget(click.target_url);

    if (click.resolution_mode === "promotion-link" && targetClickToken) {
      promotionLinkRecentClicks += 1;
    }

    if (!click.click_token || !targetClickToken) {
      missingTokenRecentClicks += 1;
      continue;
    }

    if (click.click_token === targetClickToken) {
      tokenMatchedRecentClicks += 1;
    } else {
      tokenMismatchedRecentClicks += 1;
    }
  }

  const status =
    tokenMismatchedRecentClicks > 0
      ? "attention"
      : missingTokenRecentClicks > 0
        ? "watch"
        : !input.postbackSecretConfigured ||
            !input.openApiReady ||
            input.unmappedConversions > 0 ||
            input.clicksLast24Hours === 0
          ? "watch"
          : "healthy";

  return {
    checkedAt: input.checkedAt,
    clicksLast24Hours: input.clicksLast24Hours,
    ignoredTestConversions: input.ignoredTestConversions,
    latestClickAt: input.latestClicks[0]?.created_at || null,
    missingTokenRecentClicks,
    openApiMissingEnvVars: input.openApiMissingEnvVars,
    openApiReady: input.openApiReady,
    postbackSecretConfigured: input.postbackSecretConfigured,
    promotionLinkRecentClicks,
    sampledRecentClicks: input.latestClicks.length,
    status,
    tokenMatchedRecentClicks,
    tokenMismatchedRecentClicks,
    totalConversions: input.totalConversions,
    unmappedConversions: input.unmappedConversions,
  };
}

export async function loadLazadaHealthStatus(now = new Date()): Promise<LazadaHealthStatus> {
  const openApiStatus = getLazadaOpenApiStatus();
  const last24Hours = new Date(now);
  last24Hours.setHours(last24Hours.getHours() - 24);

  const [
    { data: latestClicks, error: latestClicksError },
    { count: clicksLast24Hours, error: clicksLast24HoursError },
    { count: totalConversions, error: totalConversionsError },
    { count: unmappedConversions, error: unmappedConversionsError },
    { data: conversionRows, error: conversionRowsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("affiliate_clicks")
      .select("id, click_token, created_at, resolution_mode, target_url")
      .eq("merchant", "lazada")
      .order("created_at", { ascending: false })
      .limit(25),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("merchant", "lazada")
      .gte("created_at", last24Hours.toISOString()),
    supabaseAdmin
      .from("affiliate_conversions")
      .select("id", { count: "exact", head: true })
      .eq("merchant", "lazada"),
    supabaseAdmin
      .from("affiliate_conversions")
      .select("id", { count: "exact", head: true })
      .eq("merchant", "lazada")
      .is("affiliate_click_id", null),
    supabaseAdmin
      .from("affiliate_conversions")
      .select(
        "id, affiliate_click_id, amount, click_token, conversion_status, external_order_id, payout, received_at"
      )
      .eq("merchant", "lazada")
      .order("received_at", { ascending: false })
      .limit(500),
  ]);

  if (
    latestClicksError ||
    clicksLast24HoursError ||
    totalConversionsError ||
    unmappedConversionsError ||
    conversionRowsError
  ) {
    throw new Error("Failed to load Lazada health check.");
  }

  const healthConversionRows = (conversionRows || []) as AffiliateConversionRow[];
  const testConversionRows = healthConversionRows.filter(isLikelyTestConversion);

  return buildHealthStatus({
    checkedAt: now.toISOString(),
    clicksLast24Hours: clicksLast24Hours || 0,
    ignoredTestConversions: testConversionRows.length,
    latestClicks: (latestClicks || []) as AffiliateHealthClickRow[],
    openApiMissingEnvVars: openApiStatus.missingEnvVars,
    openApiReady: openApiStatus.ready,
    postbackSecretConfigured: Boolean(process.env.LAZADA_POSTBACK_SECRET?.trim()),
    totalConversions: Math.max((totalConversions || 0) - testConversionRows.length, 0),
    unmappedConversions: unmappedConversions || 0,
  });
}
