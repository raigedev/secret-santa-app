export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

export function isNullableNumber(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

export function sanitizeTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeCompactString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

export function sanitizeOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

const SUPPORTED_SHOPPING_REGIONS = ["AU", "CA", "GLOBAL", "JP", "PH", "UK", "US"] as const;

export type SupportedShoppingRegion = (typeof SUPPORTED_SHOPPING_REGIONS)[number];

export function isSupportedShoppingRegion(
  value: string | null | undefined
): value is SupportedShoppingRegion {
  return SUPPORTED_SHOPPING_REGIONS.includes(value as SupportedShoppingRegion);
}
