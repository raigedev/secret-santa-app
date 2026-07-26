// @ts-check

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_DISPLAY_TIME_ZONE = "UTC";

export const EXCHANGE_TIME_ZONE = "Asia/Manila";

const EXCHANGE_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: EXCHANGE_TIME_ZONE,
  year: "numeric",
});

/**
 * @param {string | null | undefined} value
 * @returns {number | null}
 */
export function getExchangeDateUtcTimestamp(value) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  const timeSeparatorIndex = trimmedValue.indexOf("T");
  const datePart =
    timeSeparatorIndex >= 0 ? trimmedValue.slice(0, timeSeparatorIndex) : trimmedValue;

  if (datePart.length !== 10 || datePart[4] !== "-" || datePart[7] !== "-") {
    return null;
  }

  const yearPart = datePart.slice(0, 4);
  const monthPart = datePart.slice(5, 7);
  const dayPart = datePart.slice(8, 10);
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    String(year).padStart(4, "0") !== yearPart ||
    String(month).padStart(2, "0") !== monthPart ||
    String(day).padStart(2, "0") !== dayPart
  ) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

/**
 * @param {number | Date} [now]
 * @returns {string}
 */
export function getExchangeDateKey(now = Date.now()) {
  const date = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("A valid current date is required.");
  }

  const parts = EXCHANGE_DATE_KEY_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new RangeError("The exchange date could not be determined.");
  }

  return `${year}-${month}-${day}`;
}

/**
 * @param {string | null | undefined} value
 * @param {number | Date} [now]
 * @returns {number | null}
 */
export function getDaysUntilExchangeDate(value, now = Date.now()) {
  const eventTimestamp = getExchangeDateUtcTimestamp(value);
  const todayTimestamp = getExchangeDateUtcTimestamp(getExchangeDateKey(now));

  if (eventTimestamp === null || todayTimestamp === null) {
    return null;
  }

  return Math.round((eventTimestamp - todayTimestamp) / DAY_MS);
}

/**
 * @param {string} value
 * @param {number} days
 * @returns {string}
 */
export function addDaysToExchangeDate(value, days) {
  const timestamp = getExchangeDateUtcTimestamp(value);

  if (timestamp === null || !Number.isInteger(days)) {
    throw new RangeError("A valid exchange date and whole-day offset are required.");
  }

  return new Date(timestamp + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @param {string | null | undefined} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @param {string} [fallback]
 * @param {string | string[]} [locale]
 * @returns {string}
 */
export function formatExchangeDate(
  value,
  options = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
  fallback = value || "Date unavailable",
  locale
) {
  const timestamp = getExchangeDateUtcTimestamp(value);

  if (timestamp === null) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: DATE_ONLY_DISPLAY_TIME_ZONE,
  }).format(timestamp);
}
