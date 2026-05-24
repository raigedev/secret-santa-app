import "server-only";

const DEFAULT_LOCAL_APP_ORIGIN = "http://localhost:3000";

export function normalizeHttpOrigin(candidate: unknown): string | null {
  const rawValue = candidate instanceof URL ? candidate.origin : candidate;

  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();

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

export function uniqueOrigins(origins: Array<string | null>): string[] {
  const unique: string[] = [];

  for (const origin of origins) {
    if (origin && !unique.includes(origin)) {
      unique.push(origin);
    }
  }

  return unique;
}

function getConfiguredAppOrigins(): string[] {
  return uniqueOrigins([
    normalizeHttpOrigin(process.env.NEXT_PUBLIC_APP_URL),
    normalizeHttpOrigin(process.env.APP_URL),
    normalizeHttpOrigin(process.env.VERCEL_URL),
    normalizeHttpOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ]);
}

export function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);

    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

export function resolveTrustedAppOrigin(candidate: string | URL | null | undefined): string {
  const requestOrigin = normalizeHttpOrigin(candidate);
  const configuredOrigins = getConfiguredAppOrigins();

  if (
    requestOrigin &&
    (configuredOrigins.includes(requestOrigin) || isLocalDevelopmentOrigin(requestOrigin))
  ) {
    return requestOrigin;
  }

  return configuredOrigins[0] || DEFAULT_LOCAL_APP_ORIGIN;
}
