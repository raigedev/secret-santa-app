import { formatPriceRange } from "./pricing";

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
  title: string;
  subtitle: string;
  href: string;
  searchQuery: string;
  priceLabel: string | null;
  fitLabel: string;
  whyItFits: string;
  trackingLabel: string;
};

export type NearbyStoreLink = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type NearbyStoreQuery = {
  id: string;
  title: string;
  subtitle: string;
  query: string;
};

type SuggestionTemplate = {
  title: string;
  subtitle: string;
  searchQuery: string;
  typicalMin: number | null;
  typicalMax: number | null;
};

type FeaturedProductTemplate = SuggestionTemplate & {
  whyItFits: string;
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

const AFFILIATE_DISCLOSURE =
  "We may earn a commission if you buy through this link.";

export const AFFILIATE_READY_MERCHANTS: SuggestionMerchant[] = [
  "amazon",
  "lazada",
  "shopee",
];

export const SHOPPING_REGION_OPTIONS: ShoppingRegionOption[] = [
  {
    value: "PH",
    label: "Philippines",
    helper: "Use Lazada, Shopee, and PH-friendly searches.",
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
    helper: "Use Canada-friendly stores and search routes.",
  },
  {
    value: "AU",
    label: "Australia",
    helper: "Use Australia-friendly stores and search routes.",
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

function buildTrackedSuggestionHref(
  merchant: SuggestionMerchant,
  groupId: string,
  wishlistItemId: string,
  searchQuery: string,
  title: string,
  region: ShoppingRegion
): string {
  const params = new URLSearchParams({
    merchant,
    groupId,
    itemId: wishlistItemId,
    q: searchQuery,
    title,
    region,
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

function dedupeFeaturedProductTemplates(
  templates: FeaturedProductTemplate[]
): FeaturedProductTemplate[] {
  const dedupedTemplates = dedupeTemplates(templates);

  return dedupedTemplates.map((template) => ({
    ...template,
    whyItFits:
      templates.find(
        (candidate) =>
          candidate.searchQuery.toLowerCase() === template.searchQuery.toLowerCase()
      )?.whyItFits || "",
  }));
}

function getLazadaStarterProductTemplates(
  option: WishlistSuggestionOption,
  itemName: string,
  itemCategory: string,
  itemNote: string
): FeaturedProductTemplate[] {
  const cleanItemName = itemName.trim();
  const cleanNote = itemNote.trim();
  const haystack = `${cleanItemName} ${itemCategory} ${cleanNote} ${option.searchQuery}`.toLowerCase();

  const exactMatchTemplate: FeaturedProductTemplate = {
    title: cleanItemName,
    subtitle: "Start with the giftee's exact wording before branching into alternatives.",
    searchQuery: option.searchQuery,
    typicalMin: null,
    typicalMax: null,
    whyItFits: "This stays closest to what the giftee actually asked for.",
  };

  if (/(tablet|ipad|android tab)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Samsung Galaxy Tab A9",
        subtitle: "A practical mainstream tablet for streaming, reading, and light study use.",
        searchQuery: "Samsung Galaxy Tab A9",
        typicalMin: 7000,
        typicalMax: 11000,
        whyItFits: "This is a realistic full-device pick when the wishlist means the tablet itself.",
      },
      {
        title: "Xiaomi Redmi Pad SE",
        subtitle: "A budget-friendly Android tablet with a strong value reputation.",
        searchQuery: "Xiaomi Redmi Pad SE",
        typicalMin: 8000,
        typicalMax: 13000,
        whyItFits: "It gives the giver a second strong tablet option at a nearby budget tier.",
      },
      {
        title: "Tablet case with stand",
        subtitle: "A fallback if the full device is too expensive but a useful add-on still works.",
        searchQuery: "tablet case with stand",
        typicalMin: 500,
        typicalMax: 1800,
        whyItFits: "This keeps the tablet theme alive without forcing the giver into the full device budget.",
      },
    ];
  }

  if (/(book|novel|manga|comic|journal|planner)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Bestselling paperback books",
        subtitle: "A broad book search that usually surfaces safe giftable titles first.",
        searchQuery: "bestselling paperback books",
        typicalMin: 300,
        typicalMax: 900,
        whyItFits: "This works well when the giftee wants a book but did not name an exact title yet.",
      },
      {
        title: "Self-help hardcover picks",
        subtitle: "Useful when the reader likes practical or motivational books.",
        searchQuery: "self help hardcover book",
        typicalMin: 350,
        typicalMax: 1000,
        whyItFits: "It gives the giver a clear subcategory to try when 'book' is still too broad.",
      },
      {
        title: "Reading journal set",
        subtitle: "A softer fallback if the giver wants something book-adjacent and gift-ready.",
        searchQuery: "reading journal gift set",
        typicalMin: 250,
        typicalMax: 700,
        whyItFits: "This is a practical fallback when the exact reading taste is still unclear.",
      },
    ];
  }

  if (/(bag|handbag|purse|wallet|luggage|backpack)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Minimalist tote bag",
        subtitle: "A safe everyday bag style that often works well for gifting.",
        searchQuery: "minimalist tote bag",
        typicalMin: 500,
        typicalMax: 1800,
        whyItFits: "This starts with a flexible bag style that suits a wide range of tastes.",
      },
      {
        title: "Everyday backpack",
        subtitle: "A useful route when the giftee wants something more practical.",
        searchQuery: "everyday backpack",
        typicalMin: 700,
        typicalMax: 2200,
        whyItFits: "It gives the giver a more functional bag direction without leaving the wishlist theme.",
      },
      {
        title: "Crossbody bag",
        subtitle: "A cleaner fashion-forward option when the gift should feel more styled.",
        searchQuery: "crossbody bag",
        typicalMin: 500,
        typicalMax: 2000,
        whyItFits: "This balances giftability and style when the wishlist item is simply 'bag'.",
      },
    ];
  }

  if (/(shirt|hoodie|dress|clothes|clothing|jacket|shoes|fashion|sneakers)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Oversized hoodie",
        subtitle: "A forgiving apparel gift shape that works well when sizing is not too exact.",
        searchQuery: "oversized hoodie",
        typicalMin: 700,
        typicalMax: 1800,
        whyItFits: "This is a common fashion gift fallback when the original clothing request is broad.",
      },
      {
        title: "Everyday graphic tee",
        subtitle: "A lighter clothing option with easier budget flexibility.",
        searchQuery: "everyday graphic tee",
        typicalMin: 300,
        typicalMax: 900,
        whyItFits: "It helps the giver try a simpler clothing gift before jumping to higher-price pieces.",
      },
      {
        title: "Classic sneakers",
        subtitle: "A stronger footwear route when the fashion ask can stretch into shoes.",
        searchQuery: "classic sneakers",
        typicalMin: 1000,
        typicalMax: 3000,
        whyItFits: "This gives one bigger fashion option if the giver wants something more substantial.",
      },
    ];
  }

  if (/(tool|hardware|diy|drill|wrench|screwdriver|hammer|repair kit)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Household tool kit",
        subtitle: "A broad and practical tool starting point for most giftees.",
        searchQuery: "household tool kit",
        typicalMin: 600,
        typicalMax: 2200,
        whyItFits: "This is the safest first step when the wishlist says tools but not a specific tool.",
      },
      {
        title: "Cordless drill set",
        subtitle: "A stronger premium route when the tool gift can be more substantial.",
        searchQuery: "cordless drill set",
        typicalMin: 1800,
        typicalMax: 5500,
        whyItFits: "It gives the giver a realistic higher-value option for hardware-oriented giftees.",
      },
      {
        title: "Tool organizer bag",
        subtitle: "A useful fallback if the giver wants something tool-related but easier to gift.",
        searchQuery: "tool organizer bag",
        typicalMin: 500,
        typicalMax: 1600,
        whyItFits: "This stays in the same hobby space without forcing a heavy equipment purchase.",
      },
    ];
  }

  if (/(beauty|makeup|skincare|perfume)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Skincare gift set",
        subtitle: "A dependable beauty route when brand preferences are still flexible.",
        searchQuery: "skincare gift set",
        typicalMin: 400,
        typicalMax: 1800,
        whyItFits: "This is a gift-ready beauty option that usually has a clean presentation.",
      },
      {
        title: "Perfume discovery set",
        subtitle: "A more expressive choice when the giftee likes fragrance.",
        searchQuery: "perfume discovery set",
        typicalMin: 600,
        typicalMax: 2200,
        whyItFits: "This gives the giver a beauty option that feels a little more special than basics.",
      },
      {
        title: "Makeup organizer kit",
        subtitle: "A safer fallback when exact products or shades are still uncertain.",
        searchQuery: "makeup organizer kit",
        typicalMin: 350,
        typicalMax: 1200,
        whyItFits: "It keeps the gift beauty-related without risking a bad shade or formula pick.",
      },
    ];
  }

  if (/(home|decor|kitchen|cookware|bedding|blanket|pillow|lamp|organizer|mug|candle)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Scented candle set",
        subtitle: "A cozy home gift that usually feels safe and polished.",
        searchQuery: "scented candle gift set",
        typicalMin: 300,
        typicalMax: 1200,
        whyItFits: "This is an easy home-category gift when the exact decor taste is still broad.",
      },
      {
        title: "Bedside lamp",
        subtitle: "A practical home item when the gift can be a bit more functional.",
        searchQuery: "bedside lamp",
        typicalMin: 500,
        typicalMax: 1800,
        whyItFits: "It gives the giver a more useful home-item path without being too niche.",
      },
      {
        title: "Desk organizer",
        subtitle: "A neat fallback for workspaces, bedrooms, and study corners.",
        searchQuery: "desk organizer",
        typicalMin: 250,
        typicalMax: 900,
        whyItFits: "This is a broad home-style gift that still feels purposeful and easy to buy.",
      },
    ];
  }

  if (/(food|snack|coffee|tea|treat|chocolate|pastry|cake|cookie|hamper|bakery|pasalubong)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Premium snack box",
        subtitle: "A dependable consumable gift when the food preference is broad.",
        searchQuery: "premium snack box",
        typicalMin: 300,
        typicalMax: 1200,
        whyItFits: "This works well when the giver wants a safe food gift that still feels generous.",
      },
      {
        title: "Coffee gift set",
        subtitle: "A stronger route when the giftee enjoys coffee or cozy drink gifts.",
        searchQuery: "coffee gift set",
        typicalMin: 400,
        typicalMax: 1400,
        whyItFits: "It gives the giver a themed food gift with a little more personality.",
      },
      {
        title: "Chocolate hamper",
        subtitle: "A celebratory fallback when you want the gift to feel festive and easy to share.",
        searchQuery: "chocolate hamper gift",
        typicalMin: 350,
        typicalMax: 1500,
        whyItFits: "This keeps the gift indulgent and simple when the exact food item is still open.",
      },
    ];
  }

  if (/(game|gaming|console|board game|toy|lego|card game)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Family board game",
        subtitle: "A social and giftable choice when the game type is still flexible.",
        searchQuery: "family board game",
        typicalMin: 600,
        typicalMax: 1800,
        whyItFits: "This gives the giver a gift-ready game option that works for many recipients.",
      },
      {
        title: "Gaming headset",
        subtitle: "A stronger gaming route when the recipient likely plays on PC or console.",
        searchQuery: "gaming headset",
        typicalMin: 800,
        typicalMax: 2500,
        whyItFits: "It keeps the gift inside gaming without needing an exact game title or platform accessory.",
      },
      {
        title: "Mechanical keyboard",
        subtitle: "A premium desk-gaming pick when the giver wants something more substantial.",
        searchQuery: "mechanical keyboard",
        typicalMin: 900,
        typicalMax: 3000,
        whyItFits: "This is a realistic higher-end gaming-adjacent option with strong gift appeal.",
      },
    ];
  }

  if (/(collectible|figure|anime|merch|funko|plush|trading card|model kit|hobby)/.test(haystack)) {
    return [
      exactMatchTemplate,
      {
        title: "Anime figure",
        subtitle: "A common collectible route when the fandom is still somewhat broad.",
        searchQuery: "anime figure",
        typicalMin: 500,
        typicalMax: 2500,
        whyItFits: "This is a strong collectible starting point when the giftee likes merch or display pieces.",
      },
      {
        title: "Blind box set",
        subtitle: "A fun collectible format when you want something surprise-friendly.",
        searchQuery: "blind box set",
        typicalMin: 300,
        typicalMax: 1500,
        whyItFits: "It gives the giver a more playful collectible format with easier price flexibility.",
      },
      {
        title: "Acrylic display case",
        subtitle: "A practical fallback if the giftee already has collectibles to display.",
        searchQuery: "acrylic display case",
        typicalMin: 350,
        typicalMax: 1200,
        whyItFits: "This stays highly relevant even when the exact fandom item is hard to choose.",
      },
    ];
  }

  return [
    exactMatchTemplate,
    {
      title: `Budget-friendly ${cleanItemName}`,
      subtitle: "A lower-pressure starting point when the exact premium version feels too open.",
      searchQuery: `budget ${option.searchQuery}`,
      typicalMin: null,
      typicalMax: null,
      whyItFits: "This gives the giver a cheaper first pass before moving into bigger-ticket picks.",
    },
    {
      title: `${cleanItemName} gift set`,
      subtitle: "A gift-ready version of the idea when the giver wants something easier to pick.",
      searchQuery: `${option.searchQuery} gift set`,
      typicalMin: null,
      typicalMax: null,
      whyItFits: "This keeps the same theme while nudging the search toward ready-made gift options.",
    },
  ];
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

