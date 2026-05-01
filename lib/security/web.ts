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

export function extractRequestClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    forwardedFor ? forwardedFor.split(",")[0] : null,
  ];

  for (const candidate of candidates) {
    const normalized = candidate?.trim();

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeHttpOrigin(candidate: string | null | undefined): string | null {
  const trimmed = candidate?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function resolveTrustedAppOrigin(requestUrl: URL): string {
  const configuredOrigin =
    normalizeHttpOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeHttpOrigin(process.env.APP_URL) ||
    normalizeHttpOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeHttpOrigin(process.env.VERCEL_URL);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return requestUrl.origin;
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
