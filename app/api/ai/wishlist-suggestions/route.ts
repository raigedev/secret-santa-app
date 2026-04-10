import { NextRequest, NextResponse } from "next/server";

import { generateGeminiWishlistSuggestionDrafts, isGeminiWishlistConfigured } from "@/lib/ai/gemini";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  buildAiWishlistSuggestionOptions,
  buildWishlistSuggestionOptions,
  type ShoppingRegion,
  type SuggestionInput,
} from "@/lib/wishlist/suggestions";

type WishlistSuggestionBody = {
  currency?: unknown;
  groupBudget?: unknown;
  groupId?: unknown;
  itemCategory?: unknown;
  itemName?: unknown;
  itemNote?: unknown;
  preferredPriceMax?: unknown;
  preferredPriceMin?: unknown;
  region?: unknown;
  wishlistItemId?: unknown;
};

function sanitizeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function sanitizeOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isShoppingRegion(value: string): value is ShoppingRegion {
  return ["AU", "CA", "GLOBAL", "JP", "PH", "UK", "US"].includes(value);
}

function buildSuggestionInput(body: WishlistSuggestionBody): SuggestionInput | null {
  const groupId = sanitizeString(body.groupId, 120);
  const wishlistItemId = sanitizeString(body.wishlistItemId, 120);
  const itemName = sanitizeString(body.itemName, 120);
  const itemCategory = sanitizeString(body.itemCategory, 60);
  const itemNote = sanitizeString(body.itemNote, 240);
  const currency = sanitizeString(body.currency, 12) || null;

  if (!groupId || !wishlistItemId || !itemName) {
    return null;
  }

  return {
    groupId,
    wishlistItemId,
    itemName,
    itemCategory,
    itemNote,
    preferredPriceMin: sanitizeOptionalNumber(body.preferredPriceMin),
    preferredPriceMax: sanitizeOptionalNumber(body.preferredPriceMax),
    groupBudget: sanitizeOptionalNumber(body.groupBudget),
    currency,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", suggestions: [], usedAi: false }, { status: 401 });
  }

  if (!isGeminiWishlistConfigured()) {
    return NextResponse.json({ suggestions: [], usedAi: false });
  }

  const rateLimit = await enforceRateLimit({
    action: "wishlist_ai_suggestions.generate",
    actorUserId: user.id,
    maxAttempts: 18,
    resourceType: "wishlist_ai_suggestion",
    subject: user.id,
    windowSeconds: 300,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.message, suggestions: [], usedAi: false },
      { status: 429 }
    );
  }

  let body: WishlistSuggestionBody;

  try {
    body = (await request.json()) as WishlistSuggestionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", suggestions: [], usedAi: false }, { status: 400 });
  }

  const region = sanitizeString(body.region, 12);
  const suggestionInput = buildSuggestionInput(body);

  if (!suggestionInput || !isShoppingRegion(region) || region !== "PH") {
    return NextResponse.json({ suggestions: [], usedAi: false });
  }

  const baseOptions = buildWishlistSuggestionOptions(suggestionInput);
  const aiDrafts = await generateGeminiWishlistSuggestionDrafts({
    suggestionInput,
    baseOptions,
  });
  const suggestions = buildAiWishlistSuggestionOptions(suggestionInput, aiDrafts);

  return NextResponse.json({
    suggestions,
    usedAi: suggestions.length > 0,
  });
}
