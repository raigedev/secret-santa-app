import {
  buildLazadaSearchFallbackCards,
  getLazadaBudgetFitLabel,
  getLazadaSuggestionPriceLabel,
} from "@/lib/affiliate/lazada-recommendations";
import { getLazadaStarterProducts } from "@/lib/affiliate/lazada-catalog";
import { slugifyAsciiIdentifier } from "@/lib/validation/common";

export type SuggestionMerchant =
  | "amazon"
  | "argos"
  | "best-buy"
  | "ebay"
  | "google-shopping"
  | "jb-hi-fi"
  | "john-lewis"
  | "kmart"
  | "lazada"
  | "rakuten"
  | "shopee"
  | "target"
  | "walmart";

export type ShoppingRegion = "AU" | "CA" | "GLOBAL" | "JP" | "PH" | "UK" | "US";

export type ShoppingRegionOption = {
  value: ShoppingRegion;
  label: string;
  helper: string;
};

export type WishlistSuggestionOption = {
  id: string;
  title: string;
  subtitle: string;
  searchQuery: string;
  fitLabel: string;
  priceLabel: string | null;
  disclosure: string;
  source: "ai" | "base";
};

export type WishlistMerchantLink = {
  id: string;
  merchant: SuggestionMerchant;
  merchantLabel: string;
  href: string;
  isAffiliateReady: boolean;
  fitLabel: string;
  priceLabel: string | null;
  title: string;
  subtitle: string;
};

export type WishlistFeaturedProductCard = {
  id: string;
  merchant: "lazada";
  merchantLabel: string;
  catalogSource: "catalog-product" | "search-backed";
  imageUrl: string | null;
  productId: string | null;
  skuId: string | null;
  title: string;
  subtitle: string;
  href: string;
  searchQuery: string;
  priceLabel: string | null;
  fitLabel: string;
  whyItFits: string;
  trackingLabel: string;
  recommendationLabel?: string;
  recommendationCaption?: string;
  recommendationTone?: "berry" | "forest" | "gold" | "ink";
};

type SuggestionTemplate = {
  title: string;
  subtitle: string;
  searchQuery: string;
  typicalMin: number | null;
  typicalMax: number | null;
};

export type SuggestionInput = {
  groupId: string;
  wishlistItemId: string;
  itemName: string;
  itemCategory: string;
  itemNote: string;
  preferredPriceMin: number | null;
  preferredPriceMax: number | null;
  groupBudget: number | null;
  currency: string | null;
};

export type AiWishlistSuggestionDraft = {
  title: string;
  subtitle: string;
  searchQuery: string;
};

const MERCHANT_LABELS: Record<SuggestionMerchant, string> = {
  amazon: "Amazon",
  argos: "Argos",
  "best-buy": "Best Buy",
  ebay: "eBay",
  "google-shopping": "Google Shopping",
  "jb-hi-fi": "JB Hi-Fi",
  "john-lewis": "John Lewis",
  kmart: "Kmart",
  lazada: "Lazada",
  rakuten: "Rakuten",
  shopee: "Shopee",
  target: "Target",
  walmart: "Walmart",
};

const AFFILIATE_DISCLOSURE = "Partner link";

export const AFFILIATE_READY_MERCHANTS: SuggestionMerchant[] = [
  "amazon",
  "lazada",
  "shopee",
];

export const SHOPPING_REGION_OPTIONS: ShoppingRegionOption[] = [
  {
    value: "PH",
    label: "Philippines",
    helper: "Shop with stores available in this region.",
  },
  {
    value: "US",
    label: "United States",
    helper: "Use large US retailers and marketplaces.",
  },
  {
    value: "UK",
    label: "United Kingdom",
    helper: "Use UK retailers and marketplace options.",
  },
  {
    value: "CA",
    label: "Canada",
    helper: "Use Canada-friendly stores and searches.",
  },
  {
    value: "AU",
    label: "Australia",
    helper: "Use Australia-friendly stores and searches.",
  },
  {
    value: "JP",
    label: "Japan",
    helper: "Use Japan-friendly stores and marketplaces.",
  },
  {
    value: "GLOBAL",
    label: "Global",
    helper: "Use broader marketplaces when the region is mixed.",
  },
];

