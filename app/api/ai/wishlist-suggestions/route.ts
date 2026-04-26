import { NextRequest, NextResponse } from "next/server";

import { generateGeminiWishlistSuggestionDrafts, isGeminiWishlistConfigured } from "@/lib/ai/gemini";
import {
  generateOpenRouterWishlistSuggestionDrafts,
  isOpenRouterWishlistConfigured,
} from "@/lib/ai/openrouter";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  isSupportedShoppingRegion,
  sanitizeCompactString,
  sanitizeOptionalNumber,
} from "@/lib/validation/common";
import {
  buildAiWishlistSuggestionOptions,
  buildWishlistSuggestionOptions,
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

type WishlistAiProvider = "gemini" | "openrouter" | null;

function buildSuggestionInput(body: WishlistSuggestionBody): SuggestionInput | null {
  const groupId = sanitizeCompactString(body.groupId, 120);
  const wishlistItemId = sanitizeCompactString(body.wishlistItemId, 120);
  const itemName = sanitizeCompactString(body.itemName, 120);
  const itemCategory = sanitizeCompactString(body.itemCategory, 60);
  const itemNote = sanitizeCompactString(body.itemNote, 240);
  const currency = sanitizeCompactString(body.currency, 12) || null;

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

function isWishlistAiConfigured(): boolean {
  return isGeminiWishlistConfigured() || isOpenRouterWishlistConfigured();
}

async function generateWishlistSuggestionDrafts(input: {
  baseOptions: ReturnType<typeof buildWishlistSuggestionOptions>;
  suggestionInput: SuggestionInput;
}): Promise<{
  drafts: Awaited<ReturnType<typeof generateGeminiWishlistSuggestionDrafts>>;
  provider: WishlistAiProvider;
}> {
  const geminiDrafts = await generateGeminiWishlistSuggestionDrafts(input);

  if (geminiDrafts.length > 0) {
    return { drafts: geminiDrafts, provider: "gemini" };
  }

  const openRouterDrafts = await generateOpenRouterWishlistSuggestionDrafts(input);

  if (openRouterDrafts.length > 0) {
    return { drafts: openRouterDrafts, provider: "openrouter" };
  }

  return { drafts: [], provider: null };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", suggestions: [], usedAi: false }, { status: 401 });
  }

  if (!isWishlistAiConfigured()) {
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

  const region = sanitizeCompactString(body.region, 12);
  const suggestionInput = buildSuggestionInput(body);

  if (!suggestionInput || !isSupportedShoppingRegion(region) || region !== "PH") {
    return NextResponse.json({ suggestions: [], usedAi: false });
  }

  const baseOptions = buildWishlistSuggestionOptions(suggestionInput);
  const { drafts: aiDrafts, provider: aiProvider } = await generateWishlistSuggestionDrafts({
    suggestionInput,
    baseOptions,
  });
  const aiSuggestions = buildAiWishlistSuggestionOptions(suggestionInput, aiDrafts);
  
  // If AI times out or fails, always show base suggestions so UI doesn't get stuck
  const suggestions = aiSuggestions.length > 0 ? aiSuggestions : baseOptions;

  return NextResponse.json({
    aiProvider,
    suggestions,
    usedAi: aiSuggestions.length > 0,
  });
}
