import { expect, test, type Page } from "@playwright/test";

import {
  AUTH_BLOCKED_MESSAGE,
  getTestAuthCredentials,
  getTestGroupId,
  loginWithTestCredentials,
} from "../helpers/auth";

// cspell:ignore networkidle

type ProductRoute = {
  name: string;
  path: string;
};

type TextPattern = {
  label: string;
  pattern: RegExp;
};

const credentials = getTestAuthCredentials();
const groupId = getTestGroupId();

const PUBLIC_PRODUCT_ROUTES: ProductRoute[] = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "create-account", path: "/create-account" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "reset-password", path: "/reset-password" },
  { name: "cool-app", path: "/cool-app" },
  { name: "invalid-invite", path: "/invite/not-a-real-token" },
];

const AUTHENTICATED_PRODUCT_ROUTES: ProductRoute[] = [
  { name: "dashboard", path: "/dashboard" },
  { name: "groups", path: "/groups" },
  { name: "create-group", path: "/create-group" },
  { name: "notifications", path: "/notifications" },
  { name: "profile", path: "/profile" },
  { name: "settings", path: "/settings" },
  { name: "history", path: "/history" },
  { name: "wishlist", path: "/wishlist" },
  { name: "shopping-ideas", path: "/secret-santa" },
  { name: "my-giftee", path: "/my-giftee" },
  { name: "gift-tracking", path: "/gift-tracking" },
  { name: "secret-messages", path: "/secret-santa-chat" },
];

const SCREEN_SIZES = [
  { name: "narrow mobile", width: 320, height: 844 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const CUSTOMER_COPY_FORBIDDEN_TERMS: TextPattern[] = [
  { label: "Supabase", pattern: /\bSupabase\b/i },
  { label: "RLS", pattern: /\bRLS\b/i },
  { label: "postback", pattern: /\bpostback\b/i },
  { label: "deterministic", pattern: /\bdeterministic\b/i },
  { label: "fallback", pattern: /\bfallback\b/i },
  { label: "taxonomy", pattern: /\btaxonomy\b/i },
  { label: "raw payload", pattern: /\braw[-_\s]?payload\b/i },
  { label: "service role", pattern: /\bservice[-_\s]?role\b/i },
];

const STALE_DASHBOARD_PILL_PATTERNS: TextPattern[] = [
  { label: "active exchanges summary pill", pattern: /\b\d+\s+active exchanges\b/i },
  { label: "updates summary pill", pattern: /\b\d+\s+updates\b/i },
  { label: "wishlist ready summary pill", pattern: /\b\d+%\s+wishlist ready\b/i },
];

const STALE_ROUTE_COPY: Array<ProductRoute & { patterns: TextPattern[] }> = [
  {
    name: "dashboard",
    path: "/dashboard",
    patterns: [
      ...STALE_DASHBOARD_PILL_PATTERNS,
      { label: "quick start checklist", pattern: /\bquick start checklist\b/i },
      { label: "useful shortcuts", pattern: /\buseful shortcuts\b/i },
      { label: "notification highlights", pattern: /\bnotification highlights\b/i },
    ],
  },
  {
    name: "groups",
    path: "/groups",
    patterns: [
      { label: "group launcher heading", pattern: /\bgroup launcher\b/i },
      { label: "old launcher explainer", pattern: /\bthis page lists your exchanges\b/i },
      { label: "old full-page prompt", pattern: /\bopen the full group page\b/i },
    ],
  },
  {
    name: "secret-messages",
    path: "/secret-santa-chat",
    patterns: [
      { label: "old giftee bucket", pattern: /\bto giftees:/i },
      { label: "old santa bucket", pattern: /\bfrom my santa:/i },
      { label: "backend-ish recipient label", pattern: /\byou as their santa - group:/i },
      { label: "backend-ish group label", pattern: /\brecipient - group:/i },
      { label: "old history readiness chip", pattern: /\bhistory ready\b/i },
      { label: "old ready-for-history chip", pattern: /\bready for history\b/i },
    ],
  },
];

function getAuthenticatedProductRoutes(): ProductRoute[] {
  const routes = [...AUTHENTICATED_PRODUCT_ROUTES];

  if (groupId) {
    routes.push(
      { name: "group-workspace", path: `/group/${groupId}` },
      { name: "group-reveal", path: `/group/${groupId}/reveal` }
    );
  }

  return routes;
}

async function openRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => undefined);
  await page.waitForTimeout(200);
}

async function getVisibleMainText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    return (main instanceof HTMLElement ? main.innerText : document.body.innerText).replace(
      /\s+/g,
      " "
    );
  });
}

async function getHeadingNoise(page: Page) {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
    const headings = [...document.querySelectorAll("main h1, main h2, main h3")]
      .filter(isVisible)
      .map((heading) => ({
        level: heading.tagName.toLowerCase(),
        text: normalize(heading.textContent || ""),
      }))
      .filter((heading) => heading.text.length > 0);
    const duplicateHeadings = Object.entries(
      headings.reduce<Record<string, number>>((counts, heading) => {
        counts[heading.text] = (counts[heading.text] || 0) + 1;
        return counts;
      }, {})
    )
      .filter(([, count]) => count > 1)
      .map(([text, count]) => ({ text, count }));

    return {
      duplicateHeadings,
      h1s: headings.filter((heading) => heading.level === "h1"),
    };
  });
}

