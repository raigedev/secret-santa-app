import { getAnonymousGroupDisplayName } from "@/lib/groups/nickname";
import type { GiftProgressStep, Group, GroupMember } from "./dashboard-types";

const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: "A$",
  CAD: "C$",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  PHP: "PHP",
  USD: "$",
};

export function createGroupUserKey(groupId: string, userId: string): string {
  return `${groupId}:${userId}`;
}

export function createEmptyQueryResult<T>(data: T[] = []): Promise<{ data: T[]; error: null }> {
  return Promise.resolve({ data, error: null });
}

export function formatDashboardDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getDaysUntilEvent(value: string, now: number): number | null {
  const eventTime = new Date(value).getTime();

  if (Number.isNaN(eventTime)) {
    return null;
  }

  return Math.max(0, Math.ceil((eventTime - now) / 86_400_000));
}

export function buildDashboardRevealMessage(groups: Group[], now: number): string {
  const events = groups
    .map((group) => {
      const eventTime = new Date(group.event_date).getTime();

      if (Number.isNaN(eventTime)) {
        return null;
      }

      return {
        daysUntilEvent: Math.max(0, Math.ceil((eventTime - now) / 86_400_000)),
        groupName: group.name || "your exchange",
        hasStarted: eventTime <= now,
        sortTime: eventTime,
      };
    })
    .filter((event): event is NonNullable<typeof event> => event !== null)
    .sort((left, right) => {
      if (left.daysUntilEvent !== right.daysUntilEvent) {
        return left.daysUntilEvent - right.daysUntilEvent;
      }

      return left.sortTime - right.sortTime;
    });

  if (events.length === 0) {
    return "Manage your groups, name draws, wishlists, and private messages in one place.";
  }

  const openEvents = events.filter((event) => event.hasStarted);
  const futureEvents = events.filter((event) => !event.hasStarted);

  if (openEvents.length > 0) {
    const [openEvent] = openEvents;
    const openEventName =
      openEvents.length > 1
        ? `${openEvent.groupName} and ${openEvents.length - 1} more`
        : openEvent.groupName;
    const nextFutureEvent = futureEvents[0];

    if (!nextFutureEvent) {
      return `Reveal day is open for ${openEventName}.`;
    }

    const futureDayLabel = `${nextFutureEvent.daysUntilEvent} day${
      nextFutureEvent.daysUntilEvent === 1 ? "" : "s"
    }`;

    return `Reveal is open for ${openEventName}. Next: ${nextFutureEvent.groupName} in ${futureDayLabel}.`;
  }

  const nextEvent = futureEvents[0];
  const sameDayEvents = futureEvents.filter(
    (event) => event.daysUntilEvent === nextEvent.daysUntilEvent
  );
  const extraSameDayCount = sameDayEvents.length - 1;
  const extraUpcomingCount = futureEvents.length - sameDayEvents.length;
  const dayLabel = `${nextEvent.daysUntilEvent} day${nextEvent.daysUntilEvent === 1 ? "" : "s"}`;

  if (extraSameDayCount > 0) {
    return `${sameDayEvents.length} reveals are ${dayLabel} away. First up: ${nextEvent.groupName}.`;
  }

  return `Next reveal: ${nextEvent.groupName} in ${dayLabel}.${
    extraUpcomingCount > 0 ? ` ${extraUpcomingCount} more upcoming.` : ""
  }`;
}

export function formatDashboardBudget(
  budget: number | null,
  currency: string | null
): string | null {
  if (budget === null) {
    return null;
  }

  const code = (currency || "PHP").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] || code;
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  });

  if (code === "PHP") {
    return `P ${formatter.format(budget)}`;
  }

  return `${symbol} ${formatter.format(budget)}`;
}

export function getDashboardMemberLabel(
  member: GroupMember,
  requireAnonymousNickname: boolean
): string {
  if (requireAnonymousNickname) {
    return getAnonymousGroupDisplayName(member.nickname, "Member");
  }

  return member.displayName || member.nickname || member.email || "Member";
}

export function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function formatGiftPrepStatusLabel(status: string | null): string {
  switch (status) {
    case "planning":
      return "planning";
    case "purchased":
      return "purchased";
    case "wrapped":
      return "wrapped";
    case "ready_to_give":
      return "ready to give";
    default:
      return "updated";
  }
}

export function normalizeGiftProgressStep(status: string | null): GiftProgressStep {
  switch (status) {
    case "purchased":
      return "purchased";
    case "wrapped":
      return "wrapped";
    case "ready_to_give":
      return "ready_to_give";
    case "planning":
    default:
      return "planning";
  }
}

export function getGiftProgressStepIndex(step: GiftProgressStep): number {
  switch (step) {
    case "planning":
      return 0;
    case "purchased":
      return 1;
    case "wrapped":
      return 2;
    case "ready_to_give":
      return 3;
    default:
      return 0;
  }
}

export function getNotificationPreviewTitle(type: string, title: string): string {
  switch (type) {
    case "gift_received":
      return "Gift update";
    case "chat":
      return "Chat ping";
    case "draw":
      return "Draw ready";
    case "reveal":
      return "Reveal time";
    case "invite":
      return "Invite";
    case "affiliate_lazada_health":
      return "Lazada health";
    default:
      return title;
  }
}

export function getDisplayFirstName(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    return "friend";
  }

  const [first] = trimmed.split(/\s+/);

  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function getAvatarLabel(value: string | null): string {
  if (!value) {
    return "?";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "?";
  }

  return trimmed.charAt(0).toUpperCase();
}
