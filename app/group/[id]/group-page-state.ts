import {
  getAnonymousGroupDisplayName,
  isEmailDerivedGroupNickname,
} from "@/lib/groups/nickname";
import {
  forEachSessionStorageKey,
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from "@/lib/client-snapshot";
import { isNullableNumber, isNullableString, isRecord } from "@/lib/validation/common";

export type Member = {
  id: string;
  user_id: string | null;
  nickname: string | null;
  email: string | null;
  role: string;
  status: string;
};

export type GroupData = {
  name: string;
  description: string | null;
  event_date: string;
  image_url: string | null;
  owner_id: string;
  budget: number | null;
  currency: string | null;
  require_anonymous_nickname: boolean;
  revealed: boolean;
  revealed_at: string | null;
};

export type Assignment = {
  receiver_nickname: string;
};

export type RevealMatch = {
  giver: string;
  receiver: string;
};

export type OwnerInsights = {
  acceptedCount: number;
  wishlistReadyCount: number;
  missingWishlistMemberNames: string[];
  confirmedGiftCount: number;
  totalGiftCount: number;
};

export type GroupRecap = {
  aliasRoster: Array<{
    alias: string;
    avatarEmoji: string;
    realName: string;
  }>;
  confirmedGiftCount: number;
  participantCount: number;
  totalGiftCount: number;
  wishlistMissingAliases: string[];
  wishlistReadyCount: number;
};

export type DrawExclusionRule = {
  createdAt: string;
  giverNickname: string;
  giverUserId: string;
  id: string;
  receiverNickname: string;
  receiverUserId: string;
};

export type DrawCycleHistoryItem = {
  assignmentCount: number;
  avoidPreviousRecipient: boolean;
  createdAt: string;
  cycleNumber: number;
  id: string;
  repeatAvoidanceRelaxed: boolean;
};

export type DrawResetHistoryItem = {
  assignmentCount: number;
  confirmedGiftCount: number;
  createdAt: string;
  id: string;
  reason: string;
};

export type GroupPageSnapshot = {
  assignment: Assignment | null;
  createdAt: number;
  currentUserId: string;
  drawDone: boolean;
  groupData: GroupData;
  groupId: string;
  isOwner: boolean;
  members: Member[];
  userId: string;
};

const GROUP_PAGE_SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const GROUP_PAGE_SNAPSHOT_STORAGE_PREFIX = "ss_group_page_snapshot_v1:";

function getGroupPageSnapshotStorageKey(groupId: string, userId: string): string {
  return `${GROUP_PAGE_SNAPSHOT_STORAGE_PREFIX}${groupId}:${userId}`;
}

function isSnapshotGroupData(value: unknown): value is GroupData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    isNullableString(value.description) &&
    typeof value.event_date === "string" &&
    isNullableString(value.image_url) &&
    typeof value.owner_id === "string" &&
    isNullableNumber(value.budget) &&
    isNullableString(value.currency) &&
    typeof value.require_anonymous_nickname === "boolean" &&
    typeof value.revealed === "boolean" &&
    isNullableString(value.revealed_at)
  );
}

function isSnapshotMember(value: unknown): value is Member {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isNullableString(value.user_id) &&
    isNullableString(value.nickname) &&
    isNullableString(value.email) &&
    typeof value.role === "string" &&
    typeof value.status === "string"
  );
}

function isGroupPageSnapshot(
  value: unknown,
  groupId: string,
  userId: string
): value is GroupPageSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.groupId === groupId &&
    value.userId === userId &&
    typeof value.createdAt === "number" &&
    Date.now() - value.createdAt < GROUP_PAGE_SNAPSHOT_TTL_MS &&
    typeof value.currentUserId === "string" &&
    typeof value.isOwner === "boolean" &&
    value.drawDone === false &&
    isSnapshotGroupData(value.groupData) &&
    Array.isArray(value.members) &&
    value.members.every(isSnapshotMember) &&
    value.assignment === null
  );
}

export function readGroupPageSnapshot(groupId: string, userId: string): GroupPageSnapshot | null {
  const storageKey = getGroupPageSnapshotStorageKey(groupId, userId);
  const rawSnapshot = readSessionStorageItem(storageKey);

  if (!rawSnapshot) {
    return null;
  }

  try {
    const parsedSnapshot = JSON.parse(rawSnapshot) as unknown;

    if (isGroupPageSnapshot(parsedSnapshot, groupId, userId)) {
      return parsedSnapshot;
    }
  } catch {
    removeSessionStorageItem(storageKey);
    return null;
  }

  removeSessionStorageItem(storageKey);
  return null;
}

export function writeGroupPageSnapshot(snapshot: GroupPageSnapshot) {
  writeSessionStorageItem(
    getGroupPageSnapshotStorageKey(snapshot.groupId, snapshot.userId),
    JSON.stringify(snapshot)
  );
}

export function clearGroupPageSnapshots(groupId?: string) {
  forEachSessionStorageKey((key) => {
    if (
      key?.startsWith(GROUP_PAGE_SNAPSHOT_STORAGE_PREFIX) &&
      (!groupId || key.startsWith(`${GROUP_PAGE_SNAPSHOT_STORAGE_PREFIX}${groupId}:`))
    ) {
      removeSessionStorageItem(key);
    }
  });
}

export function sanitizeMembersForGroupPageSnapshot(
  members: Member[],
  currentUserId: string
): Member[] {
  return members.map((member) => ({
    ...member,
    email: null,
    user_id: member.user_id === currentUserId ? member.user_id : null,
  }));
}

export function getVisibleGroupMemberName(
  member: Member,
  index: number,
  requireAnonymousNickname: boolean,
  fallbackPrefix = "Member"
): string {
  const fallbackLabel = `${fallbackPrefix} ${index + 1}`;
  const safeNickname = isEmailDerivedGroupNickname(member.nickname, member.email)
    ? null
    : member.nickname?.trim();

  if (member.status !== "accepted") {
    return fallbackLabel;
  }

  if (requireAnonymousNickname) {
    return getAnonymousGroupDisplayName(safeNickname, fallbackLabel);
  }

  return safeNickname || fallbackLabel;
}