const REGION_MERCHANTS: Record<ShoppingRegion, SuggestionMerchant[]> = {
  PH: ["lazada", "shopee", "amazon"],
  US: ["amazon", "walmart", "target"],
  UK: ["amazon", "argos", "john-lewis"],
  CA: ["amazon", "walmart", "best-buy"],
  AU: ["amazon", "kmart", "jb-hi-fi"],
  JP: ["amazon", "rakuten", "ebay"],
  GLOBAL: ["amazon", "ebay", "google-shopping"],
};

const CATEGORY_TEMPLATES: Record<string, SuggestionTemplate[]> = {
  Books: [
    {
      title: "Bestselling books",
      subtitle: "Easy giftable reads for most tastes.",
      searchQuery: "bestselling books",
      typicalMin: 350,
      typicalMax: 900,
    },
    {
      title: "Self-help books",
      subtitle: "Good fit when they want practical or inspiring reads.",
      searchQuery: "self-help books",
      typicalMin: 300,
      typicalMax: 850,
    },
  ],
  Tech: [
    {
      title: "Budget tech gifts",
      subtitle: "Browse practical gadgets and everyday accessories.",
      searchQuery: "budget tech gifts",
      typicalMin: 500,
      typicalMax: 2500,
    },
    {
      title: "Popular device accessories",
      subtitle: "Helpful if the exact device is still flexible.",
      searchQuery: "popular tech accessories",
      typicalMin: 300,
      typicalMax: 1800,
    },
  ],
  Fashion: [
    {
      title: "Everyday clothing gifts",
      subtitle: "Browse safe apparel picks for gifting.",
      searchQuery: "casual clothing gifts",
      typicalMin: 350,
      typicalMax: 1800,
    },
    {
      title: "Cozy hoodie and sweater picks",
      subtitle: "Useful when the wishlist item is broad.",
      searchQuery: "hoodie sweater gifts",
      typicalMin: 500,
      typicalMax: 2000,
    },
  ],
  Beauty: [
    {
      title: "Beauty gift sets",
      subtitle: "Browse gift-ready skincare or makeup bundles.",
      searchQuery: "beauty gift set",
      typicalMin: 400,
      typicalMax: 1800,
    },
    {
      title: "Self-care essentials",
      subtitle: "A good option if the brand preference is unclear.",
      searchQuery: "self care gift set",
      typicalMin: 300,
      typicalMax: 1400,
    },
  ],
  Food: [
    {
      title: "Snack boxes and treats",
      subtitle: "A safe option when they want something consumable.",
      searchQuery: "gift snack box",
      typicalMin: 250,
      typicalMax: 1200,
    },
    {
      title: "Coffee and tea gift picks",
      subtitle: "Helpful when you need something easy to share.",
      searchQuery: "coffee tea gift set",
      typicalMin: 300,
      typicalMax: 1000,
    },
  ],
  Games: [
    {
      title: "Board games and party games",
      subtitle: "Good for social or family-friendly gifts.",
      searchQuery: "board game gift",
      typicalMin: 500,
      typicalMax: 2000,
    },
    {
      title: "Gaming accessories",
      subtitle: "Useful if the exact game platform is unknown.",
      searchQuery: "gaming accessories gift",
      typicalMin: 400,
      typicalMax: 2500,
    },
  ],
  Home: [
    {
      title: "Home essentials",
      subtitle: "Practical gifts for desks, rooms, and kitchens.",
      searchQuery: "home essentials gift",
      typicalMin: 300,
      typicalMax: 1800,
    },
    {
      title: "Cozy home decor",
      subtitle: "Helps when the wishlist is about ambiance or comfort.",
      searchQuery: "cozy home decor gift",
      typicalMin: 350,
      typicalMax: 1500,
    },
  ],
  Collectibles: [
    {
      title: "Collectible display pieces",
      subtitle: "Browse fandom and hobby-friendly gift ideas.",
      searchQuery: "collectible figure gift",
      typicalMin: 500,
      typicalMax: 3000,
    },
    {
      title: "Limited or hobby-themed finds",
      subtitle: "Useful when the recipient likes niche merch.",
      searchQuery: "hobby collectible gift",
      typicalMin: 350,
      typicalMax: 2500,
    },
  ],
  Experience: [
    {
      title: "Experience gift ideas",
      subtitle: "Helpful for vouchers, classes, and activity-style gifts.",
      searchQuery: "experience gift voucher",
      typicalMin: 500,
      typicalMax: 3000,
    },
    {
      title: "Treat-yourself bundles",
      subtitle: "A good option when the experience format is flexible.",
      searchQuery: "spa cafe gift voucher",
      typicalMin: 400,
      typicalMax: 2500,
    },
  ],
  Other: [
    {
      title: "Gift ideas close to this wishlist item",
      subtitle: "Use the exact wishlist item as the starting search.",
      searchQuery: "",
      typicalMin: null,
      typicalMax: null,
    },
  ],
};

