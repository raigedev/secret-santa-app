export const GROUP_IMAGE_BUCKET = "group-images";

export function normalizeGroupImageUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    const candidate = new URL(value);
    const allowedOrigin = new URL(supabaseUrl).origin;
    const allowedPathPrefix = `/storage/v1/object/public/${GROUP_IMAGE_BUCKET}/`;

    if (candidate.origin !== allowedOrigin || !candidate.pathname.startsWith(allowedPathPrefix)) {
      return null;
    }

    return `${candidate.origin}${candidate.pathname}${candidate.search}`;
  } catch {
    return null;
  }
}
