import { expect, test, type Page } from "@playwright/test";

import {
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

async function expectBadgeClearOfBellIcon(page: Page, testId: string) {
  const badge = page.getByTestId(testId);

  if (!(await badge.isVisible().catch(() => false))) {
    return;
  }

  const badgeMetrics = await badge.evaluate((badgeElement) => {
    const button = badgeElement.closest("button");
    const icon = button?.querySelector("svg");

    if (!(icon instanceof SVGElement)) {
      return { hasIcon: false, overlapsIcon: true };
    }

    const badgeRect = badgeElement.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const overlapsIcon =
      badgeRect.left < iconRect.right &&
      badgeRect.right > iconRect.left &&
      badgeRect.top < iconRect.bottom &&
      badgeRect.bottom > iconRect.top;

    return { hasIcon: true, overlapsIcon };
  });

  expect(badgeMetrics.hasIcon).toBe(true);
  expect(badgeMetrics.overlapsIcon).toBe(false);
}

async function installBodyTextWatcher(
  page: Page,
  options: {
    flagName: string;
    includedText?: string[];
    matchSantaGreeting?: boolean;
  }
) {
  await page.addInitScript((watchOptions) => {
    const testWindow = window as unknown as Window & Record<string, boolean | undefined>;
    testWindow[watchOptions.flagName] = false;

    const markIfMatched = () => {
      const text = document.body?.innerText || "";
      const matchedIncludedText =
        watchOptions.includedText?.some((value) => text.includes(value)) || false;
      const matchedSantaGreeting = watchOptions.matchSantaGreeting
        ? /Good (morning|afternoon|evening),\s*Santa\b/i.test(text)
        : false;

      if (matchedIncludedText || matchedSantaGreeting) {
        testWindow[watchOptions.flagName] = true;
      }
    };

    const startWatching = () => {
      markIfMatched();
      new MutationObserver(markIfMatched).observe(document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startWatching, { once: true });
    } else {
      startWatching();
    }
  }, options);
}

const AUTHENTICATED_SCREEN_CASES: ScreenCase[] = [
  {
    name: "dashboard",
    path: "/dashboard",
    assertVisible: async (page) => {
      await expect(page.getByRole("button", { name: /open profile menu/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /group snapshot/i })).toBeVisible();
      await expect(page.getByText(/\b0 days left\b/i)).toHaveCount(0);
      await expectBadgeClearOfBellIcon(page, "app-shell-notification-badge");

      await page.getByRole("button", { name: /open notifications/i }).click();
      const notificationsPanel = page.getByTestId("dashboard-notifications-panel");
      await expect(notificationsPanel).toBeVisible();
      await expect(page.getByRole("button", { name: /^all$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^unread$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /view all notifications/i })).toBeVisible();

      const panelMetrics = await notificationsPanel.evaluate((panel) => {
        const panelRect = panel.getBoundingClientRect();
        const list = panel.querySelector('[data-testid="dashboard-notifications-list"]');
        const listStyle = list ? window.getComputedStyle(list) : null;

        return {
          height: panelRect.height,
          listOverflowY: listStyle?.overflowY || "",
          listMaxHeight: listStyle?.maxHeight || "",
        };
      });
      expect(panelMetrics.height).toBeLessThanOrEqual(450);
      expect(panelMetrics.listOverflowY).toBe("auto");
      expect(parseFloat(panelMetrics.listMaxHeight)).toBeGreaterThanOrEqual(180);
      await expect(page).toHaveURL(/\/dashboard$/);
    },
  },
  {
    name: "my-groups",
    path: "/groups",
    assertVisible: async (page) => {
      await expect(page.getByTestId("app-route-shell")).toBeVisible();
      await expect(page.getByRole("heading", { name: /your groups/i })).toBeVisible();
    },
  },
  {
    name: "create-group",
    path: "/create-group",
    assertVisible: async (page) => {
      await expect(page.getByRole("heading", { name: /create a secret santa group/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /create group/i })).toBeVisible();
    },
  },
  {
    name: "notifications",
    path: "/notifications",
    assertVisible: async (page) => {
      await expect(page.getByText(/notifications/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /mark all read/i })).toBeVisible();
      await expect(page.getByText(/reminder settings/i)).toHaveCount(0);
    },
  },
  {
    name: "profile",
    path: "/profile",
    assertVisible: async (page) => {
      await expect(page.getByText(/my profile/i).first()).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText(/reminder settings/i)).toBeVisible({ timeout: 45_000 });
      await expect(page.getByRole("button", { name: /save changes/i })).toBeVisible({
        timeout: 45_000,
      });
    },
  },
  {
    name: "reminders",
    path: "/reminders",
    assertVisible: async (page) => {
      await expect(page.getByTestId("reminders-workspace")).toBeVisible();
      await expect(page.getByRole("heading", { name: /keep the exchange moving/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /save reminders/i })).toBeVisible();
      await expect(page.getByTestId("santa-assistant-preference-toggle")).toBeVisible();
    },
  },
  {
    name: "wishlist",
    path: "/wishlist",
    assertVisible: async (page) => {
      await expect(page.getByText(/^my wishlist$/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /open gift planning/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /back to dashboard/i })).toHaveCount(0);
    },
  },
  {
    name: "secret-santa",
    path: "/secret-santa",
    assertVisible: async (page) => {
      await expect(page.getByRole("heading", { name: /shopping ideas/i })).toBeVisible();
      await expect(page.getByTestId("shopping-option-panel").first()).toBeVisible();

      const notificationsButton = page.getByRole("button", { name: /open notifications/i });
      await expect(notificationsButton).toBeVisible();
      await expectBadgeClearOfBellIcon(page, "shopping-ideas-notification-badge");
      await notificationsButton.click();
      await expect(page.getByTestId("dashboard-notifications-panel")).toBeVisible();
      await expect(page).toHaveURL(/\/secret-santa$/);
      await page.getByRole("button", { name: /close notifications/i }).click();
    },
  },
  {
    name: "my-giftee",
    path: "/my-giftee",
    assertVisible: async (page) => {
      await expect(page.getByRole("heading", { name: /my giftee/i })).toBeVisible();
      await expect(page.getByTestId("my-giftee-workspace")).toBeVisible();
    },
  },
  {
    name: "gift-tracking",
    path: "/gift-tracking",
    assertVisible: async (page) => {
      await expect(page.getByRole("heading", { name: /gift tracking/i })).toBeVisible();
      await expect(page.getByTestId("gift-tracking-workspace")).toBeVisible();
    },
  },
  {
    name: "secret-santa-chat",
    path: "/secret-santa-chat",
    assertVisible: async (page) => {
      const chatPage = page.getByTestId("secret-santa-chat-page");
      const pageHeading = page.getByRole("heading", { name: /private gift whispers/i });
      await expect(chatPage).toBeVisible();
      await expect(pageHeading).toBeVisible();
      await expect(page.getByText(/one private thread for each secret santa match/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /^dashboard$/i })).toHaveCount(0);

      const headingColor = await pageHeading.evaluate(
        (heading) => window.getComputedStyle(heading).color
      );
      expect(headingColor).toBe("rgb(46, 52, 50)");
    },
  },
];

