import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  AUTH_BLOCKED_MESSAGE,
  GROUP_BLOCKED_MESSAGE,
  canSeededUserOpenAffiliateReport,
  getTestAuthCredentials,
  getTestGroupId,
  loginWithTestCredentials,
} from "../helpers/auth";

type NavigationCase = {
  label: RegExp;
  expectedHref: RegExp;
  expectedUrl: RegExp;
  ready: (page: Page) => Promise<void>;
};

const credentials = getTestAuthCredentials();
const groupId = getTestGroupId();
const CRITICAL_CONSOLE_PATTERNS = [
  /maximum update depth exceeded/i,
  /hydration failed/i,
  /cannot read properties/i,
  /uncaught/i,
];

function isNonCriticalLocalNavigationAbort(text: string): boolean {
  if (!text.endsWith(" due to access control checks.")) {
    return false;
  }

  return (
    text.includes("/127.0.0.1:54321/rest/v1/") ||
    text.includes("/localhost:54321/rest/v1/") ||
    text.includes("/127.0.0.1:3000/") ||
    text.includes("/localhost:3000/")
  );
}

const SHARED_NAVIGATION_CASES: NavigationCase[] = [
  {
    label: /^dashboard$/i,
    expectedHref: /\/dashboard$/,
    expectedUrl: /\/dashboard$/,
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: /active exchanges/i })).toBeVisible();
    },
  },
  {
    label: /^my groups$/i,
    expectedHref: /\/groups$/,
    expectedUrl: /\/groups$/,
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: /your groups/i })).toBeVisible();
    },
  },
  {
    label: /^my giftee$/i,
    expectedHref: /\/my-giftee$/,
    expectedUrl: /\/my-giftee$/,
    ready: async (page) => {
      await expect(page.getByTestId("secret-santa-page-shell")).toBeVisible();
      await expect(page.getByTestId("my-giftee-workspace")).toBeVisible();
    },
  },
  {
    label: /^my wishlist$/i,
    expectedHref: /\/wishlist$/,
    expectedUrl: /\/wishlist$/,
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: /^my wishlist$/i })).toBeVisible();
    },
  },
  {
    label: /^messages$/i,
    expectedHref: /\/secret-santa-chat$/,
    expectedUrl: /\/secret-santa-chat$/,
    ready: async (page) => {
      await expect(page.getByTestId("secret-santa-chat-page")).toBeVisible();
      await expect(page.getByRole("heading", { name: /^secret messages$/i }).first()).toBeVisible();
    },
  },
  {
    label: /^shopping ideas$/i,
    expectedHref: /\/secret-santa$/,
    expectedUrl: /\/secret-santa$/,
    ready: async (page) => {
      await expect(page.getByTestId("secret-santa-page-shell")).toBeVisible();
      await expect(page.getByRole("heading", { name: /shopping ideas/i })).toBeVisible();
    },
  },
  {
    label: /^gift progress$/i,
    expectedHref: /\/gift-tracking$/,
    expectedUrl: /\/gift-tracking$/,
    ready: async (page) => {
      await expect(page.getByTestId("secret-santa-page-shell")).toBeVisible();
      await expect(page.getByTestId("gift-tracking-workspace")).toBeVisible();
    },
  },
  {
    label: /^history$/i,
    expectedHref: /\/history$/,
    expectedUrl: /\/history$/,
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: /history memory book/i })).toBeVisible();
    },
  },
  {
    label: /^settings$/i,
    expectedHref: /\/settings$/,
    expectedUrl: /\/settings$/,
    ready: async (page) => {
      await expect(page.getByTestId("settings-workspace")).toBeVisible();
    },
  },
];

function monitorCriticalPageErrors(page: Page) {
  const issues: string[] = [];

  const recordIssue = (text: string) => {
    if (isNonCriticalLocalNavigationAbort(text)) {
      return;
    }

    issues.push(text);
  };

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (CRITICAL_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) {
      recordIssue(text);
    }
  });

  page.on("pageerror", (error) => {
    recordIssue(error.message);
  });

  return {
    expectClean() {
      expect(issues, "Expected no critical console or page errors").toEqual([]);
    },
  };
}

async function expectVisibleNonDarkSurface(page: Page) {
  const surface = await page.evaluate(() => {
    const main = document.querySelector("main");
    const target = main instanceof HTMLElement ? main : document.body;
    const style = window.getComputedStyle(target);
    const rect = target.getBoundingClientRect();

    return {
      background: `${style.background} ${style.backgroundColor} ${style.backgroundImage}`,
      height: rect.height,
      textLength: (target.innerText || "").trim().length,
    };
  });

  expect(surface.textLength, "The destination should not be a blank page").toBeGreaterThan(12);
  expect(surface.height, "The destination should own the viewport surface").toBeGreaterThan(360);
  expect(surface.background).not.toContain("rgb(10, 22, 40)");
  expect(surface.background).not.toContain("rgb(15, 23, 42)");
}

