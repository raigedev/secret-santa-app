import {
  prepareVerifiedImageUpload,
  type PreparedVerifiedImage,
} from "@/lib/security/image-upload";

const MAX_GROUP_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_GROUP_IMAGE_DECODED_SIDE = 6000;
const MAX_GROUP_IMAGE_DECODED_PIXELS = 12_000_000;

const ALLOWED_GROUP_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type PreparedGroupImage = PreparedVerifiedImage;

export async function prepareGroupImageUpload(file: File | null): Promise<{
  image: PreparedGroupImage | null;
  message?: string;
}> {
  if (!file || file.size === 0) {
    return { image: null };
  }

  return prepareVerifiedImageUpload(file, {
    allowedTypes: ALLOWED_GROUP_IMAGE_TYPES,
    maxBytes: MAX_GROUP_IMAGE_BYTES,
    maxDecodedPixels: MAX_GROUP_IMAGE_DECODED_PIXELS,
    maxDecodedSide: MAX_GROUP_IMAGE_DECODED_SIDE,
    messages: {
      invalidType: "Upload a JPG, PNG, or WebP image.",
      tooLarge: "Keep the group picture under 2 MB.",
      tooLargeDimensions: "Choose a smaller picture, under 6000 pixels on each side.",
      unverified: "That image file could not be verified.",
    },
  });
}