test.describe("authenticated screen regressions", () => {
  test.setTimeout(90_000);
  test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

  for (const screen of AUTHENTICATED_SCREEN_CASES) {
    test(`${screen.name} renders its core authenticated UI`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginWithTestCredentials(page, credentials!);
      await page.goto(screen.path);
      await screen.assertVisible(page);

      if (
        screen.path === "/secret-santa" ||
        screen.path === "/my-giftee" ||
        screen.path === "/gift-tracking"
      ) {
        await expect(page.getByTestId("app-route-shell")).toHaveCount(0);
        await expect(page.getByTestId("secret-santa-page-shell")).toBeVisible();
        return;
      }

      await expect(page.getByTestId("app-route-shell")).toBeVisible();
      await expect(page.getByTestId("app-shell-sidebar")).toBeVisible();
    });
  }

  test("shared app shell keeps authenticated sections in one frame", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard");

    const appShell = page.getByTestId("app-route-shell");
    const sidebar = page.getByTestId("app-shell-sidebar");
    const dashboardLink = sidebar.getByRole("link", { name: /^dashboard$/i });
    const myGroupsLink = sidebar.getByRole("link", { name: /my groups?/i });
    await expect(appShell).toBeVisible();
    await expect(sidebar).toBeVisible();
    await expect(dashboardLink).toHaveAttribute("aria-current", "page");
    await expect(myGroupsLink).toHaveAttribute("href", /\/groups$/);

    await myGroupsLink.click();
    await expect(page).toHaveURL(/\/groups$/);
    await expect(page.getByRole("heading", { name: /your groups/i })).toBeVisible();
    await expect(myGroupsLink).toHaveAttribute("aria-current", "page");
    await expect(dashboardLink).not.toHaveAttribute("aria-current", "page");

    await myGroupsLink.click();
    await expect(page).toHaveURL(/\/groups$/);
    await expect(myGroupsLink).toHaveAttribute("aria-current", "page");

    await sidebar.getByRole("link", { name: /wishlist/i }).click();
    await page.waitForURL(/\/wishlist$/);
    await expect(appShell).toBeVisible();
    await expect(page.getByText(/^my wishlist$/i)).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /wishlist/i })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await sidebar.getByRole("link", { name: /shopping ideas/i }).click();
    await page.waitForURL(/\/secret-santa/);
    await expect(page.getByTestId("app-route-shell")).toHaveCount(0);
    await expect(page.getByTestId("secret-santa-page-shell")).toBeVisible();
  });

  test("sidebar my giftee navigation keeps a light loading surface", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard");
    await expect(page.getByTestId("app-shell-sidebar")).toBeVisible();

    await page.evaluate(() => {
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);

        if (key?.startsWith("ss_secret_santa_page_snapshot_v1:")) {
          sessionStorage.removeItem(key);
        }
      }
    });

    await page.route("**/rest/v1/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      try {
        await route.continue();
      } catch (error) {
        if (!String(error).includes("Route is already handled")) {
          throw error;
        }
      }
    });

    await page
      .getByTestId("app-shell-sidebar")
      .getByRole("link", { name: /my giftee/i })
      .click();
    await page.waitForURL(/\/my-giftee/);

    const loadingShell = page.getByTestId("secret-santa-loading-shell");
    await expect(loadingShell).toBeVisible({ timeout: 5000 });

    const loadingSurface = await page.evaluate(() => {
      const shell =
        Array.from(
          document.querySelectorAll<HTMLElement>('[data-testid="secret-santa-loading-shell"]')
        ).find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }) || document.querySelector<HTMLElement>('[data-testid="secret-santa-loading-shell"]');

      if (!shell) {
        return { backgroundSignature: "", height: 0 };
      }

      const style = window.getComputedStyle(shell);
      const rect = shell.getBoundingClientRect();

      return {
        backgroundSignature: `${style.background} ${style.backgroundColor} ${style.backgroundImage}`,
        height: Math.max(rect.height, window.innerHeight),
      };
    });

    expect(loadingSurface.backgroundSignature).not.toContain("rgb(10, 22, 40)");
    expect(loadingSurface.backgroundSignature).not.toContain("rgb(15, 23, 42)");
    expect(loadingSurface.height).toBeGreaterThan(500);

    await page.unroute("**/rest/v1/**");
    await expect(page.getByTestId("secret-santa-page-shell")).toBeVisible({ timeout: 20000 });
  });

  test("legacy assignments route redirects to my giftee", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/assignments");
    await expect(page).toHaveURL(/\/my-giftee$/);
    await expect(page.getByRole("heading", { name: /my giftee/i })).toBeVisible();
    await expect(page.getByTestId("my-giftee-workspace")).toBeVisible();
  });

  test("dashboard keeps text readable with a stored midnight preference", async ({ page }) => {
    const dashboardConsoleErrors: string[] = [];

    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration failed|server rendered text/i.test(message.text())
      ) {
        dashboardConsoleErrors.push(message.text());
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /switch to midnight dashboard theme/i }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("ss_dashboard_theme")))
      .toBe("midnight");
    await page.reload();

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /group snapshot/i })).toBeVisible();

    const textSamples = await page.evaluate(() => {
      const parseRgbColor = (color: string) => {
        const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(color);

        if (!match) {
          return null;
        }

        return [Number(match[1]), Number(match[2]), Number(match[3])];
      };
      const relativeLuminance = (color: string) => {
        const labMatch = /lab\(([0-9.]+)%?/i.exec(color);

        if (labMatch) {
          return Number(labMatch[1]) / 100;
        }

        const modernColorMatch = new RegExp("ok" + "lch\\(([0-9.]+)", "i").exec(color);

        if (modernColorMatch) {
          return Number(modernColorMatch[1]);
        }

        const channels = parseRgbColor(color);

        if (!channels) {
          return 1;
        }

        const [red, green, blue] = channels.map((channel) => {
          const normalized = channel / 255;

          return normalized <= 0.03928
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });

        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const readSample = (label: string, selector: string, matcher: RegExp) => {
        const element = Array.from(document.querySelectorAll(selector)).find((candidate) =>
          matcher.test(candidate.textContent || "")
        );

        if (!(element instanceof HTMLElement)) {
          return { color: "", found: false, label, luminance: 1 };
        }

        const color = window.getComputedStyle(element).color;
        return { color, found: true, label, luminance: relativeLuminance(color) };
      };

      return [
        readSample("welcome heading", "h1", /welcome back/i),
        readSample("reveal message", "p", /reveal|manage your groups|wishlists/i),
        readSample("group overview heading", "h2", /group snapshot/i),
        readSample("group overview summary", "p", /quick status for your exchanges/i),
      ];
    });

    for (const sample of textSamples) {
      expect(sample.found, `${sample.label} should be present`).toBe(true);
      expect(sample.luminance, `${sample.label} uses ${sample.color}`).toBeGreaterThan(0.45);
    }

    const shellBackground = await page
      .getByTestId("app-route-shell")
      .evaluate((shell) => window.getComputedStyle(shell).backgroundImage);
    expect(shellBackground).toContain("rgb(8, 17, 31)");

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("ss_dashboard_theme")))
      .toBe("midnight");
    expect(dashboardConsoleErrors).toEqual([]);
  });

  test("viewer name stays consistent between dashboard and shopping ideas refreshes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard");

    const dashboardViewerName = page.getByTestId("app-shell-viewer-name");
    await expect(dashboardViewerName).toBeVisible();

    let expectedViewerName = "";
    await expect
      .poll(
        async () => {
          expectedViewerName = (await dashboardViewerName.textContent())?.trim() || "";
          return /^(profile|santa)$/i.test(expectedViewerName) ? "" : expectedViewerName;
        },
        { timeout: 20000 }
      )
      .not.toBe("");

    await page.goto("/secret-santa");
    await expect(page.getByTestId("secret-santa-page-shell")).toBeVisible({ timeout: 20000 });
    const shoppingViewerName = page.getByTestId("shopping-ideas-viewer-name");
    await expect(shoppingViewerName).toHaveText(expectedViewerName);

    const changedSnapshots = await page.evaluate(() => {
      let changedCount = 0;

      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);

        if (!key?.startsWith("ss_secret_santa_page_snapshot_v1:")) {
          continue;
        }

        const snapshot = JSON.parse(sessionStorage.getItem(key) || "{}") as {
          viewerName?: string;
        };
        snapshot.viewerName = "Snapshot Santa";
        sessionStorage.setItem(key, JSON.stringify(snapshot));
        changedCount += 1;
      }

      return changedCount;
    });
    expect(changedSnapshots).toBeGreaterThan(0);

    await installBodyTextWatcher(page, {
      flagName: "__sawWrongViewerName",
      includedText: ["Snapshot Santa"],
      matchSantaGreeting: true,
    });

    for (let reloadIndex = 0; reloadIndex < 3; reloadIndex += 1) {
      await page.reload();
      await expect(shoppingViewerName).toHaveText(expectedViewerName, { timeout: 10000 });
      await expect(page.getByTestId("shopping-ideas-greeting")).not.toHaveText(/,\s*Santa\b/i);
    }

    const sawWrongViewerName = await page.evaluate(() =>
      Boolean((window as Window & { __sawWrongViewerName?: boolean }).__sawWrongViewerName)
    );
    expect(sawWrongViewerName).toBe(false);
  });

  test("viewer avatar falls back to the selected festive avatar", async ({ page }) => {
    const festiveAvatar = "\u{1F384}";

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard");

    await expect(page.getByTestId("app-shell-viewer-avatar")).toBeVisible();
    await expect
      .poll(async () => (await page.getByTestId("app-shell-viewer-name").textContent())?.trim() || "")
      .not.toMatch(/^(profile|santa)$/i);

    await page.evaluate((avatarEmoji) => {
      window.dispatchEvent(
        new CustomEvent("ss-profile-updated", {
          detail: {
            avatarEmoji,
            avatarUrl: null,
            displayName: "Avatar Tester",
          },
        })
      );
    }, festiveAvatar);

    const dashboardAvatar = page.getByTestId("app-shell-viewer-avatar");
    await expect(dashboardAvatar).toHaveText(festiveAvatar);
    await expect(dashboardAvatar.locator("img")).toHaveCount(0);

    await page.goto("/secret-santa");
    await expect(page.getByTestId("secret-santa-page-shell")).toBeVisible({ timeout: 20000 });
    await expect
      .poll(
        async () => (await page.getByTestId("shopping-ideas-viewer-name").textContent())?.trim() || "",
        { timeout: 20000 }
      )
      .not.toMatch(/^(profile|santa)$/i);

    await page.evaluate((avatarEmoji) => {
      window.dispatchEvent(
        new CustomEvent("ss-profile-updated", {
          detail: {
            avatarEmoji,
            avatarUrl: null,
            displayName: "Avatar Tester",
          },
        })
      );
    }, festiveAvatar);

    const shoppingAvatar = page.getByTestId("shopping-ideas-viewer-avatar");
    await expect(shoppingAvatar).toHaveText(festiveAvatar);
    await expect(shoppingAvatar.locator("img")).toHaveCount(0);
  });

  test("login does not write group memberships from the browser", async ({ page }) => {
    const browserSideGroupMemberWrites: string[] = [];

    page.on("request", (request) => {
      const requestUrl = request.url();

      if (
        requestUrl.includes("/rest/v1/group_members") &&
        request.method().toUpperCase() !== "GET"
      ) {
        browserSideGroupMemberWrites.push(`${request.method()} ${requestUrl}`);
      }
    });

    await loginWithTestCredentials(page, credentials!);

    expect(browserSideGroupMemberWrites).toEqual([]);
  });

  test("dashboard refresh keeps the drawn recipient action stable", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard");
    await page.evaluate(() => {
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);

        if (key?.startsWith("ss_dashboard_snapshot_v1:")) {
          sessionStorage.removeItem(key);
        }
      }
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: /group snapshot/i })).toBeVisible();

    const viewRecipientAction = page.getByRole("button", { name: /view recipient/i });
    const hasDrawnRecipient = await viewRecipientAction
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasDrawnRecipient) {
      await page.reload();
      await expect(page.getByRole("button", { name: /no recipient yet/i })).toBeVisible();
      return;
    }

    await installBodyTextWatcher(page, {
      flagName: "__dashboardSawNoRecipientYet",
      includedText: ["No Recipient Yet"],
    });

    await page.reload();
    await expect(viewRecipientAction).toBeVisible();

    const sawNoRecipientYet = await page.evaluate(() =>
      Boolean(
        (window as Window & { __dashboardSawNoRecipientYet?: boolean })
          .__dashboardSawNoRecipientYet
      )
    );
    expect(sawNoRecipientYet).toBe(false);
  });

  test("secret-santa keeps shopping picks readable", async ({ page }) => {
    const secretSantaConsoleErrors: string[] = [];

    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /maximum update depth exceeded/i.test(message.text())
      ) {
        secretSantaConsoleErrors.push(message.text());
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/secret-santa");
    await page.getByLabel(/online shop region/i).selectOption({ label: "Philippines" });

    const santaAssistant = page.getByTestId("santa-assistant");
    await expect(santaAssistant).toBeVisible();
    const santaAssistantToggle = page.getByTestId("santa-assistant-toggle");
    await expect(santaAssistantToggle).toHaveAttribute(
      "aria-label",
      /secret santa assistant/i
    );
    await expect(santaAssistantToggle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.getByTestId("santa-assistant-logo-face")).toBeVisible();
    const assistantAnimation = await page
      .getByTestId("santa-assistant")
      .locator(".santa-assistant-avatar")
      .evaluate((avatar) => window.getComputedStyle(avatar).animationName);
    expect(assistantAnimation).toContain("santa-assistant-float");
    const faceAnimation = await page
      .getByTestId("santa-assistant-logo-face")
      .evaluate((face) => window.getComputedStyle(face).animationName);
    expect(faceAnimation).toContain("santa-assistant-face-breathe");
    await santaAssistantToggle.click();
    await page.getByLabel(/ask santa buddy/i).fill("What is the budget?");
    await page.getByRole("button", { name: /^ask$/i }).click();
    await expect(page.getByTestId("santa-assistant-bubble")).toContainText(/group budget/i);
    await page.getByRole("button", { name: /hide santa buddy/i }).click();
    await expect(page.getByTestId("santa-assistant")).toHaveCount(0);
    await expect(page.getByTestId("santa-helper-panel").first()).toBeVisible();
    await expect(page.getByTestId("santa-helper-action-strip")).toHaveCount(0);
    await expect(page.getByText(/safest pick/i).first()).toBeVisible();

    const shoppingOptionPanel = page.getByTestId("shopping-option-panel").first();
    const shoppingOptions = page.getByTestId("shopping-focus-options");
    const optionButtons = shoppingOptions.getByRole("button");
    await expect(optionButtons.first()).toBeVisible();
    await expect(shoppingOptions.getByText(/try this/i)).toHaveCount(0);

    const selectedOption = shoppingOptions.locator('button[aria-pressed="true"]').first();
    await expect(selectedOption).toBeVisible();
    await expect(selectedOption).toHaveCSS("background-color", "rgb(72, 102, 78)");
    await expect(selectedOption.locator("div").first()).toHaveCSS("color", "rgb(255, 255, 255)");

    const pageBackdrop = await page.getByTestId("secret-santa-page-shell").evaluate((shell) => {
      const style = window.getComputedStyle(shell);

      return {
        backgroundImage: style.backgroundImage,
      };
    });
    expect(pageBackdrop.backgroundImage).toContain("repeating-linear-gradient");

    const desktopWishlistStrip = page
      .getByTestId("recipient-wishlist-desktop-strip")
      .first();
    await expect(desktopWishlistStrip).toBeVisible();
    await expect(page.getByTestId("recipient-wishlist-desktop-card").first()).toBeVisible();
    await expect(
      desktopWishlistStrip.locator('button[aria-pressed="true"]').first()
    ).toBeVisible();

    const clippedOptionLabels = await optionButtons.evaluateAll((buttons) =>
      buttons
        .map((button, index) => {
          const label = button.querySelector("div");
          const labelStyle = label ? window.getComputedStyle(label) : null;

          return {
            index,
            text: button.textContent?.replace(/\s+/g, " ").trim() || "",
            isClipped: label ? label.scrollWidth > label.clientWidth + 1 : true,
            textOverflow: labelStyle?.textOverflow || "",
            whiteSpace: labelStyle?.whiteSpace || "",
          };
        })
        .filter(
          (button) =>
            button.isClipped ||
            button.textOverflow === "ellipsis" ||
            button.whiteSpace === "nowrap"
        )
    );

    expect(clippedOptionLabels).toEqual([]);

    const curatedCards = page.getByTestId("curated-shopping-card");
    const curatedSection = page.getByTestId("curated-shopping-section").first();
    await expect(curatedCards.first()).toBeVisible();
    const shoppingSurfaceTexture = await page
      .getByTestId("curated-shopping-section")
      .first()
      .evaluate((card) => window.getComputedStyle(card).backgroundImage);
    expect(shoppingSurfaceTexture).toContain("linear-gradient");

    const decoratedSurfaces = page.locator(
      [
        '[data-testid="recipient-wishlist-rail"]',
        '[data-testid="recipient-wishlist-item-card"]',
        '[data-testid="recipient-wishlist-desktop-strip"]',
        '[data-testid="recipient-wishlist-desktop-card"]',
        '[data-testid="shopping-option-panel"]',
        '[data-testid="curated-shopping-section"]',
        '[data-testid="curated-shopping-card"]',
      ].join(",")
    );
    const undecoratedSurfaces = await decoratedSurfaces.evaluateAll((surfaces) =>
      surfaces
        .map((surface, index) => {
          const style = window.getComputedStyle(surface);
          const borderWidths = [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
          ].map((value) => parseFloat(value));
          const borderStyles = [
            style.borderTopStyle,
            style.borderRightStyle,
            style.borderBottomStyle,
            style.borderLeftStyle,
          ];
          const hasVisibleBorder = borderWidths.some(
            (width, borderIndex) => width >= 1 && borderStyles[borderIndex] !== "none"
          );

          return {
            index,
            borderWidths,
            boxShadow: style.boxShadow,
            hasVisibleBorder,
            testId: surface.getAttribute("data-testid") || "",
          };
        })
        .filter((surface) => !surface.hasVisibleBorder || surface.boxShadow === "none")
    );
    expect(undecoratedSurfaces).toEqual([]);
    const lazadaCtas = page.locator('[data-testid="lazada-cta-link"]:visible');
    await expect(lazadaCtas.first()).toBeVisible();

    const plainArrowLazadaCtas = await lazadaCtas.evaluateAll((links) =>
      links
        .map((link, index) => ({
          index,
          text: link.textContent?.replace(/\s+/g, " ").trim() || "",
        }))
        .filter((link) => /->|→/.test(link.text))
    );
    expect(plainArrowLazadaCtas).toEqual([]);

    const firstLazadaCtaShape = await lazadaCtas.first().evaluate((link) => {
      const linkRect = link.getBoundingClientRect();
      const linkStyle = window.getComputedStyle(link);
      const iconWell = link.querySelector('span[aria-hidden="true"]');
      const iconRect = iconWell instanceof HTMLElement
        ? iconWell.getBoundingClientRect()
        : null;

      return {
        backgroundImage: linkStyle.backgroundImage,
        borderRadius: linkStyle.borderRadius,
        height: linkRect.height,
        iconHeight: iconRect?.height || 0,
        iconWidth: iconRect?.width || 0,
        textColor: linkStyle.color,
      };
    });
    expect(firstLazadaCtaShape.backgroundImage).toContain("linear-gradient");
    expect(firstLazadaCtaShape.backgroundImage).toContain("rgb(72, 102, 78)");
    expect(firstLazadaCtaShape.textColor).toBe("rgb(255, 253, 247)");
    expect(firstLazadaCtaShape.height).toBeGreaterThanOrEqual(42);
    expect(parseFloat(firstLazadaCtaShape.borderRadius)).toBeGreaterThanOrEqual(20);
    expect(firstLazadaCtaShape.iconHeight).toBeGreaterThanOrEqual(26);
    expect(firstLazadaCtaShape.iconWidth).toBeGreaterThanOrEqual(26);

    await shoppingOptionPanel.evaluate((panel) => {
      window.scrollBy(0, panel.getBoundingClientRect().top);
    });
    await expect(shoppingOptionPanel).toBeVisible();

    const stickyPanelTop = await shoppingOptionPanel.evaluate(
      (panel) => panel.getBoundingClientRect().top
    );
    expect(stickyPanelTop).toBeGreaterThanOrEqual(0);
    expect(stickyPanelTop).toBeLessThanOrEqual(100);

    const stickyPanelSurface = await shoppingOptionPanel.evaluate((panel) => {
      const panelStyle = window.getComputedStyle(panel);

      return {
        backgroundColor: panelStyle.backgroundColor,
        backgroundImage: panelStyle.backgroundImage,
      };
    });
    expect(stickyPanelSurface.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(stickyPanelSurface.backgroundImage).toContain("repeating-linear-gradient");
    await curatedSection.scrollIntoViewIfNeeded();

    const stickyPanelBoundary = await shoppingOptionPanel.evaluate((panel) => {
      const curatedSection = document.querySelector(
        '[data-testid="curated-shopping-section"]'
      );

      if (!(curatedSection instanceof HTMLElement)) {
        throw new Error("Curated shopping section was not measurable.");
      }

      const panelRect = panel.getBoundingClientRect();
      const curatedRect = curatedSection.getBoundingClientRect();

      return {
        curatedTop: curatedRect.top,
        panelBottom: panelRect.bottom,
      };
    });
    expect(stickyPanelBoundary.panelBottom).toBeLessThanOrEqual(
      stickyPanelBoundary.curatedTop + 1
    );

    const cardsMissingGroupBudget = await curatedCards.evaluateAll((cards) =>
      cards
        .map((card, index) => ({
          index,
          text: card.textContent?.replace(/\s+/g, " ").trim() || "",
        }))
        .filter((card) => !/Group budget:/i.test(card.text))
    );
    expect(cardsMissingGroupBudget).toEqual([]);

    const clippedRoleLabels = await page
      .getByTestId("curated-shopping-role-label")
      .evaluateAll((labels) =>
        labels
          .map((label, index) => {
            const labelStyle = window.getComputedStyle(label);

            return {
              index,
              text: label.textContent?.replace(/\s+/g, " ").trim() || "",
              isClipped: label.scrollWidth > label.clientWidth + 1,
              textOverflow: labelStyle.textOverflow,
              whiteSpace: labelStyle.whiteSpace,
            };
          })
          .filter(
            (label) =>
              label.isClipped ||
              label.textOverflow === "ellipsis" ||
              label.whiteSpace === "nowrap"
          )
      );
    expect(clippedRoleLabels).toEqual([]);

    const overlappingCardMedia = await curatedCards.evaluateAll((cards) =>
      cards
        .map((card, index) => {
          const media = card.querySelector('[data-testid="curated-shopping-media"]');
          const body = card.querySelector('[data-testid="curated-shopping-body"]');

          if (!(media instanceof HTMLElement) || !(body instanceof HTMLElement)) {
            return { index, reason: "missing media or body" };
          }

          const mediaRect = media.getBoundingClientRect();
          const bodyRect = body.getBoundingClientRect();

          return mediaRect.bottom <= bodyRect.top + 1
            ? null
            : { index, mediaBottom: mediaRect.bottom, bodyTop: bodyRect.top };
        })
        .filter((overlap) => overlap !== null)
    );
    expect(overlappingCardMedia).toEqual([]);
    expect(secretSantaConsoleErrors).toEqual([]);
  });

  test("secret-santa shopping options fit narrow previews", async ({ page }) => {
    await page.setViewportSize({ width: 733, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/secret-santa");

    const shoppingOptionPanel = page.getByTestId("shopping-option-panel").first();
    await shoppingOptionPanel.scrollIntoViewIfNeeded();
    await expect(shoppingOptionPanel).toBeVisible();

    const optionLayout = await page
      .getByTestId("shopping-focus-options")
      .first()
      .evaluate((options) => {
        const firstLabel = options.querySelector("button div");

        if (firstLabel) {
          firstLabel.textContent =
            "Cosmo LADY | Summer Cotton Short Sleeve and Long Pants Men's Lounge wear Set";
        }

        const optionsRect = options.getBoundingClientRect();
        const optionButtons = [...options.querySelectorAll("button")];

        return {
          display: window.getComputedStyle(options).display,
          hasHorizontalOverflow: options.scrollWidth > options.clientWidth + 1,
          overflowingButtons: optionButtons
            .map((button, index) => {
              const buttonRect = button.getBoundingClientRect();
              const label = button.querySelector("div");

              return {
                index,
                buttonOverflows:
                  buttonRect.left < optionsRect.left - 1 ||
                  buttonRect.right > optionsRect.right + 1,
                labelClipped: label ? label.scrollWidth > label.clientWidth + 1 : true,
                text: button.textContent?.replace(/\s+/g, " ").trim() || "",
              };
            })
            .filter((button) => button.buttonOverflows || button.labelClipped),
        };
      });

    expect(optionLayout.display).toBe("grid");
    expect(optionLayout.hasHorizontalOverflow).toBe(false);
    expect(optionLayout.overflowingButtons).toEqual([]);
  });

  test("secret-santa wishlist rail does not trap page scrolling", async ({ page, isMobile }) => {
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/secret-santa");

    let wishlistRail = page.getByTestId("recipient-wishlist-rail").first();

    if (!isMobile && !(await wishlistRail.isVisible().catch(() => false))) {
      await page.setViewportSize({ width: 1100, height: 720 });
      await page.reload();
      wishlistRail = page.getByTestId("recipient-wishlist-rail").first();
    }

    await expect(wishlistRail).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));

    if (isMobile) {
      const mobileScrollState = await wishlistRail.evaluate((rail) => {
        const railStyle = window.getComputedStyle(rail);
        const scrollingElement = document.scrollingElement || document.documentElement;

        return {
          maxHeight: railStyle.maxHeight,
          overflowY: railStyle.overflowY,
          pageCanScroll: scrollingElement.scrollHeight > window.innerHeight + 1,
        };
      });

      expect(mobileScrollState.maxHeight).toBe("none");
      expect(["auto", "scroll"]).not.toContain(mobileScrollState.overflowY);
      expect(mobileScrollState.pageCanScroll).toBe(true);

      await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.8)));
      await expect
        .poll(() => page.evaluate(() => window.scrollY), {
          message: "Page should remain the scrolling surface on mobile layouts.",
        })
        .toBeGreaterThan(0);
      return;
    }

    const railBox = await wishlistRail.boundingBox();

    if (!railBox) {
      throw new Error("Recipient wishlist rail was not measurable.");
    }

    const viewport = page.viewportSize();
    const pointerX = railBox.x + railBox.width / 2;
    const pointerY = Math.min(
      railBox.y + Math.min(railBox.height / 2, 240),
      (viewport?.height || 720) - 20
    );

    await page.mouse.move(pointerX, pointerY);
    await page.mouse.wheel(0, 900);

    await expect
      .poll(() => page.evaluate(() => window.scrollY), {
        message: "Page should scroll when the pointer is over the wishlist rail.",
      })
      .toBeGreaterThan(0);
  });
});

