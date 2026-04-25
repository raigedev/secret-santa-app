import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  extractConversionProductSummary,
  isLikelyTestConversion,
  loadLazadaHealthStatus,
  type AffiliateConversionRow,
  type LazadaHealthStatus,
} from "@/lib/affiliate/lazada-health";
import { canViewAffiliateReport } from "@/lib/affiliate/report-access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CopyPostbackUrlButton } from "./CopyPostbackUrlButton";

type AffiliateReportPageProps = {
  searchParams: Promise<{
    route?: string;
    testPostback?: string;
    window?: string;
  }>;
};

type AffiliateClickRow = {
  id: string;
  catalog_source: string | null;
  created_at: string;
  fit_label: string | null;
  merchant: string;
  resolution_mode: string | null;
  resolution_reason: string | null;
  search_query: string;
  selected_query: string | null;
  suggestion_title: string;
  tracking_label: string | null;
  user_id: string | null;
};

type ProfileRow = {
  display_name: string | null;
  user_id: string;
};

type AffiliatePerformanceRow = {
  affiliate_click_id: string;
  affiliate_conversion_id: string | null;
  amount: number | string | null;
  actor_label: string;
  catalog_source: string | null;
  clicked_at: string;
  converted_product_id: string | null;
  converted_product_sku: string | null;
  converted_product_title: string | null;
  conversion_status: string | null;
  converted_at: string | null;
  currency: string | null;
  fit_label: string | null;
  merchant: string;
  payout: number | string | null;
  resolution_mode: string | null;
  search_query: string;
  selected_query: string | null;
  suggestion_title: string;
  tracking_label: string | null;
};

type TopItemInsight = {
  click_count: number;
  conversion_count: number;
  dominant_route: string;
  payout_total: number;
  suggestion_title: string;
};

type TopAngleInsight = {
  click_count: number;
  conversion_count: number;
  label: string;
  payout_total: number;
};

type RouteQualityInsight = {
  coverage: number;
  label: string;
  promotion_link_clicks: number;
  total_clicks: number;
};

type FallbackReasonInsight = {
  click_count: number;
  label: string;
};

type FamilyQualityInsight = {
  click_count: number;
  coverage: number;
  family: string;
  fallback_clicks: number;
  promotion_link_clicks: number;
};

type OptimizationRecommendation = {
  description: string;
  label: string;
  title: string;
};

type LazadaHealthAction = {
  body: string;
  label: string;
  tone: "good" | "watch" | "attention";
};

type WindowFilter = "7d" | "30d" | "90d" | "all";
type RouteFilter = "all" | "direct" | "search";

const REPORT_ACTIVITY_LIMIT = 300;
const REPORT_TABLE_LIMIT = 50;
const DIRECT_CATALOG_SOURCES = ["catalog-product", "wishlist-product"];
const POSTGRES_UNDEFINED_COLUMN_ERROR_CODE = "42703";

type QueryErrorLike = {
  code?: string;
  message?: string;
} | null;

function isMissingSelectedQueryError(error: QueryErrorLike): boolean {
  if (!error) {
    return false;
  }

  // Older deployments may not have the `selected_query` column yet.
  if (error.code === POSTGRES_UNDEFINED_COLUMN_ERROR_CODE) {
    return true;
  }

  return (error.message || "").toLowerCase().includes("selected_query");
}

function parseNumericValue(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatPesoAmount(value: number): string {
  return `P ${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)}`;
}

function formatPercentValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value)}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not converted yet";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-PH", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function summarizeSearchQuery(value: string): string {
  const firstPart = value.split(" | ")[0] || value;
  return firstPart.length > 70 ? `${firstPart.slice(0, 67)}...` : firstPart;
}

function normalizeInsightLabel(value: string | null | undefined, fallback: string): string {
  const normalized = (value || "").trim();

  if (normalized.length === 0) {
    return fallback;
  }

  return normalized.length > 70 ? `${normalized.slice(0, 67)}...` : normalized;
}

