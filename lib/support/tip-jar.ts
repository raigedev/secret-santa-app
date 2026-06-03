export const GROUP_CREATED_TIP_PROMPT_STORAGE_KEY = "ss_group_created_tip_prompt";
export const SUPPORT_PAGE_PATH = "/support";

export type TipJarLinkTarget = {
  href: string;
  isExternal: boolean;
};

export function getSafeTipJarUrl(
  rawUrl = process.env.NEXT_PUBLIC_TIP_JAR_URL || ""
): string | null {
  const trimmedUrl = rawUrl.trim();

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

export function getTipJarNavLinkTarget(
  rawUrl = process.env.NEXT_PUBLIC_TIP_JAR_URL || ""
): TipJarLinkTarget {
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
