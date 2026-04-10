import "server-only";

import { createHash, createHmac } from "crypto";
import {
  findBestLazadaFeedMatches,
  findLazadaFeedProductByItemId,
  findLazadaFeedProductByUrl,
} from "@/lib/affiliate/lazada-feed";
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";

export const LAZADA_DEFAULT_API_BASE_URL = "https://api.lazada.com.ph/rest";
export const LAZADA_GET_LINK_PATH = "/marketing/getlink";
export const LAZADA_MAX_GET_LINK_BATCH_SIZE = 100;

export type LazadaLinkInputType = "offerId" | "productId" | "url";

export type LazadaSubIds = Partial<
  Record<"subId1" | "subId2" | "subId3" | "subId4" | "subId5" | "subId6", string>
>;

export type LazadaOpenApiStatus = {
  apiBaseUrl: string;
  missingEnvVars: string[];
  ready: boolean;
};

export type LazadaGetLinkRequestOptions = {
  inputType: LazadaLinkInputType;
  inputValues: string[];
  userToken: string;
  subAffId?: string | null;
  subIds?: LazadaSubIds;
  dmInviteId?: string | null;
  mmCampaignId?: string | null;
};

export type LazadaRawGetLinkItem = {
  dmCommission?: string | null;
  dmPromotionLink?: string | null;
  errorCode?: string | null;
  errorMsg?: string | null;
  hyperCommissionAmount?: string | null;
  hyperCommissionRate?: string | null;
  inputValue?: string | null;
  mmCommission?: string | null;
  mmPromotionLink?: string | null;
  offerName?: string | null;
  offerPromotionLink?: string | null;
  originalUrl?: string | null;
  productId?: string | null;
  productName?: string | null;
  regularCommission?: string | null;
  regularPromotionLink?: string | null;
};

export type LazadaRawGetLinkResponse = {
  code?: string | null;
  data?: {
    offerBatchGetLinkInfoList?: LazadaRawGetLinkItem[] | null;
    productBatchGetLinkInfoList?: LazadaRawGetLinkItem[] | null;
    urlBatchGetLinkInfoList?: LazadaRawGetLinkItem[] | null;
  } | null;
  error_code?: string | null;
  error_msg?: string | null;
  message?: string | null;
  request_id?: string | null;
  result?: {
    data?: {
      offerBatchGetLinkInfoList?: LazadaRawGetLinkItem[] | null;
      productBatchGetLinkInfoList?: LazadaRawGetLinkItem[] | null;
      urlBatchGetLinkInfoList?: LazadaRawGetLinkItem[] | null;
    } | null;
    success?: boolean | null;
  } | null;
  success?: boolean | null;
  type?: string | null;
};

