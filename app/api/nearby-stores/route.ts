import { NextRequest, NextResponse } from "next/server";

type NearbyStoresRequest = {
  area: string;
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

function buildMapsUrl(lat: number | null, lon: number | null, fallbackLabel: string): string {
  if (typeof lat === "number" && typeof lon === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
  }

  return `https://www.google.com/maps/search/${encodeURIComponent(fallbackLabel)}`;
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
  const queries = body.queries
    .map((query) => sanitizeText(query, 140))
    .filter(Boolean)
    .slice(0, MAX_QUERIES);

  if (!area || queries.length === 0) {
    return NextResponse.json(
      { error: "Area and store queries are required.", stores: [] },
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
    const responses = await Promise.all(
      queries.map(async (query) => {
        const textQuery = `${query} ${area}`;
        const params = new URLSearchParams({
          text: textQuery,
          type: "amenity",
          limit: "4",
          format: "geojson",
          apiKey,
        });

        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/search?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(`Geoapify search failed with status ${response.status}.`);
        }

        const payload = (await response.json()) as GeoapifyGeocodeResponse;
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
            typeof properties.lat === "number" ? properties.lat : null,
            typeof properties.lon === "number" ? properties.lon : null,
            address
          ),
          rating: null,
          userRatingCount: null,
          openNow: null,
          primaryType: properties.categories?.[0] || properties.result_type || null,
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
