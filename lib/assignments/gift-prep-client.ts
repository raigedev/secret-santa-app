import { isNullableString, isRecord, isUuid } from "@/lib/validation/common";
import { MAX_GIFT_PREP_GROUP_IDS } from "./gift-prep-contract";

type MyAssignmentGiftPrepRow = {
  gift_prep_status: string | null;
  gift_prep_updated_at: string | null;
  gift_received: boolean | null;
  gift_received_at: string | null;
  group_id: string;
  receiver_id: string;
  receiver_nickname: string | null;
};

type GiftPrepResponsePayload = {
  rows?: unknown;
};

type MyAssignmentGiftPrepResult = {
  data: MyAssignmentGiftPrepRow[];
  error: Error | null;
};

function isNullableBoolean(value: unknown): value is boolean | null {
  return typeof value === "boolean" || value === null;
}

function parseGiftPrepRow(value: unknown): MyAssignmentGiftPrepRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const groupId = value.group_id;
  const receiverId = value.receiver_id;

  if (
    typeof groupId !== "string" ||
    typeof receiverId !== "string" ||
    !isUuid(groupId) ||
    !isUuid(receiverId)
  ) {
    return null;
  }

  if (
    !isNullableString(value.gift_prep_status) ||
    !isNullableString(value.gift_prep_updated_at) ||
    !isNullableBoolean(value.gift_received) ||
    !isNullableString(value.gift_received_at)
  ) {
    return null;
  }

  return {
    gift_prep_status: value.gift_prep_status,
    gift_prep_updated_at: value.gift_prep_updated_at,
    gift_received: value.gift_received,
    gift_received_at: value.gift_received_at,
    group_id: groupId,
    receiver_id: receiverId,
    receiver_nickname: isNullableString(value.receiver_nickname) ? value.receiver_nickname : null,
  };
}

function parseGiftPrepRows(payload: GiftPrepResponsePayload): MyAssignmentGiftPrepRow[] {
  if (!Array.isArray(payload.rows)) {
    return [];
  }

  return payload.rows
    .map((row) => parseGiftPrepRow(row))
    .filter((row): row is MyAssignmentGiftPrepRow => Boolean(row));
}

export async function fetchMyAssignmentGiftPrep(
  groupIds: string[]
): Promise<MyAssignmentGiftPrepResult> {
  const safeGroupIds = Array.from(new Set(groupIds.filter(isUuid)));

  try {
    const rows: MyAssignmentGiftPrepRow[] = [];

    for (let offset = 0; offset < safeGroupIds.length; offset += MAX_GIFT_PREP_GROUP_IDS) {
      const response = await fetch("/api/assignments/gift-prep", {
        body: JSON.stringify({
          groupIds: safeGroupIds.slice(offset, offset + MAX_GIFT_PREP_GROUP_IDS),
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to load gift progress.");
      }

      const payload = (await response.json()) as GiftPrepResponsePayload;
      rows.push(...parseGiftPrepRows(payload));
    }

    return { data: rows, error: null };
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error : new Error("Failed to load gift progress."),
    };
  }
}