export type LazadaNormalizedPromotionLink = {
  inputValue: string;
  offerName: string | null;
  originalUrl: string | null;
  productId: string | null;
  productName: string | null;
  promotionLink: string | null;
  regularCommission: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type LazadaPromotionLinkResolution = {
  mode: "promotion-link" | "search-fallback";
  reason:
    | "api-error"
    | "feed-promo-link-ready"
    | "invalid-product-url"
    | "invalid-search-url"
    | "missing-product-id"
    | "open-api-disabled"
    | "open-api-not-live"
    | "open-api-pending"
    | "promotion-link-ready";
  targetUrl: string;
};

export type LazadaPrimePromotionLinksResult = {
  productIdsPrimed: number;
  ready: boolean;
  urlsPrimed: number;
};

export type LazadaAffiliateAttributionContext = {
  catalogSource?: string | null;
  fitLabel?: string | null;
  groupId?: string | null;
  productId?: string | null;
  searchQuery: string;
  selectedQuery?: string | null;
  skuId?: string | null;
  trackingLabel?: string | null;
  wishlistItemId?: string | null;
};

type LazadaCachedPromotionLinkEntry = {
  expiresAt: number;
  links: LazadaNormalizedPromotionLink[];
};

const LAZADA_PROMOTION_LINK_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const lazadaGlobalCache = globalThis as typeof globalThis & {
  __lazadaPromotionLinkCache?: Map<string, LazadaCachedPromotionLinkEntry>;
};

function canonicalizeLazadaRequestParams(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== "sign")
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${key}${params[key] ?? ""}`)
    .join("");
}

function signLazadaRequest(
  path: string,
  params: Record<string, string>,
  appSecret: string
): string {
  const payload = `${path}${canonicalizeLazadaRequestParams(params)}`;

  return createHmac("sha256", appSecret)
    .update(payload, "utf8")
    .digest("hex")
    .toUpperCase();
}

function getLazadaPromotionLinkCache(): Map<string, LazadaCachedPromotionLinkEntry> {
  if (!lazadaGlobalCache.__lazadaPromotionLinkCache) {
    lazadaGlobalCache.__lazadaPromotionLinkCache = new Map();
  }

  return lazadaGlobalCache.__lazadaPromotionLinkCache;
}

function appendLazadaSubIdsToPromotionLink(
  targetUrl: string,
  subIds: LazadaSubIds
): string {
  const safeSubIds = sanitizeLazadaSubIds(subIds);

  try {
    const parsed = new URL(targetUrl);

    for (const [key, value] of Object.entries(safeSubIds)) {
      if (!parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, value);
      }
    }

    return parsed.toString();
  } catch {
    return targetUrl;
  }
}

function isResolvableLazadaUrl(value: string): boolean {
  try {
    const parsed = new URL(value);

    return /(^|\.)lazada\.com\.ph$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

function sanitizeOptionalIdentifier(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^a-zA-Z0-9._:-]/g, "").trim();
  return normalized.length > 0 ? normalized.slice(0, 80) : null;
}

export function sanitizeLazadaSubIds(subIds?: LazadaSubIds): LazadaSubIds {
  if (!subIds) {
    return {};
  }

  return Object.entries(subIds).reduce<LazadaSubIds>((accumulator, [key, value]) => {
    const safeValue = sanitizeOptionalIdentifier(value);

    if (!safeValue) {
      return accumulator;
    }

    accumulator[key as keyof LazadaSubIds] = safeValue;
    return accumulator;
  }, {});
}

export function getLazadaOpenApiStatus(): LazadaOpenApiStatus {
  const missingEnvVars: string[] = [];

  if (!process.env.LAZADA_APP_KEY) {
    missingEnvVars.push("LAZADA_APP_KEY");
  }

  if (!process.env.LAZADA_APP_SECRET) {
    missingEnvVars.push("LAZADA_APP_SECRET");
  }

  if (!process.env.LAZADA_USER_TOKEN) {
    missingEnvVars.push("LAZADA_USER_TOKEN");
  }

  return {
    apiBaseUrl: process.env.LAZADA_API_BASE_URL || LAZADA_DEFAULT_API_BASE_URL,
    missingEnvVars,
    ready: missingEnvVars.length === 0,
  };
}

export function buildLazadaWishlistSubIds(searchQuery: string): LazadaSubIds {
  return buildLazadaWishlistSubIdsFromContext({
    searchQuery,
  });
}

function slugifyLazadaSubIdValue(value: string | null | undefined, fallback: string): string {
  const slug = (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return slug || fallback;
}

export function buildLazadaClickToken(context: LazadaAffiliateAttributionContext): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        catalogSource: context.catalogSource || "",
        fitLabel: context.fitLabel || "",
        groupId: context.groupId || "",
        productId: context.productId || "",
        searchQuery: context.searchQuery,
        selectedQuery: context.selectedQuery || "",
        skuId: context.skuId || "",
        trackingLabel: context.trackingLabel || "",
        wishlistItemId: context.wishlistItemId || "",
      })
    )
    .digest("hex")
    .slice(0, 16);
}

export function buildLazadaWishlistSubIdsFromContext(
  context: LazadaAffiliateAttributionContext
): LazadaSubIds {
  const sourceToken = slugifyLazadaSubIdValue(context.catalogSource, "search");
  const roleToken = slugifyLazadaSubIdValue(
    context.fitLabel || context.trackingLabel,
    "gift"
  );
  const queryToken = slugifyLazadaSubIdValue(context.searchQuery, "gift");
  const clickToken = buildLazadaClickToken(context);

  return sanitizeLazadaSubIds({
    subId1: "secret-santa",
    subId2: "wishlist",
    subId3: sourceToken,
    subId4: roleToken,
    subId5: queryToken,
    subId6: clickToken,
  });
}

function buildGenericLazadaPromotionCacheKey(
  inputType: LazadaLinkInputType,
  inputValues: string[]
): string {
  return buildLazadaGetLinkCacheKey({
    inputType,
    inputValues,
  });
}

export function chunkLazadaInputValues(values: string[]): string[][] {
  const sanitizedValues = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const chunks: string[][] = [];

  for (let index = 0; index < sanitizedValues.length; index += LAZADA_MAX_GET_LINK_BATCH_SIZE) {
    chunks.push(sanitizedValues.slice(index, index + LAZADA_MAX_GET_LINK_BATCH_SIZE));
  }

  return chunks;
}

export function buildLazadaGetLinkRequest(
  options: LazadaGetLinkRequestOptions
): Record<string, string> {
  const sanitizedSubIds = sanitizeLazadaSubIds(options.subIds);
  const request: Record<string, string> = {
    inputType: options.inputType,
    inputValue: options.inputValues.join(","),
    userToken: options.userToken,
  };

  const safeCampaignId = sanitizeOptionalIdentifier(options.mmCampaignId);
  const safeInviteId = sanitizeOptionalIdentifier(options.dmInviteId);
  const safeSubAffId = sanitizeOptionalIdentifier(options.subAffId);

  if (safeCampaignId) {
    request.mmCampaignId = safeCampaignId;
  }

  if (safeInviteId) {
    request.dmInviteId = safeInviteId;
  }

  if (safeSubAffId) {
    request.subAffId = safeSubAffId;
  }

  for (const [key, value] of Object.entries(sanitizedSubIds)) {
    request[key] = value;
  }

  return request;
}

// Cache keys must be stable across restarts and safe to log.
// We hash the request payload rather than embedding raw user tokens or URLs.
export function buildLazadaGetLinkCacheKey(
  options: Omit<LazadaGetLinkRequestOptions, "userToken">
): string {
  const payload = JSON.stringify({
    dmInviteId: sanitizeOptionalIdentifier(options.dmInviteId),
    inputType: options.inputType,
    inputValues: [...options.inputValues].map((value) => value.trim()).sort(),
    mmCampaignId: sanitizeOptionalIdentifier(options.mmCampaignId),
    subAffId: sanitizeOptionalIdentifier(options.subAffId),
    subIds: sanitizeLazadaSubIds(options.subIds),
  });

  return createHash("sha256").update(payload).digest("hex");
}

export function readCachedLazadaPromotionLinks(
  cacheKey: string
): LazadaNormalizedPromotionLink[] | null {
  const cache = getLazadaPromotionLinkCache();
  const cachedEntry = cache.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    cache.delete(cacheKey);
    return null;
  }

  return cachedEntry.links;
}

export function storeCachedLazadaPromotionLinks(
  cacheKey: string,
  links: LazadaNormalizedPromotionLink[]
): void {
  const cache = getLazadaPromotionLinkCache();

  cache.set(cacheKey, {
    expiresAt: Date.now() + LAZADA_PROMOTION_LINK_CACHE_TTL_MS,
    links,
  });
}

export function normalizeLazadaGetLinkResponse(
  inputType: LazadaLinkInputType,
  response: LazadaRawGetLinkResponse
): LazadaNormalizedPromotionLink[] {
  const responseData = response.result?.data || response.data;
  const list =
    inputType === "productId"
      ? responseData?.productBatchGetLinkInfoList
      : inputType === "url"
        ? responseData?.urlBatchGetLinkInfoList
        : responseData?.offerBatchGetLinkInfoList;

  return (list || []).map((item) => ({
    inputValue: item.inputValue || item.productId || item.originalUrl || "",
    offerName: item.offerName || null,
    originalUrl: item.originalUrl || null,
    productId: item.productId || null,
    productName: item.productName || null,
    promotionLink:
      item.regularPromotionLink || item.offerPromotionLink || item.mmPromotionLink || null,
    regularCommission: item.regularCommission || null,
    errorCode: item.errorCode || response.error_code || response.code || null,
    errorMessage: item.errorMsg || response.error_msg || response.message || null,
  }));
}

export async function primeLazadaPromotionLinks(options: {
  productIds?: string[] | null;
  urls?: string[] | null;
}): Promise<LazadaPrimePromotionLinksResult> {
  const openApiStatus = getLazadaOpenApiStatus();

  if (!openApiStatus.ready || process.env.LAZADA_OPEN_API_ENABLED !== "true") {
    return {
      productIdsPrimed: 0,
      ready: false,
      urlsPrimed: 0,
    };
  }

  const uniqueProductIds = Array.from(
    new Set(
      (options.productIds || [])
        .map((productId) => productId.trim())
        .filter((productId) => productId.length > 0)
    )
  );
  const uniqueUrls = Array.from(
    new Set(
      (options.urls || [])
        .map((url) => normalizeLazadaProductPageUrl(url))
        .filter((url): url is string => Boolean(url))
    )
  );
  const productFeedHits = uniqueProductIds.filter(
    (productId) => Boolean(findLazadaFeedProductByItemId(productId)?.promoShortLink)
  );
  const productIdsNeedingApiFetch = uniqueProductIds.filter(
    (productId) => !findLazadaFeedProductByItemId(productId)?.promoShortLink
  );
  const urlFeedHits = uniqueUrls.filter(
    (url) => Boolean(findLazadaFeedProductByUrl(url)?.promoShortLink)
  );
  const urlsNeedingApiFetch = uniqueUrls.filter(
    (url) => !findLazadaFeedProductByUrl(url)?.promoShortLink
  );

  let productIdsPrimed = 0;
  let urlsPrimed = 0;

  productIdsPrimed = productFeedHits.length;

  if (productIdsNeedingApiFetch.length > 0) {
    const links = await fetchLazadaPromotionLinks({
      apiBaseUrl: openApiStatus.apiBaseUrl,
      appKey: process.env.LAZADA_APP_KEY!,
      appSecret: process.env.LAZADA_APP_SECRET!,
      userToken: process.env.LAZADA_USER_TOKEN!,
      inputType: "productId",
      inputValues: productIdsNeedingApiFetch,
    });

    productIdsPrimed += links.filter((link) => Boolean(link.promotionLink)).length;
  }

  urlsPrimed = urlFeedHits.length;

  if (urlsNeedingApiFetch.length > 0) {
    const links = await fetchLazadaPromotionLinks({
      apiBaseUrl: openApiStatus.apiBaseUrl,
      appKey: process.env.LAZADA_APP_KEY!,
      appSecret: process.env.LAZADA_APP_SECRET!,
      userToken: process.env.LAZADA_USER_TOKEN!,
      inputType: "url",
      inputValues: urlsNeedingApiFetch,
    });

    urlsPrimed += links.filter((link) => Boolean(link.promotionLink)).length;
  }

  return {
    productIdsPrimed,
    ready: true,
    urlsPrimed,
  };
}

async function fetchLazadaPromotionLinks(
  options: Omit<LazadaGetLinkRequestOptions, "userToken"> & {
    apiBaseUrl: string;
    appKey: string;
    appSecret: string;
    userToken: string;
  }
): Promise<LazadaNormalizedPromotionLink[]> {
  const cacheKey = buildLazadaGetLinkCacheKey({
    inputType: options.inputType,
    inputValues: options.inputValues,
    subAffId: options.subAffId,
    subIds: options.subIds,
    dmInviteId: options.dmInviteId,
    mmCampaignId: options.mmCampaignId,
  });
  const cachedLinks = readCachedLazadaPromotionLinks(cacheKey);

  if (cachedLinks) {
    return cachedLinks;
  }

  const chunks = chunkLazadaInputValues(options.inputValues);
  const normalizedLinks: LazadaNormalizedPromotionLink[] = [];

  for (const chunk of chunks) {
    const businessParams = buildLazadaGetLinkRequest({
      inputType: options.inputType,
      inputValues: chunk,
      userToken: options.userToken,
      subAffId: options.subAffId,
      subIds: options.subIds,
      dmInviteId: options.dmInviteId,
      mmCampaignId: options.mmCampaignId,
    });
    const requestParams: Record<string, string> = {
      ...businessParams,
      app_key: options.appKey,
      sign_method: "sha256",
      timestamp: Date.now().toString(),
    };
    const sign = signLazadaRequest(LAZADA_GET_LINK_PATH, requestParams, options.appSecret);

    requestParams.sign = sign;

    const response = await fetch(
      `${options.apiBaseUrl}${LAZADA_GET_LINK_PATH}`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(requestParams).toString(),
      }
    );

    if (!response.ok) {
      throw new Error(`Lazada getlink failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as LazadaRawGetLinkResponse;
    const links = normalizeLazadaGetLinkResponse(options.inputType, payload);

    normalizedLinks.push(...links);
  }

  storeCachedLazadaPromotionLinks(cacheKey, normalizedLinks);
  return normalizedLinks;
}

