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

type GooglePlacesSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    currentOpeningHours?: { openNow?: boolean };
    primaryTypeDisplayName?: { text?: string };
  }>;
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

// Nearby store search is intentionally server-side so the API key stays private
// and we can normalize results before the client renders them.
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

  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Nearby store search is not configured yet. Add GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY to enable in-app results.",
        stores: [],
      },
      { status: 503 }
    );
  }

  try {
    const responses = await Promise.all(
      queries.map(async (query) => {
        const textQuery = `${query} ${area}`;
        const response = await fetch(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.primaryTypeDisplayName",
            },
            body: JSON.stringify({
              textQuery,
              maxResultCount: 4,
            }),
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(`Places search failed with status ${response.status}.`);
        }

        const payload =
          (await response.json()) as GooglePlacesSearchResponse;

        return payload.places || [];
      })
    );

    const dedupedStores = new Map<string, NearbyStoreResult>();

    for (const places of responses) {
      for (const place of places) {
        const key = place.id || place.googleMapsUri || place.formattedAddress || "";

        if (!key || dedupedStores.has(key)) {
          continue;
        }

        dedupedStores.set(key, {
          id: key,
          name: place.displayName?.text || "Nearby store",
          address: place.formattedAddress || "Address unavailable",
          mapsUrl: place.googleMapsUri || "https://maps.google.com",
          rating:
            typeof place.rating === "number" ? place.rating : null,
          userRatingCount:
            typeof place.userRatingCount === "number"
              ? place.userRatingCount
              : null,
          openNow:
            typeof place.currentOpeningHours?.openNow === "boolean"
              ? place.currentOpeningHours.openNow
              : null,
          primaryType: place.primaryTypeDisplayName?.text || null,
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