test.describe("group-scoped authenticated regressions", () => {
  test.skip(!credentials || !groupId, !credentials ? AUTH_BLOCKED_MESSAGE : GROUP_BLOCKED_MESSAGE);

  test("group details route renders for a seeded member", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);
    await page.goto(`/group/${groupId}`);
    await expect(page.getByRole("button", { name: /back to dashboard/i })).toBeVisible();
    await expect(page.getByText(/manage members, invites, wishlists, and the name draw from here/i)).toBeVisible();
  });

  test("peer profile lookup stays authenticated and uncached", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);

    const response = await page.request.post("/api/groups/peer-profiles", {
      data: { groupIds: [groupId] },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");

    const body = (await response.json()) as { profilesByGroup?: unknown };
    expect(body.profilesByGroup).toBeTruthy();
    expect(typeof body.profilesByGroup).toBe("object");
  });

  test("my groups sidebar link returns to the groups list", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto(`/group/${groupId}`);

    const sidebar = page.getByTestId("app-shell-sidebar");
    const myGroupsLink = sidebar.getByRole("link", { name: /my groups?/i });

    await expect(myGroupsLink).toHaveAttribute("href", /\/groups$/);
    await myGroupsLink.click();
    await expect(page).toHaveURL(/\/groups$/);
    await expect(page.getByRole("heading", { name: /your groups/i })).toBeVisible();
  });

  test("group reveal route renders for a seeded member", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);
    await page.goto(`/group/${groupId}/reveal`);
    await expect(page.getByRole("button", { name: /back to group/i }).first()).toBeVisible();
    await expect(page.getByText(/one event\. two reveal moments\./i)).toBeVisible();
  });
});

