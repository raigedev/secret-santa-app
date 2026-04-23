import { expect, test } from "@playwright/test";

import { INVALID_INVITE_TOKEN } from "../fixtures/routes";

test.describe("public route coverage", () => {
  test("landing route renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeVisible();
  });

  test("login route renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /giftdraw/i })).toBeVisible();
  });

  test("create-account route renders", async ({ page }) => {
    await page.goto("/create-account");
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  });

  test("forgot-password route renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /forgot password/i })).toBeVisible();
  });

  test("reset-password route renders", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
  });

  test("invalid invite token route renders an unavailable state", async ({ page }) => {
    await page.goto(`/invite/${INVALID_INVITE_TOKEN}`);
    await expect(page.getByText(/join secret santa/i)).toBeVisible();
    await expect(page.getByText(/this invite link is no longer valid/i)).toBeVisible();
  });
});
