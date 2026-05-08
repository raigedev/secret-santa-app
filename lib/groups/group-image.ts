import type { SupabaseClient } from "@supabase/supabase-js";

export const GROUP_IMAGE_BUCKET = "group-images";
const GROUP_IMAGE_SIGNED_URL_TTL_SECONDS = 10 * 60;
const GROUP_IMAGE_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/cover\.(jpg|png|webp)$/i;

function normalizeGroupImagePath(value: string | null | undefined): string | null {
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
