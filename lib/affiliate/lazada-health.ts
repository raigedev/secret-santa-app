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

export type AffiliateConversionRow = {
  affiliate_click_id: string | null;
  id: string;
  amount: number | string | null;
  click_token: string | null;
  conversion_status: string | null;
  external_order_id: string | null;
  payout: number | string | null;
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

function readUrlHost(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
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
    const targetHost = readUrlHost(click.target_url);

    if (targetHost === "c.lazada.com.ph" && click.resolution_mode === "promotion-link") {
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
      .select(
        "id, affiliate_click_id, amount, click_token, conversion_status, external_order_id, payout, received_at"
      )
      .eq("merchant", "lazada")
      .order("received_at", { ascending: false })
      .limit(500),
  ]);

  if (latestClicksError || clicksLast24HoursError || conversionRowsError) {
    throw new Error("Failed to load Lazada health check.");
  }

  const healthConversionRows = (conversionRows || []) as AffiliateConversionRow[];
  const testConversionRows = healthConversionRows.filter(isLikelyTestConversion);
  const realConversionRows = healthConversionRows.filter((row) => !isLikelyTestConversion(row));

  return buildHealthStatus({
    checkedAt: now.toISOString(),
    clicksLast24Hours: clicksLast24Hours || 0,
    ignoredTestConversions: testConversionRows.length,
    latestClicks: (latestClicks || []) as AffiliateHealthClickRow[],
    openApiMissingEnvVars: openApiStatus.missingEnvVars,
    openApiReady: openApiStatus.ready,
    postbackSecretConfigured: Boolean(process.env.LAZADA_POSTBACK_SECRET?.trim()),
    totalConversions: realConversionRows.length,
    unmappedConversions: realConversionRows.filter((row) => !row.affiliate_click_id).length,
  });
}
