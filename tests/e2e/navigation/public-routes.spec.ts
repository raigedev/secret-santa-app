import { expect, test } from "@playwright/test";

import { INVALID_INVITE_TOKEN } from "../fixtures/routes";

test.describe("public route coverage", () => {
  test("landing route renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeVisible();
  });

  test("login route renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();
  });

  test("create-account route renders", async ({ page }) => {
    await page.goto("/create-account");
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  });

  test("cool-app route renders and updates its gift plan", async ({ page }) => {
    await page.goto("/cool-app");
    await expect(page.getByRole("heading", { name: /build a gift plan/i })).toBeVisible();
    await expect(page.getByText(/clever gift route for kenneth/i)).toBeVisible();

    await page.getByRole("button", { name: "Warm" }).click();
    await expect(page.getByText(/warm gift route for kenneth/i)).toBeVisible();

    await page.getByLabel("Recipient").fill("Jamie");
    await expect(page.getByText(/warm gift route for jamie/i)).toBeVisible();
  });

  test("forgot-password route renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /forgot password/i })).toBeVisible();
  });

  test("reset-password route renders", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
  });

  test("privacy route renders", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /shopping and affiliate links/i })).toBeVisible();
  });

  test("invalid invite token route renders an unavailable state", async ({ page }) => {
    await page.goto(`/invite/${INVALID_INVITE_TOKEN}`);
    await expect(page.getByText(/join secret santa/i)).toBeVisible();
    await expect(page.getByText(/this invite link is no longer valid/i)).toBeVisible();
  });
});
