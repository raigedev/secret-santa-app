import "server-only";

import { readFileSync } from "fs";
import path from "path";
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

type LazadaFeedBudgetWindow = {
  maximum: number | null;
  minimum: number | null;
};

const lazadaFeedGlobal = globalThis as typeof globalThis & {
  __lazadaFeedProducts?: LazadaFeedProduct[];
};

function loadImportedLazadaFeedRows(): LazadaImportedFeedRow[] {
  const feedPath = path.join(
    process.cwd(),
    "lib",
    "affiliate",
    "lazada-feed-data.generated.json"
  );
  const fileContents = readFileSync(feedPath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(fileContents) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed as LazadaImportedFeedRow[];
}

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

const FEED_MATCH_PROFILES: Array<{
  id: string;
  include: string[];
  test: RegExp;
}> = [
  {
    id: "bag keyword match",
    include: ["bag", "tote", "backpack", "crossbody", "shoulder", "wallet"],
    test: /\b(tote|bag|backpack|crossbody|wallet|purse|handbag|luggage)\b/,
  },
  {
    id: "apparel keyword match",
    include: [
      "hoodie",
      "shirt",
      "tee",
      "jacket",
      "sweater",
      "dress",
      "sneaker",
      "shoe",
    ],
    test: /\b(hoodie|shirt|tee|jacket|sweater|dress|sneaker|shoe|clothing|fashion)\b/,
  },
  {
    id: "organizer keyword match",
    include: ["organizer", "stand", "bookshelf", "shelf", "holder"],
    test: /\b(organizer|book stand|desk organizer|bookshelf|shelf|stand|holder)\b/,
  },
  {
    id: "power keyword match",
    include: ["power bank", "charger", "battery", "charging"],
    test: /\b(power bank|charger|battery pack|battery|charging)\b/,
  },
  {
    id: "book keyword match",
    include: ["book", "novel", "manga", "comic", "journal", "planner"],
    test: /\b(book|novel|manga|comic|journal|planner)\b/,
  },
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

function getLazadaFeedProducts(): LazadaFeedProduct[] {
  if (!lazadaFeedGlobal.__lazadaFeedProducts) {
    lazadaFeedGlobal.__lazadaFeedProducts = loadImportedLazadaFeedRows().map(
      normalizeImportedFeedRow
    );
  }

  return lazadaFeedGlobal.__lazadaFeedProducts;
}

export function findLazadaFeedProductByUrl(url: string): LazadaFeedProduct | null {
  const normalizedUrl = normalizeLazadaProductPageUrl(url);

  if (!normalizedUrl) {
    return null;
  }

  return (
    getLazadaFeedProducts().find((product) => product.normalizedProductUrl === normalizedUrl) ||
    null
  );
}

export function findLazadaFeedProductByItemId(itemId: string): LazadaFeedProduct | null {
  const normalizedItemId = itemId.trim();

  if (!normalizedItemId) {
    return null;
  }

  return (
    getLazadaFeedProducts().find((product) => product.itemId === normalizedItemId) || null
  );
}

export function getLazadaFeedProductPrice(product: {
  discountedPrice: number | null;
  salePrice: number | null;
}): number | null {
  return product.discountedPrice ?? product.salePrice;
}

function buildLazadaFeedBudgetWindow(input: {
  preferredPriceMin?: number | null;
  preferredPriceMax?: number | null;
  groupBudget?: number | null;
}): LazadaFeedBudgetWindow {
  const preferredMin = input.preferredPriceMin ?? null;
  const preferredMax = input.preferredPriceMax ?? null;
  const groupBudget = input.groupBudget ?? null;
  const minimumCandidates = [preferredMin, groupBudget].filter(
    (value): value is number => value !== null
  );
  const minimum =
    minimumCandidates.length > 0 ? Math.max(...minimumCandidates) : null;

  let maximum = preferredMax;

  if (maximum === null && groupBudget !== null) {
    maximum = Math.max(groupBudget * 1.6, groupBudget + 500);
  }

  if (maximum !== null && minimum !== null && maximum < minimum) {
    maximum = minimum;
  }

  return {
    maximum,
    minimum,
  };
}

function filterLazadaFeedProductsByBudgetWindow(
  products: LazadaFeedProduct[],
  input: {
    preferredPriceMin?: number | null;
    preferredPriceMax?: number | null;
    groupBudget?: number | null;
  }
): LazadaFeedProduct[] {
  const budgetWindow = buildLazadaFeedBudgetWindow(input);

  if (budgetWindow.minimum === null && budgetWindow.maximum === null) {
    return products;
  }

  return products.filter((product) => {
    const productPrice = getLazadaFeedProductPrice(product);

    if (productPrice === null) {
      return false;
    }

    if (budgetWindow.minimum !== null && productPrice < budgetWindow.minimum) {
      return false;
    }

    if (budgetWindow.maximum !== null && productPrice > budgetWindow.maximum) {
      return false;
    }

    return true;
  });
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
  const productNormalized = normalizeFeedString(productText);
  const productTokens = new Set(tokenizeFeedText(productText));
  const itemNameNormalized = normalizeFeedString(input.itemName);
  const searchQueryNormalized = normalizeFeedString(input.searchQuery);
  const itemNoteNormalized = normalizeFeedString(input.itemNote);
  const categoryNormalized = normalizeFeedString(input.itemCategory);
  const itemNameTokens = Array.from(new Set(tokenizeFeedText(input.itemName)));
  const searchQueryTokens = Array.from(new Set(tokenizeFeedText(input.searchQuery)));
  const noteTokens = Array.from(new Set(tokenizeFeedText(input.itemNote)));
  const categoryTokens = Array.from(new Set(tokenizeFeedText(input.itemCategory)));
  const reasons: string[] = [];
  let score = 0;

  if (itemNameTokens.length > 0) {
    const overlappingItemTokens = itemNameTokens.filter((token) => productTokens.has(token));
    score += Math.min(overlappingItemTokens.length / itemNameTokens.length, 1) * 0.45;
  }

  if (searchQueryTokens.length > 0) {
    const overlappingSearchTokens = searchQueryTokens.filter((token) => productTokens.has(token));
    score += Math.min(overlappingSearchTokens.length / searchQueryTokens.length, 1) * 0.25;
  }

  if (noteTokens.length > 0) {
    const overlappingNoteTokens = noteTokens.filter((token) => productTokens.has(token));
    score += Math.min(overlappingNoteTokens.length / noteTokens.length, 1) * 0.08;
  }

  if (categoryTokens.length > 0) {
    const overlappingCategoryTokens = categoryTokens.filter((token) => productTokens.has(token));
    score += Math.min(overlappingCategoryTokens.length / categoryTokens.length, 1) * 0.05;
  }

  if (
    itemNameNormalized.length > 3 &&
    (productNormalized.includes(itemNameNormalized) ||
      itemNameNormalized.includes(productNormalized))
  ) {
    score += 0.18;
    reasons.push("item title overlap");
  }

  if (
    searchQueryNormalized.length > 4 &&
    searchQueryNormalized !== itemNameNormalized &&
    (productNormalized.includes(searchQueryNormalized) ||
      searchQueryNormalized.includes(productNormalized))
  ) {
    score += 0.12;
    reasons.push("search overlap");
  }

  const techSearch = /(tablet|ipad|android tab|galaxy tab|redmi pad|xiaomi pad)/.test(
    `${itemNameNormalized} ${searchQueryNormalized} ${itemNoteNormalized}`
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

  const profileHaystack = `${itemNameNormalized} ${searchQueryNormalized} ${itemNoteNormalized} ${categoryNormalized}`;

  for (const profile of FEED_MATCH_PROFILES) {
    if (!profile.test.test(profileHaystack)) {
      continue;
    }

    if (profile.include.some((term) => productNormalized.includes(term))) {
      score += 0.14;
      reasons.push(profile.id);
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
  const candidateProducts = filterLazadaFeedProductsByBudgetWindow(
    getLazadaFeedProducts(),
    input
  );

  return candidateProducts.map((product) =>
    scoreFeedMatch({
      ...input,
      product,
    })
  )
    .filter((match) => match.score >= minimumScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
