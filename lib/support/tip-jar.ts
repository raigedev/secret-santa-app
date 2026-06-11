export const GROUP_CREATED_TIP_PROMPT_STORAGE_KEY = "ss_group_created_tip_prompt";
export const DEFAULT_TIP_JAR_URL = "https://ko-fi.com/mysecretsanta";
export const SUPPORT_PAGE_PATH = "/support";

const DEFAULT_TIP_JAR_LINK = new URL(DEFAULT_TIP_JAR_URL);
const DEFAULT_TIP_JAR_URL_WITHOUT_PROTOCOL = `${DEFAULT_TIP_JAR_LINK.hostname}${DEFAULT_TIP_JAR_LINK.pathname}`
  .replace(/\/$/, "")
  .toLowerCase();

export type TipJarLinkTarget = {
  href: string;
  isExternal: boolean;
};

function resolveTipJarUrl(rawUrl?: string): string {
  if (typeof rawUrl === "string") {
    return rawUrl.trim();
  }

  return process.env.NEXT_PUBLIC_TIP_JAR_URL?.trim() || DEFAULT_TIP_JAR_URL;
}

function normalizeTipJarUrl(rawUrl: string): string {
  const urlWithoutProtocol = rawUrl.replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();

  if (urlWithoutProtocol === DEFAULT_TIP_JAR_URL_WITHOUT_PROTOCOL) {
    return `https://${rawUrl}`;
  }

  return rawUrl;
}

export function getSafeTipJarUrl(rawUrl?: string): string | null {
  const trimmedUrl = normalizeTipJarUrl(resolveTipJarUrl(rawUrl));

  if (!trimmedUrl) {
    return null;
  }

  try {
    const url = new URL(trimmedUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getTipJarNavLinkTarget(rawUrl?: string): TipJarLinkTarget {
  const safeTipJarUrl = getSafeTipJarUrl(rawUrl);

  if (safeTipJarUrl) {
    return {
      href: safeTipJarUrl,
      isExternal: true,
    };
  }

  return {
    href: SUPPORT_PAGE_PATH,
    isExternal: false,
  };
}
