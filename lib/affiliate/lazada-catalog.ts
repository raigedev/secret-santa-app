export type LazadaStarterCatalogProduct = {
  id: string;
  title: string;
  subtitle: string;
  searchQuery: string;
  typicalMin: number | null;
  typicalMax: number | null;
  whyItFits: string;
  productId: string | null;
  skuId: string | null;
  source: "catalog-product" | "search-backed";
};

type LazadaStarterCatalogInput = {
  itemName: string;
  itemCategory: string;
  itemNote: string;
  searchQuery: string;
  preferredPriceMin?: number | null;
  preferredPriceMax?: number | null;
  groupBudget?: number | null;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSearchBackedProduct(
  title: string,
  subtitle: string,
  searchQuery: string,
  whyItFits: string,
  typicalMin: number | null,
  typicalMax: number | null
): LazadaStarterCatalogProduct {
  return {
    id: `starter-${slugify(searchQuery)}`,
    title,
    subtitle,
    searchQuery,
    typicalMin,
    typicalMax,
    whyItFits,
    productId: null,
    skuId: null,
    source: "search-backed",
  };
}

function normalizeExactLazadaSearchQuery(itemName: string, haystack: string): string {
  const cleanItemName = itemName.trim().replace(/\s+/g, " ");

  if (/(tablet|ipad|android tab|galaxy tab|redmi pad|xiaomi pad)/.test(haystack)) {
    const stripped = cleanItemName
      .replace(
        /\b(gift set|gift|bundle|package|budget|affordable|cheap|best|usually above target|usually below target)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

    return stripped.length > 0 ? stripped : cleanItemName;
  }

  return cleanItemName;
}

function buildExactMatchProduct(
  itemName: string,
  haystack: string
): LazadaStarterCatalogProduct {
  const exactSearchQuery = normalizeExactLazadaSearchQuery(itemName, haystack);

  return buildSearchBackedProduct(
    itemName,
    "Start with the giftee's exact wording before branching into alternatives.",
    exactSearchQuery,
    "This stays closest to what the giftee actually asked for.",
    null,
    null
  );
}

export function getLazadaStarterProducts(
  input: LazadaStarterCatalogInput
): LazadaStarterCatalogProduct[] {
  const cleanItemName = input.itemName.trim();
  const cleanNote = input.itemNote.trim();
  const haystack = `${cleanItemName} ${input.itemCategory} ${cleanNote} ${input.searchQuery}`.toLowerCase();
  const exactMatchProduct = buildExactMatchProduct(cleanItemName, haystack);

  if (/(tablet|ipad|android tab)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Samsung Galaxy Tab A9",
        "A practical mainstream tablet for streaming, reading, and light study use.",
        "Samsung Galaxy Tab A9",
        "This is a realistic full-device pick when the wishlist means the tablet itself.",
        7000,
        11000
      ),
      buildSearchBackedProduct(
        "Xiaomi Redmi Pad SE",
        "A budget-friendly Android tablet with a strong value reputation.",
        "Xiaomi Redmi Pad SE",
        "It gives the giver a second strong tablet option at a nearby budget tier.",
        8000,
        13000
      ),
      buildSearchBackedProduct(
        "Tablet case with stand",
        "A fallback if the full device is too expensive but a useful add-on still works.",
        "tablet case with stand",
        "This keeps the tablet theme alive without forcing the giver into the full device budget.",
        500,
        1800
      ),
    ];
  }

  if (/(book|novel|manga|comic|journal|planner)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Bestselling paperback books",
        "A broad book search that usually surfaces safe giftable titles first.",
        "bestselling paperback books",
        "This works well when the giftee wants a book but did not name an exact title yet.",
        300,
        900
      ),
      buildSearchBackedProduct(
        "Self-help hardcover picks",
        "Useful when the reader likes practical or motivational books.",
        "self help hardcover book",
        "It gives the giver a clear subcategory to try when 'book' is still too broad.",
        350,
        1000
      ),
      buildSearchBackedProduct(
        "Reading journal set",
        "A softer fallback if the giver wants something book-adjacent and gift-ready.",
        "reading journal gift set",
        "This is a practical fallback when the exact reading taste is still unclear.",
        250,
        700
      ),
    ];
  }

  if (/(bag|handbag|purse|wallet|luggage|backpack)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Minimalist tote bag",
        "A safe everyday bag style that often works well for gifting.",
        "minimalist tote bag",
        "This starts with a flexible bag style that suits a wide range of tastes.",
        500,
        1800
      ),
      buildSearchBackedProduct(
        "Everyday backpack",
        "A useful route when the giftee wants something more practical.",
        "everyday backpack",
        "It gives the giver a more functional bag direction without leaving the wishlist theme.",
        700,
        2200
      ),
      buildSearchBackedProduct(
        "Crossbody bag",
        "A cleaner fashion-forward option when the gift should feel more styled.",
        "crossbody bag",
        "This balances giftability and style when the wishlist item is simply 'bag'.",
        500,
        2000
      ),
    ];
  }

  if (/(shirt|hoodie|dress|clothes|clothing|jacket|shoes|fashion|sneakers)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Oversized hoodie",
        "A forgiving apparel gift shape that works well when sizing is not too exact.",
        "oversized hoodie",
        "This is a common fashion gift fallback when the original clothing request is broad.",
        700,
        1800
      ),
      buildSearchBackedProduct(
        "Everyday graphic tee",
        "A lighter clothing option with easier budget flexibility.",
        "everyday graphic tee",
        "It helps the giver try a simpler clothing gift before jumping to higher-price pieces.",
        300,
        900
      ),
      buildSearchBackedProduct(
        "Classic sneakers",
        "A stronger footwear route when the fashion ask can stretch into shoes.",
        "classic sneakers",
        "This gives one bigger fashion option if the giver wants something more substantial.",
        1000,
        3000
      ),
    ];
  }

  if (/(tool|hardware|diy|drill|wrench|screwdriver|hammer|repair kit)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Household tool kit",
        "A broad and practical tool starting point for most giftees.",
        "household tool kit",
        "This is the safest first step when the wishlist says tools but not a specific tool.",
        600,
        2200
      ),
      buildSearchBackedProduct(
        "Cordless drill set",
        "A stronger premium route when the tool gift can be more substantial.",
        "cordless drill set",
        "It gives the giver a realistic higher-value option for hardware-oriented giftees.",
        1800,
        5500
      ),
      buildSearchBackedProduct(
        "Tool organizer bag",
        "A useful fallback if the giver wants something tool-related but easier to gift.",
        "tool organizer bag",
        "This stays in the same hobby space without forcing a heavy equipment purchase.",
        500,
        1600
      ),
    ];
  }

  if (/(beauty|makeup|skincare|perfume)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Skincare gift set",
        "A dependable beauty route when brand preferences are still flexible.",
        "skincare gift set",
        "This is a gift-ready beauty option that usually has a clean presentation.",
        400,
        1800
      ),
      buildSearchBackedProduct(
        "Perfume discovery set",
        "A more expressive choice when the giftee likes fragrance.",
        "perfume discovery set",
        "This gives the giver a beauty option that feels a little more special than basics.",
        600,
        2200
      ),
      buildSearchBackedProduct(
        "Makeup organizer kit",
        "A safer fallback when exact products or shades are still uncertain.",
        "makeup organizer kit",
        "It keeps the gift beauty-related without risking a bad shade or formula pick.",
        350,
        1200
      ),
    ];
  }

  if (/(home|decor|kitchen|cookware|bedding|blanket|pillow|lamp|organizer|mug|candle)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Scented candle set",
        "A cozy home gift that usually feels safe and polished.",
        "scented candle gift set",
        "This is an easy home-category gift when the exact decor taste is still broad.",
        300,
        1200
      ),
      buildSearchBackedProduct(
        "Bedside lamp",
        "A practical home item when the gift can be a bit more functional.",
        "bedside lamp",
        "It gives the giver a more useful home-item path without being too niche.",
        500,
        1800
      ),
      buildSearchBackedProduct(
        "Desk organizer",
        "A neat fallback for workspaces, bedrooms, and study corners.",
        "desk organizer",
        "This is a broad home-style gift that still feels purposeful and easy to buy.",
        250,
        900
      ),
    ];
  }

  if (/(food|snack|coffee|tea|treat|chocolate|pastry|cake|cookie|hamper|bakery|pasalubong)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Premium snack box",
        "A dependable consumable gift when the food preference is broad.",
        "premium snack box",
        "This works well when the giver wants a safe food gift that still feels generous.",
        300,
        1200
      ),
      buildSearchBackedProduct(
        "Coffee gift set",
        "A stronger route when the giftee enjoys coffee or cozy drink gifts.",
        "coffee gift set",
        "It gives the giver a themed food gift with a little more personality.",
        400,
        1400
      ),
      buildSearchBackedProduct(
        "Chocolate hamper",
        "A celebratory fallback when you want the gift to feel festive and easy to share.",
        "chocolate hamper gift",
        "This keeps the gift indulgent and simple when the exact food item is still open.",
        350,
        1500
      ),
    ];
  }

  if (/(game|gaming|console|board game|toy|lego|card game)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Family board game",
        "A social and giftable choice when the game type is still flexible.",
        "family board game",
        "This gives the giver a gift-ready game option that works for many recipients.",
        600,
        1800
      ),
      buildSearchBackedProduct(
        "Gaming headset",
        "A stronger gaming route when the recipient likely plays on PC or console.",
        "gaming headset",
        "It keeps the gift inside gaming without needing an exact game title or platform accessory.",
        800,
        2500
      ),
      buildSearchBackedProduct(
        "Mechanical keyboard",
        "A premium desk-gaming pick when the giver wants something more substantial.",
        "mechanical keyboard",
        "This is a realistic higher-end gaming-adjacent option with strong gift appeal.",
        900,
        3000
      ),
    ];
  }

  if (/(collectible|figure|anime|merch|funko|plush|trading card|model kit|hobby)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Anime figure",
        "A common collectible route when the fandom is still somewhat broad.",
        "anime figure",
        "This is a strong collectible starting point when the giftee likes merch or display pieces.",
        500,
        2500
      ),
      buildSearchBackedProduct(
        "Blind box set",
        "A fun collectible format when you want something surprise-friendly.",
        "blind box set",
        "It gives the giver a more playful collectible format with easier price flexibility.",
        300,
        1500
      ),
      buildSearchBackedProduct(
        "Acrylic display case",
        "A practical fallback if the giftee already has collectibles to display.",
        "acrylic display case",
        "This stays highly relevant even when the exact fandom item is hard to choose.",
        350,
        1200
      ),
    ];
  }

  return [
    exactMatchProduct,
    buildSearchBackedProduct(
      `Budget-friendly ${cleanItemName}`,
      "A lower-pressure starting point when the exact premium version feels too open.",
      `budget ${input.searchQuery}`,
      "This gives the giver a cheaper first pass before moving into bigger-ticket picks.",
      null,
      null
    ),
    buildSearchBackedProduct(
      `${cleanItemName} gift set`,
      "A gift-ready version of the idea when the giver wants something easier to pick.",
      `${input.searchQuery} gift set`,
      "This keeps the same theme while nudging the search toward ready-made gift options.",
      null,
      null
    ),
  ];
}
