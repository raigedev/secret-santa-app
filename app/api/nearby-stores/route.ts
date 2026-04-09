import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type NearbyStoresRequest = {
  area?: string;
  latitude?: number;
  longitude?: number;
  queries: string[];
};

type NearbyStoreResult = {
  id: string;
  name: string;
  address: string;
  mapsUrl: string;
  rating: number | null;
  userRatingCount: number | null;
  openNow: boolean | null;
  primaryType: string | null;
  availabilityBadge: string;
  availabilityHint: string;
};

type ScoredNearbyStoreResult = NearbyStoreResult & {
  relevanceScore: number;
};

type GeoapifyGeocodeFeature = {
  properties?: {
    place_id?: string;
    name?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    lat?: number;
    lon?: number;
    result_type?: string;
    categories?: string[];
  };
};

type GeoapifyGeocodeResponse = {
  features?: GeoapifyGeocodeFeature[];
};

type GeoapifyPlacesFeature = {
  properties?: {
    place_id?: string;
    name?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    lat?: number;
    lon?: number;
    categories?: string[];
    distance?: number;
  };
};

type GeoapifyPlacesResponse = {
  features?: GeoapifyPlacesFeature[];
};

const MAX_QUERIES = 3;
const MAX_RESULTS = 6;

const HARD_GROCERY_CHAIN_KEYWORDS = [
  "alfamart",
  "7-eleven",
  "7 eleven",
  "uncle john",
  "dali",
];

const SOFT_GROCERY_KEYWORDS = [
  "savemore",
  "supermarket",
  "convenience",
  "minimart",
  "mini mart",
  "grocery",
  "puregold",
];

const GIFT_SHOP_KEYWORDS = [
  "party needs",
  "gift shop",
  "souvenir",
  "party",
  "balloon",
  "novelty",
  "favor",
  "favors",
];

const TECH_MAJOR_RETAILER_KEYWORDS = [
  "sm store",
  "the sm store",
  "sm city",
  "sm center",
  "sm mall",
  "central mall",
  "department store",
];

const BOOKSTORE_RETAILER_KEYWORDS = [
  "fully booked",
  "national bookstore",
  "booksale",
  "bookstore",
  "book shop",
];

const FASHION_RETAILER_KEYWORDS = [
  "department store",
  "shopping mall",
  "boutique",
  "apparel",
  "fashion",
  "shoe",
  "bag",
  "luggage",
];

const TOOLS_RETAILER_KEYWORDS = [
  "ace hardware",
  "wilcon",
  "mr diy",
  "handyman",
  "hardware",
  "tool",
  "home improvement",
];

const GAMES_AND_COLLECTIBLES_KEYWORDS = [
  "datablitz",
  "gamextreme",
  "toy kingdom",
  "toy store",
  "gaming",
  "hobby",
  "collectible",
  "figure",
];

const HOME_STORE_KEYWORDS = [
  "department store",
  "shopping mall",
  "home",
  "decor",
  "houseware",
  "kitchen",
  "furniture",
];

const FOOD_SPECIALTY_KEYWORDS = [
  "bakery",
  "coffee",
  "tea",
  "pasalubong",
  "deli",
  "snack",
  "chocolate",
  "specialty food",
];

const EXPERIENCE_PLACE_KEYWORDS = [
  "spa",
  "wellness",
  "cinema",
  "activity",
  "workshop",
  "class",
  "massage",
];

type PlaceSearchProfile = {
  kind:
    | "bags"
    | "beauty"
    | "books"
    | "collectibles"
    | "experience"
    | "fashion"
    | "food"
    | "games"
    | "generic"
    | "gift"
    | "home"
    | "tech"
    | "tools";
  categories: string[];
  strongMatchKeywords: string[];
  supportKeywords: string[];
  excludeKeywords: string[];
  categoryHints: string[];
  minimumScore: number;
};

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isRequestBody(value: unknown): value is NearbyStoresRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<NearbyStoresRequest>;
  return Array.isArray(candidate.queries);
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildMapsUrl(
  name: string,
  address: string,
  lat: number | null,
  lon: number | null
): string {
  const searchLabel = [name, address].filter(Boolean).join(" ");

  if (searchLabel.trim().length > 0) {
    // A plain Maps search tends to show the place result list/business card more
    // naturally when we only have third-party place data and not a Google place_id.
    return `https://www.google.com/maps/search/${encodeURIComponent(searchLabel)}`;
  }

  if (typeof lat === "number" && typeof lon === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
  }

  return "https://www.google.com/maps";
}

