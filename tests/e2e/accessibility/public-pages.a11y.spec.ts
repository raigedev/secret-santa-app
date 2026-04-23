import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousA11yViolations(pagePath: string, page: Page) {
  await page.goto(pagePath);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const highImpactViolations = results.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious"
  );

  expect(highImpactViolations, `Expected no serious accessibility violations on ${pagePath}`).toEqual([]);
}

test.describe("public accessibility coverage", () => {
  test("landing page has no serious accessibility violations", async ({ page }) => {
    await expectNoSeriousA11yViolations("/", page);
  });

  test("login page has no serious accessibility violations", async ({ page }) => {
    await expectNoSeriousA11yViolations("/login", page);
  });

  test("create-account page has no serious accessibility violations", async ({ page }) => {
    await expectNoSeriousA11yViolations("/create-account", page);
  });
});