async function expectSharedNavigationContract(page: Page) {
  const sidebar = page.getByTestId("app-shell-sidebar");
  await expect(sidebar).toBeVisible();

  for (const navItem of SHARED_NAVIGATION_CASES) {
    await expect(sidebar.getByRole("link", { name: navItem.label })).toHaveAttribute(
      "href",
      navItem.expectedHref
    );
  }

  await expect(sidebar.getByRole("link", { name: /^assignments$/i })).toHaveCount(0);
}

async function expectOnlyCurrentSidebarLink(sidebar: Locator, label: RegExp) {
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: label })).toHaveAttribute(
    "aria-current",
    "page"
  );
}

async function clickVisibleNavigationLink(link: Locator) {
  await expect(link).toBeVisible();
  await link.click({ force: true });
}

function isTransientFirefoxNavigationAbort(error: unknown): boolean {
  return error instanceof Error && /NS_BINDING_ABORTED|frame was detached/i.test(error.message);
}

async function returnToDashboard(page: Page) {
  const currentPathname = new URL(page.url()).pathname;

  if (currentPathname !== "/dashboard") {
    try {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!isTransientFirefoxNavigationAbort(error)) {
        throw error;
      }
    }
  }

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /active exchanges/i })).toBeVisible();
}

async function expectSantaAssistantClearOf(page: Page, target: Locator, label: string) {
  await expect(page.getByTestId("santa-assistant-toggle")).toBeVisible();
  await expect(target.first()).toBeVisible();

  const overlap = await target.first().evaluate((targetElement) => {
    const assistant = document.querySelector<HTMLElement>(
      '[data-testid="santa-assistant-toggle"]'
    );

    if (!assistant) {
      return { hasAssistant: false, overlaps: true };
    }

    const assistantRect = assistant.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const overlaps =
      assistantRect.left < targetRect.right &&
      assistantRect.right > targetRect.left &&
      assistantRect.top < targetRect.bottom &&
      assistantRect.bottom > targetRect.top;

    return { hasAssistant: true, overlaps };
  });

  expect(overlap.hasAssistant, `Santa assistant should render before checking ${label}`).toBe(
    true
  );
  expect(overlap.overlaps, `Santa assistant should not cover ${label}`).toBe(false);
}

