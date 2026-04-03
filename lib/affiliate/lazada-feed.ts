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
  sourceCategory: string;
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
  sourceCategory: string | null;
};

export type LazadaFeedMatch = {
  product: LazadaFeedProduct;
  score: number;
  reasons: string[];
};

export type LazadaFeedBudgetMode = "minimum-only" | "window";

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
  {
    id: "stationery keyword match",
    include: ["notebook", "pen", "marker", "stationery", "sketchbook", "planner", "journal"],
    test: /\b(stationery|notebook|pen|marker|sketchbook|art supplies|craft|gift card)\b/,
  },
  {
    id: "baby keyword match",
    include: ["baby", "newborn", "infant", "toddler", "feeding", "stroller", "diaper"],
    test: /\b(baby|newborn|infant|toddler|feeding|stroller|diaper|nursery)\b/,
  },
  {
    id: "pet keyword match",
    include: ["pet", "dog", "cat", "litter", "leash", "scratch", "bowl", "kennel"],
    test: /\b(pet|dog|cat|feline|canine|litter|leash|scratch|kennel|aquarium)\b/,
  },
  {
    id: "audio keyword match",
    include: ["audio", "earbuds", "headset", "speaker", "microphone", "soundbar"],
    test: /\b(audio|earbuds|headset|speaker|microphone|soundbar|headphones)\b/,
  },
  {
    id: "camera keyword match",
    include: ["camera", "drone", "tripod", "lens", "gimbal", "action cam"],
    test: /\b(camera|drone|tripod|lens|gimbal|action cam)\b/,
  },
  {
    id: "computer keyword match",
    include: ["keyboard", "mouse", "monitor", "ssd", "laptop", "printer", "router", "webcam"],
    test: /\b(keyboard|mouse|monitor|ssd|laptop|printer|router|webcam|storage|desktop)\b/,
  },
  {
    id: "appliance keyword match",
    include: ["fan", "blender", "vacuum", "rice cooker", "air fryer", "kettle", "appliance"],
    test: /\b(fan|blender|vacuum|rice cooker|air fryer|kettle|appliance|microwave)\b/,
  },
  {
    id: "automotive keyword match",
    include: ["car", "motorcycle", "helmet", "dash cam", "seat cover", "automotive"],
    test: /\b(car|motorcycle|helmet|dash cam|seat cover|automotive)\b/,
  },
  {
    id: "digital keyword match",
    include: ["voucher", "gift card", "subscription", "top up", "load", "software", "license"],
    test: /\b(voucher|gift card|subscription|top up|topup|load|software|license|digital)\b/,
  },
];

