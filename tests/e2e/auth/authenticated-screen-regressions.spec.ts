import { expect, test, type Page } from "@playwright/test";

import {
  AFFILIATE_REPORT_BLOCKED_MESSAGE,
  AUTH_BLOCKED_MESSAGE,
  GROUP_BLOCKED_MESSAGE,
  canSeededUserOpenAffiliateReport,
  getTestAuthCredentials,
  getTestGroupId,
  loginWithTestCredentials,
} from "../helpers/auth";

type ScreenCase = {
  name: string;
  path: string;
  assertVisible: (page: Page) => Promise<void>;
};

const credentials = getTestAuthCredentials();
const groupId = getTestGroupId();

const AUTHENTICATED_SCREEN_CASES: ScreenCase[] = [
  {
    name: "dashboard",
    path: "/dashboard",
    assertVisible: async (page) => {
      await expect(page.getByRole("button", { name: /open profile menu/i })).toBeVisible();
      await expect(page.getByText(/your groups/i)).toBeVisible();
    },
  },
  {
    name: "create-group",
    path: "/create-group",
    assertVisible: async (page) => {
      await expect(page.getByRole("heading", { name: /create your secret santa group/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /create group/i })).toBeVisible();
    },
  },
  {
    name: "notifications",
    path: "/notifications",
    assertVisible: async (page) => {
      await expect(page.getByText(/notifications/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /save reminder settings/i })).toBeVisible();
    },
  },
  {
    name: "profile",
    path: "/profile",
    assertVisible: async (page) => {
      await expect(page.getByText(/my profile/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /save changes/i })).toBeVisible();
    },
  },
  {
    name: "wishlist",
    path: "/wishlist",
    assertVisible: async (page) => {
      await expect(page.getByText(/^my wishlist$/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /open gift planning/i })).toBeVisible();
    },
  },
  {
    name: "secret-santa",
    path: "/secret-santa",
    assertVisible: async (page) => {
      await expect(page.getByRole("heading", { name: /curate the right secret santa gift/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /back to dashboard/i })).toBeVisible();
    },
  },
  {
    name: "secret-santa-chat",
    path: "/secret-santa-chat",
    assertVisible: async (page) => {
      await expect(page.getByRole("heading", { name: /private gift whispers/i })).toBeVisible();
      await expect(page.getByText(/one private thread for each secret santa match/i)).toBeVisible();
    },
  },
];

test.describe("authenticated screen regressions", () => {
  test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

  for (const screen of AUTHENTICATED_SCREEN_CASES) {
    test(`${screen.name} renders its core authenticated UI`, async ({ page }) => {
      await loginWithTestCredentials(page, credentials!);
      await page.goto(screen.path);
      await screen.assertVisible(page);
    });
  }
});

test.describe("group-scoped authenticated regressions", () => {
  test.skip(!credentials || !groupId, !credentials ? AUTH_BLOCKED_MESSAGE : GROUP_BLOCKED_MESSAGE);

  test("group details route renders for a seeded member", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);
    await page.goto(`/group/${groupId}`);
    await expect(page.getByRole("button", { name: /back to dashboard/i })).toBeVisible();
    await expect(page.getByText(/manage members, draw names, and monitor the group from here/i)).toBeVisible();
  });

  test("group reveal route renders for a seeded member", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);
    await page.goto(`/group/${groupId}/reveal`);
    await expect(page.getByRole("button", { name: /back to group/i }).first()).toBeVisible();
    await expect(page.getByText(/one event\. two reveal moments\./i)).toBeVisible();
  });
});

test.describe("owner-only affiliate route regressions", () => {
  test.skip(
    !credentials || !canSeededUserOpenAffiliateReport(credentials.email),
    !credentials ? AUTH_BLOCKED_MESSAGE : AFFILIATE_REPORT_BLOCKED_MESSAGE
  );

  test("affiliate report renders for an allowed owner account", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard/affiliate-report");
    await expect(page.getByRole("heading", { name: /lazada affiliate report/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /open shopping flow/i })).toBeVisible();
  });
});