function slugify(value: string): string {
  return slugifyAsciiIdentifier(value);
}

function normalizeSuggestionQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function createSuggestionOption(
  input: SuggestionInput,
  template: SuggestionTemplate,
  source: "ai" | "base",
  idPrefix = ""
): WishlistSuggestionOption {
  return {
    id: slugify(`${idPrefix}${template.searchQuery}`),
    title: template.title,
    subtitle: template.subtitle,
    searchQuery: template.searchQuery,
    fitLabel: getLazadaBudgetFitLabel(
      template,
      input.preferredPriceMin,
      input.preferredPriceMax,
      input.groupBudget
    ),
    priceLabel: getLazadaSuggestionPriceLabel(
      template,
      input.preferredPriceMin,
      input.preferredPriceMax,
      input.groupBudget,
      input.currency
    ),
    disclosure:
      source === "ai"
        ? "Suggested shopping option - partner link"
        : AFFILIATE_DISCLOSURE,
    source,
  };
}

function getMerchantSearchUrl(
  merchant: SuggestionMerchant,
  query: string,
  region: ShoppingRegion = "GLOBAL"
): string {
  const encodedQuery = encodeURIComponent(query);
  const slugQuery = query.trim().replace(/\s+/g, "-");

  switch (merchant) {
    case "amazon":
      switch (region) {
        case "UK":
          return `https://www.amazon.co.uk/s?k=${encodedQuery}`;
        case "CA":
          return `https://www.amazon.ca/s?k=${encodedQuery}`;
        case "AU":
          return `https://www.amazon.com.au/s?k=${encodedQuery}`;
        case "JP":
          return `https://www.amazon.co.jp/s?k=${encodedQuery}`;
        default:
          return `https://www.amazon.com/s?k=${encodedQuery}`;
      }
    case "argos":
      return `https://www.argos.co.uk/search/${encodeURIComponent(slugQuery)}/`;
    case "best-buy":
      return `https://www.bestbuy.ca/en-ca/search?search=${encodedQuery}`;
    case "ebay":
      return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}`;
    case "google-shopping":
      return `https://www.google.com/search?tbm=shop&q=${encodedQuery}`;
    case "jb-hi-fi":
      return `https://www.jbhifi.com.au/search?query=${encodedQuery}`;
    case "john-lewis":
      return `https://www.johnlewis.com/search?search-term=${encodedQuery}`;
    case "kmart":
      return `https://www.kmart.com.au/search/?searchTerm=${encodedQuery}`;
    case "lazada":
      return `https://www.lazada.com.ph/catalog/?q=${encodedQuery}`;
    case "rakuten":
      return `https://search.rakuten.co.jp/search/mall/${encodedQuery}/`;
    case "shopee":
      return `https://shopee.ph/search?keyword=${encodedQuery}`;
    case "target":
      return `https://www.target.com/s?searchTerm=${encodedQuery}`;
    case "walmart":
      return region === "CA"
        ? `https://www.walmart.ca/search?q=${encodedQuery}`
        : `https://www.walmart.com/search?q=${encodedQuery}`;
    default:
      return `https://www.google.com/search?q=${encodedQuery}`;
  }
}

