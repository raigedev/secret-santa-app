import { expect, test } from "@playwright/test";
import {
  AUTH_BLOCKED_MESSAGE,
  getTestAuthCredentials,
  loginWithTestCredentials,
} from "../helpers/auth";

test("opening an email invitation waits for confirmation and removes the token from the URL", async ({ page }) => {
  const tokenHash = "a".repeat(56);
  const submissions: string[] = [];

  await page.route("**/auth/callback", async (route) => {
    submissions.push(route.request().postData() || "");
    await route.fulfill({ status: 303, headers: { location: "/invite/confirm?error=unavailable" } });
  });

  await page.goto(`/invite/confirm#token_hash=${tokenHash}`);
  const confirm = page.getByRole("button", { name: "Continue to invitation" });
  await expect(confirm).toBeVisible();
  await expect(page).toHaveURL(/\/invite\/confirm$/);
  expect(submissions).toEqual([]);

  await confirm.click();
  await expect(page.getByRole("heading", { name: "Invitation link unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  expect(submissions).toEqual([`token_hash=${tokenHash}`]);
});

test("invite confirmation rejects cross-site and malformed submissions", async ({ request, baseURL }) => {
  const crossSite = await request.post("/auth/callback", {
    headers: { origin: "https://example.com" },
    form: { token_hash: "a".repeat(56) },
    maxRedirects: 0,
  });
  expect(crossSite.status()).toBe(403);

  const malformed = await request.post("/auth/callback", {
    headers: { origin: new URL(baseURL!).origin },
    form: { token_hash: "invalid" },
    maxRedirects: 0,
  });
  expect(malformed.status()).toBe(303);
  expect(malformed.headers().location).toMatch(/\/invite\/confirm\?error=unavailable$/);
  expect(malformed.headers()["set-cookie"]).toBeUndefined();
});

test("group creation excludes the organizer and duplicate addresses from the invite count", async ({ page }) => {
  const credentials = getTestAuthCredentials();
  test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

  await loginWithTestCredentials(page, credentials!);
  await page.goto("/create-group");
  const invites = page.getByRole("textbox", { name: "Invite members" });
  await invites.fill(` ${credentials!.email.toUpperCase()}, participant@example.com, Participant@example.com `);

  await expect(invites).toHaveAccessibleDescription("You're already the organizer. Your email won't be invited.");
  await expect(page.getByText("1 to send", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create exchange" })).toBeEnabled();
});