// This helper is the switch point for real Lazada promotion links.
// Today it safely falls back to the normal Lazada search URL when API access is
// still pending. Once the Open API credentials are approved, we can replace the
// internals here with the signed /marketing/getlink call and keep the redirect
// route contract unchanged.
export async function resolveLazadaPromotionLinkTarget(options: {
  attribution?: Omit<LazadaAffiliateAttributionContext, "searchQuery">;
  fallbackUrl: string;
  productId: string | null;
  searchQuery: string;
}): Promise<LazadaPromotionLinkResolution> {
  if (!options.productId) {
    return {
      mode: "search-fallback",
      reason: "missing-product-id",
      targetUrl: options.fallbackUrl,
    };
  }

  const wishlistSubIds = buildLazadaWishlistSubIdsFromContext({
    searchQuery: options.searchQuery,
    ...options.attribution,
  });
  const feedProduct = findLazadaFeedProductByItemId(options.productId);

  if (feedProduct?.promoShortLink) {
    return {
      mode: "promotion-link",
      reason: "feed-promo-link-ready",
      targetUrl: appendLazadaSubIdsToPromotionLink(feedProduct.promoShortLink, wishlistSubIds),
    };
  }

  const openApiStatus = getLazadaOpenApiStatus();

  if (!openApiStatus.ready) {
    return {
      mode: "search-fallback",
      reason: "open-api-pending",
      targetUrl: options.fallbackUrl,
    };
  }

  if (process.env.LAZADA_OPEN_API_ENABLED !== "true") {
    return {
      mode: "search-fallback",
      reason: "open-api-disabled",
      targetUrl: options.fallbackUrl,
    };
  }

  const cacheKey = buildGenericLazadaPromotionCacheKey("productId", [options.productId]);
  const cachedLinks = readCachedLazadaPromotionLinks(cacheKey);
  const cachedPromotionLink = cachedLinks?.find((link) => link.productId === options.productId);

  if (cachedPromotionLink?.promotionLink) {
    return {
      mode: "promotion-link",
      reason: "promotion-link-ready",
      targetUrl: appendLazadaSubIdsToPromotionLink(
        cachedPromotionLink.promotionLink,
        wishlistSubIds
      ),
    };
  }

  try {
    const links = await fetchLazadaPromotionLinks({
      apiBaseUrl: openApiStatus.apiBaseUrl,
      appKey: process.env.LAZADA_APP_KEY!,
      appSecret: process.env.LAZADA_APP_SECRET!,
      userToken: process.env.LAZADA_USER_TOKEN!,
      inputType: "productId",
      inputValues: [options.productId],
    });
    const livePromotionLink = links.find((link) => link.productId === options.productId);

    if (livePromotionLink?.promotionLink) {
      return {
        mode: "promotion-link",
        reason: "promotion-link-ready",
        targetUrl: appendLazadaSubIdsToPromotionLink(
          livePromotionLink.promotionLink,
          wishlistSubIds
        ),
      };
    }
  } catch {
    return {
      mode: "search-fallback",
      reason: "api-error",
      targetUrl: options.fallbackUrl,
    };
  }

  return {
    mode: "search-fallback",
    reason: "open-api-not-live",
    targetUrl: options.fallbackUrl,
  };
}

