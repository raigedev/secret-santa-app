import { expect, test } from "@playwright/test";

const TEST_GROUP_ID = "11111111-1111-1111-1111-111111111111";
const TEST_ITEM_ID = "22222222-2222-2222-2222-222222222222";

test.describe("public smoke coverage", () => {
  test("landing page renders the primary call to action", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeVisible();
    await expect(page.getByText(/draw names online, share wishlists/i)).toBeVisible();
  });

  test("login page renders the core auth controls", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /my secret santa/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("dashboard redirects unauthenticated visitors to login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
  });

  test("reminder processing route rejects unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/notifications/process-reminders");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("lazada health route rejects unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/affiliate/lazada/health-check");

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("suggestion redirect requires an authenticated session", async ({ page }) => {
    const params = new URLSearchParams({
      merchant: "lazada",
      groupId: TEST_GROUP_ID,
      itemId: TEST_ITEM_ID,
      q: "power bank",
      title: "Budget Power Bank",
      region: "PH",
    });

    await page.goto(`/go/suggestion?${params.toString()}`);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
  });

  test("wishlist-link redirect requires an authenticated session", async ({ page }) => {
    const params = new URLSearchParams({
      groupId: TEST_GROUP_ID,
      itemId: TEST_ITEM_ID,
      name: "Power Bank",
      url: "https://www.lazada.com.ph/products/example-i123456789.html",
    });

    await page.goto(`/go/wishlist-link?${params.toString()}`);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
  });

  test("prime-links route rejects unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/affiliate/lazada/prime-links", {
      data: { productIds: ["1234567890"] },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
