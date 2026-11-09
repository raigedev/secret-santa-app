import { MAX_GIFT_PREP_GROUP_IDS } from "@/lib/assignments/gift-prep-contract";
import {
  isEmailDerivedGroupNickname,
  sanitizeGroupNickname,
  validateAnonymousGroupNickname,
} from "@/lib/groups/nickname";
import { noStoreJson } from "@/lib/security/no-store-response";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readLimitedJsonBody } from "@/lib/security/request-body";
import { isTrustedRequestOrigin } from "@/lib/security/web";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isRecord, isUuid } from "@/lib/validation/common";

const GIFT_PREP_BODY_LIMIT_BYTES = 8 * 1024;
// This authenticated read path is shared by dashboard, history, and gift screens.
// Keep it bounded, but high enough for normal navigation and full browser smoke runs.
const GIFT_PREP_READ_RATE_LIMIT_MAX_REQUESTS = 600;
const GIFT_PREP_READ_RATE_LIMIT_WINDOW_SECONDS = 3600;
const MEMBER_LOOKUP_PAGE_SIZE = 500;

type GiftPrepRow = {
  gift_prep_status: string | null;
  gift_prep_updated_at: string | null;
  gift_received: boolean | null;
  gift_received_at: string | null;
  group_id: string;
  receiver_id: string;
  receiver_nickname: string | null;
};

type GiftPrepPayload = {
  rows: GiftPrepRow[];
};

export const dynamic = "force-dynamic";

function giftPrepResponse(payload: GiftPrepPayload, init?: ResponseInit) {
  return noStoreJson(payload, init);
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

  const bodyResult = await readLimitedJsonBody<unknown>(request, GIFT_PREP_BODY_LIMIT_BYTES);

  if (!bodyResult.ok) {
    return giftPrepResponse(
      { rows: [] },
      { status: bodyResult.error === "too-large" ? 413 : 400 }
    );
  }

  if (!isRecord(bodyResult.body)) {
    return giftPrepResponse({ rows: [] }, { status: 400 });
  }

  const groupIds = parseGroupIds(bodyResult.body.groupIds);

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

  const { data: assignments, error } = await supabaseAdmin
    .from("assignments")
    .select(
      "group_id, receiver_id, gift_prep_status, gift_prep_updated_at, gift_received, gift_received_at"
    )
    .eq("giver_id", user.id)
    .in("group_id", groupIds);

  if (error) {
    return giftPrepResponse({ rows: [] }, { status: 500 });
  }

  if (!assignments?.length) {
    return giftPrepResponse({ rows: [] });
  }

  const receiverByGroup = new Map(assignments.map((row) => [row.group_id, row.receiver_id]));
  const memberUserIds = [...new Set([user.id, ...receiverByGroup.values()])];
  const joinedGroups = new Set<string>();
  const nicknameByGroup = new Map<string, string>();

  // The client-facing roster hides peer identities in alias groups. Match the caller's
  // own assignments here and return only the recipient's group display label.
  for (let offset = 0; ; offset += MEMBER_LOOKUP_PAGE_SIZE) {
    const { data: members, error: memberError } = await supabaseAdmin
      .from("group_members")
      .select("group_id, user_id, nickname, email, groups!inner(require_anonymous_nickname)")
      .in("group_id", [...receiverByGroup.keys()])
      .in("user_id", memberUserIds)
      .eq("status", "accepted")
      .order("id")
      .range(offset, offset + MEMBER_LOOKUP_PAGE_SIZE - 1);

    if (memberError) {
      return giftPrepResponse({ rows: [] }, { status: 500 });
    }

    for (const member of members) {
      if (member.user_id === user.id) {
        joinedGroups.add(member.group_id);
      }
      if (member.user_id !== receiverByGroup.get(member.group_id)) {
        continue;
      }

      const nickname = sanitizeGroupNickname(member.nickname || "");
      const namesVisible = isRecord(member.groups) &&
        (member.groups.require_anonymous_nickname === false ||
          member.groups.require_anonymous_nickname === null);
      const safeAlias = !isEmailDerivedGroupNickname(nickname, member.email) &&
        !validateAnonymousGroupNickname({ nickname, email: member.email });
      if (nickname && (namesVisible || safeAlias)) {
        nicknameByGroup.set(member.group_id, nickname);
      }
    }

    if (members.length < MEMBER_LOOKUP_PAGE_SIZE) {
      break;
    }
  }

  return giftPrepResponse({
    rows: assignments
      .filter((assignment) => joinedGroups.has(assignment.group_id))
      .map((assignment) => ({
        ...assignment,
        receiver_nickname: nicknameByGroup.get(assignment.group_id) ?? null,
      })),
  });
}