test.describe("owner-only affiliate route regressions", () => {
  test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

  test("affiliate report enforces owner-only access", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard");

    const sharedShellSidebar = page.getByTestId("app-shell-sidebar");
    const sharedShellReportLink = sharedShellSidebar.getByRole("link", {
      name: /affiliate report/i,
    });
    const sharedShellHeaderReportLink = page
      .getByTestId("app-route-shell")
      .locator("header")
      .first()
      .getByRole("link", { name: /affiliate report/i });
    await expect(sharedShellHeaderReportLink).toHaveCount(0);

    if (canSeededUserOpenAffiliateReport(credentials!.email)) {
      await expect(sharedShellReportLink).toBeVisible();
      await sharedShellReportLink.click();
      await page.waitForURL(/\/dashboard\/affiliate-report$/);
      await expect(page.getByRole("heading", { name: /lazada affiliate report/i })).toBeVisible();

      await page.goto("/secret-santa");
      await expect(page.getByRole("heading", { name: /shopping ideas/i })).toBeVisible();
      const shoppingShellReportLink = page
        .getByTestId("shopping-ideas-sidebar")
        .getByRole("link", { name: /affiliate report/i });
      await expect(shoppingShellReportLink).toBeVisible();
      await shoppingShellReportLink.click();
      await page.waitForURL(/\/dashboard\/affiliate-report$/);
      await expect(page.getByRole("heading", { name: /lazada affiliate report/i })).toBeVisible();
      return;
    }

    await expect(sharedShellReportLink).toHaveCount(0);

    await page.goto("/secret-santa");
    await expect(page.getByRole("heading", { name: /shopping ideas/i })).toBeVisible();
    await expect(
      page.getByTestId("shopping-ideas-sidebar").getByRole("link", {
        name: /affiliate report/i,
      })
    ).toHaveCount(0);

    await page.goto("/dashboard/affiliate-report");

    await page.waitForURL(/\/dashboard$/);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /group snapshot/i })).toBeVisible();
  });
});
