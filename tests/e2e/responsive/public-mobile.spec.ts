import { expect, test } from "@playwright/test";

test.describe("public mobile coverage", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("landing page keeps the main CTA visible on mobile", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("heading", { name: /draw names and plan better gifts/i })).toBeVisible();
  });

  test("create-account form remains usable on mobile", async ({ page }) => {
    await page.goto("/create-account");

    await expect(page.getByPlaceholder(/your name/i)).toBeInViewport({ ratio: 1 });
    await expect(page.getByPlaceholder(/your email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up/i })).toBeVisible();
  });

  test("login form remains usable on mobile", async ({ page }) => {
    await page.goto("/login");

    const email = page.getByRole("textbox", { name: "Email address" });
    await expect(email).toBeInViewport({ ratio: 1 });
    await expect(email).toHaveCSS("font-size", "16px");
    await expect(page.getByRole("region", { name: "Secret Santa login preview" })).toBeHidden();
    await expect(page.getByPlaceholder(/enter your password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });

  test("forgot-password form remains usable on mobile", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.getByPlaceholder(/enter your email address/i)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: /email reset link/i })).toBeVisible();
  });

  test("reset-password form remains usable on mobile", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.getByLabel(/new password/i)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: /save new password/i })).toBeVisible();
  });

  test("landing hero stays centered when its artwork hides at tablet widths", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    const heading = page.getByRole("heading", { name: /draw names and plan better gifts/i });
    await expect(heading).toBeVisible();
    const box = await heading.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x + box!.width / 2 - 384)).toBeLessThanOrEqual(1);
  });

  test("signup begins in view on a short landscape phone", async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto("/create-account");

    await expect(page.getByPlaceholder(/your name/i)).toBeInViewport();
  });

  test("desktop login retains the split layout", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");

    const artwork = page.getByRole("region", { name: "Secret Santa login preview" });
    const email = page.getByRole("textbox", { name: "Email address" });
    await expect(artwork).toBeVisible();
    await expect(email).toBeVisible();
    const [artworkBox, emailBox] = await Promise.all([artwork.boundingBox(), email.boundingBox()]);
    expect(artworkBox).not.toBeNull();
    expect(emailBox).not.toBeNull();
    expect(emailBox!.x).toBeGreaterThan(artworkBox!.x + artworkBox!.width);
  });

  for (const path of ["/privacy", "/terms", "/affiliate-disclosure"]) {
    test(`${path} contact text wraps on an extra-narrow screen`, async ({ page }) => {
      await page.setViewportSize({ width: 280, height: 653 });
      await page.goto(path);

      const email = page.locator('main a[href^="mailto:"]').first();
      await expect(email).toBeVisible();
      await expect.poll(() => email.evaluate((element) => {
        const viewportWidth = document.documentElement.clientWidth;
        const box = element.getBoundingClientRect();
        return document.documentElement.scrollWidth <= viewportWidth + 1 && box.right <= viewportWidth + 1;
      })).toBe(true);
    });
  }
});
