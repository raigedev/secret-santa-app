type LazadaImportedFeedRow = {
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

const LAZADA_IMPORTED_FEED_ROWS: LazadaImportedFeedRow[] = [
  {
    date: "2026-04-03",
    skuId: "31890603703",
    itemId: "5343634107",
    productName:
      "Portable Pet Heart Rate Monitor - Animal ECG & Vital Signs Monitoring Device, Veterinary-Grade Heart Rate Monitor for Dogs, Cats, and Small Animals.",
    salePrice: "56277.78",
    discountedPrice: "55522.58",
    discountedPercentage: "-1%",
    pictureUrl:
      "https://my-live-01.slatic.net/p/5bec63c9a28132b8b4ab6597ea5111df.jpg",
    productUrl:
      "https://pages.lazada.com.ph/products/pdp-i5343634107-s31890603703.html",
    brand: "No Brand",
    maximumCommissionRate: "22.09%",
    categoryLv1: "N/A",
    sellerId: "501122080800",
    inviteId: "N/A",
    dmInviteStartTime: "N/A",
    dmInviteEndTime: "N/A",
    promoLink:
      "https://pages.lazada.com.ph/products/pdp-i5343634107-s31890603703.html?exlaz=e_7yXqighYAL9sbdaDA0DvZK%252F23Xvf8d6ADAo3n60nGqHWTxJfsb%252BNdNYnaND6549nPdfWnr5gjMsf93k%252FUtMIzOUrmUuWMVw%252FmdxXgFYnvoxBxaI2SDa2Zil6XgQIOLbo4M5B1Suvbb0zZBSbSOQYPSsMlra7h%252BeCQurNMkZ7LZ4WIS45ORi19PbrBDlN5ICQ%252BlPuw2EihQFZDH0k40l8bi2WBAyD9bUWRwtKfSXhnchbIJp0%252B%252Fp6d5oezcbR%252BE4grgjSbwN1VFolQMLdWwuCTdEUr4CXa5%252BGQ8IGCPbf%252B5rSDNL3cp8jjdGt0m0EtnCGkJXWebI3UhxG7eIq%252Bnuj3Ef9OtQDrwmK86iyu60CgNTgFt9UxjjmSwib9tsvqswRab0kUCnTYmdaANM%252BMLvs2nyXb%252BVCI0U6apvwW63pOXTm42JXw2YvyN8HbJJmBvdvx7FaHvblnSg%253D",
    promoDeepLink:
      "lazada://ph/pdp?itemId=5343634107&skuId=31890603703&t=pdp&from_affiliate=1&dsource=sml&exlaz=e_tOo8wiEdkOTGip8qo24MCWmYAMry59QRmdxXgFYnvowrDJa2u4fngkLqzTJGey2eFiEuOTkYtfT26wQ5TeSAkKpK8NtSwPUdSPdvZ0DPOq0%3D",
    promoShortLink: "https://c.lazada.com.ph/t/c.diJmcM",
    promoCode: "$f8s4y$",
    subAffId: "N/A",
    subId1: "N/A",
    subId2: "N/A",
    subId3: "N/A",
    mediaLandingPage: "N/A",
    subId4: "N/A",
    subId5: "N/A",
    subId6: "N/A",
    pickChannel: "Bonus Products Link",
  },
];

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
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
