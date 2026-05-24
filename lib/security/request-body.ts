import "server-only";

type LimitedJsonBodyReadError = "invalid-json" | "too-large";
type LimitedTextBodyReadError = "invalid-body" | "too-large";

type LimitedJsonBodyReadResult<TBody> =
  | { body: TBody; ok: true }
  | { error: LimitedJsonBodyReadError; ok: false };

type LimitedTextBodyReadResult =
  | { ok: true; text: string }
  | { error: LimitedTextBodyReadError; ok: false };

type LimitedBodyReadResult =
  | { bytes: Uint8Array; ok: true }
  | { error: "too-large"; ok: false };

function isOverBodyLimit(request: Request, maxBytes: number): boolean {
  const contentLengthHeader = request.headers.get("content-length");

  if (!contentLengthHeader) {
    return false;
  }

  const contentLength = Number(contentLengthHeader);

  return Number.isFinite(contentLength) && contentLength > maxBytes;
}

async function readLimitedRequestBody(
  request: Request,
  maxBytes: number
): Promise<LimitedBodyReadResult> {
  if (isOverBodyLimit(request, maxBytes)) {
    return { error: "too-large", ok: false };
  }

  if (!request.body) {
    return { bytes: new Uint8Array(), ok: true };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // The response is already rejected; cancellation is only best-effort cleanup.
      }

      return { error: "too-large", ok: false };
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { bytes, ok: true };
}

export async function readLimitedTextBody(
  request: Request,
  maxBytes: number
): Promise<LimitedTextBodyReadResult> {
  try {
    const bodyRead = await readLimitedRequestBody(request, maxBytes);

    if (!bodyRead.ok) {
      return { error: "too-large", ok: false };
    }

    return { ok: true, text: new TextDecoder().decode(bodyRead.bytes) };
  } catch {
    return { error: "invalid-body", ok: false };
  }
}

export async function readLimitedJsonBody<TBody = unknown>(
  request: Request,
  maxBytes: number
): Promise<LimitedJsonBodyReadResult<TBody>> {
  const bodyRead = await readLimitedTextBody(request, maxBytes);

  if (!bodyRead.ok) {
    return { error: bodyRead.error === "too-large" ? "too-large" : "invalid-json", ok: false };
  }

  try {
    const bodyText = bodyRead.text;

    if (bodyText.trim().length === 0) {
      return { error: "invalid-json", ok: false };
    }

    return { body: JSON.parse(bodyText) as TBody, ok: true };
  } catch {
    return { error: "invalid-json", ok: false };
  }
}