function getNearbySearchBase(itemName: string, itemCategory: string, searchQuery: string): string[] {
  const haystack = `${itemName} ${itemCategory} ${searchQuery}`.toLowerCase();

  if (/(tablet|ipad|android tab|laptop|gadget|tech|phone|mobile|earbuds|headphone|camera)/.test(haystack)) {
    return ["electronics store", "computer shop", "gadget store"];
  }

  if (/(tool|hardware|diy|drill|wrench|screwdriver|hammer|repair kit)/.test(haystack)) {
    return ["hardware store", "tool shop", "home improvement store"];
  }

  if (/(book|novel|manga|comic|journal|planner|stationery|art supplies)/.test(haystack)) {
    return ["bookstore", "school and office supplies", "mall bookstore"];
  }

  if (/(bag|handbag|purse|wallet|luggage|backpack)/.test(haystack)) {
    return ["bag store", "fashion accessories shop", "department store"];
  }

  if (/(shirt|hoodie|dress|clothes|clothing|jacket|shoes|fashion|sandals|slippers|accessories|jewelry)/.test(haystack)) {
    return ["clothing store", "department store", "mall fashion shop"];
  }

  if (/(beauty|makeup|skincare|perfume)/.test(haystack)) {
    return ["beauty store", "cosmetics shop", "department store"];
  }

  if (/(game|gaming|console|board game|toy|lego|card game)/.test(haystack)) {
    return ["gaming store", "toy store", "hobby shop"];
  }

  if (/(collectible|figure|anime|merch|funko|plush|trading card|model kit|hobby)/.test(haystack)) {
    return ["collectibles store", "hobby shop", "toy store"];
  }

  if (/(home|decor|kitchen|cookware|bedding|blanket|pillow|lamp|organizer|mug|candle)/.test(haystack)) {
    return ["home store", "kitchenware shop", "department store"];
  }

  if (/(food|snack|coffee|tea|treat|chocolate|pastry|cake|cookie|hamper|bakery|pasalubong)/.test(haystack)) {
    return ["specialty food store", "bakery", "pasalubong shop"];
  }

  if (/(experience|voucher|spa|massage|cinema|activity|class|workshop)/.test(haystack)) {
    return ["spa and wellness center", "cinema", "activity center"];
  }

  return ["gift shop", "department store", "mall store"];
}

function buildMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

function toDisplayArea(areaHint: string): string {
  const trimmed = areaHint.trim();

  return trimmed.length > 0 ? trimmed : "near me";
}

export function buildWishlistSuggestionOptions(
  input: SuggestionInput
): WishlistSuggestionOption[] {
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
  ).slice(0, 4);

  return templates.map((template) => ({
    id: slugify(template.searchQuery),
    title: template.title,
    subtitle: template.subtitle,
    searchQuery: template.searchQuery,
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
  }));
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
            region
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

  // These cards intentionally use specific Lazada-oriented search picks now.
  // Once the Lazada Open API is approved, the same UI can swap to real
  // product-level promotion links without redesigning the wishlist flow.
  const templates = dedupeFeaturedProductTemplates(
    getLazadaStarterProductTemplates(
      input.option,
      input.itemName,
      input.itemCategory,
      input.itemNote
    )
  ).slice(0, 3);

  return templates.map((template) => ({
    id: `lazada-featured-${slugify(template.searchQuery)}`,
    merchant: "lazada",
    merchantLabel: MERCHANT_LABELS.lazada,
    title: template.title,
    subtitle: template.subtitle,
    href: buildTrackedSuggestionHref(
      "lazada",
      input.groupId,
      input.wishlistItemId,
      template.searchQuery,
      template.title,
      input.region
    ),
    searchQuery: template.searchQuery,
    priceLabel: getSuggestionPriceLabel(
      template,
      input.preferredPriceMin,
      input.preferredPriceMax,
      input.groupBudget,
      input.currency
    ),
    fitLabel: getBudgetFitLabel(
      template,
      input.preferredPriceMin,
      input.preferredPriceMax,
      input.groupBudget
    ),
    whyItFits: template.whyItFits,
    trackingLabel: "Search-backed pick",
  }));
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

