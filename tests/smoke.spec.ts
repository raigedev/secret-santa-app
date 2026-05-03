import { expect, test } from "@playwright/test";

import { expectUnauthorizedJson } from "./e2e/helpers/assertions";

const TEST_GROUP_ID = "11111111-1111-1111-1111-111111111111";
const TEST_ITEM_ID = "22222222-2222-2222-2222-222222222222";

test.describe("public smoke coverage", () => {
  test("landing page renders the primary call to action", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeVisible();
    await expect(page.getByText(/create a group, invite members, share wishlist ideas/i)).toBeVisible();
  });

  test("login page renders the core auth controls", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("dashboard redirects unauthenticated visitors to login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
  });

  test("reminder processing route rejects unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/notifications/process-reminders");

    await expectUnauthorizedJson(response);
  });

  test("lazada health route rejects unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/affiliate/lazada/health-check");

    await expectUnauthorizedJson(response);
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
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
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
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
  });

  test("prime-links route rejects unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/affiliate/lazada/prime-links", {
      data: { productIds: ["1234567890"] },
    });

    await expectUnauthorizedJson(response);
  });
});
