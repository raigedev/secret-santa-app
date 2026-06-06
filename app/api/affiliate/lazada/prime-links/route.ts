import { NextRequest } from "next/server";

import { primeLazadaPromotionLinks } from "@/lib/affiliate/lazada";
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
import { noStoreJson } from "@/lib/security/no-store-response";
import { readLimitedJsonBody } from "@/lib/security/request-body";
import { canAccessRecipientWishlistItem } from "@/lib/wishlist/recipient-access";
import { requireAuthenticatedAffiliateRoute } from "../_shared/authenticated-affiliate-route";

const MAX_BATCH_INPUTS = 100;
const PRIME_LINKS_BODY_LIMIT_BYTES = 64 * 1024;
const LAZADA_PRODUCT_ID_PATTERN = /^[0-9]{1,20}$/;

export const dynamic = "force-dynamic";

type PrimeLinksBody = {
  requests?: unknown;
};

type PrimeLinksRequest = {
  groupId: string;
  productIds: string[];
  urls: string[];
  wishlistItemId: string;
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

function sanitizePrimeLinkRequests(value: unknown): PrimeLinksRequest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((request): request is Record<string, unknown> => {
      return typeof request === "object" && request !== null;
    })
    .map((request) => ({
      groupId: typeof request.groupId === "string" ? request.groupId.trim() : "",
      productIds: sanitizeProductIds(request.productIds),
      urls: sanitizeUrls(request.urls),
      wishlistItemId:
        typeof request.wishlistItemId === "string" ? request.wishlistItemId.trim() : "",
    }))
    .filter(
      (request) =>
        request.groupId.length > 0 &&
        request.wishlistItemId.length > 0 &&
        (request.productIds.length > 0 || request.urls.length > 0)
    )
    .slice(0, MAX_BATCH_INPUTS);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedAffiliateRoute(request, {
    action: "affiliate.lazada.prime_links",
    maxAttempts: 60,
    resourceId: "lazada",
    resourceType: "affiliate_redirect",
    windowSeconds: 3600,
  });

  if (!auth.ok) {
    return auth.response;
  }

  const payloadResult = await readLimitedJsonBody<PrimeLinksBody>(
    request,
    PRIME_LINKS_BODY_LIMIT_BYTES
  );

  if (!payloadResult.ok) {
    return noStoreJson(
      { error: payloadResult.error === "too-large" ? "Request body too large" : "Invalid JSON body" },
      { status: payloadResult.error === "too-large" ? 413 : 400 }
    );
  }

  const payload = payloadResult.body;
  const linkRequests = sanitizePrimeLinkRequests(payload.requests);
  const productIdSet = new Set<string>();
  const urlSet = new Set<string>();

  for (const linkRequest of linkRequests) {
    const accessCheck = await canAccessRecipientWishlistItem({
      groupId: linkRequest.groupId,
      userId: auth.userId,
      wishlistItemId: linkRequest.wishlistItemId,
    });

    if (!accessCheck.allowed) {
      return noStoreJson(
        {
          error: "Forbidden",
          primed: false,
          productIdsPrimed: 0,
          urlsPrimed: 0,
        },
        { status: 403 }
      );
    }

    for (const productId of linkRequest.productIds) {
      if (productIdSet.size < MAX_BATCH_INPUTS) {
        productIdSet.add(productId);
      }
    }

    for (const url of linkRequest.urls) {
      if (urlSet.size < MAX_BATCH_INPUTS) {
        urlSet.add(url);
      }
    }
  }

  const productIds = [...productIdSet];
  const urls = [...urlSet];

  if (productIds.length === 0 && urls.length === 0) {
    return noStoreJson({
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

    return noStoreJson({
      primed: result.ready,
      productIdsPrimed: result.productIdsPrimed,
      urlsPrimed: result.urlsPrimed,
    });
  } catch {
    return noStoreJson(
      {
        error: "Failed to prime Lazada promotion links",
      },
      { status: 500 }
    );
  }
}