test.describe("authenticated workflow edge cases", () => {
  test.setTimeout(150_000);
  test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

  test("shared sidebar has a stable route contract for every primary tool", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard");

    await expectSharedNavigationContract(page);

    const affiliateReportLink = page
      .getByTestId("app-shell-sidebar")
      .getByRole("link", { name: /^affiliate report$/i });

    if (canSeededUserOpenAffiliateReport(credentials!.email)) {
      await expect(affiliateReportLink).toHaveAttribute("href", /\/dashboard\/affiliate-report$/);
    } else {
      await expect(affiliateReportLink).toHaveCount(0);
    }
  });

  test("sidebars keep one correct active item across app sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard");

    const sharedSidebar = page.getByTestId("app-shell-sidebar");
    await expectOnlyCurrentSidebarLink(sharedSidebar, /^dashboard$/i);

    const myGroupsLink = sharedSidebar.getByRole("link", { name: /^my groups$/i });
    await myGroupsLink.click();
    await expect(page).toHaveURL(/\/groups$/);
    await expectOnlyCurrentSidebarLink(sharedSidebar, /^my groups$/i);

    await sharedSidebar.getByRole("link", { name: /^dashboard$/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectOnlyCurrentSidebarLink(sharedSidebar, /^dashboard$/i);

    await sharedSidebar.getByRole("link", { name: /^my wishlist$/i }).click();
    await expect(page).toHaveURL(/\/wishlist$/);
    await expectOnlyCurrentSidebarLink(sharedSidebar, /^my wishlist$/i);

    await sharedSidebar.getByRole("link", { name: /^messages$/i }).click();
    await expect(page).toHaveURL(/\/secret-santa-chat$/);
    await expectOnlyCurrentSidebarLink(sharedSidebar, /^messages$/i);

    await sharedSidebar.getByRole("link", { name: /^settings$/i }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expectOnlyCurrentSidebarLink(sharedSidebar, /^settings$/i);

    await page.goto("/secret-santa");
    const shoppingSidebar = page.getByTestId("shopping-ideas-sidebar");
    await expectOnlyCurrentSidebarLink(shoppingSidebar, /^shopping ideas$/i);

    await clickVisibleNavigationLink(
      shoppingSidebar.getByRole("link", { name: /^my giftee$/i })
    );
    await expect(page).toHaveURL(/\/my-giftee$/);
    await expectOnlyCurrentSidebarLink(page.getByTestId("shopping-ideas-sidebar"), /^my giftee$/i);

    const giftProgressLink = page
      .getByTestId("shopping-ideas-sidebar")
      .getByRole("link", { name: /^gift progress$/i });
    await clickVisibleNavigationLink(giftProgressLink);
    await expect(page).toHaveURL(/\/gift-tracking$/);
    await expectOnlyCurrentSidebarLink(page.getByTestId("shopping-ideas-sidebar"), /^gift progress$/i);
  });

  test("my groups delete requires an in-page exact-name confirmation", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/groups");
    await expect(page.getByRole("heading", { name: /your groups/i })).toBeVisible();

    const appModalDisplay = await page.evaluate(() => {
      const pageMain = document.querySelector<HTMLElement>("[data-app-shell-content] > main");
      if (!pageMain) {
        return "missing-main";
      }

      const modalProbe = document.createElement("div");
      modalProbe.dataset.appModal = "true";
      modalProbe.className = "fixed inset-0";
      pageMain.append(modalProbe);
      const display = window.getComputedStyle(modalProbe).display;
      modalProbe.remove();
      return display;
    });
    expect(appModalDisplay).not.toBe("none");

    const deleteButton = page.getByRole("button", { name: /^delete$/i }).first();
    if (!(await deleteButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      testInfo.annotations.push({
        type: "edge-case-note",
        description: "Seeded account has no owned group delete button right now.",
      });
      return;
    }

    await deleteButton.click();
    const dialog = page.getByRole("dialog", { name: /delete .+\?/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/type the group name to confirm/i)).toBeVisible();
    const confirmInput = dialog.getByLabel(/type the group name/i);
    const deleteForeverButton = dialog.getByRole("button", { name: /delete forever/i });
    await expect(deleteForeverButton).toBeDisabled();

    await confirmInput.fill("__not_the_group_name__");
    await expect(deleteForeverButton).toBeDisabled();
    await expect(dialog.getByText(/match the exact group name/i)).toBeVisible();

    const exactGroupName = await confirmInput.getAttribute("placeholder");
    if (exactGroupName) {
      await confirmInput.fill(exactGroupName);
      await expect(deleteForeverButton).toBeEnabled();
    }

    await dialog.getByRole("button", { name: /keep group/i }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("my groups keeps Santa Buddy clear of workspace controls", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/groups");
    await expect(page.getByRole("heading", { name: /your groups/i })).toBeVisible();
    await expectSantaAssistantClearOf(
      page,
      page.getByRole("button", { name: /open full workspace/i }),
      "the desktop Exchange health action"
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/groups");
    await expect(page.getByRole("heading", { name: /your groups/i })).toBeVisible();
    await expectSantaAssistantClearOf(
      page,
      page.getByRole("button", { name: /open overview/i }),
      "the mobile overview action"
    );
  });

  test("group scoped routes select their matching shared sidebar item", async ({ page }) => {
    test.skip(!groupId, GROUP_BLOCKED_MESSAGE);

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto(`/group/${groupId}`);

    const sidebar = page.getByTestId("app-shell-sidebar");
    await expect(page.getByText(/monitor participation and progress/i)).toBeVisible();
    await expectOnlyCurrentSidebarLink(sidebar, /^my groups$/i);

    await page.goto(`/group/${groupId}/reveal`);
    await expect(page.getByText(/one event\. two reveal moments\./i)).toBeVisible();
    await expectOnlyCurrentSidebarLink(sidebar, /^my giftee$/i);
  });

  test("shared sidebar navigation reaches each destination without blank or dark-page flashes", async ({
    page,
  }) => {
    const pageHealth = monitorCriticalPageErrors(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);

    for (const navItem of SHARED_NAVIGATION_CASES) {
      await returnToDashboard(page);
      await expectSharedNavigationContract(page);

      await page.getByTestId("app-shell-sidebar").getByRole("link", { name: navItem.label }).click();
      await expect(page).toHaveURL(navItem.expectedUrl);
      await navItem.ready(page);
      await expectVisibleNonDarkSurface(page);
    }

    pageHealth.expectClean();
  });

  test("shopping ideas sidebar keeps the same destination intent as the shared shell", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/secret-santa");
    await expect(page.getByTestId("secret-santa-page-shell")).toBeVisible();

    const sidebar = page.getByTestId("shopping-ideas-sidebar");
    const shoppingIdeasLink = sidebar.getByRole("link", { name: /^shopping ideas$/i });
    const myGifteeLink = sidebar.getByRole("link", { name: /^my giftee$/i });
    await expect(sidebar).toBeVisible();
    await expect(page.getByTestId("shopping-region-helper-control")).toBeVisible();
    await expect(page.getByTestId("shopping-region-mobile-control")).toHaveCount(1);
    await expect(page.getByTestId("shopping-region-budget-control")).toHaveCount(0);
    await expect(page.getByTestId("shopping-region-header-control")).toHaveCount(0);
    await expect(sidebar.locator('select[aria-label="Online shop region"]')).toHaveCount(0);
    await expect(page.getByTestId("shopping-sidebar-current-group")).toContainText(
      /current exchange/i
    );
    await expect(
      page.getByTestId("shopping-sidebar-current-group").getByRole("link", {
        name: /^open group$/i,
      })
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /^dashboard$/i })).toHaveAttribute(
      "href",
      /\/dashboard$/
    );
    await expect(sidebar.getByRole("link", { name: /^my groups$/i })).toHaveAttribute(
      "href",
      /\/groups$/
    );
    await expect(myGifteeLink).toHaveAttribute("href", /\/my-giftee$/);
    await expect(sidebar.getByRole("link", { name: /^my wishlist$/i })).toHaveAttribute(
      "href",
      /\/wishlist$/
    );
    await expect(sidebar.getByRole("link", { name: /^assignments$/i })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: /^gift progress$/i })).toHaveAttribute(
      "href",
      /\/gift-tracking$/
    );
    await expect(sidebar.getByRole("link", { name: /^settings$/i })).toHaveAttribute(
      "href",
      /\/settings$/
    );
    await expect(shoppingIdeasLink).toHaveAttribute("aria-current", "page");

    await myGifteeLink.click();
    await expect(page).toHaveURL(/\/my-giftee$/);
    await expectOnlyCurrentSidebarLink(page.getByTestId("shopping-ideas-sidebar"), /^my giftee$/i);

    await sidebar.getByRole("link", { name: /^my groups$/i }).click();
    await expect(page).toHaveURL(/\/groups$/);
    await expect(page.getByRole("heading", { name: /your groups/i })).toBeVisible();
  });

  test("notification actions leave the inbox for their target screen instead of staying nested", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/notifications");
    await expect(page.getByText(/notifications/i).first()).toBeVisible();

    const addWishlistNotification = page
      .getByRole("button")
      .filter({ hasText: /add wishlist/i })
      .first();

    if (!(await addWishlistNotification.isVisible({ timeout: 5000 }).catch(() => false))) {
      testInfo.annotations.push({
        type: "edge-case-note",
        description:
          "Seeded account has no visible Add wishlist notification right now; route-action click was not applicable.",
      });
      return;
    }

    await addWishlistNotification.click();
    await expect(page).toHaveURL(/\/wishlist$/);
    await expect(page.getByRole("heading", { name: /^my wishlist$/i })).toBeVisible();
  });

  test("safe validation blocks empty workflow submissions before writes", async ({
    page,
  }, testInfo) => {
    const dataWriteRequests: string[] = [];
    page.on("request", (request) => {
      const requestUrl = request.url();

      if (
        request.method().toUpperCase() !== "GET" &&
        /\/rest\/v1\/(wishlist_items|groups|group_members|group_invites|invitations)\b/.test(
          requestUrl
        )
      ) {
        dataWriteRequests.push(`${request.method()} ${requestUrl}`);
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/wishlist");
    await expect(page.getByRole("heading", { name: /^my wishlist$/i })).toBeVisible();

    const addWishlistButton = page.getByRole("button", { name: /add to wishlist/i });
    if (await addWishlistButton.isVisible().catch(() => false)) {
      await page.getByPlaceholder(/item name, brand, or model/i).fill("");
      await addWishlistButton.click();
      await expect(page.getByText(/item name is required/i)).toBeVisible();
    } else {
      testInfo.annotations.push({
        type: "edge-case-note",
        description: "Seeded account has no writable wishlist group right now.",
      });
    }

    await page.goto("/create-group");
    await expect(page.getByRole("heading", { name: /^create group$/i })).toBeVisible();
    await page.getByRole("button", { name: /^create group$/i }).click();
    await expect(page.locator("input:invalid")).toHaveCount(2);

    const createGroupForm = page.locator("form").first();
    const groupNameInput = createGroupForm.getByPlaceholder(/office holiday party/i);
    const eventDateInput = createGroupForm.locator('input[type="date"]');
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await page.getByRole("button", { name: /^use nicknames in this group$/i }).click();
    await groupNameInput.fill("Playwright validation check");
    await eventDateInput.fill(futureDate);
    await expect(groupNameInput).toHaveValue("Playwright validation check");
    await expect(eventDateInput).toHaveValue(futureDate);
    await page.getByRole("button", { name: /^create group$/i }).click();

    await expect(page.getByText(/enter a group nickname to continue/i)).toBeVisible();
    await expect(page).toHaveURL(/\/create-group$/);
    expect(dataWriteRequests).toEqual([]);
  });
});
