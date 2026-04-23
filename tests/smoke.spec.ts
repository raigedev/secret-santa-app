import { expect, test } from "@playwright/test";

test.describe("public smoke coverage", () => {
  test("landing page renders the primary call to action", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeVisible();
    await expect(page.getByText(/draw names online, share wishlists/i)).toBeVisible();
  });

  test("login page renders the core auth controls", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /giftdraw/i })).toBeVisible();
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
});
