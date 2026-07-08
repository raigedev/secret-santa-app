import { createHash } from "crypto";
import { NextRequest } from "next/server";

import { stripReservedPostbackSecrets } from "@/lib/affiliate/lazada-postback.mjs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordAuditEvent, recordServerFailure } from "@/lib/security/audit";
import { noStoreText } from "@/lib/security/no-store-response";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readLimitedTextBody } from "@/lib/security/request-body";
import { safeEqualSecret } from "@/lib/security/web";

export const dynamic = "force-dynamic";

type PostbackPayload = Record<string, string>;
type PostbackPayloadReadResult =
  | {
      ok: true;
      payload: PostbackPayload;
    }
  | {
      ok: false;
      response: Response;
    };

const URL_POSTBACK_AUTH_PARAM_KEYS = new Set(["secret", "token"]);
const UNAUTHORIZED_POSTBACK_RATE_LIMIT_SUBJECT = "lazada-postback:unauthorized";
const MAX_POSTBACK_BODY_BYTES = 64 * 1024;

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

function normalizeIdempotencyPart(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function buildPostbackIdempotencyKey({
  externalOrderId,
  merchant,
  payloadHash,
}: {
  externalOrderId: string | null;
  merchant: string;
  payloadHash: string;
}): string {
  const normalizedOrderId = normalizeIdempotencyPart(externalOrderId);

  if (normalizedOrderId) {
    return `${merchant}:order:${normalizedOrderId}`;
  }

  return `${merchant}:payload:${payloadHash}`;
}

function isMissingIdempotencySchemaError(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const message = error.message || "";
  return (
    error.code === "42P10" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /idempotency_key|unique or exclusion constraint|schema cache/i.test(message)
  );
}

function removeIdempotencyKey<T extends { idempotency_key: string }>(
  payload: T
): Omit<T, "idempotency_key"> {
  const legacyPayload = { ...payload };
  delete (legacyPayload as Partial<T>).idempotency_key;
  return legacyPayload;
}

function getProvidedPostbackSecret(request: NextRequest): string | null {
  return (
    request.headers.get("x-lazada-postback-secret") ||
    request.headers.get("x-postback-secret")
  )?.trim() || null;
}

function stripPayloadPostbackAuthParams(payload: PostbackPayload): PostbackPayload {
  return Object.entries(payload).reduce<PostbackPayload>((sanitizedPayload, [key, value]) => {
    if (URL_POSTBACK_AUTH_PARAM_KEYS.has(key.trim().toLowerCase())) {
      return sanitizedPayload;
    }

    sanitizedPayload[key] = value;
    return sanitizedPayload;
  }, {});
}

async function readPostbackPayload(request: NextRequest): Promise<PostbackPayloadReadResult> {
  const queryPayload = stripPayloadPostbackAuthParams(
    normalizePayloadObject(Object.fromEntries(request.nextUrl.searchParams.entries()))
  );

  if (request.method === "GET") {
    return { ok: true, payload: queryPayload };
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  try {
    const bodyRead = await readLimitedTextBody(request, MAX_POSTBACK_BODY_BYTES);

    if (!bodyRead.ok) {
      return {
        ok: false,
        response: noStoreText(
          bodyRead.error === "too-large" ? "Postback body too large" : "Invalid postback payload",
          { status: bodyRead.error === "too-large" ? 413 : 400 }
        ),
      };
    }

    const parsedText = bodyRead.text.trim();

    if (parsedText.length === 0) {
      return { ok: true, payload: queryPayload };
    }

    if (contentType.includes("application/json")) {
      const json = JSON.parse(parsedText) as Record<string, unknown>;
      return {
        ok: true,
        payload: stripPayloadPostbackAuthParams({
          ...queryPayload,
          ...normalizePayloadObject(json),
        }),
      };
    }

    if (contentType.includes("multipart/form-data")) {
      return {
        ok: false,
        response: noStoreText("Unsupported postback content type", { status: 415 }),
      };
    }

    const params = new URLSearchParams(parsedText);

    return {
      ok: true,
      payload: stripPayloadPostbackAuthParams({
        ...queryPayload,
        ...normalizePayloadObject(Object.fromEntries(params.entries())),
      }),
    };
  } catch {
    return {
      ok: false,
      response: noStoreText("Invalid postback payload", { status: 400 }),
    };
  }
}

function isAuthorizedPostback(request: NextRequest): boolean {
  const configuredSecret = process.env.LAZADA_POSTBACK_SECRET?.trim();

  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const providedSecret = getProvidedPostbackSecret(request);

  return safeEqualSecret(configuredSecret, providedSecret);
}

function getPostbackBodyPreflightResponse(request: NextRequest): Response | null {
  if (request.method === "GET") {
    return null;
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_POSTBACK_BODY_BYTES) {
    return noStoreText("Postback body too large", { status: 413 });
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes("multipart/form-data")) {
    return noStoreText("Unsupported postback content type", { status: 415 });
  }

  return null;
}

async function buildUnauthorizedPostbackResponse(request: NextRequest): Promise<Response> {
  const rateLimit = await enforceRateLimit({
    action: "affiliate.lazada.postback.unauthorized",
    maxAttempts: 100,
    resourceType: "affiliate_postback",
    // Public forwarding headers are not a reliable identity signal, so keep
    // unauthenticated postback failures in one route-wide abuse bucket.
    subject: UNAUTHORIZED_POSTBACK_RATE_LIMIT_SUBJECT,
    windowSeconds: 3600,
  });

  if (!rateLimit.allowed) {
    return noStoreText(rateLimit.message, {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)),
      },
    });
  }

  await recordAuditEvent({
    details: {
      hasProvidedSecret: Boolean(getProvidedPostbackSecret(request)),
      method: request.method,
      queryParamCount: request.nextUrl.searchParams.size,
    },
    eventType: "affiliate.lazada.postback.unauthorized",
    outcome: "failure",
    resourceType: "affiliate_postback",
  });

  return noStoreText("Unauthorized", { status: 401 });
}

