import { formatPriceRange } from "./pricing";

export type SuggestionMerchant = "lazada" | "shopee";

export type WishlistSuggestion = {
  id: string;
  merchant: SuggestionMerchant;
  merchantLabel: string;
  title: string;
  subtitle: string;
  searchQuery: string;
  href: string;
  fitLabel: string;
  priceLabel: string | null;
  disclosure: string;
};

type SuggestionTemplate = {
  title: string;
  subtitle: string;
  searchQuery: string;
  typicalMin: number | null;
  typicalMax: number | null;
};

type SuggestionInput = {
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

const MERCHANT_LABELS: Record<SuggestionMerchant, string> = {
  lazada: "Lazada",
  shopee: "Shopee",
};

const AFFILIATE_DISCLOSURE =
  "We may earn a commission if you buy through this link.";

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
      subtitle: "Good fallback if the brand preference is unclear.",
      searchQuery: "self care gift set",
      typicalMin: 300,
      typicalMax: 1400,
    },
  ],
  Food: [
    {
      title: "Snack boxes and treats",
      subtitle: "A safe route when they want something consumable.",
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
      subtitle: "A fallback when the experience format is flexible.",
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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getMerchantSearchUrl(merchant: SuggestionMerchant, query: string): string {
  const encodedQuery = encodeURIComponent(query);

  switch (merchant) {
    case "lazada":
      return `https://www.lazada.com.ph/catalog/?q=${encodedQuery}`;
    case "shopee":
      return `https://shopee.ph/search?keyword=${encodedQuery}`;
    default:
      return `https://www.google.com/search?q=${encodedQuery}`;
  }
}

function buildTrackedSuggestionHref(
  merchant: SuggestionMerchant,
  groupId: string,
  wishlistItemId: string,
  searchQuery: string,
  title: string
): string {
  const params = new URLSearchParams({
    merchant,
    groupId,
    itemId: wishlistItemId,
    q: searchQuery,
    title,
  });

  return `/go/suggestion?${params.toString()}`;
}

function getKeywordTemplates(itemName: string, itemNote: string): SuggestionTemplate[] {
  const haystack = `${itemName} ${itemNote}`.toLowerCase();

  if (/(book|novel|manga|comic|journal)/.test(haystack)) {
    return [
      {
        title: "Fiction favorites",
        subtitle: "A strong fallback when the exact title is open.",
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

  if (/(tablet|ipad|android tab)/.test(haystack)) {
    return [
      {
        title: "Budget tablets",
        subtitle: "Good for comparing entry-level options quickly.",
        searchQuery: "budget tablet",
        typicalMin: 4000,
        typicalMax: 12000,
      },
      {
        title: "Tablet bundles and accessories",
        subtitle: "Helpful when the full tablet is above budget.",
        searchQuery: "tablet accessories bundle",
        typicalMin: 500,
        typicalMax: 2500,
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

function getBudgetFitLabel(
  template: SuggestionTemplate,
  preferredMin: number | null,
  preferredMax: number | null,
  groupBudget: number | null
): string {
  const effectiveMax = preferredMax ?? groupBudget;

  if (template.typicalMin === null && template.typicalMax === null) {
    return effectiveMax !== null ? "Use your budget target" : "Flexible pricing";
  }

  if (effectiveMax !== null && template.typicalMin !== null && template.typicalMin > effectiveMax) {
    return "Usually above target";
  }

  if (
    effectiveMax !== null &&
    template.typicalMax !== null &&
    template.typicalMax <= effectiveMax
  ) {
    return "Usually within target";
  }

  if (preferredMin !== null && template.typicalMax !== null && template.typicalMax < preferredMin) {
    return "Usually under target";
  }

  return "Flexible pricing";
}

function getSuggestionPriceLabel(
  template: SuggestionTemplate,
  preferredMin: number | null,
  preferredMax: number | null,
  groupBudget: number | null,
  currency: string | null
): string | null {
  if (preferredMin !== null || preferredMax !== null) {
    const preferredLabel = formatPriceRange(preferredMin, preferredMax, currency);
    return preferredLabel ? `Target: ${preferredLabel}` : null;
  }

  if (groupBudget !== null) {
    const groupBudgetLabel = formatPriceRange(null, groupBudget, currency);
    return groupBudgetLabel ? `Group budget: ${groupBudgetLabel}` : null;
  }

  const typicalLabel = formatPriceRange(template.typicalMin, template.typicalMax, currency);
  return typicalLabel ? `Typical spend: ${typicalLabel}` : null;
}

export function buildWishlistSuggestions(input: SuggestionInput): WishlistSuggestion[] {
  const baseQuery = input.itemName.trim();
  const categoryTemplates = CATEGORY_TEMPLATES[input.itemCategory] || CATEGORY_TEMPLATES.Other;
  const keywordTemplates = getKeywordTemplates(input.itemName, input.itemNote);

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
      ...categoryTemplates,
    ].filter((template) => template.searchQuery.trim().length > 0)
  ).slice(0, 2);

  return templates.flatMap((template) =>
    (["lazada", "shopee"] as SuggestionMerchant[]).map((merchant) => ({
      id: `${merchant}-${slugify(template.searchQuery)}`,
      merchant,
      merchantLabel: MERCHANT_LABELS[merchant],
      title: template.title,
      subtitle: template.subtitle,
      searchQuery: template.searchQuery,
      href: buildTrackedSuggestionHref(
        merchant,
        input.groupId,
        input.wishlistItemId,
        template.searchQuery,
        template.title
      ),
      fitLabel: getBudgetFitLabel(
        template,
        input.preferredPriceMin,
        input.preferredPriceMax,
        input.groupBudget
      ),
      priceLabel: getSuggestionPriceLabel(
        template,
        input.preferredPriceMin,
        input.preferredPriceMax,
        input.groupBudget,
        input.currency
      ),
      disclosure: AFFILIATE_DISCLOSURE,
    }))
  );
}

export function buildMerchantDestinationUrl(
  merchant: SuggestionMerchant,
  searchQuery: string
): string {
  const fallbackUrl = getMerchantSearchUrl(merchant, searchQuery);
  const template =
    merchant === "lazada"
      ? process.env.LAZADA_AFFILIATE_SEARCH_TEMPLATE
      : process.env.SHOPEE_AFFILIATE_SEARCH_TEMPLATE;

  if (!template) {
    return fallbackUrl;
  }

  return template
    .replace("{query}", encodeURIComponent(searchQuery))
    .replace("{url}", encodeURIComponent(fallbackUrl));
}
