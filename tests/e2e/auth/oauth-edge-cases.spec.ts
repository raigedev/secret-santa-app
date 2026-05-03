import { expect, test } from "@playwright/test";

test.describe("login oauth edge cases", () => {
  test("google oauth loading state clears after leaving for the provider and returning with browser back", async ({
    page,
  }) => {
    let oauthUrl = "";

    await page.route("**/auth/v1/authorize**", async (route) => {
      oauthUrl = route.request().url();

      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Mock Google sign-in</title><h1>Mock Google sign-in</h1>",
      });
    });

    await page.goto("/login?next=%2Fdashboard");

    await page.getByRole("button", { name: /continue with google/i }).click();
    await page.waitForURL(/\/auth\/v1\/authorize/i, { timeout: 15_000 });
    expect(oauthUrl).toContain("provider=google");
    expect(oauthUrl).toContain("redirect_to=");

    await page.goBack({ waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
    await expect(page.getByText(/opening google sign-in/i)).toBeHidden();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
  });

  test("google oauth shows recovery controls while the provider navigation is slow", async ({
    page,
  }) => {
    await page.route("**/auth/v1/authorize**", () => new Promise(() => undefined));

    await page.goto("/login?next=%2Fdashboard");

    await page.getByRole("button", { name: /continue with google/i }).dispatchEvent("click");

    await expect(page.getByText(/opening google sign-in/i)).toBeVisible();
    await expect(page.getByText(/still on this screen/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
    await expect(page.getByRole("link", { name: /open google sign-in again/i })).toBeVisible();

    await page.getByRole("button", { name: /back to sign in/i }).dispatchEvent("click");

    await expect(page.getByText(/opening google sign-in/i)).toBeHidden();
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });
});
