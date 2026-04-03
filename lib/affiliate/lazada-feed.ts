import "server-only";

import importedLazadaFeedRows from "@/lib/affiliate/lazada-feed-data.generated.json";
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";

export type LazadaImportedFeedRow = {
  date: string;
  skuId: string;
  itemId: string;
  productName: string;
  salePrice: string;
  discountedPrice: string;
  discountedPercentage: string;
  pictureUrl: string;
  productUrl: string;
  brand: string;
  maximumCommissionRate: string;
  categoryLv1: string;
  sellerId: string;
  inviteId: string;
  dmInviteStartTime: string;
  dmInviteEndTime: string;
  promoLink: string;
  promoDeepLink: string;
  promoShortLink: string;
  promoCode: string;
  subAffId: string;
  subId1: string;
  subId2: string;
  subId3: string;
  mediaLandingPage: string;
  subId4: string;
  subId5: string;
  subId6: string;
  pickChannel: string;
};

export type LazadaFeedProduct = {
  itemId: string;
  skuId: string;
  productName: string;
  productUrl: string | null;
  pictureUrl: string | null;
  promoShortLink: string | null;
  promoLink: string | null;
  promoDeepLink: string | null;
  brand: string | null;
  categoryLv1: string | null;
  salePrice: number | null;
  discountedPrice: number | null;
  discountedPercentage: string | null;
  maximumCommissionRate: string | null;
  pickChannel: string | null;
  normalizedProductUrl: string | null;
};

export type LazadaFeedMatch = {
  product: LazadaFeedProduct;
  score: number;
  reasons: string[];
};

const LAZADA_IMPORTED_FEED_ROWS =
  importedLazadaFeedRows as LazadaImportedFeedRow[];

const MATCH_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "best",
  "budget",
  "for",
  "gift",
  "gifts",
  "in",
  "of",
  "or",
  "set",
  "the",
  "to",
  "with",
]);

const TECH_MATCH_WORDS = [
  "tablet",
  "ipad",
  "galaxy",
  "redmi",
  "xiaomi",
  "samsung",
  "android",
  "device",
];

const TECH_EXCLUDE_WORDS = [
  "animal",
  "cat",
  "cats",
  "dog",
  "dogs",
  "heart",
  "monitor",
  "pet",
  "veterinary",
];