export function buildNearbyStoreLinks(
  option: WishlistSuggestionOption,
  itemName: string,
  itemCategory: string,
  areaHint: string
): NearbyStoreLink[] {
  return buildNearbyStoreQueries(option, itemName, itemCategory, areaHint).map(
    (query) => ({
      id: query.id,
      title: query.title,
      subtitle: query.subtitle,
      href: buildMapsSearchUrl(query.query),
    })
  );
}

export function buildNearbyStoreQueries(
  option: WishlistSuggestionOption,
  itemName: string,
  itemCategory: string,
  areaHint: string
): NearbyStoreQuery[] {
  // We intentionally build store-category searches instead of promising
  // exact branch inventory. That keeps the nearby-store experience useful
  // without overstating what the app can verify.
  const displayArea = toDisplayArea(areaHint);
  const storeSearches = getNearbySearchBase(itemName, itemCategory, option.searchQuery);

  return storeSearches.map((storeSearch) => ({
    id: `${slugify(storeSearch)}-${slugify(displayArea)}`,
    title: `${storeSearch} ${displayArea === "near me" ? "near me" : `near ${displayArea}`}`,
    subtitle:
      displayArea === "near me"
        ? "Open Maps and compare nearby physical shops."
        : `Open Maps and compare shops around ${displayArea}.`,
    query: `${storeSearch} ${displayArea}`,
  }));
}
