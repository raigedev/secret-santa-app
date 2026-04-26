import type {
  DashboardActivityItem,
  DashboardNotificationPreviewItem,
  DashboardSnapshot,
  GiftProgressStep,
  GiftProgressSummary,
  Group,
  GroupMember,
  PendingInvite,
} from "./dashboard-types";

const DASHBOARD_SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const DASHBOARD_SNAPSHOT_STORAGE_PREFIX = "ss_dashboard_snapshot_v1:";

function getDashboardSnapshotStorageKey(userId: string): string {
  return `${DASHBOARD_SNAPSHOT_STORAGE_PREFIX}${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNullableNumber(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function isDashboardTone(value: unknown): value is DashboardActivityItem["tone"] {
  return (
    value === "amber" ||
    value === "blue" ||
    value === "emerald" ||
    value === "rose" ||
    value === "violet"
  );
}

function isGiftProgressStep(value: unknown): value is GiftProgressStep {
  return (
    value === "planning" ||
    value === "purchased" ||
    value === "wrapped" ||
    value === "ready_to_give"
  );
}

function isGroupMember(value: unknown): value is GroupMember {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNullableString(value.userId) &&
    isNullableString(value.nickname) &&
    isNullableString(value.email) &&
    typeof value.role === "string" &&
    isNullableString(value.displayName) &&
    isNullableString(value.avatarEmoji) &&
    isNullableString(value.avatarUrl)
  );
}

function isDashboardGroup(value: unknown): value is Group {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.event_date === "string" &&
    isNullableNumber(value.budget) &&
    isNullableString(value.currency) &&
    typeof value.owner_id === "string" &&
    typeof value.created_at === "string" &&
    typeof value.require_anonymous_nickname === "boolean" &&
    Array.isArray(value.members) &&
    value.members.every(isGroupMember) &&
    typeof value.isOwner === "boolean" &&
    typeof value.hasDrawn === "boolean"
  );
}

function isPendingInvite(value: unknown): value is PendingInvite {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.group_id === "string" &&
    typeof value.group_name === "string" &&
    typeof value.group_description === "string" &&
    typeof value.group_event_date === "string" &&
    typeof value.require_anonymous_nickname === "boolean"
  );
}

function isGiftProgressSummary(value: unknown): value is GiftProgressSummary {
  if (!isRecord(value)) {
    return false;
  }

  const countsByStep = value.countsByStep;

  return (
    isGiftProgressStep(value.focusStep) &&
    typeof value.focusCount === "number" &&
    isRecord(countsByStep) &&
    typeof countsByStep.planning === "number" &&
    typeof countsByStep.purchased === "number" &&
    typeof countsByStep.wrapped === "number" &&
    typeof countsByStep.ready_to_give === "number" &&
    typeof value.totalAssignments === "number" &&
    typeof value.readyToGiveCount === "number" &&
    isNullableString(value.recipientName) &&
    isNullableString(value.groupName)
  );
}

function isDashboardActivityItem(value: unknown): value is DashboardActivityItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.subtitle === "string" &&
    typeof value.createdAt === "string" &&
    isNullableString(value.href) &&
    typeof value.icon === "string" &&
    isDashboardTone(value.tone)
  );
}

function isDashboardNotificationPreviewItem(
  value: unknown
): value is DashboardNotificationPreviewItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isNullableString(value.href) &&
    typeof value.icon === "string" &&
    isDashboardTone(value.tone) &&
    typeof value.createdAt === "string"
  );
}

function isDashboardSnapshot(value: unknown, userId: string): value is DashboardSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.userId === userId &&
    typeof value.createdAt === "number" &&
    Date.now() - value.createdAt < DASHBOARD_SNAPSHOT_TTL_MS &&
    typeof value.userName === "string" &&
    Array.isArray(value.ownedGroups) &&
    value.ownedGroups.every(isDashboardGroup) &&
    Array.isArray(value.invitedGroups) &&
    value.invitedGroups.every(isDashboardGroup) &&
    Array.isArray(value.pendingInvites) &&
    value.pendingInvites.every(isPendingInvite) &&
    Array.isArray(value.recipientNames) &&
    value.recipientNames.every((recipientName) => typeof recipientName === "string") &&
    typeof value.unreadNotificationCount === "number" &&
    typeof value.wishlistItemCount === "number" &&
    typeof value.wishlistGroupCount === "number" &&
    (value.giftProgressSummary === null || isGiftProgressSummary(value.giftProgressSummary)) &&
    Array.isArray(value.activityFeedItems) &&
    value.activityFeedItems.every(isDashboardActivityItem) &&
    Array.isArray(value.notificationPreviewItems) &&
    value.notificationPreviewItems.every(isDashboardNotificationPreviewItem)
  );
}

export function readDashboardSnapshot(userId: string): DashboardSnapshot | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  const rawSnapshot = sessionStorage.getItem(getDashboardSnapshotStorageKey(userId));

  if (!rawSnapshot) {
    return null;
  }

  try {
    const parsedSnapshot = JSON.parse(rawSnapshot) as unknown;

    if (isDashboardSnapshot(parsedSnapshot, userId)) {
      return parsedSnapshot;
    }
  } catch {
    sessionStorage.removeItem(getDashboardSnapshotStorageKey(userId));
    return null;
  }

  sessionStorage.removeItem(getDashboardSnapshotStorageKey(userId));
  return null;
}

export function writeDashboardSnapshot(snapshot: DashboardSnapshot) {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  sessionStorage.setItem(
    getDashboardSnapshotStorageKey(snapshot.userId),
    JSON.stringify(snapshot)
  );
}

export function clearDashboardSnapshots() {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);

    if (key?.startsWith(DASHBOARD_SNAPSHOT_STORAGE_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  }
}

export function sanitizeGroupsForDashboardSnapshot(groups: Group[]): Group[] {
  return groups.map((group) => ({
    ...group,
    members: group.members.map((member) => ({
      ...member,
      userId: null,
      email: null,
      avatarUrl: null,
    })),
  }));
}