export function buildTrackedSuggestionHref(
  merchant: SuggestionMerchant,
  groupId: string,
  wishlistItemId: string,
  searchQuery: string,
  title: string,
  region: ShoppingRegion,
  options?: {
    catalogSource?: string | null;
    fitLabel?: string | null;
    groupBudget?: number | null;
    itemCategory?: string | null;
    itemName?: string | null;
    itemNote?: string | null;
    productId?: string | null;
    preferredPriceMax?: number | null;
    preferredPriceMin?: number | null;
    selectedQuery?: string | null;
    skuId?: string | null;
    trackingLabel?: string | null;
  }
): string {
  const params = new URLSearchParams({
    merchant,
    groupId,
    itemId: wishlistItemId,
    q: searchQuery,
    title,
    region,
  });

  if (options?.productId) {
    params.set("productId", options.productId);
  }

  if (options?.skuId) {
    params.set("skuId", options.skuId);
  }

  if (options?.catalogSource) {
    params.set("catalogSource", options.catalogSource);
  }

  if (options?.fitLabel) {
    params.set("fitLabel", options.fitLabel);
  }

  if (options?.trackingLabel) {
    params.set("trackingLabel", options.trackingLabel);
  }

  if (options?.selectedQuery) {
    params.set("selectedQuery", options.selectedQuery);
  }

  if (options?.itemName) {
    params.set("itemName", options.itemName);
  }

  if (options?.itemCategory) {
    params.set("itemCategory", options.itemCategory);
  }

  if (options?.itemNote) {
    params.set("itemNote", options.itemNote);
  }

  if (options?.preferredPriceMin !== null && options?.preferredPriceMin !== undefined) {
    params.set("preferredPriceMin", String(options.preferredPriceMin));
  }

  if (options?.preferredPriceMax !== null && options?.preferredPriceMax !== undefined) {
    params.set("preferredPriceMax", String(options.preferredPriceMax));
  }

  if (options?.groupBudget !== null && options?.groupBudget !== undefined) {
    params.set("groupBudget", String(options.groupBudget));
  }

  return `/go/suggestion?${params.toString()}`;
}

