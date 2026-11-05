import { expect, test } from "@playwright/test";

import { PROTECTED_PAGE_PATHS } from "../fixtures/routes";

test.describe("protected route coverage", () => {
  for (const path of PROTECTED_PAGE_PATHS) {
    test(`unauthenticated visitors are redirected away from ${path}`, async ({ page }) => {
      await page.goto(path);

      // Since 1347b11 the proxy keeps the requested app path in `next` for the post-login return.
      await expect(page).toHaveURL(
        (url) => url.pathname === "/login" && url.searchParams.get("next") === path
      );
      await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
    });
  }
});
