import { expect, test } from "@playwright/test";

import { PROTECTED_PAGE_PATHS } from "../fixtures/routes";

test.describe("protected route coverage", () => {
  for (const path of PROTECTED_PAGE_PATHS) {
    test(`unauthenticated visitors are redirected away from ${path}`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
    });
  }
});
