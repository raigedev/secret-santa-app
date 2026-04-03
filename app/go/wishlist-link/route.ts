import { NextRequest, NextResponse } from "next/server";

import { resolveLazadaWishlistItemLinkTarget } from "@/lib/affiliate/lazada";
import { normalizeLazadaProductPageUrl } from "@/lib/affiliate/lazada-url";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const groupId = searchParams.get("groupId");
  const wishlistItemId = searchParams.get("itemId");
  const itemName = searchParams.get("name")?.trim() || "Wishlist item";
  const itemUrl = searchParams.get("url")?.trim() || "";

  const normalizedItemUrl = normalizeLazadaProductPageUrl(itemUrl);

  if (!groupId || !wishlistItemId || !normalizedItemUrl) {
    return NextResponse.redirect(new URL("/secret-santa", request.url));
  }

  const lazadaTarget = await resolveLazadaWishlistItemLinkTarget({
    fallbackUrl: normalizedItemUrl,
    itemName,
    itemUrl: normalizedItemUrl,
  });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabaseAdmin.from("affiliate_clicks").insert({
      user_id: user?.id || null,
      group_id: groupId,
      wishlist_item_id: wishlistItemId,
      merchant: "lazada",
      suggestion_title: itemName.slice(0, 120),
      search_query: normalizedItemUrl.slice(0, 200),
      target_url: lazadaTarget.targetUrl.slice(0, 1000),
    });
  } catch {
    // Tracking should never block the shopper from reaching Lazada.
  }

  return NextResponse.redirect(lazadaTarget.targetUrl);
}