function getPlaceSearchProfile(query: string): PlaceSearchProfile {
  const haystack = query.toLowerCase();

  if (/(electronics|computer|gadget|tablet)/.test(haystack)) {
    return {
      kind: "tech",
      categories: [
        "commercial.elektronics",
        "commercial.shopping_mall",
        "commercial.department_store",
      ],
      strongMatchKeywords: [
        "tablet",
        "computer",
        "laptop",
        "gadget",
        "mobile",
        "phone",
        "cellphone",
        "electronics",
        "electronic",
        "device",
        "pc",
        "appliance",
      ],
      supportKeywords: ["accessories", "digital", "shopping mall", "department store"],
      excludeKeywords: [
        "surveillance",
        "security",
        "cctv",
        "alarm",
        "tracking",
        "gps",
        "industrial",
        "automotive",
        "car accessories",
        "electrical supply",
        "gift",
        "souvenir",
        "party",
        "novelty",
        "toy",
        "balloon",
      ],
      categoryHints: ["elektronics", "shopping_mall", "department_store"],
      minimumScore: 3,
    };
  }

  if (/(tool|hardware|diy|drill|wrench|screwdriver|hammer|repair kit)/.test(haystack)) {
    return {
      kind: "tools",
      categories: ["commercial.department_store", "commercial.shopping_mall"],
      strongMatchKeywords: [
        "hardware",
        "tool",
        "tools",
        "diy",
        "home improvement",
        "drill",
        "wrench",
        "screwdriver",
      ],
      supportKeywords: ["department store", "shopping mall", "houseware"],
      excludeKeywords: ["beauty", "fashion", "laundry", "grocery"],
      categoryHints: ["department_store", "shopping_mall"],
      minimumScore: 2,
    };
  }

  if (/(book|bookstore|journal|manga|comic)/.test(haystack)) {
    return {
      kind: "books",
      categories: ["commercial.books", "commercial.shopping_mall"],
      strongMatchKeywords: [
        "book",
        "books",
        "bookstore",
        "manga",
        "comic",
        "novel",
        "journal",
      ],
      supportKeywords: ["stationery", "school", "office supplies", "shopping mall"],
      excludeKeywords: ["hotel", "cafe", "restaurant", "bar", "repair"],
      categoryHints: ["books", "shopping_mall"],
      minimumScore: 2,
    };
  }

  if (/(bag|handbag|purse|wallet|luggage|backpack)/.test(haystack)) {
    return {
      kind: "bags",
      categories: ["commercial.clothing", "commercial.department_store"],
      strongMatchKeywords: [
        "bag",
        "bags",
        "handbag",
        "purse",
        "wallet",
        "luggage",
        "backpack",
      ],
      supportKeywords: ["fashion", "accessories", "department store", "shopping mall"],
      excludeKeywords: ["grocery", "hardware", "laundry"],
      categoryHints: ["clothing", "department_store", "shopping_mall"],
      minimumScore: 2,
    };
  }

  if (/(clothing|fashion|shirt|hoodie|dress|shoes)/.test(haystack)) {
    return {
      kind: "fashion",
      categories: ["commercial.clothing", "commercial.department_store"],
      strongMatchKeywords: [
        "fashion",
        "clothing",
        "apparel",
        "boutique",
        "wear",
        "shirt",
        "hoodie",
        "dress",
        "shoes",
      ],
      supportKeywords: ["department store", "shopping mall"],
      excludeKeywords: ["laundry", "repair"],
      categoryHints: ["clothing", "department_store", "shopping_mall"],
      minimumScore: 2,
    };
  }

  if (/(beauty|makeup|skincare|cosmetic)/.test(haystack)) {
    return {
      kind: "beauty",
      categories: [
        "commercial.health_and_beauty",
        "commercial.health_and_beauty.cosmetics",
      ],
      strongMatchKeywords: [
        "beauty",
        "makeup",
        "skincare",
        "cosmetic",
        "fragrance",
        "perfume",
      ],
      supportKeywords: ["health and beauty", "department store"],
      excludeKeywords: ["clinic", "dental", "hospital"],
      categoryHints: ["health_and_beauty", "cosmetics", "department_store"],
      minimumScore: 2,
    };
  }

  if (/(game|gaming|console|board game|toy|lego|card game)/.test(haystack)) {
    return {
      kind: "games",
      categories: ["commercial.department_store", "commercial.shopping_mall"],
      strongMatchKeywords: [
        "game",
        "gaming",
        "console",
        "board game",
        "toy",
        "lego",
        "card game",
      ],
      supportKeywords: ["hobby", "department store", "shopping mall"],
      excludeKeywords: ["grocery", "hardware", "industrial"],
      categoryHints: ["department_store", "shopping_mall"],
      minimumScore: 2,
    };
  }

  if (/(collectible|figure|anime|merch|funko|plush|trading card|model kit|hobby)/.test(haystack)) {
    return {
      kind: "collectibles",
      categories: [
        "commercial.gift_and_souvenir",
        "commercial.department_store",
        "commercial.shopping_mall",
      ],
      strongMatchKeywords: [
        "collectible",
        "figure",
        "anime",
        "merch",
        "funko",
        "plush",
        "trading card",
        "model kit",
        "hobby",
      ],
      supportKeywords: ["toy", "department store", "shopping mall"],
      excludeKeywords: ["grocery", "hardware", "industrial"],
      categoryHints: ["gift_and_souvenir", "department_store", "shopping_mall"],
      minimumScore: 2,
    };
  }

  if (/(home|decor|kitchen|cookware|bedding|blanket|pillow|lamp|organizer|mug|candle)/.test(haystack)) {
    return {
      kind: "home",
      categories: ["commercial.department_store", "commercial.shopping_mall"],
      strongMatchKeywords: [
        "home",
        "decor",
        "kitchen",
        "cookware",
        "bedding",
        "blanket",
        "pillow",
        "lamp",
        "organizer",
        "mug",
        "candle",
      ],
      supportKeywords: ["houseware", "department store", "shopping mall"],
      excludeKeywords: ["industrial", "automotive"],
      categoryHints: ["department_store", "shopping_mall"],
      minimumScore: 2,
    };
  }

  if (/(food|snack|coffee|tea|treat|chocolate|pastry|cake|cookie|hamper|bakery|pasalubong)/.test(haystack)) {
    return {
      kind: "food",
      categories: [
        "commercial.gift_and_souvenir",
        "commercial.department_store",
        "commercial.shopping_mall",
      ],
      strongMatchKeywords: [
        "food",
        "snack",
        "coffee",
        "tea",
        "chocolate",
        "pastry",
        "cake",
        "cookie",
        "bakery",
        "pasalubong",
      ],
      supportKeywords: ["deli", "specialty", "shopping mall"],
      excludeKeywords: ["hardware", "industrial", "automotive"],
      categoryHints: ["gift_and_souvenir", "department_store", "shopping_mall"],
      minimumScore: 2,
    };
  }

  if (/(experience|voucher|spa|massage|cinema|activity|class|workshop)/.test(haystack)) {
    return {
      kind: "experience",
      categories: ["commercial.shopping_mall", "commercial.department_store"],
      strongMatchKeywords: [
        "spa",
        "wellness",
        "cinema",
        "activity",
        "class",
        "workshop",
        "massage",
        "voucher",
      ],
      supportKeywords: ["shopping mall", "department store"],
      excludeKeywords: ["grocery", "hardware", "industrial"],
      categoryHints: ["shopping_mall", "department_store"],
      minimumScore: 2,
    };
  }

  if (/(gift|souvenir)/.test(haystack)) {
    return {
      kind: "gift",
      categories: ["commercial.gift_and_souvenir", "commercial.department_store"],
      strongMatchKeywords: ["gift", "souvenir", "party", "novelty", "toy"],
      supportKeywords: ["department store", "shopping mall", "variety store"],
      excludeKeywords: ["funeral"],
      categoryHints: ["gift_and_souvenir", "department_store", "shopping_mall"],
      minimumScore: 2,
    };
  }

  return {
    kind: "generic",
    categories: ["commercial.department_store", "commercial.shopping_mall"],
    strongMatchKeywords: ["gift", "department store", "shopping mall", "store"],
    supportKeywords: ["boutique", "variety", "shop"],
    excludeKeywords: ["warehouse", "industrial"],
    categoryHints: ["department_store", "shopping_mall"],
    minimumScore: 2,
  };
}

