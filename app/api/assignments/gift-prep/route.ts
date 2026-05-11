import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/security/rate-limit";
import { isTrustedRequestOrigin } from "@/lib/security/web";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isRecord, isUuid } from "@/lib/validation/common";

const MAX_GIFT_PREP_GROUP_IDS = 50;
const GIFT_PREP_READ_RATE_LIMIT_MAX_REQUESTS = 120;
const GIFT_PREP_READ_RATE_LIMIT_WINDOW_SECONDS = 3600;

type GiftPrepRow = {
  gift_prep_status: string | null;
  gift_prep_updated_at: string | null;
  gift_received: boolean | null;
  gift_received_at: string | null;
  group_id: string;
  receiver_id: string;
};

type GiftPrepPayload = {
  rows: GiftPrepRow[];
};

export const dynamic = "force-dynamic";

function giftPrepResponse(payload: GiftPrepPayload, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(payload, {
    ...init,
    headers,
  });
}

function parseGroupIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter(isUuid))).slice(0, MAX_GIFT_PREP_GROUP_IDS);
}

export async function POST(request: Request) {
  if (!isTrustedRequestOrigin(request)) {
    return giftPrepResponse({ rows: [] }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return giftPrepResponse({ rows: [] }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return giftPrepResponse({ rows: [] }, { status: 400 });
  }

  if (!isRecord(body)) {
    return giftPrepResponse({ rows: [] }, { status: 400 });
  }

  const groupIds = parseGroupIds(body.groupIds);

  if (groupIds.length === 0) {
    return giftPrepResponse({ rows: [] });
  }

  const rateLimit = await enforceRateLimit({
    action: "assignments.gift_prep.read",
    actorUserId: user.id,
    maxAttempts: GIFT_PREP_READ_RATE_LIMIT_MAX_REQUESTS,
    resourceType: "assignment",
    subject: user.id,
    windowSeconds: GIFT_PREP_READ_RATE_LIMIT_WINDOW_SECONDS,
  });

  if (!rateLimit.allowed) {
    return giftPrepResponse(
      { rows: [] },
      {
        headers: {
          "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)),
        },
        status: 429,
      }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("assignments")
    .select(
      "group_id, receiver_id, gift_prep_status, gift_prep_updated_at, gift_received, gift_received_at"
    )
    .eq("giver_id", user.id)
    .in("group_id", groupIds);

  if (error) {
    return giftPrepResponse({ rows: [] }, { status: 500 });
  }

  return giftPrepResponse({
    rows: (data || []) as GiftPrepRow[],
  });
}
