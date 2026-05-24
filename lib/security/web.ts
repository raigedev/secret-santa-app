import "server-only";

import { timingSafeEqual } from "crypto";

import {
  isLocalDevelopmentOrigin,
  normalizeHttpOrigin,
  uniqueOrigins,
} from "@/lib/security/app-origin";

export { normalizeSafeAppPath } from "@/lib/security/safe-app-path";
export { resolveTrustedAppOrigin } from "@/lib/security/app-origin";

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

type HeaderReader = Pick<Headers, "get">;

function getTrustedOrigins(requestOrigin: string | null): string[] {
  return uniqueOrigins([
    requestOrigin && isLocalDevelopmentOrigin(requestOrigin) ? requestOrigin : null,
    normalizeHttpOrigin(process.env.NEXT_PUBLIC_APP_URL),
    normalizeHttpOrigin(process.env.APP_URL),
    normalizeHttpOrigin(process.env.VERCEL_URL),
    normalizeHttpOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ]);
}

function getHeaderRequestOrigin(headers: HeaderReader): string | null {
  const host = headers.get("host")?.trim();

  if (!host) {
    return null;
  }

  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    ? "http"
    : "https";

  return normalizeHttpOrigin(`${protocol}://${host}`);
}

export function isTrustedHeaderOrigin(headers: HeaderReader): boolean {
  const providedOrigin = normalizeHttpOrigin(headers.get("origin"));

  if (!providedOrigin) {
    const fetchSite = headers.get("sec-fetch-site")?.toLowerCase();

    return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
  }

  const requestOrigin = getHeaderRequestOrigin(headers);

  return getTrustedOrigins(requestOrigin).includes(providedOrigin);
}

export function isTrustedRequestOrigin(request: Request): boolean {
  const providedOrigin = normalizeHttpOrigin(request.headers.get("origin"));

  if (!providedOrigin) {
    const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

    // Older clients may omit Origin, so fall back to Fetch Metadata only when
    // it positively identifies a same-site or user-initiated request.
    return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
  }

  const requestOrigin = normalizeHttpOrigin(new URL(request.url).origin);

  return getTrustedOrigins(requestOrigin).includes(providedOrigin);
}
