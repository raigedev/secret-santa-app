function hasUnsafePathControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function isSafeAppPath(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !hasUnsafePathControlCharacter(value)
  );
}

const POST_AUTH_BLOCKED_EXACT_PATHS = new Set([
  "/auth/callback",
  "/create-account",
  "/forgot-password",
  "/login",
  "/reset-password",
]);

const POST_AUTH_BLOCKED_PATH_PREFIXES = [
  "/api/",
  "/go/",
  "/_next/",
];

function readPathname(value: string): string {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const endIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  return endIndex === undefined ? value : value.slice(0, endIndex);
}

function isSafePostAuthPath(value: string): boolean {
  const pathname = readPathname(value);

  if (POST_AUTH_BLOCKED_EXACT_PATHS.has(pathname)) {
    return false;
  }

  return !POST_AUTH_BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function normalizeSafeAppPath(candidate: unknown, fallback = "/"): string {
  const normalized = typeof candidate === "string" ? candidate.trim() || fallback : fallback;

  if (isSafeAppPath(normalized)) {
    return normalized;
  }

  return isSafeAppPath(fallback) ? fallback : "/";
}

export function normalizeSafePostAuthPath(candidate: unknown, fallback = "/dashboard"): string {
  const normalized = normalizeSafeAppPath(candidate, fallback);

  if (isSafePostAuthPath(normalized)) {
    return normalized;
  }

  const safeFallback = normalizeSafeAppPath(fallback, "/dashboard");
  return isSafePostAuthPath(safeFallback) ? safeFallback : "/dashboard";
}
