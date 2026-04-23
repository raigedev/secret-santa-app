import { expect, test } from "@playwright/test";

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

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("lazada prime-links reject unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/affiliate/lazada/prime-links", {
      data: { productIds: ["1234567890"] },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("lazada health check rejects unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/affiliate/lazada/health-check");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("reminder processor rejects unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/notifications/process-reminders");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("test postback endpoint rejects unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/affiliate/lazada/test-postback");

    expect(response.status()).toBe(403);
  });
});
