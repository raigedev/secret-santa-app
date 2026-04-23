import { expect, test } from "@playwright/test";

test.describe("public mobile coverage", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("landing page keeps the main CTA visible on mobile", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeVisible();
    await expect(page.getByText(/make gift giving/i)).toBeVisible();
  });

  test("create-account form remains usable on mobile", async ({ page }) => {
    await page.goto("/create-account");

    await expect(page.getByPlaceholder(/your name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/your email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up/i })).toBeVisible();
  });

  test("login form remains usable on mobile", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByPlaceholder(/username or email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/enter your password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });

  test("forgot-password form remains usable on mobile", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.getByPlaceholder(/registered email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  test("reset-password form remains usable on mobile", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.getByPlaceholder(/enter new password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /update password/i })).toBeVisible();
  });
});
