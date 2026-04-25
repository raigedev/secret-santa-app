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
        "A useful add-on if the full device is too expensive.",
        "tablet case with stand",
        "This keeps the tablet theme alive without forcing the giver into the full device budget.",
        500,
        1800
      ),
    ];
  }

  if (/(stationery|notebook|pen|marker|sketchbook|art supplies|craft|gift card)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Stationery gift set",
        "A tidy stationery route when the exact supply list is still flexible.",
        "stationery gift set",
        "This keeps the idea practical and giftable without overcommitting to one specific tool.",
        250,
        900
      ),
      buildSearchBackedProduct(
        "Planner and notebook set",
        "A safer everyday option for writing, planning, and school or work use.",
        "planner notebook set",
        "This gives the giver a more polished paper-goods option with easy gifting appeal.",
        300,
        1100
      ),
      buildSearchBackedProduct(
        "Art supplies starter set",
        "A stronger creative route when the giftee is clearly into drawing or crafts.",
        "art supplies starter set",
        "This keeps the stationery-and-craft direction while widening into more substantial hobby picks.",
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
        "A softer book-adjacent idea that is easy to gift.",
        "reading journal gift set",
        "This is practical when the exact reading taste is still unclear.",
        250,
        700
      ),
    ];
  }

  if (/(earbuds|headset|headphones|speaker|microphone|audio|soundbar)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Bluetooth earbuds",
        "A practical everyday audio gift when the exact device type is still open.",
        "bluetooth earbuds",
        "This is an easy audio-category gift that still feels useful and modern.",
        500,
        1800
      ),
      buildSearchBackedProduct(
        "Portable speaker",
        "A stronger shared-use audio option if the giftee likes music in rooms or on the go.",
        "portable speaker",
        "This gives a more social audio route without locking into headphone fit or comfort.",
        700,
        2200
      ),
      buildSearchBackedProduct(
        "Wireless gaming headset",
        "A step-up audio route when the gift can be more substantial.",
        "wireless gaming headset",
        "This is the pricier audio direction when the giver wants something more premium than a basic accessory.",
        1500,
        4500
      ),
    ];
  }

  if (/(camera|drone|tripod|lens|gimbal|action cam)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Camera accessory kit",
        "A practical camera route when the exact device body is too expensive or too open.",
        "camera accessory kit",
        "This keeps the photography theme without forcing a full camera purchase.",
        600,
        1800
      ),
      buildSearchBackedProduct(
        "Tripod and phone mount",
        "A safe content-creation pick for both cameras and phones.",
        "tripod phone mount",
        "This gives the giver a useful photo-video route that still feels giftable.",
        500,
        1600
      ),
      buildSearchBackedProduct(
        "Mini camera drone",
        "A stronger tech-photo route when the budget can stretch higher.",
        "mini camera drone",
        "This is a more ambitious camera-adjacent option if the gift is meant to feel substantial.",
        1800,
        6500
      ),
    ];
  }

  if (/(keyboard|mouse|monitor|ssd|laptop|printer|router|webcam|storage|desktop|computer)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Wireless keyboard and mouse set",
        "A practical computer gift when the exact setup is still flexible.",
        "wireless keyboard mouse set",
        "This stays inside the computer category but keeps the gift easier to choose and ship.",
        700,
        2200
      ),
      buildSearchBackedProduct(
        "Portable SSD",
        "A stronger tech utility option for work, school, and creative use.",
        "portable ssd",
        "This gives the giver a more premium computer accessory that still feels broadly useful.",
        1200,
        3500
      ),
      buildSearchBackedProduct(
        "Monitor light bar",
        "A desk-friendly idea when the giftee likes setup upgrades.",
        "monitor light bar",
        "This keeps the computer theme alive while nudging the search toward polished workspace upgrades.",
        900,
        2500
      ),
    ];
  }

  if (/(bag|handbag|purse|wallet|luggage|backpack)/.test(haystack)) {
    if (/\btote\b/.test(haystack)) {
      return [
        exactMatchProduct,
        buildSearchBackedProduct(
          "Structured tote bag",
          "A slightly more polished tote direction when you want something a little stronger.",
          "structured tote bag",
          "This keeps the tote idea intact while nudging the search toward a more elevated everyday option.",
          700,
          1800
        ),
        buildSearchBackedProduct(
          "Premium tote bag",
          "A higher-end tote route if the giver is comfortable spending more.",
          "premium tote bag",
          "This is the pricier tote search when the gift can stretch into a more premium bag.",
          1200,
          3500
        ),
        buildSearchBackedProduct(
          "Leather tote bag",
          "A stronger fashion-forward tote search for a more substantial gift.",
          "leather tote bag",
          "This keeps the tote category but pushes the search toward pricier materials and dressier options.",
          1500,
          4500
        ),
      ];
    }

    if (/\bbackpack\b/.test(haystack)) {
      return [
        exactMatchProduct,
        buildSearchBackedProduct(
          "Commuter backpack",
          "A practical daily bag route with a little more structure than a generic backpack.",
          "commuter backpack",
          "This keeps the backpack direction but pushes it toward more purposeful daily-use picks.",
          700,
          2200
        ),
        buildSearchBackedProduct(
          "Premium laptop backpack",
          "A higher-end backpack route if the gift can stretch upward.",
          "premium laptop backpack",
          "This gives the giver a pricier backpack option that still stays in the same practical category.",
          1500,
          4500
        ),
        buildSearchBackedProduct(
          "Travel backpack",
          "A bigger-capacity backpack search when the gift should feel more substantial.",
          "travel backpack",
          "This stays inside the backpack category while widening the search toward larger higher-ticket picks.",
          1200,
          3500
        ),
      ];
    }

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
        "Structured handbag",
        "A small spend-up if the giver wants something more polished than a basic everyday bag.",
        "structured handbag",
        "This nudges the search into a slightly more elevated bag style without jumping straight to luxury.",
        800,
        2200
      ),
      buildSearchBackedProduct(
        "Premium bag",
        "A higher-priced bag search when the gift can stretch further.",
        "premium bag",
        "This keeps the same general bag theme while pushing the search toward pricier options.",
        1400,
        4000
      ),
    ];
  }

  if (/(baby|newborn|infant|toddler|feeding|stroller|diaper|nursery)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Baby essentials set",
        "A dependable starting point when the exact baby item is still broad.",
        "baby essentials set",
        "This is a safe first route when the giver wants something practical for a baby or new parent.",
        500,
        1800
      ),
      buildSearchBackedProduct(
        "Feeding and nursery picks",
        "Useful when the gift should feel practical and everyday.",
        "baby feeding nursery essentials",
        "This keeps the baby category focused on the most consistently useful gift areas.",
        600,
        2200
      ),
      buildSearchBackedProduct(
        "Baby walker or stroller accessories",
        "A more substantial route when the gift can stretch upward.",
        "baby stroller accessories",
        "This gives the giver a bigger-ticket baby direction without assuming the exact core item.",
        1200,
        4000
      ),
    ];
  }

  if (/(pet|dog|cat|feline|canine|litter|leash|scratch|kennel|aquarium)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Pet essentials",
        "A practical pet route when the exact accessory or treat is still open.",
        "pet essentials",
        "This is the safest first step when the giftee really means something for their pet.",
        400,
        1400
      ),
      buildSearchBackedProduct(
        "Cat and dog toy set",
        "A fun pet-friendly option that stays broadly giftable.",
        "cat dog toy set",
        "This keeps the pet category light and useful when the exact breed or need is unclear.",
        300,
        1100
      ),
      buildSearchBackedProduct(
        "Pet carrier or bed",
        "A stronger pet route when the gift can be more substantial.",
        "pet carrier bed",
        "This gives the giver a more premium pet-item direction if they want something bigger than toys or treats.",
        900,
        3200
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
        "This is a common fashion gift when the original clothing request is broad.",
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

  if (/(fan|blender|vacuum|rice cooker|air fryer|kettle|appliance|microwave)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Kitchen appliance picks",
        "A useful appliance route when the exact machine type is still flexible.",
        "kitchen appliance",
        "This keeps the gift practical while leaving room for the giver to compare common household appliances.",
        900,
        3500
      ),
      buildSearchBackedProduct(
        "Portable home appliance",
        "A smaller appliance route for useful everyday upgrades.",
        "portable home appliance",
        "This gives a lower-pressure appliance direction before moving into larger higher-ticket machines.",
        700,
        2500
      ),
      buildSearchBackedProduct(
        "Air fryer or rice cooker",
        "A stronger home-appliance route when the gift can be more substantial.",
        "air fryer rice cooker",
        "This is the pricier appliance direction when the giver wants a more meaningful kitchen upgrade.",
        1800,
        6000
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
        "A useful tool-related idea that is easier to gift.",
        "tool organizer bag",
        "This stays in the same hobby space without forcing a heavy equipment purchase.",
        500,
        1600
      ),
    ];
  }

  if (/(car|motorcycle|helmet|dash cam|seat cover|automotive)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Car accessory kit",
        "A practical automotive route when the exact car item is still broad.",
        "car accessory kit",
        "This is the safest first automotive step when the giftee wants something useful for a vehicle.",
        500,
        1800
      ),
      buildSearchBackedProduct(
        "Dash cam and mounts",
        "A stronger car-tech direction when the gift can stretch upward.",
        "dash cam car mount",
        "This gives the giver a more premium automotive route without jumping straight to costly major parts.",
        1500,
        4500
      ),
      buildSearchBackedProduct(
        "Motorcycle helmet accessories",
        "Useful when the giftee is more bike-oriented than car-oriented.",
        "motorcycle helmet accessories",
        "This keeps the automotive category open to two-wheel riders instead of assuming only car accessories.",
        800,
        2500
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
        "A safer option when exact products or shades are still uncertain.",
        "makeup organizer kit",
        "It keeps the gift beauty-related without risking a bad shade or formula pick.",
        350,
        1200
      ),
    ];
  }

  if (/(voucher|gift card|subscription|top up|topup|load|software|license|digital|service)/.test(haystack)) {
    return [
      exactMatchProduct,
      buildSearchBackedProduct(
        "Gift card and voucher picks",
        "A broad digital route when the giver wants something quick and flexible.",
        "gift card voucher",
        "This is a safe digital option when the exact platform or brand is still open.",
        300,
        1500
      ),
      buildSearchBackedProduct(
        "Gaming and streaming credits",
        "Useful when the recipient is more entertainment-focused.",
        "gaming streaming credits",
        "This gives the giver a clearer digital direction when the gift should feel fun and easy to use right away.",
        300,
        2000
      ),
      buildSearchBackedProduct(
        "Software and subscription picks",
        "A stronger digital route when the gift is more functional or work-oriented.",
        "software subscription",
        "This keeps the digital gift idea but nudges it toward more practical higher-value options.",
        500,
        3000
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
        "A neat idea for workspaces, bedrooms, and study corners.",
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
        "A celebratory option when you want the gift to feel festive and easy to share.",
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
        "A practical option if the giftee already has collectibles to display.",
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
    buildSearchBackedProduct(
      `Premium ${cleanItemName}`,
      "A higher-end route when the giver wants a more substantial version of the same idea.",
      `premium ${input.searchQuery}`,
      "This keeps the original idea but pushes the search toward more premium picks.",
      null,
      null
    ),
  ];
}