const SOURCE_CATEGORY_PROFILES: Array<{
  categories: string[];
  id: string;
  test: RegExp;
}> = [
  {
    id: "bag source category",
    categories: ["Bags and Travel", "Fashion Accessories"],
    test: /\b(tote|bag|backpack|crossbody|wallet|purse|handbag|luggage)\b/,
  },
  {
    id: "fashion source category",
    categories: [
      "Kid's Fashion",
      "Lingerie, Sleep, Lounge and Thermal Wear",
      "Men's Clothing",
      "Men's Shoes",
      "Sports, Shoes and Clothing",
      "Women's Clothing",
      "Women's Shoes",
    ],
    test: /\b(hoodie|shirt|tee|jacket|sweater|dress|sneaker|shoe|clothing|fashion)\b/,
  },
  {
    id: "book source category",
    categories: ["Media, Music and Books", "Stationery, Craft and Gift Cards"],
    test: /\b(book|novel|manga|comic|journal|planner|stationery|craft|gift card)\b/,
  },
  {
    id: "digital source category",
    categories: [
      "Digital Goods",
      "Digital Utilities",
      "Services",
      "Special Digital Products",
      "Stationery, Craft and Gift Cards",
    ],
    test: /\b(voucher|gift card|subscription|top up|topup|load|software|license|digital|service)\b/,
  },
  {
    id: "tech source category",
    categories: [
      "Audio",
      "Cameras and Drones",
      "Computers and Components",
      "Data Storage",
      "Electronic Parts and Accessories",
      "Mobile accessories",
      "Mobiles and Tablets",
      "Printers and Scanners",
      "Smart Devices",
      "Televisions and Videos",
    ],
    test: /\b(tablet|ipad|galaxy tab|redmi pad|power bank|charger|battery|phone|mobile|gadget|headset|earbuds|keyboard|monitor|printer|camera|drone|smart)\b/,
  },
  {
    id: "appliance source category",
    categories: ["Home Appliances", "Kitchenware and Tableware", "House Hold Supplies"],
    test: /\b(fan|blender|vacuum|rice cooker|air fryer|kettle|appliance|microwave)\b/,
  },
  {
    id: "beauty source category",
    categories: ["Beauty", "Beauty, Skincare & Wellness", "Health"],
    test: /\b(beauty|makeup|skincare|perfume|wellness|self care|cosmetic)\b/,
  },
  {
    id: "home source category",
    categories: [
      "Bedding and Bath",
      "Furniture and Organization",
      "Home Appliances",
      "House Hold Supplies",
      "Kitchenware and Tableware",
      "Laundry And Cleaning Equipments",
      "Lighting and Decor",
      "Outdoor and Garden",
    ],
    test: /\b(home|decor|kitchen|cookware|bedding|blanket|pillow|lamp|organizer|mug|candle|laundry|garden|appliance)\b/,
  },
  {
    id: "tool source category",
    categories: ["Tools and Home Improvements", "Automotive"],
    test: /\b(tool|hardware|diy|drill|wrench|screwdriver|hammer|repair|improvement|automotive)\b/,
  },
  {
    id: "food source category",
    categories: ["Groceries"],
    test: /\b(food|snack|coffee|tea|treat|chocolate|pastry|cake|cookie|hamper|bakery|pasalubong|grocery)\b/,
  },
  {
    id: "game source category",
    categories: ["Gaming Devices and Software", "Toys and Games"],
    test: /\b(game|gaming|console|board game|toy|lego|card game)\b/,
  },
  {
    id: "collectible source category",
    categories: ["Toys and Games"],
    test: /\b(collectible|figure|anime|merch|funko|plush|trading card|model kit|hobby)\b/,
  },
  {
    id: "baby source category",
    categories: ["Mother And Baby"],
    test: /\b(baby|newborn|infant|toddler|stroller|feeding)\b/,
  },
  {
    id: "pet source category",
    categories: ["Pet Supplies"],
    test: /\b(pet|dog|cat|feline|canine|vet|veterinary|litter)\b/,
  },
];

