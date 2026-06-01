export const GROUP_CREATED_TIP_PROMPT_STORAGE_KEY = "ss_group_created_tip_prompt";

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
