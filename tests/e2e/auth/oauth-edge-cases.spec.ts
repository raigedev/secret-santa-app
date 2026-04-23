import { expect, test } from "@playwright/test";

test.describe("login oauth edge cases", () => {
  test("google oauth loading state clears after leaving for Google and returning with browser back", async ({
    page,
  }) => {
    await page.goto("/login?next=%2Fdashboard");

    await page.getByRole("button", { name: /continue with google/i }).click();
    await page.waitForURL(/accounts\.google\.com/i, { timeout: 15_000 });

    await page.goBack({ waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
    await expect(page.getByText(/redirecting to google/i)).toBeHidden();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
  });
});
