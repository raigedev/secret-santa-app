const LAZADA_ALLOWED_HOSTS = [
  "lazada.com.ph",
  "www.lazada.com.ph",
  "pages.lazada.com.ph",
];

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function isLazadaHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);

  return LAZADA_ALLOWED_HOSTS.some((allowedHost) =>
    normalized === normalizeHostname(allowedHost)
  );
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

    if (!parsed.pathname.toLowerCase().includes("/products/")) {
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
