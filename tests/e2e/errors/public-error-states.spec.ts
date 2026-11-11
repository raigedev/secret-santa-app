import { expect, test } from "@playwright/test";

import { INVALID_INVITE_TOKEN, UNKNOWN_ROUTE_PATH } from "../fixtures/routes";

test.describe("public error and edge states", () => {
  test("invalid invite links show a friendly unavailable message", async ({ page }) => {
    await page.goto(`/invite/${INVALID_INVITE_TOKEN}`);

    await expect(page.getByText(/this invite link is no longer valid/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /go to dashboard/i })).toBeVisible();
  });

  test("unknown routes currently redirect guests to login", async ({ page }) => {
    await page.goto(UNKNOWN_ROUTE_PATH);

    // Since 1347b11 the proxy keeps the requested app path in `next` for the post-login return.
    await expect(page).toHaveURL(
      (url) => url.pathname === "/login" && url.searchParams.get("next") === UNKNOWN_ROUTE_PATH
    );
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
  });
});