async function getLayoutNoise(page: Page) {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const getElementText = (element: HTMLElement) =>
      (element.innerText || element.getAttribute("value") || element.getAttribute("placeholder") || "")
        .replace(/\s+/g, " ")
        .trim();
    const getLineCount = (element: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lineCount = [...range.getClientRects()].filter(
        (rect) => rect.width > 1 && rect.height > 1
      ).length;
      range.detach();
      return lineCount;
    };
    const root = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
    const clippedElements = [
      ...document.querySelectorAll(
        [
          "main button",
          "main a",
          "main [role='button']",
          "main [role='textbox']",
          "main [data-ui-guardrail-text]",
          "main h1",
          "main h2",
          "main h3",
          "main p",
          "main span",
          "main label",
          "main input",
          "main textarea",
          "main select",
        ].join(",")
      ),
    ]
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .filter((element) => {
        if (!isVisible(element)) {
          return false;
        }

        const text = getElementText(element);

        if (text.length < 3) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const isScreenReaderOnly =
          style.position === "absolute" && rect.width <= 2 && rect.height <= 2;
        const canClip =
          ["hidden", "clip"].includes(style.overflowX) ||
          ["hidden", "clip"].includes(style.overflowY);

        if (isScreenReaderOnly || !canClip) {
          return false;
        }

        return (
          element.scrollWidth > element.clientWidth + 3 ||
          element.scrollHeight > element.clientHeight + 3
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          issue: "clipped text",
          tag: element.tagName.toLowerCase(),
          text: getElementText(element).slice(0, 90),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          scrollWidth: element.scrollWidth,
          scrollHeight: element.scrollHeight,
        };
      });
    const awkwardWrappedNames = [...document.querySelectorAll("main [data-ui-guardrail-text]")]
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .filter((element) => {
        if (!isVisible(element)) {
          return false;
        }

        const text = getElementText(element);

        return /^\S{3,12}$/.test(text) && getLineCount(element) > 1;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          issue: "awkward short-name wrap",
          tag: element.tagName.toLowerCase(),
          text: getElementText(element).slice(0, 90),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          scrollWidth: element.scrollWidth,
          scrollHeight: element.scrollHeight,
        };
      });

    return {
      clippedElements: [...clippedElements, ...awkwardWrappedNames],
      overflowX,
    };
  });
}

function getPatternHits(text: string, patterns: TextPattern[]) {
  return patterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label);
}

test.describe("product UI guardrails", () => {
  test("public screens avoid duplicate primary headings", async ({ page }) => {
    for (const route of PUBLIC_PRODUCT_ROUTES) {
      await openRoute(page, route.path);

      const headingNoise = await getHeadingNoise(page);

      expect(
        headingNoise.h1s.length,
        `${route.name} should have at most one visible h1 in the primary content`
      ).toBeLessThanOrEqual(1);
      expect(
        headingNoise.duplicateHeadings,
        `${route.name} should not repeat the same visible heading in the primary content`
      ).toEqual([]);
    }
  });

  test("authenticated screens avoid duplicate headings and internal product copy", async ({
    page,
  }) => {
    test.skip(!credentials, AUTH_BLOCKED_MESSAGE);
    test.setTimeout(90_000);

    await loginWithTestCredentials(page, credentials!);

    for (const route of getAuthenticatedProductRoutes()) {
      await openRoute(page, route.path);

      const [headingNoise, visibleText] = await Promise.all([
        getHeadingNoise(page),
        getVisibleMainText(page),
      ]);

      expect(
        headingNoise.h1s.length,
        `${route.name} should have at most one visible h1 in the primary content`
      ).toBeLessThanOrEqual(1);
      expect(
        headingNoise.duplicateHeadings,
        `${route.name} should not repeat the same visible heading in the primary content`
      ).toEqual([]);
      expect(
        getPatternHits(visibleText, CUSTOMER_COPY_FORBIDDEN_TERMS),
        `${route.name} should not expose backend or implementation wording in customer UI`
      ).toEqual([]);
    }
  });

  test("known noisy UI fragments stay removed", async ({ page }) => {
    test.skip(!credentials, AUTH_BLOCKED_MESSAGE);

    await loginWithTestCredentials(page, credentials!);

    for (const route of STALE_ROUTE_COPY) {
      await openRoute(page, route.path);

      const visibleText = await getVisibleMainText(page);

      expect(
        getPatternHits(visibleText, route.patterns),
        `${route.name} should not reintroduce removed helper panels, summary pills, or bucket labels`
      ).toEqual([]);
    }
  });

  test("core product screens avoid overflow and clipped visible text across key screen sizes", async ({
    page,
  }) => {
    test.skip(!credentials, AUTH_BLOCKED_MESSAGE);
    test.setTimeout(180_000);

    await loginWithTestCredentials(page, credentials!);

    for (const viewport of SCREEN_SIZES) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of getAuthenticatedProductRoutes()) {
        await openRoute(page, route.path);

        const layoutNoise = await getLayoutNoise(page);

        expect(
          layoutNoise.overflowX,
          `${route.name} should not horizontally overflow at ${viewport.name}`
        ).toBeLessThanOrEqual(4);
        expect(
          layoutNoise.clippedElements,
          `${route.name} should not clip visible text or controls at ${viewport.name}`
        ).toEqual([]);
      }
    }
  });
});