export async function resolveLazadaSuggestionLinkTarget(options: {
  attribution?: Omit<LazadaAffiliateAttributionContext, "searchQuery">;
  fallbackUrl: string;
  productId: string | null;
  searchQuery: string;
  itemName: string;
  itemCategory: string;
  itemNote: string;
  preferredPriceMin: number | null;
  preferredPriceMax: number | null;
  groupBudget: number | null;
}): Promise<LazadaPromotionLinkResolution> {
  if (options.productId) {
    return resolveLazadaPromotionLinkTarget({
      attribution: options.attribution,
      fallbackUrl: options.fallbackUrl,
      productId: options.productId,
      searchQuery: options.searchQuery,
    });
  }

  const feedMatches = findBestLazadaFeedMatches({
    itemName: options.itemName,
    itemCategory: options.itemCategory,
    itemNote: options.itemNote,
    searchQuery: options.searchQuery,
    preferredPriceMin: options.preferredPriceMin,
    preferredPriceMax: options.preferredPriceMax,
    groupBudget: options.groupBudget,
    limit: 1,
    minimumScore: 0.78,
  });
  const topMatch = feedMatches[0] || null;

  if (!topMatch) {
    return {
      mode: "search-fallback",
      reason: "missing-product-id",
      targetUrl: options.fallbackUrl,
    };
  }

  const wishlistSubIds = buildLazadaWishlistSubIdsFromContext({
    searchQuery: options.searchQuery,
    ...options.attribution,
  });

  if (topMatch.product.promoShortLink) {
    return {
      mode: "promotion-link",
      reason: "feed-promo-link-ready",
      targetUrl: appendLazadaSubIdsToPromotionLink(topMatch.product.promoShortLink, wishlistSubIds),
    };
  }

  return resolveLazadaPromotionLinkTarget({
    attribution: options.attribution,
    fallbackUrl: options.fallbackUrl,
    productId: topMatch.product.itemId,
    searchQuery: options.searchQuery,
  });
}

