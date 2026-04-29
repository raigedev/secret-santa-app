import { expect, type APIResponse } from "@playwright/test";

export async function expectUnauthorizedJson(response: APIResponse) {
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "Unauthorized" });
}