function getKeywordTemplates(itemName: string, itemNote: string): SuggestionTemplate[] {
  const haystack = `${itemName} ${itemNote}`.toLowerCase();

  if (/(stationery|notebook|pen|marker|sketchbook|art supplies|craft|gift card)/.test(haystack)) {
    return [
      {
        title: "Stationery gift picks",
        subtitle: "A tidy option for practical desk, school, or craft gifts.",
        searchQuery: "stationery gift set",
        typicalMin: 250,
        typicalMax: 1000,
      },
      {
        title: "Planner and notebook picks",
        subtitle: "Useful when the wishlist leans toward writing or organization.",
        searchQuery: "planner notebook set",
        typicalMin: 300,
        typicalMax: 1200,
      },
    ];
  }

  if (/(book|novel|manga|comic|journal)/.test(haystack)) {
    return [
      {
        title: "Fiction favorites",
        subtitle: "A good option when the exact item is flexible.",
        searchQuery: "fiction books gift",
        typicalMin: 350,
        typicalMax: 850,
      },
      {
        title: "Giftable journals and books",
        subtitle: "Useful when they mentioned books broadly.",
        searchQuery: "giftable journal and book set",
        typicalMin: 250,
        typicalMax: 900,
      },
    ];
  }

  if (/(earbuds|headset|headphones|speaker|microphone|audio|soundbar)/.test(haystack)) {
    return [
      {
        title: "Audio accessory picks",
        subtitle: "A practical option when the giftee wants music or listening gear.",
        searchQuery: "audio accessories gift",
        typicalMin: 500,
        typicalMax: 2200,
      },
      {
        title: "Portable speaker and earbuds",
        subtitle: "Useful when the exact audio device is still flexible.",
        searchQuery: "portable speaker earbuds",
        typicalMin: 700,
        typicalMax: 2500,
      },
    ];
  }

  if (/(camera|drone|tripod|lens|gimbal|action cam)/.test(haystack)) {
    return [
      {
        title: "Camera accessory picks",
        subtitle: "A safer photography option when the full device is too open.",
        searchQuery: "camera accessory gift",
        typicalMin: 600,
        typicalMax: 2200,
      },
      {
        title: "Tripods and content gear",
        subtitle: "Good for creators when the exact camera body is unknown.",
        searchQuery: "tripod content creator gear",
        typicalMin: 500,
        typicalMax: 1800,
      },
    ];
  }

  if (/(keyboard|mouse|monitor|ssd|laptop|printer|router|webcam|storage|desktop|computer)/.test(haystack)) {
    return [
      {
        title: "Computer accessory picks",
        subtitle: "A broad option for work, gaming, or desk setup upgrades.",
        searchQuery: "computer accessories gift",
        typicalMin: 600,
        typicalMax: 2500,
      },
      {
        title: "Desk setup tech",
        subtitle: "Useful when the giftee likes practical computer upgrades.",
        searchQuery: "desk setup tech gift",
        typicalMin: 800,
        typicalMax: 3000,
      },
    ];
  }

  if (/(tablet|ipad|android tab|\btab\b|galaxy tab|redmi pad|xiaomi pad|mi pad|matepad|lenovo tab)/.test(haystack)) {
    return [
      {
        title: "Budget tablets",
        subtitle: "Entry-level picks for schoolwork, videos, and everyday browsing.",
        searchQuery: "budget tablet",
        typicalMin: 4000,
        typicalMax: 12000,
      },
      {
        title: "Study and reading tablets",
        subtitle: "Good for note-taking, e-books, and lighter productivity use.",
        searchQuery: "tablet for study and reading",
        typicalMin: 5000,
        typicalMax: 15000,
      },
      {
        title: "Tablet bundles and accessories",
        subtitle: "Helpful if the full device is too much and you want a useful add-on instead.",
        searchQuery: "tablet accessories bundle",
        typicalMin: 500,
        typicalMax: 2500,
      },
    ];
  }

  if (/(baby|newborn|infant|toddler|feeding|stroller|diaper|nursery)/.test(haystack)) {
    return [
      {
        title: "Baby essentials",
        subtitle: "A practical starting point for baby or parent-friendly gifts.",
        searchQuery: "baby essentials gift",
        typicalMin: 500,
        typicalMax: 1800,
      },
      {
        title: "Nursery and feeding picks",
        subtitle: "Useful when the gift should feel practical and everyday.",
        searchQuery: "baby nursery feeding essentials",
        typicalMin: 600,
        typicalMax: 2200,
      },
    ];
  }

  if (/(pet|dog|cat|feline|canine|litter|leash|scratch|kennel|aquarium)/.test(haystack)) {
    return [
      {
        title: "Pet gift picks",
        subtitle: "A broad option for useful or fun pet-related gifts.",
        searchQuery: "pet gift essentials",
        typicalMin: 350,
        typicalMax: 1400,
      },
      {
        title: "Pet toys and essentials",
        subtitle: "Helpful when the exact pet need is still open.",
        searchQuery: "pet toys essentials",
        typicalMin: 300,
        typicalMax: 1200,
      },
    ];
  }

  if (/(shirt|hoodie|dress|clothes|clothing|jacket|shoes)/.test(haystack)) {
    return [
      {
        title: "Giftable clothing picks",
        subtitle: "A broader fashion search when the item is flexible.",
        searchQuery: "giftable clothes",
        typicalMin: 350,
        typicalMax: 1800,
      },
      {
        title: "Cozy everyday wear",
        subtitle: "Useful for sweaters, hoodies, and casual basics.",
        searchQuery: "cozy casual wear gift",
        typicalMin: 400,
        typicalMax: 1600,
      },
    ];
  }

  if (/(fan|blender|vacuum|rice cooker|air fryer|kettle|appliance|microwave)/.test(haystack)) {
    return [
      {
        title: "Useful home appliances",
        subtitle: "A practical option for kitchen or home upgrades.",
        searchQuery: "useful home appliance",
        typicalMin: 900,
        typicalMax: 3500,
      },
      {
        title: "Kitchen appliance upgrades",
        subtitle: "Good when the gift should feel more substantial.",
        searchQuery: "kitchen appliance upgrade",
        typicalMin: 1500,
        typicalMax: 5000,
      },
    ];
  }

  if (/(car|motorcycle|helmet|dash cam|seat cover|automotive)/.test(haystack)) {
    return [
      {
        title: "Car accessory picks",
        subtitle: "A broad option for useful automotive gifts.",
        searchQuery: "car accessories gift",
        typicalMin: 500,
        typicalMax: 1800,
      },
      {
        title: "Dash cam and ride upgrades",
        subtitle: "Helpful when the gift can stretch a bit higher.",
        searchQuery: "dash cam ride upgrade",
        typicalMin: 1500,
        typicalMax: 4500,
      },
    ];
  }

  if (/(voucher|gift card|subscription|top up|topup|load|software|license|digital|service)/.test(haystack)) {
    return [
      {
        title: "Digital gift picks",
        subtitle: "A flexible option for vouchers, subscriptions, and credits.",
        searchQuery: "digital gift voucher",
        typicalMin: 300,
        typicalMax: 1800,
      },
      {
        title: "Software and subscription ideas",
        subtitle: "Useful when the gift should feel practical or instantly usable.",
        searchQuery: "software subscription gift",
        typicalMin: 500,
        typicalMax: 2500,
      },
    ];
  }

  return [];
}

