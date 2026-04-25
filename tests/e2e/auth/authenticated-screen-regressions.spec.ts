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
      await expect(page.getByRole("heading", { name: /create a secret santa group/i })).toBeVisible();
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
    await expect(curatedCards.first()).toBeVisible();
    await curatedCards.last().scrollIntoViewIfNeeded();
    await expect(shoppingOptionPanel).toBeVisible();

    const stickyPanelTop = await shoppingOptionPanel.evaluate(
      (panel) => panel.getBoundingClientRect().top
    );
    expect(stickyPanelTop).toBeGreaterThanOrEqual(0);
    expect(stickyPanelTop).toBeLessThanOrEqual(16);

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

  test("secret-santa wishlist rail does not trap page scrolling", async ({ page }) => {
    await loginWithTestCredentials(page, credentials!);
    await page.goto("/secret-santa");

    const wishlistRail = page.getByTestId("recipient-wishlist-rail").first();
    await expect(wishlistRail).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));

    const railBox = await wishlistRail.boundingBox();

    if (!railBox) {
      throw new Error("Recipient wishlist rail was not measurable.");
    }

    await page.mouse.move(
      railBox.x + railBox.width / 2,
      railBox.y + Math.min(railBox.height / 2, 240)
    );
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
