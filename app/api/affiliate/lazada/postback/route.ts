import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { stripReservedPostbackSecrets } from "@/lib/affiliate/lazada-postback.mjs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordAuditEvent } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { extractRequestClientIp, safeEqualSecret } from "@/lib/security/web";

export const dynamic = "force-dynamic";

type PostbackPayload = Record<string, string>;
const URL_POSTBACK_AUTH_PARAM_KEYS = new Set(["secret", "token"]);

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

function getProvidedPostbackSecret(request: NextRequest, payload: PostbackPayload): string | null {
  return (
    request.headers.get("x-lazada-postback-secret") ||
    request.headers.get("x-postback-secret") ||
    getFirstPayloadValue(payload, ["token", "secret"])
  )?.trim() || null;
}

function stripUrlPostbackAuthParams(payload: PostbackPayload): PostbackPayload {
  return Object.entries(payload).reduce<PostbackPayload>((sanitizedPayload, [key, value]) => {
    if (URL_POSTBACK_AUTH_PARAM_KEYS.has(key.trim().toLowerCase())) {
      return sanitizedPayload;
    }

    sanitizedPayload[key] = value;
    return sanitizedPayload;
  }, {});
}

async function readPostbackPayload(request: NextRequest): Promise<PostbackPayload> {
  const queryPayload = stripUrlPostbackAuthParams(
    normalizePayloadObject(Object.fromEntries(request.nextUrl.searchParams.entries()))
  );

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
    return process.env.NODE_ENV !== "production";
  }

  const providedSecret = getProvidedPostbackSecret(request, payload);

  return safeEqualSecret(configuredSecret, providedSecret);
}

async function buildUnauthorizedPostbackResponse(
  request: NextRequest,
  payload: PostbackPayload
): Promise<NextResponse> {
  const clientIp = extractRequestClientIp(request.headers) || "unknown";
  const rateLimit = await enforceRateLimit({
    action: "affiliate.lazada.postback.unauthorized",
    maxAttempts: 100,
    resourceType: "affiliate_postback",
    subject: `lazada-postback:${clientIp}`,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return new NextResponse(rateLimit.message, {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)),
      },
    });
  }

  await recordAuditEvent({
    details: {
      hasProvidedSecret: Boolean(getProvidedPostbackSecret(request, payload)),
      method: request.method,
      payloadKeyCount: Object.keys(payload).length,
    },
    eventType: "affiliate.lazada.postback.unauthorized",
    outcome: "failure",
    resourceType: "affiliate_postback",
  });

  return new NextResponse("Unauthorized", { status: 401 });
}

async function handlePostback(request: NextRequest) {
  const rawPayload = await readPostbackPayload(request);

  if (!isAuthorizedPostback(request, rawPayload)) {
    return buildUnauthorizedPostbackResponse(request, rawPayload);
  }

  const clickToken = getFirstPayloadValue(rawPayload, [
    "subId6",
    "sub_id6",
    "clickToken",
    "click_token",
  ]);
  const payload = stripReservedPostbackSecrets(rawPayload);
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
      console.error("[lazada-postback] Click lookup failed", {
        errorCode: clickLookupError.code,
        errorMessage: clickLookupError.message,
        hasClickToken: true,
      });
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
    console.error("[lazada-postback] Conversion write failed", {
      errorCode: conversionError.code,
      errorMessage: conversionError.message,
      hasClickToken: Boolean(clickToken),
      mappedClick: Boolean(affiliateClickId),
    });
    return new NextResponse("Conversion write failed", { status: 500 });
  }

  await recordAuditEvent({
    details: {
      eventType,
      hasClickToken: Boolean(clickToken),
      hasExternalOrderId: Boolean(externalOrderId),
      mappedClick: Boolean(affiliateClickId),
      status: conversionStatus,
    },
    eventType: "affiliate.lazada.postback.accepted",
    outcome: "success",
    resourceId: affiliateClickId,
    resourceType: "affiliate_postback",
  });

  return new NextResponse("OK", { status: 200 });
}

export async function GET(request: NextRequest) {
  return handlePostback(request);
}

export async function POST(request: NextRequest) {
  return handlePostback(request);
}
