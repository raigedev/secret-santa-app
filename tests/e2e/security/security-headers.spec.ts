import { expect, test } from "@playwright/test";

test.describe("security headers", () => {
  test("public pages send the baseline security headers", async ({ request }) => {
    const response = await request.get("/privacy");
    const headers = response.headers();
    const contentSecurityPolicy = headers["content-security-policy"] || "";

    expect(response.ok()).toBe(true);
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).toContain("frame-src 'none'");
    if (contentSecurityPolicy.includes("http://127.0.0.1:54321")) {
      expect(contentSecurityPolicy).not.toContain("upgrade-insecure-requests");
    } else {
      expect(contentSecurityPolicy).toContain("upgrade-insecure-requests");
    }
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("same-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("geolocation=()");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(headers["x-permitted-cross-domain-policies"]).toBe("none");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("security contact file is public and machine-readable", async ({ request }) => {
    const response = await request.get("/.well-known/security.txt");
    const body = await response.text();

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(body).toContain("Contact: mailto:mysecretsanta.notifications@gmail.com");
    expect(body).toContain("Policy: ");
    expect(body).toContain("Expires: ");
  });
});
