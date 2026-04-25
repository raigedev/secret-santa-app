import { expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export const PLAYWRIGHT_AUTH_DIR = path.join(process.cwd(), "playwright", ".auth");
export const PLAYWRIGHT_AUTH_STATE_PATH = path.join(PLAYWRIGHT_AUTH_DIR, "user.json");
export const AUTH_BLOCKED_MESSAGE =
  "Set PLAYWRIGHT_E2E_EMAIL and PLAYWRIGHT_E2E_PASSWORD to a seeded non-production account to enable authenticated Playwright coverage.";
export const GROUP_BLOCKED_MESSAGE =
  "Set PLAYWRIGHT_E2E_GROUP_ID to a real group that the seeded Playwright account can access to enable group-route coverage.";
export const AFFILIATE_REPORT_BLOCKED_MESSAGE =
  "Allow the seeded Playwright account to open the affiliate report and set the matching AFFILIATE_REPORT_ALLOWED_EMAILS or AFFILIATE_REPORT_OWNER_EMAIL value to enable owner-only affiliate coverage.";

export type TestAuthCredentials = {
  email: string;
  password: string;
};

function getNormalizedCsvEnv(key: string): string[] {
  return (process.env[key] || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function getTestAuthCredentials(): TestAuthCredentials | null {
  const email = process.env.PLAYWRIGHT_E2E_EMAIL?.trim();
  const password = process.env.PLAYWRIGHT_E2E_PASSWORD?.trim();

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export function getTestGroupId(): string | null {
  const groupId = process.env.PLAYWRIGHT_E2E_GROUP_ID?.trim();
  return groupId || null;
}

export function canSeededUserOpenAffiliateReport(email: string | null | undefined): boolean {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const allowedEmails = [
    ...getNormalizedCsvEnv("AFFILIATE_REPORT_ALLOWED_EMAILS"),
    ...getNormalizedCsvEnv("AFFILIATE_REPORT_OWNER_EMAIL"),
  ];

  return allowedEmails.includes(normalizedEmail);
}

export async function loginWithTestCredentials(page: Page, credentials: TestAuthCredentials) {
  await page.goto("/login");
  await page.getByPlaceholder(/enter your email address/i).fill(credentials.email);
  await page.getByPlaceholder(/enter your password/i).fill(credentials.password);
  await page.getByRole("button", { name: /^login$/i }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function saveAuthenticatedStorageState(page: Page) {
  await mkdir(PLAYWRIGHT_AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: PLAYWRIGHT_AUTH_STATE_PATH });
}
