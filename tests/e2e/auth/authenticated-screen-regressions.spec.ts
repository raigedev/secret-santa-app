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

const AUTHENTICATED_SCREEN_CASES: ScreenCase[] = [
  {
    name: "dashboard",
    path: "/dashboard",
    assertVisible: async (page) => {
      await expect(page.getByRole("button", { name: /open profile menu/i })).toBeVisible();
      await expect(page.getByText(/your groups/i)).toBeVisible();

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
      await expect(page.getByText(/my profile/i).first()).toBeVisible();
      await expect(page.getByText(/reminder settings/i)).toBeVisible();
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
      await expect(page.getByRole("heading", { name: /shopping ideas/i })).toBeVisible();
      await expect(page.getByTestId("shopping-option-panel").first()).toBeVisible();

      const notificationsButton = page.getByRole("button", { name: /open notifications/i });
      await expect(notificationsButton).toBeVisible();
      await notificationsButton.click();
      await expect(page.getByTestId("dashboard-notifications-panel")).toBeVisible();
      await expect(page).toHaveURL(/\/secret-santa$/);
      await page.getByRole("button", { name: /close notifications/i }).click();
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
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginWithTestCredentials(page, credentials!);
      await page.goto(screen.path);
      await screen.assertVisible(page);

      if (screen.path === "/secret-santa") {
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
    await expect(appShell).toBeVisible();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "aria-current",
      "page"
    );

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
    await expect(page.getByText(/your groups/i)).toBeVisible();

    const viewRecipientAction = page.getByRole("button", { name: /view recipient/i });
    const hasDrawnRecipient = await viewRecipientAction
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasDrawnRecipient) {
      await page.reload();
      await expect(page.getByRole("button", { name: /no recipient yet/i })).toBeVisible();
      return;
    }

    await page.addInitScript(() => {
      const dashboardWindow = window as Window & {
        __dashboardSawNoRecipientYet?: boolean;
      };
      dashboardWindow.__dashboardSawNoRecipientYet = false;

      const markWrongGiftMatchState = () => {
        if (document.body?.innerText.includes("No Recipient Yet")) {
          dashboardWindow.__dashboardSawNoRecipientYet = true;
        }
      };

      const observer = new MutationObserver(markWrongGiftMatchState);
      const startWatching = () => {
        markWrongGiftMatchState();
        observer.observe(document.documentElement, {
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

    const santaHelper = page.getByTestId("santa-helper");
    await expect(santaHelper).toBeVisible();
    await expect(page.getByTestId("santa-helper-panel").first()).toBeVisible();
    await expect(page.getByText(/safest pick/i).first()).toBeVisible();
    await expect(page.getByTestId("santa-helper-toggle")).toHaveAttribute(
      "aria-label",
      /jump to top picks/i
    );
    const santaHelperAnimations = await page
      .getByTestId("santa-helper")
      .evaluate((helper) => {
        const button = helper.querySelector('[data-testid="santa-helper-toggle"]');
        const mascot = helper.querySelector(".santa-helper-mascot");

        return {
          buttonAnimation:
            button instanceof HTMLElement
              ? window.getComputedStyle(button).animationName
              : "",
          mascotAnimation:
            mascot instanceof SVGElement
              ? window.getComputedStyle(mascot).animationName
              : "",
        };
      });
    expect(santaHelperAnimations.buttonAnimation).toContain("santa-helper-warp");
    expect(santaHelperAnimations.mascotAnimation).toContain("santa-helper-bob");

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

    const cardsMissingBudgetTarget = await curatedCards.evaluateAll((cards) =>
      cards
        .map((card, index) => ({
          index,
          text: card.textContent?.replace(/\s+/g, " ").trim() || "",
        }))
        .filter((card) => !/Budget target:/i.test(card.text))
    );
    expect(cardsMissingBudgetTarget).toEqual([]);

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
    await expect(page.getByText(/your groups/i)).toBeVisible();
  });
});