function dedupeTemplates(templates: SuggestionTemplate[]): SuggestionTemplate[] {
  const seenQueries = new Set<string>();

  return templates.filter((template) => {
    const key = template.searchQuery.toLowerCase();

    if (seenQueries.has(key)) {
      return false;
    }

    seenQueries.add(key);
    return true;
  });
}

function buildStarterSuggestionTemplates(input: SuggestionInput): SuggestionTemplate[] {
  return getLazadaStarterProducts({
    itemName: input.itemName,
    itemCategory: input.itemCategory,
    itemNote: input.itemNote,
    searchQuery: input.itemName.trim(),
    preferredPriceMin: input.preferredPriceMin,
    preferredPriceMax: input.preferredPriceMax,
    groupBudget: input.groupBudget,
  }).map((product) => ({
    title: product.title,
    subtitle: product.subtitle,
    searchQuery: product.searchQuery,
    typicalMin: product.typicalMin,
    typicalMax: product.typicalMax,
  }));
}

export function buildWishlistSuggestionOptions(
  input: SuggestionInput
): WishlistSuggestionOption[] {
  const baseQuery = input.itemName.trim();
  const categoryTemplates = CATEGORY_TEMPLATES[input.itemCategory] || CATEGORY_TEMPLATES.Other;
  const keywordTemplates = getKeywordTemplates(input.itemName, input.itemNote);
  const starterTemplates = buildStarterSuggestionTemplates(input);

  const templates = dedupeTemplates(
    [
      {
        title: input.itemName.trim(),
        subtitle: input.itemNote.trim()
          ? `Start with the recipient's exact wording: ${input.itemNote.trim()}`
          : "Start with the exact wishlist item first.",
        searchQuery: baseQuery,
        typicalMin: null,
        typicalMax: null,
      },
      ...keywordTemplates,
      ...starterTemplates,
      ...categoryTemplates,
    ].filter((template) => template.searchQuery.trim().length > 0)
  ).slice(0, 4);

  return templates.map((template) => createSuggestionOption(input, template, "base"));
}

export function buildAiWishlistSuggestionOptions(
  input: SuggestionInput,
  drafts: AiWishlistSuggestionDraft[]
): WishlistSuggestionOption[] {
  return dedupeTemplates(
    drafts
      .map((draft) => ({
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        searchQuery: draft.searchQuery.trim(),
        typicalMin: null,
        typicalMax: null,
      }))
      .filter(
        (draft) =>
          draft.title.length > 0 &&
          draft.subtitle.length > 0 &&
          draft.searchQuery.length > 0
      )
  )
    .slice(0, 3)
    .map((template) => createSuggestionOption(input, template, "ai", "ai-"));
}

export function mergeWishlistSuggestionOptions(
  baseOptions: WishlistSuggestionOption[],
  aiOptions: WishlistSuggestionOption[],
  selectedSuggestionId = ""
): WishlistSuggestionOption[] {
  const exactBaseOption = baseOptions[0] || null;
  const selectedOption =
    [...baseOptions, ...aiOptions].find((option) => option.id === selectedSuggestionId) || null;
  const orderedOptions = [
    exactBaseOption,
    ...aiOptions,
    ...baseOptions.filter((option) => option.id !== exactBaseOption?.id),
  ].filter((option): option is WishlistSuggestionOption => Boolean(option));
  const seenQueries = new Set<string>();
  const seenIds = new Set<string>();
  const uniqueOptions = orderedOptions.filter((option) => {
    const normalizedQuery = normalizeSuggestionQuery(option.searchQuery);

    if (seenIds.has(option.id) || seenQueries.has(normalizedQuery)) {
      return false;
    }

    seenIds.add(option.id);
    seenQueries.add(normalizedQuery);
    return true;
  });
  const visibleOptions = uniqueOptions.slice(0, 4);

  if (!selectedOption || visibleOptions.some((option) => option.id === selectedOption.id)) {
    return visibleOptions;
  }

  return [...visibleOptions.slice(0, 3), selectedOption];
}

