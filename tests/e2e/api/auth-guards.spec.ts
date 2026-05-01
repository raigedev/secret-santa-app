import { expect, test } from "@playwright/test";

import { expectUnauthorizedJson } from "../helpers/assertions";

test.describe("API auth and guard coverage", () => {
  test("affiliate report access returns a safe false value when logged out", async ({ request }) => {
    const response = await request.get("/api/affiliate/report-access");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ allowed: false });
  });

  test("wishlist AI suggestions reject unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/ai/wishlist-suggestions", {
      data: {
        groupId: "group-id",
        itemName: "Tablet",
        region: "PH",
        wishlistItemId: "item-id",
      },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
      suggestions: [],
      usedAi: false,
    });
  });

  test("auth callback ignores spoofed forwarded hosts for redirects", async ({ request }) => {
    const response = await request.get("/auth/callback", {
      headers: {
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
      maxRedirects: 0,
    });
    const location = response.headers().location || "";

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(location).toContain("/login?error=no_code");
    expect(location).not.toContain("evil.example");
  });

  test("lazada matches reject unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/affiliate/lazada/matches", {
      data: {
        groupId: "group-id",
        itemName: "Power Bank",
        region: "PH",
        searchQuery: "power bank",
        wishlistItemId: "item-id",
      },
    });

    await expectUnauthorizedJson(response);
  });

  test("lazada prime-links reject unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/affiliate/lazada/prime-links", {
      data: { productIds: ["1234567890"] },
    });

    await expectUnauthorizedJson(response);
  });

  test("lazada health check rejects unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/affiliate/lazada/health-check");

    await expectUnauthorizedJson(response);
  });

  test("reminder processor rejects unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/notifications/process-reminders");

    await expectUnauthorizedJson(response);
  });

  test("test postback endpoint rejects unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/affiliate/lazada/test-postback");

    expect(response.status()).toBe(403);
  });
});
