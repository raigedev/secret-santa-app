import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildMerchantDestinationUrl,
  SuggestionMerchant,
} from "@/lib/wishlist/suggestions";

const ALLOWED_MERCHANTS: SuggestionMerchant[] = ["lazada", "shopee"];

function isSuggestionMerchant(value: string | null): value is SuggestionMerchant {
  return Boolean(value) && ALLOWED_MERCHANTS.includes(value as SuggestionMerchant);
}

// Suggestion clicks are routed through the app so we can log them before handing the user
// off to Lazada or Shopee. The route only builds destinations for known merchants, which
// avoids turning it into a generic open redirect endpoint.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const merchant = searchParams.get("merchant");
  const groupId = searchParams.get("groupId");
  const wishlistItemId = searchParams.get("itemId");
  const searchQuery = searchParams.get("q")?.trim() || "";
  const suggestionTitle = searchParams.get("title")?.trim() || "Suggested gift";

  if (
    !isSuggestionMerchant(merchant) ||
    !groupId ||
    !wishlistItemId ||
    searchQuery.length === 0
  ) {
    return NextResponse.redirect(new URL("/secret-santa", request.url));
  }

  const targetUrl = buildMerchantDestinationUrl(merchant, searchQuery);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabaseAdmin.from("affiliate_clicks").insert({
      user_id: user?.id || null,
      group_id: groupId,
      wishlist_item_id: wishlistItemId,
      merchant,
      suggestion_title: suggestionTitle.slice(0, 120),
      search_query: searchQuery.slice(0, 200),
      target_url: targetUrl.slice(0, 1000),
    });
  } catch {
    // Click tracking should never block the user from reaching the merchant page.
  }

  return NextResponse.redirect(targetUrl);
}
