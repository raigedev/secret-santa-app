import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PostbackPayload = Record<string, string>;

function normalizePayloadValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => normalizePayloadValue(entry))
      .filter((entry): entry is string => Boolean(entry))
      .join(",");

    return joined || null;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePayloadObject(input: Record<string, unknown>): PostbackPayload {
  return Object.entries(input).reduce<PostbackPayload>((accumulator, [key, value]) => {
    const normalizedValue = normalizePayloadValue(value);

    if (!normalizedValue) {
      return accumulator;
    }

    accumulator[key] = normalizedValue;
    return accumulator;
  }, {});
}

function getFirstPayloadValue(payload: PostbackPayload, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];

    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function parseOptionalAmount(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^0-9.-]/g, "");
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPayloadHash(payload: PostbackPayload): string {
  const normalized = Object.keys(payload)
    .sort((left, right) => left.localeCompare(right))
    .reduce<Record<string, string>>((accumulator, key) => {
      accumulator[key] = payload[key];
      return accumulator;
    }, {});

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

async function readPostbackPayload(request: NextRequest): Promise<PostbackPayload> {
  const queryPayload = normalizePayloadObject(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (request.method === "GET") {
    return queryPayload;
  }

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      return {
        ...queryPayload,
        ...normalizePayloadObject(json),
      };
    }

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      return {
        ...queryPayload,
        ...normalizePayloadObject(Object.fromEntries(formData.entries())),
      };
    }

    const rawText = await request.text();
    const parsedText = rawText.trim();

    if (parsedText.length === 0) {
      return queryPayload;
    }

    const params = new URLSearchParams(parsedText);

    return {
      ...queryPayload,
      ...normalizePayloadObject(Object.fromEntries(params.entries())),
    };
  } catch {
    return queryPayload;
  }
}

function isAuthorizedPostback(request: NextRequest, payload: PostbackPayload): boolean {
  const configuredSecret = process.env.LAZADA_POSTBACK_SECRET?.trim();

  if (!configuredSecret) {
    return true;
  }

  const providedSecret =
    getFirstPayloadValue(payload, ["token", "secret"]) ||
    request.headers.get("x-lazada-postback-secret") ||
    request.headers.get("x-postback-secret");

  return providedSecret === configuredSecret;
}

async function handlePostback(request: NextRequest) {
  const payload = await readPostbackPayload(request);

  if (!isAuthorizedPostback(request, payload)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const clickToken = getFirstPayloadValue(payload, [
    "subId6",
    "sub_id6",
    "clickToken",
    "click_token",
  ]);
  const eventType =
    getFirstPayloadValue(payload, ["eventType", "event_type", "type", "postbackType"]) ||
    "order";
  const conversionStatus = getFirstPayloadValue(payload, [
    "status",
    "orderStatus",
    "order_status",
    "conversionStatus",
    "conversion_status",
    "action",
    "state",
  ]);
  const externalOrderId = getFirstPayloadValue(payload, [
    "transactionId",
    "transaction_id",
    "orderId",
    "order_id",
    "tid",
    "ref_id",
  ]);
  const externalClickId = getFirstPayloadValue(payload, [
    "clickid",
    "click_id",
    "refId",
    "ref_id",
  ]);
  const offerId = getFirstPayloadValue(payload, ["offerId", "offer_id", "_p_offer"]);
  const currency = getFirstPayloadValue(payload, ["currency", "currencyCode", "currency_code"]);
  const amount = parseOptionalAmount(
    getFirstPayloadValue(payload, [
      "amount",
      "saleAmount",
      "sale_amount",
      "payAmount",
      "pay_amount",
      "_p_pay_amount",
    ])
  );
  const payout = parseOptionalAmount(
    getFirstPayloadValue(payload, [
      "payout",
      "commission",
      "payoutAmount",
      "payout_amount",
      "_p_payout",
    ])
  );
  const payloadHash = buildPayloadHash(payload);

  let affiliateClickId: string | null = null;

  if (clickToken) {
    const { data: matchingClick, error: clickLookupError } = await supabaseAdmin
      .from("affiliate_clicks")
      .select("id")
      .eq("merchant", "lazada")
      .eq("click_token", clickToken)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (clickLookupError) {
      return new NextResponse("Click lookup failed", { status: 500 });
    }

    affiliateClickId = matchingClick?.id || null;
  }

  const { error: conversionError } = await supabaseAdmin.from("affiliate_conversions").upsert(
    {
      affiliate_click_id: affiliateClickId,
      amount,
      click_token: clickToken,
      conversion_status: conversionStatus,
      currency,
      event_type: eventType,
      external_click_id: externalClickId,
      external_order_id: externalOrderId,
      merchant: "lazada",
      offer_id: offerId,
      payload_hash: payloadHash,
      payout,
      raw_payload: payload,
    },
    {
      onConflict: "payload_hash",
    }
  );

  if (conversionError) {
    return new NextResponse("Conversion write failed", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}

export async function GET(request: NextRequest) {
  return handlePostback(request);
}

export async function POST(request: NextRequest) {
  return handlePostback(request);
}