function buildPlaceHaystack(properties: GeoapifyPlacesFeature["properties"]): string {
  return [
    properties?.name,
    properties?.formatted,
    properties?.address_line1,
    properties?.address_line2,
    ...(properties?.categories || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function countKeywordMatches(haystack: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => {
    return haystack.includes(keyword) ? count + 1 : count;
  }, 0);
}

function includesAnyKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function getDisplayPrimaryType(categories: string[] | undefined): string | null {
  if (!categories || categories.length === 0) {
    return null;
  }

  const preferredCategory =
    categories.find((category) => category.includes(".")) || categories[0];
  const segments = preferredCategory.split(".");
  const rawLabel = segments[segments.length - 1] || preferredCategory;

  return rawLabel
    .replace(/_/g, " ")
    .replace(/\belektronics\b/g, "electronics")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getAvailabilitySignal(
  score: number,
  categories: string[] | undefined
): {
  badge: string;
  hint: string;
} {
  // This is intentionally framed as a likelihood signal, not live inventory.
  // We only know how closely the store profile matches the wishlist item type.
  if (score >= 7) {
    return {
      badge: "Best option",
      hint: "This store looks like one of the stronger matches for this wishlist item.",
    };
  }

  if (score >= 4) {
    return {
      badge: "Good option",
      hint: "This store likely carries items close to what the giftee wants.",
    };
  }

  const categoryText = (categories || []).join(" ").toLowerCase();

  if (
    categoryText.includes("shopping_mall") ||
    categoryText.includes("department_store")
  ) {
    return {
      badge: "Broad option",
      hint: "This is a general shopping stop where you may find related stores in one place.",
    };
  }

  return {
    badge: "Backup",
    hint: "This is a broader backup option if the closer matches do not work out.",
  };
}

function scorePlaceResult(
  profile: PlaceSearchProfile,
  properties: GeoapifyPlacesFeature["properties"]
): number {
  const fullHaystack = buildPlaceHaystack(properties);
  const nameHaystack = [properties?.name, properties?.address_line1]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const categoriesHaystack = (properties?.categories || []).join(" ").toLowerCase();

  if (
    profile.excludeKeywords.some((keyword) => fullHaystack.includes(keyword))
  ) {
    return -1;
  }

  const strongNameMatches = countKeywordMatches(
    nameHaystack,
    profile.strongMatchKeywords
  );
  const strongFullMatches = countKeywordMatches(
    fullHaystack,
    profile.strongMatchKeywords
  );
  const supportMatches = countKeywordMatches(fullHaystack, profile.supportKeywords);
  const categoryMatches = countKeywordMatches(
    categoriesHaystack,
    profile.categoryHints
  );

  let score = 0;
  score += strongNameMatches * 4;
  score += Math.max(0, strongFullMatches - strongNameMatches) * 2;
  score += supportMatches;
  score += categoryMatches * 2;

  if (profile.kind !== "food" && profile.kind !== "generic") {
    if (includesAnyKeyword(fullHaystack, HARD_GROCERY_CHAIN_KEYWORDS)) {
      return -1;
    }

    if (
      (includesAnyKeyword(fullHaystack, SOFT_GROCERY_KEYWORDS) ||
        categoriesHaystack.includes("supermarket") ||
        categoriesHaystack.includes("convenience")) &&
      !categoriesHaystack.includes("shopping_mall") &&
      !categoriesHaystack.includes("department_store")
    ) {
      return -1;
    }
  }

  if (
    profile.kind !== "gift" &&
    profile.kind !== "collectibles" &&
    profile.kind !== "generic" &&
    (categoriesHaystack.includes("gift_and_souvenir") ||
      includesAnyKeyword(fullHaystack, GIFT_SHOP_KEYWORDS)) &&
    !categoriesHaystack.includes("shopping_mall") &&
    !categoriesHaystack.includes("department_store")
  ) {
    // Specialty party/gift shops are usually poor matches for most non-gift
    // wishlist types, so we keep them from rising to the top for items like
    // tablets, books, bags, or tools.
    return -1;
  }

  if (profile.kind === "tech") {
    if (
      categoriesHaystack.includes("department_store") ||
      categoriesHaystack.includes("shopping_mall")
    ) {
      // Big department stores and mall anchors are still plausible tablet/electronics
      // stops even when the listing is broader than a dedicated gadget shop.
      score += 2;
    }

    if (includesAnyKeyword(fullHaystack, TECH_MAJOR_RETAILER_KEYWORDS)) {
      score += 2;
    }
  }

  if (profile.kind === "books") {
    if (includesAnyKeyword(fullHaystack, BOOKSTORE_RETAILER_KEYWORDS)) {
      score += 2;
    }

    if (categoriesHaystack.includes("shopping_mall")) {
      score += 1;
    }
  }

  if (profile.kind === "bags" || profile.kind === "fashion") {
    if (includesAnyKeyword(fullHaystack, FASHION_RETAILER_KEYWORDS)) {
      score += 2;
    }

    if (
      categoriesHaystack.includes("department_store") ||
      categoriesHaystack.includes("shopping_mall")
    ) {
      score += 1;
    }
  }

  if (profile.kind === "tools") {
    if (includesAnyKeyword(fullHaystack, TOOLS_RETAILER_KEYWORDS)) {
      score += 2;
    }
  }

  if (profile.kind === "games" || profile.kind === "collectibles") {
    if (includesAnyKeyword(fullHaystack, GAMES_AND_COLLECTIBLES_KEYWORDS)) {
      score += 2;
    }

    if (
      categoriesHaystack.includes("department_store") ||
      categoriesHaystack.includes("shopping_mall")
    ) {
      score += 1;
    }
  }

  if (profile.kind === "home") {
    if (includesAnyKeyword(fullHaystack, HOME_STORE_KEYWORDS)) {
      score += 2;
    }

    if (
      categoriesHaystack.includes("department_store") ||
      categoriesHaystack.includes("shopping_mall")
    ) {
      score += 1;
    }
  }

  if (profile.kind === "food") {
    if (includesAnyKeyword(fullHaystack, FOOD_SPECIALTY_KEYWORDS)) {
      score += 2;
    }

    if (categoriesHaystack.includes("shopping_mall")) {
      score += 1;
    }
  }

  if (profile.kind === "experience") {
    if (includesAnyKeyword(fullHaystack, EXPERIENCE_PLACE_KEYWORDS)) {
      score += 2;
    }
  }

  // Nearby malls and department stores can still be useful fallback destinations,
  // but we keep them below explicit specialty stores when a stronger match exists.
  if (
    properties?.distance !== undefined &&
    Number.isFinite(properties.distance) &&
    properties.distance <= 3000
  ) {
    score += 1;
  }

  return score >= profile.minimumScore ? score : -1;
}

// Nearby store search stays server-side so the Geoapify key does not ship to the browser.
// Geoapify's free plan is enough for this early-stage feature, and we still keep Maps links
// as the final handoff so the giver can navigate to the shop they choose.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to search nearby stores.", stores: [] },
      { status: 401 }
    );
  }

  const rateLimit = await enforceRateLimit({
    action: "nearby_stores.search",
    actorUserId: user.id,
    maxAttempts: 20,
    resourceType: "nearby_store_search",
    subject: user.id,
    windowSeconds: 300,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.message, stores: [] },
      { status: 429 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid nearby store request.", stores: [] },
      { status: 400 }
    );
  }

  if (!isRequestBody(body)) {
    return NextResponse.json(
      { error: "Invalid nearby store request.", stores: [] },
      { status: 400 }
    );
  }

  const area = sanitizeText(body.area, 120);
  const latitude = isFiniteCoordinate(body.latitude) ? body.latitude : null;
  const longitude = isFiniteCoordinate(body.longitude) ? body.longitude : null;
  const queries = body.queries
    .map((query) => sanitizeText(query, 140))
    .filter(Boolean)
    .slice(0, MAX_QUERIES);

  if ((!area && (latitude === null || longitude === null)) || queries.length === 0) {
    return NextResponse.json(
      { error: "An area or current location is required.", stores: [] },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Nearby store results are not configured yet. You can still use the Maps links below for now.",
        stores: [],
      },
      { status: 503 }
    );
  }

  try {
    let searchLat = latitude;
    let searchLon = longitude;

    if (searchLat === null || searchLon === null) {
      const areaParams = new URLSearchParams({
        text: area,
        format: "geojson",
        limit: "1",
        apiKey,
      });

      const areaResponse = await fetch(
        `https://api.geoapify.com/v1/geocode/search?${areaParams.toString()}`,
        {
          cache: "no-store",
        }
      );

      if (!areaResponse.ok) {
        throw new Error(`Geoapify area search failed with status ${areaResponse.status}.`);
      }

      const areaPayload = (await areaResponse.json()) as GeoapifyGeocodeResponse;
      const areaFeature = areaPayload.features?.[0]?.properties;

      if (
        !areaFeature ||
        typeof areaFeature.lat !== "number" ||
        typeof areaFeature.lon !== "number"
      ) {
        return NextResponse.json(
          {
            error:
              "We couldn't place that area yet. Try a more specific city or district name.",
            stores: [],
          },
          { status: 404 }
        );
      }

      searchLat = areaFeature.lat;
      searchLon = areaFeature.lon;
    }

    const responses = await Promise.all(
      queries.map(async (query) => {
        const profile = getPlaceSearchProfile(query);
        const params = new URLSearchParams({
          categories: profile.categories.join(","),
          filter: `circle:${searchLon},${searchLat},15000`,
          bias: `proximity:${searchLon},${searchLat}`,
          limit: "4",
          format: "geojson",
          apiKey,
        });

        const response = await fetch(
          `https://api.geoapify.com/v2/places?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(`Geoapify places search failed with status ${response.status}.`);
        }

        const payload = (await response.json()) as GeoapifyPlacesResponse;
        return {
          profile,
          features: payload.features || [],
        };
      })
    );

    const dedupedStores = new Map<string, ScoredNearbyStoreResult>();

    for (const { profile, features } of responses) {
      for (const feature of features) {
        const properties = feature.properties;
        const key =
          properties?.place_id ||
          `${properties?.formatted || ""}-${properties?.lat || ""}-${properties?.lon || ""}`;

        if (!properties || !key) {
          continue;
        }

        const relevanceScore = scorePlaceResult(profile, properties);

        if (relevanceScore < 0) {
          continue;
        }

        const address =
          properties.formatted ||
          [properties.address_line1, properties.address_line2]
            .filter(Boolean)
            .join(", ") ||
          "Address unavailable";
        const availabilitySignal = getAvailabilitySignal(
          relevanceScore,
          properties.categories
        );

        const scoredStore: ScoredNearbyStoreResult = {
          id: key,
          name: properties.name || properties.address_line1 || "Nearby store",
          address,
          mapsUrl: buildMapsUrl(
            properties.name || properties.address_line1 || "Nearby store",
            address,
            typeof properties.lat === "number" ? properties.lat : null,
            typeof properties.lon === "number" ? properties.lon : null
          ),
          rating: null,
          userRatingCount: null,
          openNow: null,
          primaryType: getDisplayPrimaryType(properties.categories),
          availabilityBadge: availabilitySignal.badge,
          availabilityHint: availabilitySignal.hint,
          relevanceScore,
        };

        const existingStore = dedupedStores.get(key);

        if (!existingStore || scoredStore.relevanceScore > existingStore.relevanceScore) {
          dedupedStores.set(key, scoredStore);
        }
      }
    }

    return NextResponse.json({
      stores: Array.from(dedupedStores.values())
        .sort((left, right) => right.relevanceScore - left.relevanceScore)
        .slice(0, MAX_RESULTS)
        .map((store) => ({
          id: store.id,
          name: store.name,
          address: store.address,
          mapsUrl: store.mapsUrl,
          rating: store.rating,
          userRatingCount: store.userRatingCount,
          openNow: store.openNow,
          primaryType: store.primaryType,
          availabilityBadge: store.availabilityBadge,
          availabilityHint: store.availabilityHint,
        })),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "We could not load nearby stores right now. You can still use the Maps links below.",
        stores: [],
      },
      { status: 502 }
    );
  }
}
