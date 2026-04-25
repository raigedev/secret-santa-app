import { expect, test } from "@playwright/test";

import { monitorPageHealth } from "../helpers/network";

test.describe("public smoke coverage", () => {
  test("landing page loads cleanly with the primary CTA and metadata", async ({ page }) => {
    const health = monitorPageHealth(page);

    await page.goto("/");

    await expect(page).toHaveTitle(/my secret santa/i);
    await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeVisible();
    await expect(page.getByText(/create a group, invite members, share wishlist ideas/i)).toBeVisible();
    await health.expectHealthy();
  });

  test("landing navigation reaches in-page sections and login", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /see how it works/i }).click();
    await expect(page).toHaveURL(/#how$/);
    await expect(page.getByText(/set up your gift exchange in three steps/i)).toBeVisible();

    await page.getByRole("button", { name: /start drawing names/i }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
  });

  test("login page renders core controls without critical console errors", async ({ page }) => {
    const health = monitorPageHealth(page);

    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /my secret santa/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await health.expectHealthy();
  });
});
