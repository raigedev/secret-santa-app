const DAY_MS = 24 * 60 * 60 * 1000;

export const GROUP_HISTORY_GRACE_DAYS = 7;

export type GroupHistoryState = {
  daysPastEvent: number;
  daysUntilHistory: number;
  isGracePeriod: boolean;
  isHistory: boolean;
  label: string;
};

function parseDateOnlyUtc(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function getTodayUtc(now: number | Date = Date.now()): number {
  const date = now instanceof Date ? now : new Date(now);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function getGroupHistoryState(
  eventDate: string | null | undefined,
  now: number | Date = Date.now()
): GroupHistoryState {
  const eventTime = parseDateOnlyUtc(eventDate);

  if (eventTime === null) {
    return {
      daysPastEvent: 0,
      daysUntilHistory: GROUP_HISTORY_GRACE_DAYS,
      isGracePeriod: false,
      isHistory: false,
      label: "Active",
    };
  }

  const daysPastEvent = Math.max(0, Math.floor((getTodayUtc(now) - eventTime) / DAY_MS));
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
