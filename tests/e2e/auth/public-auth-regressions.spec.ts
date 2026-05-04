import { expect, test } from "@playwright/test";

test.describe("public auth regressions", () => {
  test("login heading aligns with the responsive auth layout", async ({ page }) => {
    await page.setViewportSize({ width: 610, height: 654 });
    await page.goto("/login");

    const loginHeading = page.getByRole("heading", { name: "Log in" });
    await expect(loginHeading).toHaveCSS("text-align", "center");

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(loginHeading).toHaveCSS("text-align", "left");
  });

  test("login requires an email before submission", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /^log in$/i }).click();
    await expect(page.getByText(/please enter your email address/i)).toBeVisible();
  });

  test("login requires a password after the email is filled", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/enter your email address/i).fill("tester@example.com");
    await page.getByRole("button", { name: /^log in$/i }).click();
    await expect(page.getByText(/please enter your password/i)).toBeVisible();
  });

  test("login replaces raw provider errors with a readable message", async ({ page }) => {
    let interceptedPasswordLogin = false;

    await page.route("**/auth/v1/token**", async (route) => {
      interceptedPasswordLogin = true;

      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "{}" }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder(/enter your email address/i).fill("tester@example.com");
    await page.getByPlaceholder(/enter your password/i).fill("not-a-real-password");
    await page.getByRole("button", { name: /^log in$/i }).click();

    const alert = page.locator("form [role='alert']");
    await expect(alert).toContainText(/we could not sign you in/i);
    await expect(alert).not.toHaveText("{}");
    expect(interceptedPasswordLogin).toBe(true);
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

  test("login drops protocol-relative next paths", async ({ page }) => {
    await page.goto(`/login?next=${encodeURIComponent("//example.com/dashboard")}`);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/create-account\?next=%2Fdashboard$/);
  });

  test("create-account keeps an internal next path when returning to login", async ({ page }) => {
    await page.goto("/create-account?next=%2Fsecret-santa");
    await page.getByRole("button", { name: /sign in instead/i }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsecret-santa$/);
  });

  test("create-account drops next paths containing backslashes", async ({ page }) => {
    await page.goto(`/create-account?next=${encodeURIComponent("/\\example.com")}`);
    await page.getByRole("button", { name: /sign in instead/i }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  });

  test("forgot-password can return to login without breaking the flow", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: /back to login/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
  });

  test("landing OAuth callback errors recover on the login screen", async ({ page }) => {
    const callbackError = new URLSearchParams({
      error: "invalid_request",
      error_code: "bad_oauth_callback",
      error_description: "OAuth state parameter missing",
    });

    await page.goto(`/?${callbackError}`);

    await expect(page).toHaveURL(/\/login\?error=oauth_callback_failed$/);
    await expect(page.locator("[role='alert']").filter({ hasText: /google sign-in expired/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });
});
