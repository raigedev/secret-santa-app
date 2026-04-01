import { NextRequest, NextResponse } from "next/server";

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

  // We do not have a Google place_id from Geoapify, so the best handoff is a
  // Maps "place" URL anchored by both the label and the coordinates. That
  // tends to open much closer to the actual building than a plain text search.
  if (searchLabel.trim().length > 0 && typeof lat === "number" && typeof lon === "number") {
    return `https://www.google.com/maps/place/${encodeURIComponent(searchLabel)}/@${lat},${lon},18z`;
  }

  if (searchLabel.trim().length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchLabel)}`;
  }

  if (typeof lat === "number" && typeof lon === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
  }

  return "https://www.google.com/maps";
}

function getPlaceCategories(query: string): string[] {
  const haystack = query.toLowerCase();

  if (/(electronics|computer|gadget|tablet)/.test(haystack)) {
    return ["commercial.elektronics", "commercial.shopping_mall"];
  }

  if (/(book|bookstore|journal|manga|comic)/.test(haystack)) {
    return ["commercial.books", "commercial.shopping_mall"];
  }

  if (/(clothing|fashion|shirt|hoodie|dress|shoes)/.test(haystack)) {
    return ["commercial.clothing", "commercial.department_store"];
  }

  if (/(beauty|makeup|skincare|cosmetic)/.test(haystack)) {
    return [
      "commercial.health_and_beauty",
      "commercial.health_and_beauty.cosmetics",
    ];
  }

  if (/(gift|souvenir)/.test(haystack)) {
    return ["commercial.gift_and_souvenir", "commercial.department_store"];
  }

  return ["commercial.department_store", "commercial.shopping_mall"];
}

// Nearby store search stays server-side so the Geoapify key does not ship to the browser.
// Geoapify's free plan is enough for this early-stage feature, and we still keep Maps links
// as the final handoff so the giver can navigate to the shop they choose.
export async function POST(request: NextRequest) {
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
        const params = new URLSearchParams({
          categories: getPlaceCategories(query).join(","),
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
        return payload.features || [];
      })
    );

    const dedupedStores = new Map<string, NearbyStoreResult>();

    for (const features of responses) {
      for (const feature of features) {
        const properties = feature.properties;
        const key =
          properties?.place_id ||
          `${properties?.formatted || ""}-${properties?.lat || ""}-${properties?.lon || ""}`;

        if (!properties || !key || dedupedStores.has(key)) {
          continue;
        }

        const address =
          properties.formatted ||
          [properties.address_line1, properties.address_line2]
            .filter(Boolean)
            .join(", ") ||
          "Address unavailable";

        dedupedStores.set(key, {
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
          primaryType: properties.categories?.[0] || null,
        });

        if (dedupedStores.size >= MAX_RESULTS) {
          break;
        }
      }

      if (dedupedStores.size >= MAX_RESULTS) {
        break;
      }
    }

    return NextResponse.json({
      stores: Array.from(dedupedStores.values()),
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