export async function resolveLazadaWishlistItemLinkTarget(options: {
  attribution?: Omit<LazadaAffiliateAttributionContext, "searchQuery">;
  fallbackUrl: string;
  itemName: string;
  itemUrl: string;
}): Promise<LazadaPromotionLinkResolution> {
  const normalizedItemUrl = normalizeLazadaProductPageUrl(options.itemUrl);

  if (!normalizedItemUrl) {
    return {
      mode: "search-fallback",
      reason: "invalid-product-url",
      targetUrl: options.fallbackUrl,
    };
  }

  const wishlistSubIds = buildLazadaWishlistSubIdsFromContext({
    searchQuery: options.itemName,
    ...options.attribution,
  });
  const feedProduct = findLazadaFeedProductByUrl(normalizedItemUrl);

  if (feedProduct?.promoShortLink) {
    return {
      mode: "promotion-link",
      reason: "feed-promo-link-ready",
      targetUrl: appendLazadaSubIdsToPromotionLink(feedProduct.promoShortLink, wishlistSubIds),
    };
  }

  const openApiStatus = getLazadaOpenApiStatus();

  if (!openApiStatus.ready) {
    return {
      mode: "search-fallback",
      reason: "open-api-pending",
      targetUrl: options.fallbackUrl,
    };
  }

  if (process.env.LAZADA_OPEN_API_ENABLED !== "true") {
    return {
      mode: "search-fallback",
      reason: "open-api-disabled",
      targetUrl: options.fallbackUrl,
    };
  }

  const cacheKey = buildGenericLazadaPromotionCacheKey("url", [normalizedItemUrl]);
  const cachedLinks = readCachedLazadaPromotionLinks(cacheKey);
  const cachedPromotionLink = cachedLinks?.find(
    (link) => normalizeLazadaProductPageUrl(link.originalUrl || "") === normalizedItemUrl
  );

  if (cachedPromotionLink?.promotionLink) {
    return {
      mode: "promotion-link",
      reason: "promotion-link-ready",
      targetUrl: appendLazadaSubIdsToPromotionLink(
        cachedPromotionLink.promotionLink,
        wishlistSubIds
      ),
    };
  }

  try {
    const links = await fetchLazadaPromotionLinks({
      apiBaseUrl: openApiStatus.apiBaseUrl,
      appKey: process.env.LAZADA_APP_KEY!,
      appSecret: process.env.LAZADA_APP_SECRET!,
      userToken: process.env.LAZADA_USER_TOKEN!,
      inputType: "url",
      inputValues: [normalizedItemUrl],
    });
    const livePromotionLink = links.find(
      (link) => normalizeLazadaProductPageUrl(link.originalUrl || "") === normalizedItemUrl
    );

    if (livePromotionLink?.promotionLink) {
      return {
        mode: "promotion-link",
        reason: "promotion-link-ready",
        targetUrl: appendLazadaSubIdsToPromotionLink(
          livePromotionLink.promotionLink,
          wishlistSubIds
        ),
      };
    }
  } catch {
    return {
      mode: "search-fallback",
      reason: "api-error",
      targetUrl: options.fallbackUrl,
    };
  }

  return {
    mode: "search-fallback",
    reason: "open-api-not-live",
    targetUrl: options.fallbackUrl,
  };
}

