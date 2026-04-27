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
      await expect(page.getByRole("heading", { name: /find a secret santa gift they will like/i })).toBeVisible();
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
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/secret-santa");
    await page.getByLabel(/online shop region/i).selectOption({ label: "Philippines" });

    const shoppingOptionPanel = page.getByTestId("shopping-option-panel").first();
    const shoppingOptions = page.getByTestId("shopping-focus-options");
    const optionButtons = shoppingOptions.getByRole("button");
    await expect(optionButtons.first()).toBeVisible();
    await expect(shoppingOptions.getByText(/try this/i)).toHaveCount(0);

    const selectedOption = shoppingOptions.locator('button[aria-pressed="true"]').first();
    await expect(selectedOption).toBeVisible();
    await expect(selectedOption).toHaveCSS("background-color", "rgb(72, 102, 78)");
    await expect(selectedOption.locator("div").first()).toHaveCSS("color", "rgb(255, 255, 255)");

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
    const lazadaCtas = page.getByTestId("lazada-cta-link");
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
      };
    });
    expect(firstLazadaCtaShape.backgroundImage).toContain("linear-gradient");
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
    expect(stickyPanelTop).toBeLessThanOrEqual(1);

    const stickyPanelSurface = await shoppingOptionPanel.evaluate((panel) => {
      const panelStyle = window.getComputedStyle(panel);

      return {
        backgroundColor: panelStyle.backgroundColor,
        backgroundImage: panelStyle.backgroundImage,
      };
    });
    expect(stickyPanelSurface.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(stickyPanelSurface.backgroundImage).not.toContain("rgba");
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

    const overlappingCardHeaders = await curatedCards.evaluateAll((cards) =>
      cards
        .map((card, index) => {
          const header = card.children.item(0);
          const media = card.children.item(1);

          if (!(header instanceof HTMLElement) || !(media instanceof HTMLElement)) {
            return { index, reason: "missing header or media" };
          }

          const headerRect = header.getBoundingClientRect();
          const mediaRect = media.getBoundingClientRect();

          return headerRect.bottom <= mediaRect.top + 1
            ? null
            : { index, headerBottom: headerRect.bottom, mediaTop: mediaRect.top };
        })
        .filter((overlap) => overlap !== null)
    );
    expect(overlappingCardHeaders).toEqual([]);
  });

  test("secret-santa wishlist rail does not trap page scrolling", async ({ page, isMobile }) => {
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/secret-santa");

    const wishlistRail = page.getByTestId("recipient-wishlist-rail").first();
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
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/dashboard/affiliate-report");

    if (canSeededUserOpenAffiliateReport(credentials!.email)) {
      await expect(page.getByRole("heading", { name: /lazada affiliate report/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /open shopping flow/i })).toBeVisible();
      return;
    }

    await page.waitForURL(/\/dashboard$/);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(/your groups/i)).toBeVisible();
  });
});
