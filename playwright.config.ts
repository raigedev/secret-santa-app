import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const LOCAL_PLAYWRIGHT_ENV_KEYS = new Set([
  "PLAYWRIGHT_E2E_EMAIL",
  "PLAYWRIGHT_E2E_PASSWORD",
  "PLAYWRIGHT_E2E_GROUP_ID",
]);

function normalizeEnvValue(value: string): string {
  const trimmedValue = value.trim();
  const firstCharacter = trimmedValue.at(0);
  const lastCharacter = trimmedValue.at(-1);

  if (
    trimmedValue.length >= 2 &&
    ((firstCharacter === '"' && lastCharacter === '"') ||
      (firstCharacter === "'" && lastCharacter === "'"))
  ) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

function loadLocalPlaywrightEnv() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();

    if (!LOCAL_PLAYWRIGHT_ENV_KEYS.has(key) || process.env[key]) {
      continue;
    }

    process.env[key] = normalizeEnvValue(trimmedLine.slice(separatorIndex + 1));
  }
}

loadLocalPlaywrightEnv();

const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const authenticatedE2eEnabled = Boolean(
  process.env.PLAYWRIGHT_E2E_EMAIL && process.env.PLAYWRIGHT_E2E_PASSWORD
);

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.ts"],
  // Seeded authenticated checks share one non-production Supabase account.
  // Keep those runs ordered so the auth service is not hit by many identical
  // sign-ins at once. Public smoke tests still run fully parallel when these
  // seeded credentials are absent.
  fullyParallel: !authenticatedE2eEnabled,
  workers: authenticatedE2eEnabled ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: {
    timeout: authenticatedE2eEnabled ? 20_000 : 5_000,
  },
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm.cmd run build && npm.cmd run start:e2e",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        url: baseURL,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
      },
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 13"],
      },
    },
  ],
});
