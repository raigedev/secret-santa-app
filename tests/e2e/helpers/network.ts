import { expect, type Page } from "@playwright/test";

const BASE_ORIGIN = new URL(
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000"
).origin;
const CORE_RESOURCE_TYPES = new Set(["document", "fetch", "font", "image", "script", "stylesheet"]);
const IGNORED_CONSOLE_PATTERNS = [/download the react devtools/i];

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url).origin === BASE_ORIGIN;
  } catch {
    return false;
  }
}

function shouldIgnoreConsoleMessage(message: string): boolean {
  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(message));
}

export function monitorPageHealth(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedCoreRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();

    if (!shouldIgnoreConsoleMessage(text)) {
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    if (!isSameOrigin(request.url()) || !CORE_RESOURCE_TYPES.has(request.resourceType())) {
      return;
    }

    failedCoreRequests.push(
      `${request.resourceType()}: ${request.url()} (${request.failure()?.errorText || "request failed"})`
    );
  });

  page.on("response", (response) => {
    const request = response.request();

    if (!isSameOrigin(response.url()) || !CORE_RESOURCE_TYPES.has(request.resourceType())) {
      return;
    }

    if (response.status() >= 400) {
      failedCoreRequests.push(`${request.resourceType()}: ${response.url()} (${response.status()})`);
    }
  });

  return {
    async expectHealthy() {
      expect(consoleErrors, "Expected no critical console errors").toEqual([]);
      expect(pageErrors, "Expected no uncaught page errors").toEqual([]);
      expect(failedCoreRequests, "Expected no failed same-origin core asset requests").toEqual([]);
    },
  };
}