function normalizeFeedString(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeFeedText(value: string): string[] {
  return normalizeFeedString(value)
    .split(" ")
    .filter((token) => token.length > 1 && !MATCH_STOPWORDS.has(token));
}

function parseOptionalFeedNumber(value: string): number | null {
  const normalized = value.trim();

  if (!normalized || normalized.toUpperCase() === "N/A") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeImportedFeedRow(row: LazadaImportedFeedRow): LazadaFeedProduct {
  return {
    itemId: row.itemId.trim(),
    skuId: row.skuId.trim(),
    productName: row.productName.trim(),
    productUrl: row.productUrl.trim() || null,
    pictureUrl: row.pictureUrl.trim() || null,
    promoShortLink: row.promoShortLink.trim() || null,
    promoLink: row.promoLink.trim() || null,
    promoDeepLink: row.promoDeepLink.trim() || null,
    brand: row.brand.trim() || null,
    categoryLv1: row.categoryLv1.trim() || null,
    salePrice: parseOptionalFeedNumber(row.salePrice),
    discountedPrice: parseOptionalFeedNumber(row.discountedPrice),
    discountedPercentage: row.discountedPercentage.trim() || null,
    maximumCommissionRate: row.maximumCommissionRate.trim() || null,
    pickChannel: row.pickChannel.trim() || null,
    normalizedProductUrl: normalizeLazadaProductPageUrl(row.productUrl),
  };
}

export const LAZADA_FEED_PRODUCTS: LazadaFeedProduct[] = LAZADA_IMPORTED_FEED_ROWS.map(
  normalizeImportedFeedRow
);

export function findLazadaFeedProductByUrl(url: string): LazadaFeedProduct | null {
  const normalizedUrl = normalizeLazadaProductPageUrl(url);

  if (!normalizedUrl) {
    return null;
  }

  return (
    LAZADA_FEED_PRODUCTS.find((product) => product.normalizedProductUrl === normalizedUrl) ||
    null
  );
}

function getTargetPrice(
  preferredMin: number | null | undefined,
  preferredMax: number | null | undefined,
  groupBudget: number | null | undefined
): number | null {
  const normalizedPreferredMin = preferredMin ?? null;
  const normalizedPreferredMax = preferredMax ?? null;
  const normalizedGroupBudget = groupBudget ?? null;

  if (normalizedPreferredMin !== null && normalizedPreferredMax !== null) {
    return (normalizedPreferredMin + normalizedPreferredMax) / 2;
  }

  if (normalizedPreferredMax !== null) {
    return normalizedPreferredMax;
  }

  if (normalizedGroupBudget !== null) {
    return normalizedGroupBudget;
  }

  return normalizedPreferredMin;
}

function scoreFeedMatch(input: {
  itemName: string;
  itemCategory: string;
  itemNote: string;
  searchQuery: string;
  preferredPriceMin?: number | null;
  preferredPriceMax?: number | null;
  groupBudget?: number | null;
  product: LazadaFeedProduct;
}): LazadaFeedMatch {
  const productText = [
    input.product.productName,
    input.product.brand,
    input.product.categoryLv1,
  ]
    .filter(Boolean)
    .join(" ");
  const haystack = [
    input.itemName,
    input.itemCategory,
    input.itemNote,
    input.searchQuery,
  ].join(" ");

  const productNormalized = normalizeFeedString(productText);
  const haystackNormalized = normalizeFeedString(haystack);
  const productTokens = new Set(tokenizeFeedText(productText));
  const queryTokens = Array.from(new Set(tokenizeFeedText(haystack)));
  const overlappingTokens = queryTokens.filter((token) => productTokens.has(token));
  const reasons: string[] = [];
  let score = 0;

  if (queryTokens.length > 0) {
    score += Math.min(overlappingTokens.length / queryTokens.length, 1) * 0.55;
  }

  if (
    haystackNormalized.length > 4 &&
    (productNormalized.includes(haystackNormalized) || haystackNormalized.includes(productNormalized))
  ) {
    score += 0.22;
    reasons.push("title overlap");
  }

  const techSearch = /(tablet|ipad|android tab|galaxy tab|redmi pad|xiaomi pad)/.test(
    haystackNormalized
  );

  if (techSearch) {
    if (TECH_MATCH_WORDS.some((word) => productNormalized.includes(word))) {
      score += 0.18;
      reasons.push("tech keyword match");
    }

    if (TECH_EXCLUDE_WORDS.some((word) => productNormalized.includes(word))) {
      score -= 0.9;
      reasons.push("tech mismatch");
    }
  }

  const targetPrice = getTargetPrice(
    input.preferredPriceMin ?? null,
    input.preferredPriceMax ?? null,
    input.groupBudget ?? null
  );
  const productPrice = input.product.discountedPrice ?? input.product.salePrice;

  if (targetPrice !== null && productPrice !== null) {
    const priceGap = Math.abs(productPrice - targetPrice) / Math.max(targetPrice, 1);

    if (priceGap <= 0.25) {
      score += 0.12;
      reasons.push("price fit");
    } else if (priceGap <= 0.5) {
      score += 0.05;
    } else if (priceGap >= 1.2) {
      score -= 0.12;
      reasons.push("price mismatch");
    }
  }

  return {
    product: input.product,
    score,
    reasons,
  };
}

export function findBestLazadaFeedMatches(input: {
  itemName: string;
  itemCategory: string;
  itemNote: string;
  searchQuery: string;
  preferredPriceMin?: number | null;
  preferredPriceMax?: number | null;
  groupBudget?: number | null;
  limit?: number;
  minimumScore?: number;
}): LazadaFeedMatch[] {
  const minimumScore = input.minimumScore ?? 0.72;
  const limit = input.limit ?? 3;

  return LAZADA_FEED_PRODUCTS.map((product) =>
    scoreFeedMatch({
      ...input,
      product,
    })
  )
    .filter((match) => match.score >= minimumScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