function normalizeFallbackReasonLabel(value: string | null | undefined): string {
  const normalized = (value || "").trim();

  if (normalized.length === 0) {
  return "Unknown reason";
  }

  return normalized
    .replace(/_/g, "-")
    .split("-")
    .map((part) => (part.length > 0 ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function buildSelectedAngleLabel(
  row:
    | Pick<AffiliateClickRow, "fit_label" | "search_query" | "selected_query" | "tracking_label">
    | Pick<AffiliatePerformanceRow, "fit_label" | "search_query" | "selected_query" | "tracking_label">
): string {
  // Newer clicks store the exact Step 1 angle, but older rows only have
  // fit/tracking labels. Falling back through those fields keeps the report
  // readable while older data gradually ages out.
  return normalizeInsightLabel(
    row.selected_query,
    row.fit_label || row.tracking_label || summarizeSearchQuery(row.search_query) || "Legacy click"
  );
}

function hasConvertedProductSummary(
  row: Pick<
    AffiliatePerformanceRow,
    "converted_product_id" | "converted_product_sku" | "converted_product_title"
  >
): boolean {
  return Boolean(row.converted_product_title || row.converted_product_id || row.converted_product_sku);
}

function buildOpenedLinkDisplayTitle(row: AffiliatePerformanceRow): string {
  if (row.catalog_source === "search-backed") {
    const selectedAngle = buildSelectedAngleLabel(row).trim().toLowerCase();
    const suggestionTitle = row.suggestion_title.trim();

    if (suggestionTitle && suggestionTitle.toLowerCase() !== selectedAngle) {
      return suggestionTitle;
    }

    return `Lazada search: ${buildSelectedAngleLabel(row)}`;
  }

  return row.suggestion_title;
}

function buildOpenedLinkDisplayDetail(row: AffiliatePerformanceRow): string {
  if (row.catalog_source === "search-backed") {
    return `Lazada search link for ${buildSelectedAngleLabel(row)}`;
  }

  return summarizeSearchQuery(row.search_query);
}

function buildLazadaProductDisplayTitle(row: AffiliatePerformanceRow): string {
  const convertedProduct =
    row.converted_product_title || row.converted_product_id || row.converted_product_sku;

  if (convertedProduct) {
    return convertedProduct;
  }

  if (row.catalog_source === "search-backed") {
    return "Waiting for Lazada";
  }

  return "Not reported yet";
}

function buildLazadaProductDisplayDetail(row: AffiliatePerformanceRow): string {
  if (hasConvertedProductSummary(row)) {
    const identifiers = [
      row.converted_product_id,
      row.converted_product_sku ? `SKU ${row.converted_product_sku}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    return identifiers || "Product details came from Lazada conversion postback.";
  }

  if (row.catalog_source === "search-backed") {
    return "For search links, the exact product appears only after Lazada reports a matching conversion.";
  }

  return "Shown here when Lazada sends product details in the conversion postback.";
}

function inferItemFamily(value: string): string {
  // This is intentionally heuristic. The goal is not perfect taxonomy; it is
  // to group related Lazada clicks into a few practical families we can tune
  // separately on the owner report.
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return "General";
  }

  if (
    /(tablet|ipad|galaxy tab|lenovo tab|matepad|xiaomi pad|e-reader|ereader|kindle)/.test(
      normalized
    )
  ) {
    return "Tablets";
  }

  if (/(power bank|charger|charging|magsafe|battery pack|fast charge)/.test(normalized)) {
    return "Charging";
  }

  if (/(hoodie|shirt|jacket|dress|shoes|sneaker|bag|tote|backpack|wallet|purse)/.test(normalized)) {
    return "Fashion";
  }

  if (/(book|novel|journal|planner|workbook|bible|comic)/.test(normalized)) {
    return "Books";
  }

  if (/(pen|notebook|stationery|marker|highlighter|paper|school supplies|pencil)/.test(normalized)) {
    return "Stationery";
  }

  if (/(dog|cat|pet|leash|litter|pet bed|pet toy|treat)/.test(normalized)) {
    return "Pet";
  }

  if (/(skincare|makeup|beauty|serum|lotion|perfume|lipstick|sunscreen)/.test(normalized)) {
    return "Beauty";
  }

  if (/(mug|pillow|blanket|organizer|storage|kitchen|lamp|home)/.test(normalized)) {
    return "Home";
  }

  if (/(headphone|earbud|speaker|microphone|mic|audio)/.test(normalized)) {
    return "Audio";
  }

  if (/(laptop|keyboard|mouse|monitor|hub|dock|usb|ssd|computer)/.test(normalized)) {
    return "Computers";
  }

  if (/(controller|gaming|ps5|xbox|switch|steam deck)/.test(normalized)) {
    return "Gaming";
  }

  if (/(baby|toddler|stroller|feeding bottle|diaper)/.test(normalized)) {
    return "Baby";
  }

  if (/(voucher|gift card|load|digital)/.test(normalized)) {
    return "Digital";
  }

  return "General";
}

function buildActorLabel(userId: string | null, profilesByUserId: Map<string, ProfileRow>): string {
  if (!userId) {
    return "Unknown user";
  }

  const profile = profilesByUserId.get(userId);
  const displayName = profile?.display_name?.trim();

  if (displayName) {
    return displayName;
  }

  return `User ${userId.slice(0, 8)}`;
}

function normalizeWindowFilter(value: string | undefined): WindowFilter {
  return value === "7d" || value === "30d" || value === "90d" || value === "all" ? value : "30d";
}

function normalizeRouteFilter(value: string | undefined): RouteFilter {
  return value === "direct" || value === "search" || value === "all" ? value : "all";
}

function describeWindowFilter(windowFilter: WindowFilter): string {
  switch (windowFilter) {
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "90d":
      return "Last 90 days";
    default:
      return "All time";
  }
}

function describeRouteFilter(routeFilter: RouteFilter): string {
  switch (routeFilter) {
    case "direct":
      return "Direct product routes";
    case "search":
      return "Lazada search links";
    default:
      return "All Lazada routes";
  }
}

function buildWindowStartIso(windowFilter: WindowFilter): string | null {
  if (windowFilter === "all") {
    return null;
  }

  const now = new Date();
  const days = windowFilter === "7d" ? 7 : windowFilter === "30d" ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function describeCatalogSource(source: string | null): string {
  if (source === "search-backed") {
    return "Lazada search link";
  }

  if (source === "catalog-product") {
    return "Catalog product";
  }

  if (source === "wishlist-product") {
    return "Wishlist product";
  }

  return source || "Older tracking";
}

function buildPerformanceRows(
  clicks: AffiliateClickRow[],
  conversions: AffiliateConversionRow[],
  profilesByUserId: Map<string, ProfileRow>
): AffiliatePerformanceRow[] {
  const conversionsByClickId = new Map<string, AffiliateConversionRow>();

  for (const conversion of conversions) {
    if (!conversion.affiliate_click_id) {
      continue;
    }

    const existing = conversionsByClickId.get(conversion.affiliate_click_id);

    if (!existing || new Date(conversion.received_at).getTime() > new Date(existing.received_at).getTime()) {
      conversionsByClickId.set(conversion.affiliate_click_id, conversion);
    }
  }

  return clicks.map((click) => {
    const matchingConversion = conversionsByClickId.get(click.id) || null;
    const convertedProduct = extractConversionProductSummary(matchingConversion?.raw_payload);

    return {
      affiliate_click_id: click.id,
      affiliate_conversion_id: matchingConversion?.id || null,
      amount: matchingConversion?.amount || null,
      actor_label: buildActorLabel(click.user_id, profilesByUserId),
      catalog_source: click.catalog_source,
      clicked_at: click.created_at,
      converted_product_id: convertedProduct.productId,
      converted_product_sku: convertedProduct.skuId,
      converted_product_title: convertedProduct.title,
      conversion_status: matchingConversion?.conversion_status || null,
      converted_at: matchingConversion?.received_at || null,
      currency: "PHP",
      fit_label: click.fit_label,
      merchant: click.merchant,
      payout: matchingConversion?.payout || null,
      resolution_mode: click.resolution_mode,
      search_query: click.search_query,
      selected_query: click.selected_query,
      suggestion_title: click.suggestion_title,
      tracking_label: click.tracking_label,
    };
  });
}

function buildTopItemInsights(rows: AffiliatePerformanceRow[]): TopItemInsight[] {
  const grouped = new Map<
    string,
    {
      click_count: number;
      conversion_count: number;
      payout_total: number;
      route_counts: Map<string, number>;
      suggestion_title: string;
    }
  >();

  for (const row of rows) {
    const key = row.suggestion_title.trim().toLowerCase();
    const existing = grouped.get(key) || {
      click_count: 0,
      conversion_count: 0,
      payout_total: 0,
      route_counts: new Map<string, number>(),
      suggestion_title: row.suggestion_title,
    };

    existing.click_count += 1;

    if (row.affiliate_conversion_id) {
      existing.conversion_count += 1;
      existing.payout_total += parseNumericValue(row.payout);
    }

    const routeKey = describeCatalogSource(row.catalog_source);
    existing.route_counts.set(routeKey, (existing.route_counts.get(routeKey) || 0) + 1);
    grouped.set(key, existing);
  }

  const hasMappedConversions = Array.from(grouped.values()).some((item) => item.conversion_count > 0);

  return Array.from(grouped.values())
    .map((item) => {
      const dominantRouteEntry =
        Array.from(item.route_counts.entries()).sort((left, right) => right[1] - left[1])[0] || null;

      return {
        click_count: item.click_count,
        conversion_count: item.conversion_count,
        dominant_route: dominantRouteEntry?.[0] || "Unknown route",
        payout_total: item.payout_total,
        suggestion_title: item.suggestion_title,
      };
    })
    .sort((left, right) => {
      if (hasMappedConversions) {
        if (right.conversion_count !== left.conversion_count) {
          return right.conversion_count - left.conversion_count;
        }

        if (right.payout_total !== left.payout_total) {
          return right.payout_total - left.payout_total;
        }
      }

      if (right.click_count !== left.click_count) {
        return right.click_count - left.click_count;
      }

      return right.payout_total - left.payout_total;
    })
    .slice(0, 3);
}

function buildTopAngleInsights(rows: AffiliatePerformanceRow[]): TopAngleInsight[] {
  const grouped = new Map<
    string,
    {
      click_count: number;
      conversion_count: number;
      label: string;
      payout_total: number;
    }
  >();

  for (const row of rows) {
    const label = buildSelectedAngleLabel(row);
    const key = label.toLowerCase();
    const existing = grouped.get(key) || {
      click_count: 0,
      conversion_count: 0,
      label,
      payout_total: 0,
    };

    existing.click_count += 1;

    if (row.affiliate_conversion_id) {
      existing.conversion_count += 1;
      existing.payout_total += parseNumericValue(row.payout);
    }

    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .sort((left, right) => {
      if (right.conversion_count !== left.conversion_count) {
        return right.conversion_count - left.conversion_count;
      }

      if (right.click_count !== left.click_count) {
        return right.click_count - left.click_count;
      }

      return right.payout_total - left.payout_total;
    })
    .slice(0, 5);
}

function buildRouteQualityInsights(input: {
  totalDirectClicks: number;
  totalDirectPromotionLinkClicks: number;
  totalSearchClicks: number;
  totalSearchPromotionLinkClicks: number;
}): RouteQualityInsight[] {
  const directCoverage =
    input.totalDirectClicks > 0
      ? (input.totalDirectPromotionLinkClicks / input.totalDirectClicks) * 100
      : 0;
  const searchCoverage =
    input.totalSearchClicks > 0
      ? (input.totalSearchPromotionLinkClicks / input.totalSearchClicks) * 100
      : 0;

  return [
    {
      coverage: directCoverage,
      label: "Direct product routes",
      promotion_link_clicks: input.totalDirectPromotionLinkClicks,
      total_clicks: input.totalDirectClicks,
    },
    {
      coverage: searchCoverage,
      label: "Lazada search links",
      promotion_link_clicks: input.totalSearchPromotionLinkClicks,
      total_clicks: input.totalSearchClicks,
    },
  ];
}

function buildFallbackReasonInsights(rows: AffiliateClickRow[]): FallbackReasonInsight[] {
  const grouped = new Map<string, number>();

  for (const row of rows) {
    if (row.resolution_mode === "promotion-link") {
      continue;
    }

    const fallbackReason = row.resolution_reason || row.resolution_mode;

    if (!fallbackReason) {
      continue;
    }

    const label = normalizeFallbackReasonLabel(fallbackReason);
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([label, click_count]) => ({ label, click_count }))
    .sort((left, right) => right.click_count - left.click_count)
    .slice(0, 5);
}

function buildFamilyQualityInsights(rows: AffiliateClickRow[]): FamilyQualityInsight[] {
  const grouped = new Map<
    string,
    {
      click_count: number;
      fallback_clicks: number;
      family: string;
      promotion_link_clicks: number;
    }
  >();

  for (const row of rows) {
    if (!row.resolution_mode && !row.resolution_reason) {
      continue;
    }

    const family = inferItemFamily(
      [row.selected_query, row.search_query, row.suggestion_title].filter(Boolean).join(" ")
    );
    const key = family.toLowerCase();
    const existing = grouped.get(key) || {
      click_count: 0,
      fallback_clicks: 0,
      family,
      promotion_link_clicks: 0,
    };

    existing.click_count += 1;

    if (row.resolution_mode === "promotion-link") {
      existing.promotion_link_clicks += 1;
    } else {
      existing.fallback_clicks += 1;
    }

    grouped.set(key, existing);
  }

  const insights = Array.from(grouped.values())
    .map((item) => ({
      click_count: item.click_count,
      coverage: item.click_count > 0 ? (item.promotion_link_clicks / item.click_count) * 100 : 0,
      family: item.family,
      fallback_clicks: item.fallback_clicks,
      promotion_link_clicks: item.promotion_link_clicks,
    }))
    .sort((left, right) => {
      if (left.coverage !== right.coverage) {
        return left.coverage - right.coverage;
      }

      return right.click_count - left.click_count;
    })
  const meaningfulInsights = insights.filter((item) => item.click_count >= 2);
  return (meaningfulInsights.length > 0 ? meaningfulInsights : insights).slice(0, 6);
}

function buildOptimizationRecommendations(input: {
  familyQualityInsights: FamilyQualityInsight[];
  legacyPromotionLinkClicks: number;
  legacyRouteClicks: number;
  routeQualityInsights: RouteQualityInsight[];
}): OptimizationRecommendation[] {
  // Keep this summary compact and action-oriented so the owner can glance at
  // the report and immediately know which Lazada path is strongest and where
  // the weakest family still needs matcher work.
  const recommendations: OptimizationRecommendation[] = [];

  const strongestRoute = input.routeQualityInsights
    .filter((insight) => insight.total_clicks > 0)
    .sort((left, right) => right.coverage - left.coverage)[0];

  if (strongestRoute) {
    recommendations.push({
      description: `${strongestRoute.promotion_link_clicks} of ${strongestRoute.total_clicks} clicks in this route family are resolving to promotion links.`,
      label: "Strongest route",
      title: strongestRoute.label,
    });
  }

  const weakestFamily = input.familyQualityInsights
    .filter((insight) => insight.click_count >= 2)
    .sort((left, right) => {
      if (left.coverage !== right.coverage) {
        return left.coverage - right.coverage;
      }

      return right.click_count - left.click_count;
    })[0];

  if (weakestFamily) {
    recommendations.push({
      description: `${weakestFamily.fallback_clicks} of ${weakestFamily.click_count} clicks in this family still need a stronger affiliate link.`,
      label: "Weakest family",
      title: weakestFamily.family,
    });
  }

  if (input.legacyRouteClicks > 0) {
    recommendations.push({
      description:
        input.legacyPromotionLinkClicks > 0
          ? `${input.legacyRouteClicks} older clicks predate the current route labels, and ${input.legacyPromotionLinkClicks} of them still resolved to promotion links.`
          : `${input.legacyRouteClicks} older clicks predate the current route labels, so route-specific coverage is best judged with newer clicks or route filters.`,
      label: "Legacy click bucket",
      title: `${input.legacyRouteClicks} legacy clicks`,
    });
  }

  return recommendations.slice(0, 3);
}

async function loadAffiliateClickRows(input: {
  routeFilter: RouteFilter;
  windowStartIso: string | null;
}): Promise<{
  clicks: AffiliateClickRow[];
  totalClicksCount: number;
  totalDirectClicksCount: number;
  totalDirectPromotionLinkClicksCount: number;
  totalPromotionLinkClicksCount: number;
  totalSearchPromotionLinkClicksCount: number;
  totalSearchClicksCount: number;
}> {
  let totalClicksQuery = supabaseAdmin
    .from("affiliate_clicks")
    .select("id", { count: "exact", head: true })
    .eq("merchant", "lazada");

  let totalDirectClicksQuery = supabaseAdmin
    .from("affiliate_clicks")
    .select("id", { count: "exact", head: true })
    .eq("merchant", "lazada")
    .in("catalog_source", DIRECT_CATALOG_SOURCES);

  let totalSearchClicksQuery = supabaseAdmin
    .from("affiliate_clicks")
    .select("id", { count: "exact", head: true })
    .eq("merchant", "lazada")
    .eq("catalog_source", "search-backed");

  let totalPromotionLinkClicksQuery = supabaseAdmin
    .from("affiliate_clicks")
    .select("id", { count: "exact", head: true })
    .eq("merchant", "lazada")
    .eq("resolution_mode", "promotion-link");

  let totalDirectPromotionLinkClicksQuery = supabaseAdmin
    .from("affiliate_clicks")
    .select("id", { count: "exact", head: true })
    .eq("merchant", "lazada")
    .eq("resolution_mode", "promotion-link")
    .in("catalog_source", DIRECT_CATALOG_SOURCES);

  let totalSearchPromotionLinkClicksQuery = supabaseAdmin
    .from("affiliate_clicks")
    .select("id", { count: "exact", head: true })
    .eq("merchant", "lazada")
    .eq("resolution_mode", "promotion-link")
    .eq("catalog_source", "search-backed");

  let clicksQuery = supabaseAdmin
    .from("affiliate_clicks")
    .select(
      "id, catalog_source, created_at, fit_label, merchant, resolution_mode, resolution_reason, search_query, selected_query, suggestion_title, tracking_label, user_id"
    )
    .eq("merchant", "lazada")
    .order("created_at", { ascending: false })
    .limit(REPORT_ACTIVITY_LIMIT);

  if (input.windowStartIso) {
    totalClicksQuery = totalClicksQuery.gte("created_at", input.windowStartIso);
    totalDirectClicksQuery = totalDirectClicksQuery.gte("created_at", input.windowStartIso);
    totalSearchClicksQuery = totalSearchClicksQuery.gte("created_at", input.windowStartIso);
    totalPromotionLinkClicksQuery = totalPromotionLinkClicksQuery.gte(
      "created_at",
      input.windowStartIso
    );
    totalDirectPromotionLinkClicksQuery = totalDirectPromotionLinkClicksQuery.gte(
      "created_at",
      input.windowStartIso
    );
    totalSearchPromotionLinkClicksQuery = totalSearchPromotionLinkClicksQuery.gte(
      "created_at",
      input.windowStartIso
    );
    clicksQuery = clicksQuery.gte("created_at", input.windowStartIso);
  }

  if (input.routeFilter === "direct") {
    // Apply the same route filter to the route-specific counters so the
    // summary row matches the selected view instead of mixing in cross-app
    // counts from other route families.
    totalClicksQuery = totalClicksQuery.in("catalog_source", DIRECT_CATALOG_SOURCES);
    totalDirectClicksQuery = totalDirectClicksQuery.in("catalog_source", DIRECT_CATALOG_SOURCES);
    totalSearchClicksQuery = totalSearchClicksQuery.in("catalog_source", DIRECT_CATALOG_SOURCES);
    totalPromotionLinkClicksQuery = totalPromotionLinkClicksQuery.in(
      "catalog_source",
      DIRECT_CATALOG_SOURCES
    );
    totalDirectPromotionLinkClicksQuery = totalDirectPromotionLinkClicksQuery.in(
      "catalog_source",
      DIRECT_CATALOG_SOURCES
    );
    totalSearchPromotionLinkClicksQuery = totalSearchPromotionLinkClicksQuery.in(
      "catalog_source",
      DIRECT_CATALOG_SOURCES
    );
    clicksQuery = clicksQuery.in("catalog_source", DIRECT_CATALOG_SOURCES);
  } else if (input.routeFilter === "search") {
    totalClicksQuery = totalClicksQuery.eq("catalog_source", "search-backed");
    totalDirectClicksQuery = totalDirectClicksQuery.eq("catalog_source", "search-backed");
    totalSearchClicksQuery = totalSearchClicksQuery.eq("catalog_source", "search-backed");
    totalPromotionLinkClicksQuery = totalPromotionLinkClicksQuery.eq(
      "catalog_source",
      "search-backed"
    );
    totalDirectPromotionLinkClicksQuery = totalDirectPromotionLinkClicksQuery.eq(
      "catalog_source",
      "search-backed"
    );
    totalSearchPromotionLinkClicksQuery = totalSearchPromotionLinkClicksQuery.eq(
      "catalog_source",
      "search-backed"
    );
    clicksQuery = clicksQuery.eq("catalog_source", "search-backed");
  }

  const [
    { count: totalClicksCount, error: totalClicksError },
    { count: totalDirectClicksCount, error: totalDirectClicksError },
    { count: totalSearchClicksCount, error: totalSearchClicksError },
    {
      count: totalDirectPromotionLinkClicksCount,
      error: totalDirectPromotionLinkClicksError,
    },
    {
      count: totalPromotionLinkClicksCount,
      error: totalPromotionLinkClicksError,
    },
    {
      count: totalSearchPromotionLinkClicksCount,
      error: totalSearchPromotionLinkClicksError,
    },
    clickResult,
  ] = await Promise.all([
    totalClicksQuery,
    totalDirectClicksQuery,
    totalSearchClicksQuery,
    totalDirectPromotionLinkClicksQuery,
    totalPromotionLinkClicksQuery,
    totalSearchPromotionLinkClicksQuery,
    clicksQuery,
  ]);

  if (
    totalClicksError ||
    totalDirectClicksError ||
    totalSearchClicksError ||
    totalDirectPromotionLinkClicksError ||
    totalPromotionLinkClicksError
    || totalSearchPromotionLinkClicksError
  ) {
    throw new Error("Failed to load affiliate report activity.");
  }

  // Fast path: newer schema with `selected_query` available.
  if (!clickResult.error) {
    return {
      clicks: (clickResult.data || []) as AffiliateClickRow[],
      totalClicksCount: totalClicksCount || 0,
      totalDirectClicksCount: totalDirectClicksCount || 0,
      totalDirectPromotionLinkClicksCount: totalDirectPromotionLinkClicksCount || 0,
      totalPromotionLinkClicksCount: totalPromotionLinkClicksCount || 0,
      totalSearchPromotionLinkClicksCount: totalSearchPromotionLinkClicksCount || 0,
      totalSearchClicksCount: totalSearchClicksCount || 0,
    };
  }

  // Backward-compat path: keep report available while migrations roll out.
  const selectedQueryMissing = isMissingSelectedQueryError(clickResult.error);

  if (!selectedQueryMissing) {
    throw new Error("Failed to load affiliate report activity.");
  }

  // Retry with a column list compatible with older schemas.
  let fallbackClicksQuery = supabaseAdmin
    .from("affiliate_clicks")
    .select(
      "id, catalog_source, created_at, fit_label, merchant, resolution_mode, resolution_reason, search_query, suggestion_title, tracking_label, user_id"
    )
    .eq("merchant", "lazada")
    .order("created_at", { ascending: false })
    .limit(REPORT_ACTIVITY_LIMIT);

  if (input.windowStartIso) {
    fallbackClicksQuery = fallbackClicksQuery.gte("created_at", input.windowStartIso);
  }

  if (input.routeFilter === "direct") {
    fallbackClicksQuery = fallbackClicksQuery.in("catalog_source", DIRECT_CATALOG_SOURCES);
  } else if (input.routeFilter === "search") {
    fallbackClicksQuery = fallbackClicksQuery.eq("catalog_source", "search-backed");
  }

  const { data: fallbackClicks, error: fallbackClicksError } = await fallbackClicksQuery;

  if (fallbackClicksError) {
    throw new Error("Failed to load affiliate report activity.");
  }

  // Normalize fallback rows so downstream UI can treat both schema versions uniformly.
  const normalizedFallbackClicks = ((fallbackClicks || []) as Array<
    Omit<AffiliateClickRow, "selected_query">
  >).map((row) => ({
    ...row,
    selected_query: null,
  }));

  return {
    clicks: normalizedFallbackClicks,
    totalClicksCount: totalClicksCount || 0,
    totalDirectClicksCount: totalDirectClicksCount || 0,
    totalDirectPromotionLinkClicksCount: totalDirectPromotionLinkClicksCount || 0,
    totalPromotionLinkClicksCount: totalPromotionLinkClicksCount || 0,
    totalSearchPromotionLinkClicksCount: totalSearchPromotionLinkClicksCount || 0,
    totalSearchClicksCount: totalSearchClicksCount || 0,
  };
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.14)] backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </section>
  );
}

function HealthStatusTone(status: LazadaHealthStatus["status"]): string {
  if (status === "healthy") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "watch") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-rose-100 text-rose-800";
}

function HealthStatusLabel(status: LazadaHealthStatus["status"]): string {
  if (status === "healthy") {
    return "Healthy";
  }

  if (status === "watch") {
    return "Watch";
  }

  return "Needs attention";
}

function TestPostbackMessage({ status }: { status: string | undefined }) {
  if (!status) {
    return null;
  }

  const copy: Record<string, string> = {
    click_lookup_failed: "Test postback could not find the latest Lazada click.",
    created: "Test postback created and mapped to the latest Lazada click.",
    missing_click: "Test postback skipped because there is no Lazada click token yet.",
    write_failed: "Test postback could not be written. Check Vercel logs for the exact error.",
  };
  const isSuccess = status === "created";

  return (
    <div
      className={`mt-4 rounded-[22px] border px-4 py-3 text-sm font-semibold ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {copy[status] || "Test postback finished."}
    </div>
  );
}

function HealthMetric({
  helper,
  label,
  value,
}: {
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm leading-5 text-slate-600">{helper}</p>
    </div>
  );
}

function buildSaleMappingHelper(health: LazadaHealthStatus): string {
  const testCopy =
    health.ignoredTestConversions > 0
      ? ` ${health.ignoredTestConversions} test/debug rows are hidden from this check.`
      : "";

  if (health.totalConversions === 0) {
    return `No real Lazada conversion rows yet.${testCopy}`;
  }

  if (health.unmappedConversions > 0) {
    return `${health.unmappedConversions} real conversion rows are not mapped to clicks yet.${testCopy}`;
  }

  return `Every real Lazada conversion is mapped to a click.${testCopy}`;
}

function isSafeHostHeader(value: string): boolean {
  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > 253) {
    return false;
  }

  for (const character of normalized) {
    const code = character.charCodeAt(0);
    const isNumber = code >= 48 && code <= 57;
    const isUpperAlpha = code >= 65 && code <= 90;
    const isLowerAlpha = code >= 97 && code <= 122;
    const isAllowedSeparator = character === "." || character === "-" || character === ":";

    if (!isNumber && !isUpperAlpha && !isLowerAlpha && !isAllowedSeparator) {
      return false;
    }
  }

  return !normalized.startsWith(".") && !normalized.startsWith("-") && !normalized.includes("..");
}

function buildLazadaPostbackUrl(headersList: Awaited<ReturnType<typeof headers>>): string {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "";
  const originCandidate = configuredOrigin.trim();
  const headerHost = headersList.get("x-forwarded-host") || headersList.get("host") || "";
  const safeHeaderHost = isSafeHostHeader(headerHost) ? headerHost.trim() : "";
  const fallbackOrigin = safeHeaderHost
    ? `${headersList.get("x-forwarded-proto") === "http" ? "http" : "https"}://${safeHeaderHost}`
    : "";
  const tokenPlaceholder = ["YOUR", "LAZADA", "POSTBACK", "SECRET"].join("_");
  const path = `/api/affiliate/lazada/postback?token=${tokenPlaceholder}`;

  try {
    const origin = originCandidate
      ? new URL(originCandidate.startsWith("http") ? originCandidate : `https://${originCandidate}`)
          .origin
      : fallbackOrigin;

    return origin ? `${origin}${path}` : path;
  } catch {
    return fallbackOrigin ? `${fallbackOrigin}${path}` : path;
  }
}

function buildLazadaHealthActions(health: LazadaHealthStatus): LazadaHealthAction[] {
  const actions: LazadaHealthAction[] = [];

  if (!health.postbackSecretConfigured) {
    actions.push({
      body: "Add LAZADA_POSTBACK_SECRET in Vercel before sharing the postback URL with Lazada.",
      label: "Secure postback",
      tone: "attention",
    });
  }

  if (health.tokenMismatchedRecentClicks > 0) {
    actions.push({
      body: "Saved click tokens and URL tokens disagree. Keep the URL token migration applied and test one fresh click.",
      label: "Fix token mismatch",
      tone: "attention",
    });
  }

  if (health.missingTokenRecentClicks > 0) {
    actions.push({
      body: "Recent sample still includes older clicks without complete token data. Fresh Lazada clicks should reduce this.",
      label: "Watch legacy clicks",
      tone: "watch",
    });
  }

  if (health.clicksLast24Hours === 0) {
    actions.push({
      body: "No Lazada click was recorded in the last 24 hours. Click one wishlist suggestion to confirm tracking is alive.",
      label: "Run a live click",
      tone: "watch",
    });
  }

  if (health.unmappedConversions > 0) {
    actions.push({
      body: "Lazada reported conversions that did not match a tracked click. Check the Lazada sub_id6 value.",
      label: "Map sales",
      tone: "watch",
    });
  }

  if (
    health.sampledRecentClicks > 0 &&
    health.promotionLinkRecentClicks < health.sampledRecentClicks
  ) {
    actions.push({
      body: "Some recent clicks still use weaker shopping links. Tune the matcher for the families shown below.",
      label: "Improve link coverage",
      tone: "watch",
    });
  }

  if (!health.openApiReady) {
    actions.push({
      body: `Add missing Lazada Open API env vars: ${health.openApiMissingEnvVars.join(", ") || "unknown"}.`,
      label: "Complete API env",
      tone: "watch",
    });
  }

  return actions.length > 0
    ? actions
    : [
        {
          body: "Clicks, token matching, sale mapping, postback security, and API credentials all look usable.",
          label: "No action needed",
          tone: "good",
        },
      ];
}

function HealthActionTone(tone: LazadaHealthAction["tone"]): string {
  if (tone === "attention") {
    return "border-rose-200 bg-rose-50 text-rose-900";
  }

  if (tone === "watch") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function LazadaHealthCheckCard({
  health,
  postbackUrl,
  testPostbackStatus,
}: {
  health: LazadaHealthStatus;
  postbackUrl: string;
  testPostbackStatus: string | undefined;
}) {
  const healthActions = buildLazadaHealthActions(health);

  return (
    <section className="mt-8 rounded-4xl border border-white/70 bg-white/88 p-5 shadow-[0_24px_70px_rgba(148,163,184,0.14)] backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Lazada health
            </p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${HealthStatusTone(
                health.status
              )}`}
            >
              {HealthStatusLabel(health.status)}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Tracking check</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            This checks whether recent Lazada clicks use affiliate links, whether click tracking
            can match Lazada reports, and whether postback security is configured.
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Checked {formatDateTime(health.checkedAt)}
          </p>
        </div>

        <form action="/api/affiliate/lazada/test-postback" method="post">
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5"
          >
            Run test report
          </button>
        </form>
      </div>

      <TestPostbackMessage status={testPostbackStatus} />

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HealthMetric
          label="Latest click"
          value={health.latestClickAt ? formatDateTime(health.latestClickAt) : "None yet"}
          helper={`${health.clicksLast24Hours} Lazada clicks in the last 24 hours.`}
        />
        <HealthMetric
          label="Token matching"
          value={`${health.tokenMatchedRecentClicks}/${health.sampledRecentClicks}`}
          helper={
            health.tokenMismatchedRecentClicks > 0 || health.missingTokenRecentClicks > 0
              ? `${health.tokenMismatchedRecentClicks} mismatch, ${health.missingTokenRecentClicks} missing in recent sample.`
              : "Saved click tokens match the Lazada URL tokens in the recent sample."
          }
        />
        <HealthMetric
          label="Promotion links"
          value={`${health.promotionLinkRecentClicks}/${health.sampledRecentClicks}`}
          helper="Recent sample using Lazada promotion links that carry click tokens."
        />
        <HealthMetric
          label="Sale mapping"
          value={
            health.totalConversions > 0
              ? `${Math.max(0, health.totalConversions - health.unmappedConversions)}/${health.totalConversions}`
              : "No sales yet"
          }
          helper={buildSaleMappingHelper(health)}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Postback secret
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {health.postbackSecretConfigured ? "Configured" : "Missing"}
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {health.postbackSecretConfigured
              ? "Lazada reports must include your shared secret."
              : "Add LAZADA_POSTBACK_SECRET in Vercel before opening the postback URL publicly."}
          </p>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Lazada Open API
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {health.openApiReady ? "Ready" : "Needs env"}
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {health.openApiReady
              ? "Product URL conversion can use the configured Lazada credentials."
              : `Missing: ${health.openApiMissingEnvVars.join(", ") || "unknown env vars"}.`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Lazada postback URL
              </p>
              <p className="mt-2 text-sm leading-5 text-slate-600">
                Use this format in Lazada, then replace the placeholder with the secret saved only
                in Vercel.
              </p>
            </div>
            <CopyPostbackUrlButton value={postbackUrl} />
          </div>
          <code className="mt-3 block break-all rounded-2xl bg-slate-950 px-4 py-3 text-xs font-semibold leading-5 text-slate-100">
            {postbackUrl}
          </code>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            How to read this
          </p>
          <div className="mt-3 grid gap-2 text-sm leading-5 text-slate-600">
            <p><span className="font-semibold text-slate-900">Token matching</span> means Lazada can report sales back to the exact click.</p>
            <p><span className="font-semibold text-slate-900">Affiliate links</span> means the click used a Lazada link that can carry tracking.</p>
            <p><span className="font-semibold text-slate-900">Sale mapping</span> means Lazada reported a conversion that matched a tracked click.</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {healthActions.slice(0, 3).map((action) => (
          <div
            key={action.label}
            className={`rounded-[20px] border px-4 py-3 text-sm ${HealthActionTone(action.tone)}`}
          >
            <p className="font-bold">{action.label}</p>
            <p className="mt-1 leading-5">{action.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InsightCard({ insight }: { insight: TopItemInsight }) {
  const conversionRate =
    insight.click_count > 0
      ? `${Math.round((insight.conversion_count / insight.click_count) * 100)}%`
      : "0%";

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.14)] backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Item signal</p>
      <h3 className="mt-2 text-xl font-bold text-slate-900">{insight.suggestion_title}</h3>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Clicks</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{insight.click_count}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Conversions</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{insight.conversion_count}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Conversion rate</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{conversionRate}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Payout</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatPesoAmount(insight.payout_total)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        Main link type: <span className={`font-semibold ${DominantLabelTone(insight.dominant_route)}`}>{insight.dominant_route}</span>
      </p>
    </section>
  );
}

function AngleInsightCard({ insight }: { insight: TopAngleInsight }) {
  const conversionRate =
    insight.click_count > 0
      ? `${Math.round((insight.conversion_count / insight.click_count) * 100)}%`
      : "0%";

  return (
    <section className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Shopping option</p>
      <h3 className="mt-2 text-lg font-bold text-slate-900">{insight.label}</h3>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Clicks</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{insight.click_count}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Conversions</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{insight.conversion_count}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Rate</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{conversionRate}</p>
        </div>
      </div>
    </section>
  );
}

function RouteQualityCard({ insight }: { insight: RouteQualityInsight }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Link quality</p>
      <h3 className="mt-2 text-lg font-bold text-slate-900">{insight.label}</h3>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Coverage</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatPercentValue(insight.coverage)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Promotion links</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{insight.promotion_link_clicks}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total clicks</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{insight.total_clicks}</p>
        </div>
      </div>
    </section>
  );
}

function FamilyQualityCard({ insight }: { insight: FamilyQualityInsight }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Item family</p>
      <h3 className="mt-2 text-lg font-bold text-slate-900">{insight.family}</h3>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Coverage</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatPercentValue(insight.coverage)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fallback clicks</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{insight.fallback_clicks}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total clicks</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{insight.click_count}</p>
        </div>
      </div>
      {insight.click_count < 3 && (
        <p className="mt-4 text-xs font-medium text-slate-500">Low sample. Treat this as directional, not final.</p>
      )}
    </section>
  );
}

function RecommendationCard({ insight }: { insight: OptimizationRecommendation }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{insight.label}</p>
      <h3 className="mt-2 text-lg font-bold text-slate-900">{insight.title}</h3>
      <p className="mt-4 text-sm leading-6 text-slate-600">{insight.description}</p>
    </section>
  );
}

function ResolutionDetailLabel(row: AffiliatePerformanceRow): string {
  if (row.resolution_mode === "promotion-link") {
    return "Affiliate-ready";
  }

  return normalizeFallbackReasonLabel(row.resolution_mode || "pending");
}

function ResolutionDetailTone(row: AffiliatePerformanceRow): string {
  if (row.resolution_mode === "promotion-link") {
    return "text-emerald-700";
  }

  return "text-amber-700";
}

function ResolutionDetailSubcopy(row: AffiliatePerformanceRow): string {
  if (row.resolution_mode === "promotion-link") {
    return "Strongest monetized path";
  }

  return "Needs matcher tuning";
}

function DominantLabelTone(value: string): string {
  return value.toLowerCase().includes("legacy") ? "text-amber-700" : "text-slate-800";
}

function LegacySupportTone(value: number): string {
  return value > 0 ? "text-amber-700" : "text-slate-500";
}

function LegacySupportCopy(value: number): string {
  return value > 0
    ? `${value} older clicks use the previous tracking format.`
    : "All clicks in this view use the current tracking format.";
}

function LegacySupportCard({
  legacyPromotionLinkClicks,
  legacyRouteClicks,
}: {
  legacyPromotionLinkClicks: number;
  legacyRouteClicks: number;
}) {
  // Older Lazada clicks predate the current direct/search route split. Calling
  // that bucket out explicitly explains why total clicks can be larger than the
  // visible direct + search counts in all-time views.
  return (
    <section className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Older tracking support</p>
      <h3 className="mt-2 text-lg font-bold text-slate-900">{legacyRouteClicks} legacy clicks</h3>
      <p className={`mt-4 text-sm leading-6 ${LegacySupportTone(legacyRouteClicks)}`}>
        {LegacySupportCopy(legacyRouteClicks)}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Promotion-link legacy clicks:{" "}
        <span className="font-semibold text-slate-900">{legacyPromotionLinkClicks}</span>
      </p>
    </section>
  );
}

export default async function AffiliateReportPage({
  searchParams,
}: AffiliateReportPageProps) {
  const resolvedSearchParams = await searchParams;
  const windowFilter = normalizeWindowFilter(resolvedSearchParams.window);
  const routeFilter = normalizeRouteFilter(resolvedSearchParams.route);
  const windowStartIso = buildWindowStartIso(windowFilter);
  const requestHeaders = await headers();
  const lazadaPostbackUrl = buildLazadaPostbackUrl(requestHeaders);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!canViewAffiliateReport(user.email)) {
    redirect("/dashboard");
  }

  const {
    clicks: clickRows,
    totalClicksCount,
    totalDirectClicksCount,
    totalDirectPromotionLinkClicksCount,
    totalPromotionLinkClicksCount,
    totalSearchPromotionLinkClicksCount,
    totalSearchClicksCount,
  } = await loadAffiliateClickRows({
    routeFilter,
    windowStartIso,
  });
  const lazadaHealth = await loadLazadaHealthStatus();
  const clickIds = clickRows.map((row) => row.id);
  // Only the latest table rows show actor labels, so we can scope profile lookups
  // to the visible slice instead of all sampled clicks.
  const visibleClickRows = clickRows.slice(0, REPORT_TABLE_LIMIT);
  const uniqueUserIds = Array.from(
    new Set(
      visibleClickRows
        .map((row) => row.user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  let profilesByUserId = new Map<string, ProfileRow>();

  if (uniqueUserIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", uniqueUserIds);

    if (profilesError) {
      throw new Error("Failed to load affiliate user profiles.");
    }

    profilesByUserId = new Map(
      ((profiles || []) as ProfileRow[]).map((profile) => [profile.user_id, profile])
    );
  }

  let conversionRows: AffiliateConversionRow[] = [];

  if (clickIds.length > 0) {
    const { data: conversions, error: conversionsError } = await supabaseAdmin
      .from("affiliate_conversions")
      .select(
        "id, affiliate_click_id, amount, click_token, conversion_status, external_order_id, payout, raw_payload, received_at"
      )
      .in("affiliate_click_id", clickIds)
      .order("received_at", { ascending: false });

    if (conversionsError) {
      throw new Error("Failed to load affiliate conversions.");
    }

    conversionRows = (conversions || []) as AffiliateConversionRow[];
  }

  const hiddenTestConversions = conversionRows.filter(isLikelyTestConversion);
  const realConversionRows = conversionRows.filter((row) => !isLikelyTestConversion(row));
  const allReportRows = buildPerformanceRows(clickRows, realConversionRows, profilesByUserId);
  const reportRows = allReportRows.slice(0, REPORT_TABLE_LIMIT);
  const topItemInsights = buildTopItemInsights(allReportRows);
  const topAngleInsights = buildTopAngleInsights(allReportRows);
  const routeQualityInsights = buildRouteQualityInsights({
    totalDirectClicks: totalDirectClicksCount || 0,
    totalDirectPromotionLinkClicks: totalDirectPromotionLinkClicksCount || 0,
    totalSearchClicks: totalSearchClicksCount || 0,
    totalSearchPromotionLinkClicks: totalSearchPromotionLinkClicksCount || 0,
  });
  const fallbackReasonInsights = buildFallbackReasonInsights(clickRows);
  const familyQualityInsights = buildFamilyQualityInsights(clickRows);

  const totalClicks = totalClicksCount || 0;
  const totalDirectClicks = totalDirectClicksCount || 0;
  const totalPromotionLinkClicks = totalPromotionLinkClicksCount || 0;
  const totalSearchClicks = totalSearchClicksCount || 0;
  const totalConversions = realConversionRows.length;
  const totalSales = realConversionRows.reduce((sum, row) => sum + parseNumericValue(row.amount), 0);
  const totalPayout = realConversionRows.reduce((sum, row) => sum + parseNumericValue(row.payout), 0);
  const promotionLinkCoverage =
    totalClicks > 0 ? (totalPromotionLinkClicks / totalClicks) * 100 : 0;
  const legacyRouteClicks = Math.max(0, totalClicks - totalDirectClicks - totalSearchClicks);
  const legacyPromotionLinkClicks = Math.max(
    0,
    totalPromotionLinkClicks -
      (totalDirectPromotionLinkClicksCount || 0) -
      (totalSearchPromotionLinkClicksCount || 0)
  );
  const hiddenTestSales = hiddenTestConversions.reduce(
    (sum, row) => sum + parseNumericValue(row.amount),
    0
  );
  const hiddenTestPayout = hiddenTestConversions.reduce(
    (sum, row) => sum + parseNumericValue(row.payout),
    0
  );
  const filterContext = `${describeWindowFilter(windowFilter)} | ${describeRouteFilter(routeFilter)}`;
  const visibleRouteQualityInsights =
    routeFilter === "all"
      ? routeQualityInsights
      : routeQualityInsights.filter((insight) =>
          routeFilter === "direct"
            ? insight.label === "Direct product routes"
            : insight.label === "Lazada search links"
        );
  const routeScopedLabel =
    routeFilter === "all" ? "selected route view" : describeRouteFilter(routeFilter).toLowerCase();
  const optimizationRecommendations = buildOptimizationRecommendations({
    familyQualityInsights,
    legacyPromotionLinkClicks,
    legacyRouteClicks,
    routeQualityInsights: visibleRouteQualityInsights,
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#edf6ff_0%,#f8fbff_45%,#eef5ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600">
              Affiliate Performance
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Lazada affiliate report
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              This owner-only page shows which Lazada links users opened, which conversions Lazada
              reported, and which shopping paths are working best.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_18px_50px_rgba(148,163,184,0.14)] transition hover:-translate-y-0.5"
            >
              Back to dashboard
            </Link>
            <Link
              href="/secret-santa"
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5"
            >
              Open shopping flow
            </Link>
          </div>
        </div>

        <section className="rounded-4xl border border-white/70 bg-white/88 p-5 shadow-[0_24px_70px_rgba(148,163,184,0.14)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Filters
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">What to improve</h2>
            </div>
            <p className="text-sm text-slate-500">Showing: {filterContext}</p>
          </div>

          <form className="mt-5 flex flex-wrap items-end gap-4" method="get">
            <label className="flex min-w-45 flex-col gap-2 text-sm font-medium text-slate-700">
              Date window
              <select
                name="window"
                defaultValue={windowFilter}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-300"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </label>

            <label className="flex min-w-45 flex-col gap-2 text-sm font-medium text-slate-700">
              Link type
              <select
                name="route"
                defaultValue={routeFilter}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-300"
              >
                <option value="all">All routes</option>
                <option value="direct">Direct product routes</option>
                <option value="search">Lazada search links</option>
              </select>
            </label>

            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5"
            >
              Apply filters
            </button>

            {(windowFilter !== "30d" || routeFilter !== "all") && (
              <Link
                href="/dashboard/affiliate-report"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
              >
                Reset
              </Link>
            )}
          </form>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            The insights below are based on the selected time window and link type. Recent activity is
            capped to the latest {REPORT_ACTIVITY_LIMIT} Lazada clicks for performance, with the latest{" "}
            {REPORT_TABLE_LIMIT} rows shown in the table.
          </p>

          {hiddenTestConversions.length > 0 && (
            <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
              Test conversions are hidden from the payout totals in this view. Hidden test rows:{" "}
              <span className="font-semibold">{hiddenTestConversions.length}</span> | Hidden sale amount:{" "}
              <span className="font-semibold">{formatPesoAmount(hiddenTestSales)}</span> | Hidden payout:{" "}
              <span className="font-semibold">{formatPesoAmount(hiddenTestPayout)}</span>
            </div>
          )}
        </section>

        <LazadaHealthCheckCard
          health={lazadaHealth}
          postbackUrl={lazadaPostbackUrl}
          testPostbackStatus={resolvedSearchParams.testPostback}
        />

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            label="Total clicks"
            value={String(totalClicks)}
            helper={`Tracked Lazada clicks in ${describeWindowFilter(windowFilter).toLowerCase()} for the selected route view.`}
          />
          <SummaryCard
            label="Direct clicks"
            value={String(totalDirectClicks)}
            helper={`Direct product clicks in ${describeWindowFilter(windowFilter).toLowerCase()} for ${routeScopedLabel}.`}
          />
          <SummaryCard
            label="Search clicks"
            value={String(totalSearchClicks)}
            helper={`Lazada search-link clicks in ${describeWindowFilter(windowFilter).toLowerCase()} for ${routeScopedLabel}.`}
          />
          <SummaryCard
            label="Promotion-link coverage"
            value={formatPercentValue(promotionLinkCoverage)}
            helper={`${totalPromotionLinkClicks} of ${totalClicks} Lazada clicks resolved to trackable affiliate links.`}
          />
          <SummaryCard
            label="Mapped conversions"
            value={String(totalConversions)}
            helper="Conversions currently linked to the filtered clicks loaded below."
          />
          <SummaryCard
            label="Recent payout"
            value={formatPesoAmount(totalPayout)}
            helper={`Mapped payout in this view. Loaded sale amount: ${formatPesoAmount(totalSales)}.`}
          />
        </section>

        <section className="mt-8 rounded-4xl border border-white/70 bg-white/88 p-5 shadow-[0_24px_70px_rgba(148,163,184,0.14)] backdrop-blur-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Insight summary
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Top item signals</h2>
            </div>
            <p className="text-sm text-slate-500">
              The Supabase view name is <span className="font-semibold text-slate-700">affiliate_performance</span>.
            </p>
          </div>

          <div className="mb-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Angle signals
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">Top selected angles</h3>
              </div>
              <p className="text-sm text-slate-500">
                New clicks now store the selected Step 1 angle directly.
              </p>
            </div>

            {topAngleInsights.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center text-sm font-medium text-slate-500">
                No angle-level signals yet for this filter.
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {topAngleInsights.map((insight) => (
                  <AngleInsightCard key={insight.label} insight={insight} />
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recommended next moves
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">What to tune next</h3>
              </div>
              <p className="text-sm text-slate-500">
                A compact read of the strongest path, the weakest family, and how much legacy data is still mixed in.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {optimizationRecommendations.map((insight) => (
                <RecommendationCard key={`${insight.label}-${insight.title}`} insight={insight} />
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Link quality
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">Route coverage by type</h3>
              </div>
              <p className="text-sm text-slate-500">
                These percentages show how often each link type becomes a trackable Lazada affiliate link.
              </p>
            </div>

            <div className={`grid gap-4 ${routeFilter === "all" ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
              {visibleRouteQualityInsights.map((insight) => (
                <RouteQualityCard key={insight.label} insight={insight} />
              ))}
              {routeFilter === "all" && (
                <LegacySupportCard
                  legacyPromotionLinkClicks={legacyPromotionLinkClicks}
                  legacyRouteClicks={legacyRouteClicks}
                />
              )}
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Weak-path signals
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">Fallback reasons</h3>
              </div>
              <p className="text-sm text-slate-500">
                These are the most common non-promotion outcomes in the current filtered sample.
              </p>
            </div>

            {fallbackReasonInsights.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center text-sm font-medium text-slate-500">
                No fallback reasons in this sample. The current filtered clicks all resolved to promotion links.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {fallbackReasonInsights.map((insight) => (
                  <section
                    key={insight.label}
                    className="rounded-3xl border border-white/70 bg-white/88 p-4 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-md"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Tracking reason
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">{insight.label}</h3>
                    <p className="mt-4 text-sm text-slate-600">
                      Clicks in sample: <span className="font-semibold text-slate-900">{insight.click_count}</span>
                    </p>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Family weak spots
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">Item family health</h3>
              </div>
              <p className="text-sm text-slate-500">
                Sample-based coverage by item family so we can see where Lazada still needs tuning.
              </p>
            </div>

            {familyQualityInsights.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center text-sm font-medium text-slate-500">
                No family-level signals yet for this filter.
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-3">
                {familyQualityInsights.map((insight) => (
                  <FamilyQualityCard key={insight.family} insight={insight} />
                ))}
              </div>
            )}
          </div>

          {topItemInsights.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center text-sm font-medium text-slate-500">
              No item insights yet for this filter. Click a few Lazada cards, then check back here.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              {topItemInsights.map((insight) => (
                <InsightCard key={insight.suggestion_title} insight={insight} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-4xl border border-white/70 bg-white/88 p-5 shadow-[0_24px_70px_rgba(148,163,184,0.14)] backdrop-blur-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Latest activity
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Clicks and conversions
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Opened in Lazada is what our app sent the user to. Lazada reported product stays
                pending for search links until Lazada sends a matching conversion report
                with product details.
              </p>
            </div>
            <p className="text-sm text-slate-500">Owner-only visibility across the app.</p>
          </div>

          {reportRows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center text-sm font-medium text-slate-500">
              No affiliate clicks or conversions yet for this filter. Click a Lazada card first, then check back here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Shopping option</th>
                    <th className="px-3 py-2">Opened in Lazada</th>
                    <th className="px-3 py-2">Lazada reported product</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Resolution</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Payout</th>
                    <th className="px-3 py-2">Clicked</th>
                    <th className="px-3 py-2">Converted</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row) => (
                    <tr
                      key={`${row.affiliate_click_id}-${row.affiliate_conversion_id || "pending"}`}
                      className="rounded-[22px] bg-slate-50/80 text-sm text-slate-700 shadow-[0_10px_25px_rgba(148,163,184,0.08)]"
                    >
                      <td className="rounded-l-[22px] px-3 py-3 align-top">
                        <div className="font-semibold text-slate-900">{row.actor_label}</div>
                        <div className="mt-1 text-xs text-slate-500">Owner-only visibility</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-slate-900">
                          {buildSelectedAngleLabel(row)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Step 1 angle</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-slate-900">
                          {buildOpenedLinkDisplayTitle(row)}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          {buildOpenedLinkDisplayDetail(row)}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-slate-900">
                          {buildLazadaProductDisplayTitle(row)}
                        </div>
                        <div
                          className={`mt-1 text-xs leading-5 ${
                            hasConvertedProductSummary(row)
                              ? "text-emerald-700"
                              : row.catalog_source === "search-backed"
                                ? "text-amber-700"
                                : "text-slate-500"
                          }`}
                        >
                          {buildLazadaProductDisplayDetail(row)}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-slate-800">
                          {row.fit_label || row.tracking_label || "Affiliate click"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {describeCatalogSource(row.catalog_source)}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className={`font-semibold ${ResolutionDetailTone(row)}`}>
                          {ResolutionDetailLabel(row)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {ResolutionDetailSubcopy(row)}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            row.affiliate_conversion_id
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.conversion_status || (row.affiliate_conversion_id ? "tracked" : "clicked")}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top font-semibold text-slate-900">
                        {row.amount !== null ? formatPesoAmount(parseNumericValue(row.amount)) : "--"}
                      </td>
                      <td className="px-3 py-3 align-top font-semibold text-slate-900">
                        {row.payout !== null ? formatPesoAmount(parseNumericValue(row.payout)) : "--"}
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-500">
                        {formatDateTime(row.clicked_at)}
                      </td>
                      <td className="rounded-r-[22px] px-3 py-3 align-top text-xs text-slate-500">
                        {formatDateTime(row.converted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
