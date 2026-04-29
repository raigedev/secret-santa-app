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
  const parsed = new Date(getDashboardEventTime(value));

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDashboardEventTime(value: string): number {
  const [datePart] = value.split("T");
  const [yearPart, monthPart, dayPart] = datePart.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    yearPart.length === 4 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31
  ) {
    const parsedLocalDate = new Date(year, month - 1, day);

    if (
      parsedLocalDate.getFullYear() === year &&
      parsedLocalDate.getMonth() === month - 1 &&
      parsedLocalDate.getDate() === day
    ) {
      return parsedLocalDate.getTime();
    }
  }

  return new Date(value).getTime();
}

function getCalendarDayKey(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCalendarDayDifference(eventTime: number, now: number): number {
  return Math.round((getCalendarDayKey(eventTime) - getCalendarDayKey(now)) / 86_400_000);
}

export function getDaysUntilEvent(value: string, now: number): number | null {
  const eventTime = getDashboardEventTime(value);

  if (Number.isNaN(eventTime)) {
    return null;
  }

  return Math.max(0, getCalendarDayDifference(eventTime, now));
}

export function isDashboardEventPast(value: string, now: number): boolean {
  const eventTime = getDashboardEventTime(value);

  if (Number.isNaN(eventTime)) {
    return false;
  }

  return getCalendarDayDifference(eventTime, now) < 0;
}

export function formatDashboardEventCountdown(value: string, now: number): string {
  const eventTime = getDashboardEventTime(value);

  if (Number.isNaN(eventTime)) {
    return "Open";
  }

  const dayDifference = getCalendarDayDifference(eventTime, now);

  if (dayDifference < 0) {
    return "Gift day passed";
  }

  if (dayDifference === 0) {
    return "Gift day today";
  }

  if (dayDifference === 1) {
    return "Tomorrow";
  }

  return `${dayDifference} days left`;
}

export function buildDashboardRevealMessage(groups: Group[], now: number): string {
  const events = groups
    .map((group) => {
      const eventTime = getDashboardEventTime(group.event_date);

      if (Number.isNaN(eventTime)) {
        return null;
      }

      return {
        dayDifference: getCalendarDayDifference(eventTime, now),
        groupName: group.name || "your exchange",
        sortTime: eventTime,
      };
    })
    .filter((event): event is NonNullable<typeof event> => event !== null)
    .sort((left, right) => {
      if (left.dayDifference !== right.dayDifference) {
        return left.dayDifference - right.dayDifference;
      }

      return left.sortTime - right.sortTime;
    });

  if (events.length === 0) {
    return "Manage your groups, name draws, wishlists, and private messages in one place.";
  }

  const pastEvents = events.filter((event) => event.dayDifference < 0);
  const todayEvents = events.filter((event) => event.dayDifference === 0);
  const futureEvents = events.filter((event) => event.dayDifference > 0);

  if (todayEvents.length > 0) {
    const [todayEvent] = todayEvents;
    const todayEventName =
      todayEvents.length > 1
        ? `${todayEvent.groupName} and ${todayEvents.length - 1} more`
        : todayEvent.groupName;
    const nextFutureEvent = futureEvents[0];

    if (!nextFutureEvent) {
      return `Gift day is today for ${todayEventName}.`;
    }

    const futureDayLabel = `${nextFutureEvent.dayDifference} day${
      nextFutureEvent.dayDifference === 1 ? "" : "s"
    }`;

    return `Gift day is today for ${todayEventName}. Next exchange: ${nextFutureEvent.groupName} in ${futureDayLabel}.`;
  }

  if (pastEvents.length > 0) {
    const latestPastEvents = pastEvents.sort((left, right) => right.sortTime - left.sortTime);
    const [pastEvent] = latestPastEvents;
    const pastEventName =
      latestPastEvents.length > 1
        ? `${pastEvent.groupName} and ${latestPastEvents.length - 1} more`
        : pastEvent.groupName;
    const nextFutureEvent = futureEvents[0];

    if (!nextFutureEvent) {
      return `Gift day passed for ${pastEventName}.`;
    }

    const futureDayLabel = `${nextFutureEvent.dayDifference} day${
      nextFutureEvent.dayDifference === 1 ? "" : "s"
    }`;

    return `Gift day passed for ${pastEventName}. Next exchange: ${nextFutureEvent.groupName} in ${futureDayLabel}.`;
  }

  const nextEvent = futureEvents[0];
  const sameDayEvents = futureEvents.filter(
    (event) => event.dayDifference === nextEvent.dayDifference
  );
  const extraSameDayCount = sameDayEvents.length - 1;
  const extraUpcomingCount = futureEvents.length - sameDayEvents.length;
  const dayLabel =
    nextEvent.dayDifference === 1
      ? "tomorrow"
      : `in ${nextEvent.dayDifference} days`;

  if (extraSameDayCount > 0) {
    return `${sameDayEvents.length} gift days are ${dayLabel}. First up: ${nextEvent.groupName}.`;
  }

  return `Next gift day: ${nextEvent.groupName} ${dayLabel}.${
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
