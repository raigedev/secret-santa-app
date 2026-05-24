import "server-only";

import { NextResponse } from "next/server";

export function noStoreJson<TBody>(body: TBody, init?: ResponseInit): NextResponse<TBody> {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export function noStoreText(body: BodyInit | null, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return new Response(body, {
    ...init,
    headers,
  });
}
