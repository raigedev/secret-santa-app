// @ts-check
// cspell:ignore Kolkata

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_DISPLAY_TIME_ZONE = "UTC";
const MAX_TIME_ZONE_LENGTH = 100;

export const DEFAULT_EXCHANGE_TIME_ZONE = "Asia/Manila";

const FALLBACK_EXCHANGE_TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Manila",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** @type {Map<string, Intl.DateTimeFormat>} */
const exchangeDateKeyFormatters = new Map();

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizeExchangeTimeZone(value) {
  const timeZone = value?.trim();

  if (!timeZone || timeZone.length > MAX_TIME_ZONE_LENGTH) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function resolveExchangeTimeZone(value) {
  return normalizeExchangeTimeZone(value) || DEFAULT_EXCHANGE_TIME_ZONE;
}

/**
 * @returns {string}
 */
export function getLocalExchangeTimeZone() {
  return resolveExchangeTimeZone(
    new Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}

/**
 * @param {string | null | undefined} preferredTimeZone
 * @returns {string[]}
 */
export function getSupportedExchangeTimeZones(preferredTimeZone) {
  /** @type {((key: "timeZone") => string[]) | undefined} */
  const supportedValuesOf = Reflect.get(Intl, "supportedValuesOf");
  const supportedTimeZones =
    typeof supportedValuesOf === "function"
      ? supportedValuesOf.call(Intl, "timeZone")
      : FALLBACK_EXCHANGE_TIME_ZONES;
  const preferred = normalizeExchangeTimeZone(preferredTimeZone);

  const timeZones = preferred
    ? [preferred, ...supportedTimeZones]
    : supportedTimeZones;

  return [...new Set(timeZones)].sort((left, right) =>
    left.localeCompare(right)
  );
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatExchangeTimeZoneLabel(value) {
  const timeZone = resolveExchangeTimeZone(value);

  if (timeZone === "UTC") {
    return "UTC";
  }

  const segments = timeZone.split("/");
  const location = (segments.at(-1) || timeZone).replaceAll("_", " ");
  const region =
    segments.length > 1 ? segments.slice(0, -1).join(" / ").replaceAll("_", " ") : "";

  return region ? `${location} (${region})` : location;
}

/**
 * @param {string} timeZone
 * @returns {Intl.DateTimeFormat}
 */
function getExchangeDateKeyFormatter(timeZone) {
  const resolvedTimeZone = resolveExchangeTimeZone(timeZone);
  const existingFormatter = exchangeDateKeyFormatters.get(resolvedTimeZone);

  if (existingFormatter) {
    return existingFormatter;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: resolvedTimeZone,
    year: "numeric",
  });

  exchangeDateKeyFormatters.set(resolvedTimeZone, formatter);
  return formatter;
}

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
 * @param {string} [timeZone]
 * @returns {string}
 */
export function getExchangeDateKey(
  now = Date.now(),
  timeZone = DEFAULT_EXCHANGE_TIME_ZONE
) {
  const date = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("A valid current date is required.");
  }

  const parts = getExchangeDateKeyFormatter(timeZone).formatToParts(date);
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
 * @param {string} [timeZone]
 * @returns {number | null}
 */
export function getDaysUntilExchangeDate(
  value,
  now = Date.now(),
  timeZone = DEFAULT_EXCHANGE_TIME_ZONE
) {
  const eventTimestamp = getExchangeDateUtcTimestamp(value);
  const todayTimestamp = getExchangeDateUtcTimestamp(
    getExchangeDateKey(now, timeZone)
  );

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
