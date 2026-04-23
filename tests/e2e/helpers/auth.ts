import { expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export const PLAYWRIGHT_AUTH_DIR = path.join(process.cwd(), "playwright", ".auth");
export const PLAYWRIGHT_AUTH_STATE_PATH = path.join(PLAYWRIGHT_AUTH_DIR, "user.json");
export const AUTH_BLOCKED_MESSAGE =
  "Set PLAYWRIGHT_E2E_EMAIL and PLAYWRIGHT_E2E_PASSWORD to a seeded non-production account to enable authenticated Playwright coverage.";

type TestAuthCredentials = {
  email: string;
  password: string;
};

export function getTestAuthCredentials(): TestAuthCredentials | null {
  const email = process.env.PLAYWRIGHT_E2E_EMAIL?.trim();
  const password = process.env.PLAYWRIGHT_E2E_PASSWORD?.trim();

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export async function loginWithTestCredentials(page: Page, credentials: TestAuthCredentials) {
  await page.goto("/login");
  await page.getByPlaceholder(/username or email/i).fill(credentials.email);
  await page.getByPlaceholder(/enter your password/i).fill(credentials.password);
  await page.getByRole("button", { name: /^login$/i }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function saveAuthenticatedStorageState(page: Page) {
  await mkdir(PLAYWRIGHT_AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: PLAYWRIGHT_AUTH_STATE_PATH });
}
