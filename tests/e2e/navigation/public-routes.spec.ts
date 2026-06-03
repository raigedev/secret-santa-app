import { expect, test } from "@playwright/test";

import { INVALID_INVITE_TOKEN } from "../fixtures/routes";

test.describe("public route coverage", () => {
  test("landing route renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeVisible();
  });

  test("landing hero CTA buttons stay aligned on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 768 });
    await page.goto("/");

    const primaryCta = page.getByRole("button", { name: /start drawing names/i }).first();
    const secondaryCta = page.getByRole("link", { name: /see how it works/i });

    const [primaryBox, secondaryBox] = await Promise.all([
      primaryCta.boundingBox(),
      secondaryCta.boundingBox(),
    ]);

    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();

    if (!primaryBox || !secondaryBox) return;

    expect(Math.abs(primaryBox.y - secondaryBox.y)).toBeLessThan(1);
    expect(Math.abs(primaryBox.height - secondaryBox.height)).toBeLessThan(1);
    expect(Math.abs(primaryBox.width - secondaryBox.width)).toBeLessThan(2);
    expect(Math.abs(primaryBox.y + primaryBox.height - (secondaryBox.y + secondaryBox.height))).toBeLessThan(1);
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

  test("how it works route renders", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page.getByRole("heading", { name: /how my secret santa works/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /one exchange, nine clear moments/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create a group/i }).first()).toHaveAttribute(
      "href",
      "/login"
    );
  });

  test("terms route renders", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /terms of use/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /acceptable use/i })).toBeVisible();
  });

  test("affiliate disclosure route renders", async ({ page }) => {
    await page.goto("/affiliate-disclosure");
    await expect(page.getByRole("heading", { name: /affiliate disclosure/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /amazon associate disclosure/i })).toBeVisible();
  });

  test("invalid invite token route renders an unavailable state", async ({ page }) => {
    await page.goto(`/invite/${INVALID_INVITE_TOKEN}`);
    await expect(page.getByText(/join secret santa/i)).toBeVisible();
    await expect(page.getByText(/this invite link is no longer valid/i)).toBeVisible();
  });
});
