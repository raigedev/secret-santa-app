import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { canViewAffiliateReport } from "@/lib/affiliate/report-access";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { isTrustedRequestOrigin } from "@/lib/security/web";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LatestClickRow = {
  id: string;
  click_token: string | null;
};

function buildPayloadHash(payload: Record<string, string>): string {
  const normalized = Object.keys(payload)
    .sort((left, right) => left.localeCompare(right))
    .reduce<Record<string, string>>((accumulator, key) => {
      accumulator[key] = payload[key]!;
      return accumulator;
    }, {});

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function redirectToReport(request: NextRequest, status: string): NextResponse {
  const target = new URL("/dashboard/affiliate-report", request.url);
  target.searchParams.set("testPostback", status);

  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !canViewAffiliateReport(user.email)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const rateLimit = await enforceRateLimit({
    action: "affiliate.lazada.test_postback",
    actorUserId: user.id,
    maxAttempts: 5,
    resourceType: "affiliate_test_postback",
    subject: user.id,
    windowSeconds: 300,
  });

  if (!rateLimit.allowed) {
    return redirectToReport(request, "rate_limited");
  }

  const { data: latestClick, error: clickError } = await supabaseAdmin
    .from("affiliate_clicks")
    .select("id, click_token")
    .eq("merchant", "lazada")
    .not("click_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (clickError) {
    console.error("[lazada-test-postback] Failed to find latest click", {
      errorCode: clickError.code,
      errorMessage: clickError.message,
    });
    return redirectToReport(request, "click_lookup_failed");
  }

  const click = latestClick as LatestClickRow | null;

  if (!click?.click_token) {
    return redirectToReport(request, "missing_click");
  }

  const payload = {
    amount: "0",
    offer_id: "debug-owner-health-check",
    payout: "0",
    status: "debug-test",
    sub_id6: click.click_token,
    transaction_id: `debug-${click.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`,
  };

  const { error: conversionError } = await supabaseAdmin.from("affiliate_conversions").upsert(
    {
      affiliate_click_id: click.id,
      amount: 0,
      click_token: click.click_token,
      conversion_status: "debug-test",
      event_type: "debug",
      external_order_id: payload.transaction_id,
      merchant: "lazada",
      offer_id: payload.offer_id,
      payload_hash: buildPayloadHash(payload),
      payout: 0,
      raw_payload: payload,
    },
    {
      onConflict: "payload_hash",
    }
  );

  if (conversionError) {
    console.error("[lazada-test-postback] Failed to write test conversion", {
      errorCode: conversionError.code,
      errorMessage: conversionError.message,
    });
    return redirectToReport(request, "write_failed");
  }

  return redirectToReport(request, "created");
}
