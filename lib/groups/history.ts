import { getDaysUntilExchangeDate } from "@/lib/exchange-date.mjs";

export const GROUP_HISTORY_GRACE_DAYS = 7;

export const GROUP_HISTORY_READ_ONLY_MESSAGE =
  "Past exchanges are read-only. Their final details and results are preserved.";

type GroupHistoryState = {
  daysPastEvent: number;
  daysUntilHistory: number;
  isGracePeriod: boolean;
  isHistory: boolean;
  label: string;
};

export function getGroupHistoryState(
  eventDate: string | null | undefined,
  now: number | Date = Date.now()
): GroupHistoryState {
  const daysUntilEvent = getDaysUntilExchangeDate(eventDate, now);

  if (daysUntilEvent === null) {
    return {
      daysPastEvent: 0,
      daysUntilHistory: GROUP_HISTORY_GRACE_DAYS,
      isGracePeriod: false,
      isHistory: false,
      label: "Active",
    };
  }

  const daysPastEvent = Math.max(0, -daysUntilEvent);
  const isHistory = daysPastEvent >= GROUP_HISTORY_GRACE_DAYS;
  const isGracePeriod = daysPastEvent > 0 && !isHistory;
  const daysUntilHistory = isHistory
    ? 0
    : Math.max(GROUP_HISTORY_GRACE_DAYS - daysPastEvent, 0);

  return {
    daysPastEvent,
    daysUntilHistory,
    isGracePeriod,
    isHistory,
    label: isHistory ? "In History" : isGracePeriod ? "Concluding soon" : "Active",
  };
}

export function isGroupInHistory(
  eventDate: string | null | undefined,
  now: number | Date = Date.now()
): boolean {
  return getGroupHistoryState(eventDate, now).isHistory;
}

export function isGroupWishlistActive(
  eventDate: string | null | undefined,
  now: number | Date = Date.now()
): boolean {
  const daysUntilEvent = getDaysUntilExchangeDate(eventDate, now);

  if (daysUntilEvent === null) {
    return true;
  }

  return daysUntilEvent >= 0;
}
