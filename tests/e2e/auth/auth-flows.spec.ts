import { expect, test } from "@playwright/test";

import {
  AUTH_BLOCKED_MESSAGE,
  getTestAuthCredentials,
  getVisibleProfileMenuButton,
  loginWithTestCredentials,
  saveAuthenticatedStorageState,
} from "../helpers/auth";

const credentials = getTestAuthCredentials();

test.describe("authenticated auth coverage", () => {
  test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

  test("login succeeds and the session survives a reload", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);
    await saveAuthenticatedStorageState(page);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(getVisibleProfileMenuButton(page)).toBeVisible();
  });

  test("logout returns the user to the login screen", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);

    await getVisibleProfileMenuButton(page).click();
    await page.getByRole("menuitem", { name: /logout/i }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
  });
});
