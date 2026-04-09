import "server-only";

import { timingSafeEqual } from "crypto";

export function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const normalized = headerValue.replace(/^Bearer\s+/i, "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function safeEqualSecret(
  expected: string | null | undefined,
  provided: string | null | undefined
): boolean {
  if (!expected || !provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export function normalizeSafeAppPath(
  candidate: string | null | undefined,
  fallback = "/"
): string {
  const normalized = candidate?.trim() || fallback;

  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    normalized.includes("\0")
  ) {
    return fallback;
  }

  return normalized;
}