async function handlePostback(request: NextRequest) {
  if (!isAuthorizedPostback(request)) {
    return buildUnauthorizedPostbackResponse(request);
  }

  const preflightResponse = getPostbackBodyPreflightResponse(request);
  if (preflightResponse) {
    return preflightResponse;
  }

  const payloadRead = await readPostbackPayload(request);
  if (!payloadRead.ok) {
    return payloadRead.response;
  }

  const rawPayload = payloadRead.payload;

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
  const idempotencyKey = buildPostbackIdempotencyKey({
    externalOrderId,
    merchant: "lazada",
    payloadHash,
  });

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
      await recordServerFailure({
        details: {
          dbCode: clickLookupError.code,
          hasClickToken: true,
        },
        errorMessage: clickLookupError.message,
        eventType: "affiliate.lazada.postback.click_lookup_failed",
        resourceType: "affiliate_conversion",
      });
      return noStoreText("Click lookup failed", { status: 500 });
    }

    affiliateClickId = matchingClick?.id || null;
  }

  const conversionPayload = {
    affiliate_click_id: affiliateClickId,
    amount,
    click_token: clickToken,
    conversion_status: conversionStatus,
    currency,
    event_type: eventType,
    external_click_id: externalClickId,
    external_order_id: externalOrderId,
    idempotency_key: idempotencyKey,
    merchant: "lazada",
    offer_id: offerId,
    payload_hash: payloadHash,
    payout,
    raw_payload: payload,
  };
  let { error: conversionError } = await supabaseAdmin.from("affiliate_conversions").upsert(
    conversionPayload,
    {
      onConflict: "idempotency_key",
    }
  );

  if (conversionError && isMissingIdempotencySchemaError(conversionError)) {
    const legacyConversionPayload = removeIdempotencyKey(conversionPayload);
    const fallbackResult = await supabaseAdmin.from("affiliate_conversions").upsert(
      legacyConversionPayload,
      {
        onConflict: "payload_hash",
      }
    );
    conversionError = fallbackResult.error;
  }

  if (conversionError) {
    await recordServerFailure({
      details: {
        dbCode: conversionError.code,
        hasClickToken: Boolean(clickToken),
        mappedClick: Boolean(affiliateClickId),
      },
      errorMessage: conversionError.message,
      eventType: "affiliate.lazada.postback.conversion_write_failed",
      resourceType: "affiliate_conversion",
    });
    return noStoreText("Conversion write failed", { status: 500 });
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

  return noStoreText("OK", { status: 200 });
}

export async function GET(request: NextRequest) {
  return handlePostback(request);
}

export async function POST(request: NextRequest) {
  return handlePostback(request);
}
