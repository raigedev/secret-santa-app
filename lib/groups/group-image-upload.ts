import { Buffer } from "node:buffer";

const MAX_GROUP_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_GROUP_IMAGE_DECODED_SIDE = 6000;
const MAX_GROUP_IMAGE_DECODED_PIXELS = 12_000_000;

const ALLOWED_GROUP_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type ImageDimensions = {
  height: number;
  width: number;
};

export type PreparedGroupImage = {
  contentType: string;
  extension: string;
  bytes: Buffer;
};

function readPngDimensions(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 24) {
    return null;
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function readJpegDimensions(bytes: Buffer): ImageDimensions | null {
  let offset = 2;

  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= bytes.length) {
      return null;
    }

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda || offset + 1 >= bytes.length) {
      return null;
    }

    const segmentLength = bytes.readUInt16BE(offset);

    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      if (segmentLength < 7 || offset + 6 >= bytes.length) {
        return null;
      }

      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function readWebpDimensions(bytes: Buffer): ImageDimensions | null {
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (dataOffset + chunkSize > bytes.length) {
      return null;
    }

    if (chunkType === "VP8X" && chunkSize >= 10 && dataOffset + 10 <= bytes.length) {
      return {
        width:
          1 +
          bytes[dataOffset + 4] +
          (bytes[dataOffset + 5] << 8) +
          (bytes[dataOffset + 6] << 16),
        height:
          1 +
          bytes[dataOffset + 7] +
          (bytes[dataOffset + 8] << 8) +
          (bytes[dataOffset + 9] << 16),
      };
    }

    if (
      chunkType === "VP8L" &&
      chunkSize >= 5 &&
      dataOffset + 5 <= bytes.length &&
      bytes[dataOffset] === 0x2f
    ) {
      const bits =
        bytes[dataOffset + 1] |
        (bytes[dataOffset + 2] << 8) |
        (bytes[dataOffset + 3] << 16) |
        (bytes[dataOffset + 4] << 24);

      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }

    if (
      chunkType === "VP8 " &&
      chunkSize >= 10 &&
      dataOffset + 10 <= bytes.length &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return null;
}

function readImageDimensions(bytes: Buffer, contentType: string): ImageDimensions | null {
  if (contentType === "image/png") {
    return readPngDimensions(bytes);
  }

  if (contentType === "image/jpeg") {
    return readJpegDimensions(bytes);
  }

  if (contentType === "image/webp") {
    return readWebpDimensions(bytes);
  }

  return null;
}

function imageDimensionsAreAllowed(dimensions: ImageDimensions): boolean {
  return (
    dimensions.width > 0 &&
    dimensions.height > 0 &&
    dimensions.width <= MAX_GROUP_IMAGE_DECODED_SIDE &&
    dimensions.height <= MAX_GROUP_IMAGE_DECODED_SIDE &&
    dimensions.width * dimensions.height <= MAX_GROUP_IMAGE_DECODED_PIXELS
  );
}

export async function prepareGroupImageUpload(file: File | null): Promise<{
  image: PreparedGroupImage | null;
  message?: string;
}> {
  if (!file || file.size === 0) {
    return { image: null };
  }

  const extension = ALLOWED_GROUP_IMAGE_TYPES.get(file.type);

  if (!extension) {
    return { image: null, message: "Upload a JPG, PNG, or WebP image." };
  }

  if (file.size > MAX_GROUP_IMAGE_BYTES) {
    return { image: null, message: "Keep the group picture under 2 MB." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const looksLikeJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const looksLikePng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const looksLikeWebp =
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const matchesContent =
    (file.type === "image/jpeg" && looksLikeJpeg) ||
    (file.type === "image/png" && looksLikePng) ||
    (file.type === "image/webp" && looksLikeWebp);

  if (!matchesContent) {
    return { image: null, message: "That image file could not be verified." };
  }

  const dimensions = readImageDimensions(bytes, file.type);

  if (!dimensions) {
    return { image: null, message: "That image file could not be verified." };
  }

  if (!imageDimensionsAreAllowed(dimensions)) {
    return { image: null, message: "Choose a smaller picture, under 6000 pixels on each side." };
  }

  return {
    image: {
      bytes,
      contentType: file.type,
      extension,
    },
  };
}
