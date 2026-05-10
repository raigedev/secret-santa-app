const LAZADA_ALLOWED_HOSTS = [
  "lazada.com.ph",
  "www.lazada.com.ph",
  "pages.lazada.com.ph",
];

const LAZADA_ALLOWED_IMAGE_HOSTS = [
  "img.lazcdn.com",
  "lazcdn.com",
  "slatic.net",
  "lazada.com.ph",
];

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isLazadaHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);

  return LAZADA_ALLOWED_HOSTS.some((allowedHost) =>
    normalized === normalizeHostname(allowedHost)
  );
}

function isLazadaProductPath(pathname: string): boolean {
  return pathname.toLowerCase().includes("/products/");
}

export function normalizeLazadaProductPageUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    if (!isLazadaHostname(parsed.hostname)) {
      return null;
    }

    if (!isLazadaProductPath(parsed.pathname)) {
      return null;
    }

    parsed.hash = "";
    parsed.search = "";

    return parsed.toString();
  } catch {
    return null;
  }
}

export function isLazadaProductPageUrl(url: string): boolean {
  return normalizeLazadaProductPageUrl(url) !== null;
}

export function isLazadaPromotionShortLinkHostname(hostname: string): boolean {
  return /^(c|s)\.lazada\.com\.ph$/i.test(hostname.trim());
}

export function normalizeLazadaPromotionLinkUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    if (
      !isLazadaPromotionShortLinkHostname(parsed.hostname) &&
      !(isLazadaHostname(parsed.hostname) && isLazadaProductPath(parsed.pathname))
    ) {
      return null;
    }

    parsed.hash = "";

    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeTrustedLazadaImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());

    if (parsed.protocol !== "https:") {
      return null;
    }

    const hostname = normalizeHostname(parsed.hostname);
    const isAllowedHost = LAZADA_ALLOWED_IMAGE_HOSTS.some(
      (allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
    );

    if (!isAllowedHost) {
      return null;
    }

    parsed.hash = "";

    return parsed.toString();
  } catch {
    return null;
  }
}