export function buildWishlistMerchantLinks(
  option: WishlistSuggestionOption,
  groupId: string,
  wishlistItemId: string,
  region: ShoppingRegion
): WishlistMerchantLink[] {
  return REGION_MERCHANTS[region].map((merchant) => {
    const isAffiliateReady = AFFILIATE_READY_MERCHANTS.includes(merchant);

    return {
      id: `${merchant}-${option.id}`,
      merchant,
      merchantLabel: MERCHANT_LABELS[merchant],
      title: option.title,
      subtitle: option.subtitle,
      href: isAffiliateReady
        ? buildTrackedSuggestionHref(
            merchant,
            groupId,
            wishlistItemId,
            option.searchQuery,
            option.title,
            region,
            {
              fitLabel: option.fitLabel,
              selectedQuery: option.searchQuery,
            }
          )
        : getMerchantSearchUrl(merchant, option.searchQuery, region),
      isAffiliateReady,
      fitLabel: option.fitLabel,
      priceLabel: option.priceLabel,
    };
  });
}

export function buildWishlistFeaturedLazadaProducts(input: {
  option: WishlistSuggestionOption;
  groupId: string;
  wishlistItemId: string;
  itemName: string;
  itemCategory: string;
  itemNote: string;
  preferredPriceMin: number | null;
  preferredPriceMax: number | null;
  groupBudget: number | null;
  currency: string | null;
  region: ShoppingRegion;
}): WishlistFeaturedProductCard[] {
  if (input.region !== "PH" && input.region !== "GLOBAL") {
    return [];
  }

  return buildLazadaSearchFallbackCards({
    currency: input.currency,
    groupBudget: input.groupBudget,
    groupId: input.groupId,
    itemCategory: input.itemCategory,
    itemName: input.itemName,
    itemNote: input.itemNote,
    limit: 3,
    preferredPriceMax: input.preferredPriceMax,
    preferredPriceMin: input.preferredPriceMin,
    region: input.region,
    searchQuery: input.option.searchQuery,
    wishlistItemId: input.wishlistItemId,
    buildHref: ({ fitLabel, product, trackingLabel }) =>
      buildTrackedSuggestionHref(
        "lazada",
        input.groupId,
        input.wishlistItemId,
        product.searchQuery,
        product.title,
        input.region,
        {
          catalogSource: product.source,
          fitLabel,
          groupBudget: input.groupBudget,
          itemCategory: input.itemCategory,
          itemName: input.itemName,
          itemNote: input.itemNote,
          productId: product.productId,
          preferredPriceMax: input.preferredPriceMax,
          preferredPriceMin: input.preferredPriceMin,
          selectedQuery: input.option.searchQuery,
          skuId: product.skuId,
          trackingLabel,
        }
      ),
  });
}

export function buildMerchantDestinationUrl(
  merchant: SuggestionMerchant,
  searchQuery: string,
  region: ShoppingRegion = "GLOBAL"
): string {
  const fallbackUrl = getMerchantSearchUrl(merchant, searchQuery, region);
  const template =
    merchant === "amazon"
      ? process.env.AMAZON_AFFILIATE_SEARCH_TEMPLATE
      : merchant === "lazada"
        ? process.env.LAZADA_AFFILIATE_SEARCH_TEMPLATE
        : process.env.SHOPEE_AFFILIATE_SEARCH_TEMPLATE;

  if (!template) {
    return fallbackUrl;
  }

  return template
    .replace("{query}", encodeURIComponent(searchQuery))
    .replace("{url}", encodeURIComponent(fallbackUrl));
}

export function detectShoppingRegionFromLocale(
  locale: string | null | undefined,
  currency: string | null | undefined
): ShoppingRegion {
  // Locale is the friendliest first hint for region-specific merchants.
  // Currency stays as a fallback when the browser locale is too generic.
  const normalizedLocale = (locale || "").toUpperCase();
  const localeRegion = normalizedLocale.split("-")[1] || "";

  switch (localeRegion) {
    case "PH":
      return "PH";
    case "US":
      return "US";
    case "GB":
    case "UK":
      return "UK";
    case "CA":
      return "CA";
    case "AU":
      return "AU";
    case "JP":
      return "JP";
    default:
      break;
  }

  switch ((currency || "").toUpperCase()) {
    case "PHP":
      return "PH";
    case "USD":
      return "US";
    case "GBP":
      return "UK";
    case "CAD":
      return "CA";
    case "AUD":
      return "AU";
    case "JPY":
      return "JP";
    default:
      return "GLOBAL";
  }
}
