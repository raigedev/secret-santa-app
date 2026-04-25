import { expect, test } from "@playwright/test";

test.describe("public auth form validation", () => {
  test("create-account requires a display name", async ({ page }) => {
    await page.goto("/create-account");

    await page.getByRole("button", { name: /sign up/i }).click();

    await expect(page.getByText(/please enter your name/i)).toBeVisible();
  });

  test("create-account validates email format", async ({ page }) => {
    await page.goto("/create-account");

    await page.getByPlaceholder(/enter your name/i).fill("Playwright Tester");
    await page.getByPlaceholder(/enter your email address/i).fill("not-an-email");
    await page.getByPlaceholder(/create a password/i).fill("12345678");
    await page.getByRole("button", { name: /sign up/i }).click();

    await expect(page.getByText(/please enter a valid email address/i)).toBeVisible();
  });

  test("create-account enforces a minimum password length", async ({ page }) => {
    await page.goto("/create-account");

    await page.getByPlaceholder(/enter your name/i).fill("Playwright Tester");
    await page.getByPlaceholder(/enter your email address/i).fill("tester@example.com");
    await page.getByPlaceholder(/create a password/i).fill("short");
    await page.getByRole("button", { name: /sign up/i }).click();

    await expect(page.getByText(/use at least 8 characters for your password/i)).toBeVisible();
  });

  test("forgot-password requires an email before submission", async ({ page }) => {
    await page.goto("/forgot-password");

    await page.getByRole("button", { name: /email reset link/i }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /enter the email address for your account/i })
    ).toBeVisible();
  });

  test("reset-password enforces the minimum password length", async ({ page }) => {
    await page.goto("/reset-password");

    await page.getByPlaceholder(/enter your new password/i).fill("short");
    await page.getByRole("button", { name: /save new password/i }).click();

    await expect(page.getByText(/use at least 8 characters for your new password/i)).toBeVisible();
  });
});
