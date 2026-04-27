import { expect, test } from "@playwright/test";

test.describe("public auth regressions", () => {
  test("login heading aligns with the responsive auth layout", async ({ page }) => {
    await page.setViewportSize({ width: 610, height: 654 });
    await page.goto("/login");

    const loginHeading = page.getByRole("heading", { name: "Login" });
    await expect(loginHeading).toHaveCSS("text-align", "center");

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(loginHeading).toHaveCSS("text-align", "left");
  });

  test("login requires an email before submission", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /^login$/i }).click();
    await expect(page.getByText(/please enter your email address/i)).toBeVisible();
  });

  test("login requires a password after the email is filled", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/enter your email address/i).fill("tester@example.com");
    await page.getByRole("button", { name: /^login$/i }).click();
    await expect(page.getByText(/please enter your password/i)).toBeVisible();
  });

  test("login keeps an internal next path when navigating to create-account", async ({ page }) => {
    await page.goto("/login?next=%2Fsecret-santa");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/create-account\?next=%2Fsecret-santa$/);
  });

  test("login drops an external next path instead of forwarding it", async ({ page }) => {
    await page.goto("/login?next=https://example.com");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/create-account\?next=%2Fdashboard$/);
  });

  test("create-account keeps an internal next path when returning to login", async ({ page }) => {
    await page.goto("/create-account?next=%2Fsecret-santa");
    await page.getByRole("button", { name: /sign in instead/i }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsecret-santa$/);
  });

  test("forgot-password can return to login without breaking the flow", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: /back to login/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
  });
});
