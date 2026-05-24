import "server-only";

import { recordServerFailure } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AffiliateClickInsert = {
  catalog_source?: string | null;
  click_token?: string | null;
  fit_label?: string | null;
  group_id: string;
  merchant: string;
  resolution_mode?: string | null;
  resolution_reason?: string | null;
  search_query: string;
  selected_query?: string | null;
  suggestion_title: string;
  target_url: string;
  tracking_label?: string | null;
  user_id: string | null;
  wishlist_item_id: string;
};

type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function readTargetHost(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

async function logAffiliateClickInsertError(
  error: SupabaseErrorLike,
  payload: AffiliateClickInsert,
  phase: "primary" | "legacy-fallback"
) {
  await recordServerFailure({
    actorUserId: payload.user_id,
    details: {
      catalogSource: payload.catalog_source || null,
      dbCode: error.code || null,
      hasClickToken: Boolean(payload.click_token),
      merchant: payload.merchant,
      phase,
      resolutionMode: payload.resolution_mode || null,
      targetHost: readTargetHost(payload.target_url),
    },
    errorMessage: error.message || "Unknown Supabase insert error",
    eventType: "affiliate.click.insert_failed",
    resourceId: payload.wishlist_item_id,
    resourceType: "affiliate_click",
  });
}

function isMissingSelectedQueryColumn(error: SupabaseErrorLike): boolean {
  const errorText = [
    error.code,
    error.details,
    error.hint,
    error.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    errorText.includes("selected_query") &&
    (errorText.includes("column") || errorText.includes("schema cache"))
  );
}

// Some production databases may not have the optional reporting column yet.
// Tracking should still record the click, then the report can fall back to
// deriving the selected query from the older search_query field.
export async function insertAffiliateClick(
  payload: AffiliateClickInsert
): Promise<void> {
  const { error } = await supabaseAdmin.from("affiliate_clicks").insert(payload);

  if (!error) {
    return;
  }

  if (payload.selected_query !== undefined && isMissingSelectedQueryColumn(error)) {
    const legacyPayload: AffiliateClickInsert = { ...payload };
    delete legacyPayload.selected_query;
    const { error: legacyError } = await supabaseAdmin
      .from("affiliate_clicks")
      .insert(legacyPayload);

    if (!legacyError) {
      return;
    }

    await logAffiliateClickInsertError(legacyError, legacyPayload, "legacy-fallback");
    throw legacyError;
  }

  await logAffiliateClickInsertError(error, payload, "primary");
  throw error;
}
