import type { SupabaseClient } from "@supabase/supabase-js";

export const GROUP_IMAGE_BUCKET = "group-images";
const GROUP_IMAGE_SIGNED_URL_TTL_SECONDS = 10 * 60;
const UUID_PATTERN_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const GROUP_IMAGE_PATH_PATTERN = new RegExp(
  `^(${UUID_PATTERN_SOURCE})\\/(${UUID_PATTERN_SOURCE})\\/cover\\.(jpg|png|webp)$`,
  "i"
);

export function normalizeGroupImagePath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const cleanValue = value.trim();

  if (GROUP_IMAGE_PATH_PATTERN.test(cleanValue)) {
    return cleanValue;
  }

  try {
    const candidate = new URL(cleanValue);
    const publicPathPrefix = `/storage/v1/object/public/${GROUP_IMAGE_BUCKET}/`;
    const signedPathPrefix = `/storage/v1/object/sign/${GROUP_IMAGE_BUCKET}/`;
    const candidatePath = decodeURIComponent(candidate.pathname);
    const objectPath = candidatePath.startsWith(publicPathPrefix)
      ? candidatePath.slice(publicPathPrefix.length)
      : candidatePath.startsWith(signedPathPrefix)
        ? candidatePath.slice(signedPathPrefix.length)
        : "";

    return GROUP_IMAGE_PATH_PATTERN.test(objectPath) ? objectPath : null;
  } catch {
    return null;
  }
}

export function getGroupImageStoragePathForOwnedGroup(options: {
  groupId: string;
  imageValue: string | null | undefined;
  userId: string;
}): string | null {
  const imagePath = normalizeGroupImagePath(options.imageValue);

  if (!imagePath) {
    return null;
  }

  const match = GROUP_IMAGE_PATH_PATTERN.exec(imagePath);
  const imageOwnerId = match?.[1]?.toLowerCase();
  const imageGroupId = match?.[2]?.toLowerCase();

  if (
    imageOwnerId !== options.userId.toLowerCase() ||
    imageGroupId !== options.groupId.toLowerCase()
  ) {
    return null;
  }

  return imagePath;
}

export async function createSignedGroupImageUrl(
  supabase: SupabaseClient,
  value: string | null | undefined
): Promise<string | null> {
  const imagePath = normalizeGroupImagePath(value);

  if (!imagePath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(GROUP_IMAGE_BUCKET)
    .createSignedUrl(imagePath, GROUP_IMAGE_SIGNED_URL_TTL_SECONDS);

  if (error) {
    return null;
  }

  return data.signedUrl;
}
