import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  AUTH_BLOCKED_MESSAGE,
  GROUP_BLOCKED_MESSAGE,
  getTestAuthCredentials,
  getTestGroupId,
  loginWithTestCredentials,
} from "../helpers/auth";

type TimingRow = {
  label: string;
  durationMs: number;
};

const credentials = getTestAuthCredentials();
const groupId = getTestGroupId();

async function recordTiming(
  rows: TimingRow[],
  label: string,
  action: () => Promise<unknown>,
  waitForReady: () => Promise<void>
) {
  const startedAt = Date.now();

  await action();
  await waitForReady();

  rows.push({
    label,
    durationMs: Date.now() - startedAt,
  });
}

async function attachTimingReport(testInfo: TestInfo, rows: TimingRow[]) {
  await testInfo.attach("navigation-performance.json", {
    body: JSON.stringify(rows, null, 2),
    contentType: "application/json",
  });
}

async function waitForLoginReady(page: Page) {
  await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
}

test.describe("navigation performance smoke coverage", () => {
  test("public landing to login path reaches an interactive screen", async ({ page }, testInfo) => {
    const rows: TimingRow[] = [];

    await recordTiming(
      rows,
      "landing ready",
      () => page.goto("/"),
      async () => {
        await expect(page.getByRole("button", { name: /start drawing names/i }).first()).toBeVisible();
      }
    );

    await recordTiming(
      rows,
      "landing start button to login ready",
      async () => {
        await page.getByRole("button", { name: /start drawing names/i }).first().click();
      },
      () => waitForLoginReady(page)
    );

    await attachTimingReport(testInfo, rows);
  });

  test("authenticated major screens reach their core UI", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

    const rows: TimingRow[] = [];

    await recordTiming(
      rows,
      "login to dashboard ready",
      () => loginWithTestCredentials(page, credentials!),
      async () => {
        await expect(page.getByRole("heading", { name: /group snapshot/i })).toBeVisible();
      }
    );

    if (groupId) {
      await recordTiming(
        rows,
        "dashboard to group ready",
        () => page.goto(`/group/${groupId}`),
        async () => {
          await expect(page.getByRole("button", { name: /back to groups/i })).toBeVisible();
        }
      );
    } else {
      testInfo.annotations.push({
        type: "skip-note",
        description: GROUP_BLOCKED_MESSAGE,
      });
    }

    await recordTiming(
      rows,
      "wishlist ready",
      () => page.goto("/wishlist"),
      async () => {
        await expect(page.getByText(/^my wishlist$/i)).toBeVisible();
        await expect(page.getByRole("button", { name: /open gift planning/i })).toHaveCount(0);
      }
    );

    await recordTiming(
      rows,
      "secret santa ready",
      () => page.goto("/secret-santa"),
      async () => {
        await expect(page.getByRole("heading", { name: /shopping ideas/i })).toBeVisible();
      }
    );

    await recordTiming(
      rows,
      "secret santa chat ready",
      () => page.goto("/secret-santa-chat"),
      async () => {
        await expect(page.getByRole("heading", { name: /private gift whispers/i })).toBeVisible();
      }
    );

    await recordTiming(
      rows,
      "notifications ready",
      () => page.goto("/notifications"),
      async () => {
        await expect(page.getByText(/notifications/i).first()).toBeVisible();
        await expect(page.getByRole("button", { name: /mark all read/i })).toBeVisible();
      }
    );

    await recordTiming(
      rows,
      "profile ready",
      () => page.goto("/profile"),
      async () => {
        await expect(page.getByText(/my profile/i).first()).toBeVisible();
        await expect(page.getByRole("button", { name: /save changes/i })).toBeVisible();
      }
    );

    await recordTiming(
      rows,
      "create group ready",
      () => page.goto("/create-group"),
      async () => {
        await expect(page.getByRole("heading", { name: /^create group$/i })).toBeVisible();
      }
    );

    await recordTiming(
      rows,
      "logout to login ready",
      async () => {
        await page.goto("/dashboard");
        await page.getByRole("button", { name: /open profile menu/i }).click();
        await page.getByRole("menuitem", { name: /logout/i }).click();
      },
      () => waitForLoginReady(page)
    );

    await attachTimingReport(testInfo, rows);
  });
});