const BAG_SUBTYPE_RULES: Array<{
  exclude: string[];
  id: string;
  include: string[];
  test: RegExp;
}> = [
  {
    id: "tote",
    include: ["tote"],
    exclude: ["backpack", "wallet", "crossbody", "pouch", "plush"],
    test: /\btote\b/,
  },
  {
    id: "backpack",
    include: ["backpack", "rucksack"],
    exclude: ["tote", "wallet", "crossbody", "handbag", "pouch"],
    test: /\b(backpack|rucksack)\b/,
  },
  {
    id: "wallet",
    include: ["wallet", "card holder", "cardholder"],
    exclude: ["tote", "backpack", "crossbody", "handbag", "luggage"],
    test: /\b(wallet|card holder|cardholder)\b/,
  },
  {
    id: "crossbody",
    include: ["crossbody", "shoulder bag", "sling"],
    exclude: ["tote", "backpack", "wallet", "luggage"],
    test: /\b(crossbody|shoulder bag|sling)\b/,
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
    sourceCategory: row.sourceCategory?.trim() || null,
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
}, budgetMode: LazadaFeedBudgetMode = "window"): LazadaFeedBudgetWindow {
  const preferredMin = input.preferredPriceMin ?? null;
  const preferredMax = input.preferredPriceMax ?? null;
  const groupBudget = input.groupBudget ?? null;
  const minimumCandidates = [preferredMin, groupBudget].filter(
    (value): value is number => value !== null
  );
  const minimum =
    minimumCandidates.length > 0 ? Math.max(...minimumCandidates) : null;

  let maximum = preferredMax;

  if (budgetMode === "window" && maximum === null && groupBudget !== null) {
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
  },
  budgetMode: LazadaFeedBudgetMode = "window"
): LazadaFeedProduct[] {
  const budgetWindow = buildLazadaFeedBudgetWindow(input, budgetMode);

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

function filterLazadaFeedProductsBySubtype(
  products: LazadaFeedProduct[],
  input: {
    itemCategory: string;
    itemName: string;
    itemNote: string;
    searchQuery: string;
  },
  options?: {
    allowFallbackToOriginal?: boolean;
  }
): LazadaFeedProduct[] {
  const searchContext = normalizeFeedString(
    `${input.itemName} ${input.itemCategory} ${input.itemNote} ${input.searchQuery}`
  );
  const matchedRule = BAG_SUBTYPE_RULES.find((rule) => rule.test.test(searchContext));

  if (!matchedRule) {
    return products;
  }

  const subtypeMatches = products.filter((product) => {
    const productText = normalizeFeedString(
      `${product.productName} ${product.brand} ${product.categoryLv1}`
    );
    const hasInclude = matchedRule.include.some((term) => productText.includes(term));
    const hasExclude = matchedRule.exclude.some((term) => productText.includes(term));

    return hasInclude && !hasExclude;
  });

  return subtypeMatches.length > 0
    ? subtypeMatches
    : options?.allowFallbackToOriginal
      ? products
      : [];
}

function getRelevantLazadaSourceCategories(input: {
  itemCategory: string;
  itemName: string;
  itemNote: string;
  searchQuery: string;
}): string[] {
  const searchContext = normalizeFeedString(
    `${input.itemName} ${input.itemCategory} ${input.itemNote} ${input.searchQuery}`
  );
  const categories = new Set<string>();

  for (const profile of SOURCE_CATEGORY_PROFILES) {
    if (!profile.test.test(searchContext)) {
      continue;
    }

    for (const category of profile.categories) {
      categories.add(category);
    }
  }

  return Array.from(categories);
}

function filterLazadaFeedProductsBySourceCategory(
  products: LazadaFeedProduct[],
  input: {
    itemCategory: string;
    itemName: string;
    itemNote: string;
    searchQuery: string;
  }
): LazadaFeedProduct[] {
  const relevantCategories = getRelevantLazadaSourceCategories(input);

  if (relevantCategories.length === 0) {
    return products;
  }

  const categoryMatches = products.filter((product) =>
    product.sourceCategory ? relevantCategories.includes(product.sourceCategory) : false
  );

  return categoryMatches.length > 0 ? categoryMatches : products;
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
  const relevantSourceCategories = getRelevantLazadaSourceCategories(input);
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

  if (
    input.product.sourceCategory &&
    relevantSourceCategories.includes(input.product.sourceCategory)
  ) {
    score += 0.16;
    reasons.push("source category match");
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
  budgetMode?: LazadaFeedBudgetMode;
  preferredPriceMin?: number | null;
  preferredPriceMax?: number | null;
  groupBudget?: number | null;
  limit?: number;
  minimumScore?: number;
}): LazadaFeedMatch[] {
  const budgetMode = input.budgetMode ?? "window";
  const minimumScore = input.minimumScore ?? 0.72;
  const limit = input.limit ?? 3;
  const budgetShortlistedProducts = filterLazadaFeedProductsByBudgetWindow(
    getLazadaFeedProducts(),
    input,
    budgetMode
  );
  const sourceShortlistedProducts = filterLazadaFeedProductsBySourceCategory(
    budgetShortlistedProducts,
    input
  );
  const candidateProducts = filterLazadaFeedProductsBySubtype(
    sourceShortlistedProducts,
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