export async function resolveLazadaSearchRouteLinkTarget(options: {
  attribution?: Omit<LazadaAffiliateAttributionContext, "searchQuery">;
  fallbackUrl: string;
  searchQuery: string;
}): Promise<LazadaPromotionLinkResolution> {
  if (!isResolvableLazadaUrl(options.fallbackUrl)) {
    return {
      mode: "search-fallback",
      reason: "invalid-search-url",
      targetUrl: options.fallbackUrl,
    };
  }

  const wishlistSubIds = buildLazadaWishlistSubIdsFromContext({
    searchQuery: options.searchQuery,
    ...options.attribution,
  });

  try {
    const parsedFallbackUrl = new URL(options.fallbackUrl);

    if (/^c\.lazada\.com\.ph$/i.test(parsedFallbackUrl.hostname)) {
      return {
        mode: "promotion-link",
        reason: "promotion-link-ready",
        targetUrl: appendLazadaSubIdsToPromotionLink(options.fallbackUrl, wishlistSubIds),
      };
    }
  } catch {
    return {
      mode: "search-fallback",
      reason: "invalid-search-url",
      targetUrl: options.fallbackUrl,
    };
  }

  const openApiStatus = getLazadaOpenApiStatus();

  if (!openApiStatus.ready) {
    return {
      mode: "search-fallback",
      reason: "open-api-pending",
      targetUrl: options.fallbackUrl,
    };
  }

  if (process.env.LAZADA_OPEN_API_ENABLED !== "true") {
    return {
      mode: "search-fallback",
      reason: "open-api-disabled",
      targetUrl: options.fallbackUrl,
    };
  }

  const cacheKey = buildGenericLazadaPromotionCacheKey("url", [options.fallbackUrl]);
  const cachedLinks = readCachedLazadaPromotionLinks(cacheKey);
  const cachedPromotionLink = cachedLinks?.find(
    (link) => (link.originalUrl || link.inputValue || "") === options.fallbackUrl
  );

  if (cachedPromotionLink?.promotionLink) {
    return {
      mode: "promotion-link",
      reason: "promotion-link-ready",
      targetUrl: appendLazadaSubIdsToPromotionLink(
        cachedPromotionLink.promotionLink,
        wishlistSubIds
      ),
    };
  }

  try {
    const links = await fetchLazadaPromotionLinks({
      apiBaseUrl: openApiStatus.apiBaseUrl,
      appKey: process.env.LAZADA_APP_KEY!,
      appSecret: process.env.LAZADA_APP_SECRET!,
      userToken: process.env.LAZADA_USER_TOKEN!,
      inputType: "url",
      inputValues: [options.fallbackUrl],
    });
    const livePromotionLink = links.find(
      (link) => (link.originalUrl || link.inputValue || "") === options.fallbackUrl
    );

    if (livePromotionLink?.promotionLink) {
      return {
        mode: "promotion-link",
        reason: "promotion-link-ready",
        targetUrl: appendLazadaSubIdsToPromotionLink(
          livePromotionLink.promotionLink,
          wishlistSubIds
        ),
      };
    }
  } catch {
    return {
      mode: "search-fallback",
      reason: "api-error",
      targetUrl: options.fallbackUrl,
    };
  }

  return {
    mode: "search-fallback",
    reason: "open-api-not-live",
    targetUrl: options.fallbackUrl,
  };
}
