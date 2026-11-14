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
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=%2Fgroups");
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

test("pending invitations appear in My Groups, not on the dashboard", async ({ page }) => {
  const credentials = getTestAuthCredentials();
  test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

  const inviteName = "Private Gift Exchange";
  let inviteRequests = 0;
  await page.route("**/api/groups/pending-invites", async (route) => {
    inviteRequests += 1;
    await route.fulfill({
      json: {
        success: true,
        invites: [{
          group_id: "11111111-1111-4111-8111-111111111111",
          group_name: inviteName,
          group_description: "",
          group_event_date: "2026-12-25",
          require_anonymous_nickname: true,
        }],
      },
    });
  });

  await loginWithTestCredentials(page, credentials!);
  await expect(page.getByText(/invite[s]? waiting/i)).toHaveCount(0);
  expect(inviteRequests).toBe(0);

  await page.goto("/groups");
  const invitations = page.getByRole("region", { name: "Pending invitations" });
  await expect(invitations.getByRole("heading", { name: inviteName })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your first exchange" })).toHaveCount(0);
  await expect(invitations.getByRole("textbox", { name: "Your name for the reveal" })).toBeVisible();
  await expect(invitations.getByRole("textbox", { name: "Secret Santa alias" })).toBeVisible();
  await expect(invitations.getByRole("button", { name: "Decline", exact: true })).toBeEnabled();
  await invitations.getByRole("button", { name: "Accept invite" }).click();
  await expect(invitations.getByRole("alert")).toHaveText("Enter a Secret Santa alias to continue.");
  await invitations.getByRole("textbox", { name: "Secret Santa alias" }).fill("Ribbon Keeper");
  await invitations.getByRole("button", { name: "Accept invite" }).click();
  await expect(invitations.getByRole("alert")).toHaveText("Enter your name for the reveal.");
});

test("My Groups opens while invitations retry a slow response", async ({ page }) => {
  const credentials = getTestAuthCredentials();
  test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

  await loginWithTestCredentials(page, credentials!);
  let inviteRequests = 0;
  await page.route("**/api/groups/pending-invites", async (route) => {
    inviteRequests += 1;
    if (inviteRequests === 1) {
      await route.fulfill({ status: 503, json: { success: false, invites: [] } });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 4_000));
    await route.fulfill({
      json: {
        success: true,
        invites: [{
          group_id: "22222222-2222-4222-8222-222222222222",
          group_name: "Slow Gift Exchange",
          group_description: "",
          group_event_date: "2026-12-25",
          require_anonymous_nickname: false,
        }],
      },
    });
  });

  await page.goto("/groups");
  await expect(page.getByRole("heading", { name: "Your Groups" })).toBeVisible();
  await expect(page.getByText("Checking invitations...", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Slow Gift Exchange" })).toBeVisible();
  await expect(page.getByText("Invitations are temporarily unavailable.")).toHaveCount(0);
  expect(inviteRequests).toBe(2);
});
