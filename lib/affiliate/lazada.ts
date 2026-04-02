import "server-only";

import { createHash } from "crypto";

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
  data?: {
    offerBatchGetLinkInfoList?: LazadaRawGetLinkItem[] | null;
    productBatchGetLinkInfoList?: LazadaRawGetLinkItem[] | null;
    urlBatchGetLinkInfoList?: LazadaRawGetLinkItem[] | null;
  } | null;
  error_code?: string | null;
  error_msg?: string | null;
  success?: boolean | null;
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

export function normalizeLazadaGetLinkResponse(
  inputType: LazadaLinkInputType,
  response: LazadaRawGetLinkResponse
): LazadaNormalizedPromotionLink[] {
  const list =
    inputType === "productId"
      ? response.data?.productBatchGetLinkInfoList
      : inputType === "url"
        ? response.data?.urlBatchGetLinkInfoList
        : response.data?.offerBatchGetLinkInfoList;

  return (list || []).map((item) => ({
    inputValue: item.inputValue || item.productId || item.originalUrl || "",
    offerName: item.offerName || null,
    originalUrl: item.originalUrl || null,
    productId: item.productId || null,
    productName: item.productName || null,
    promotionLink:
      item.regularPromotionLink || item.offerPromotionLink || item.mmPromotionLink || null,
    regularCommission: item.regularCommission || null,
    errorCode: item.errorCode || response.error_code || null,
    errorMessage: item.errorMsg || response.error_msg || null,
  }));
}
