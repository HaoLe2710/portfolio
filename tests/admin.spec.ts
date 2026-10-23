import { expect, test } from "@playwright/test";

function successEnvelope<T>(data: T) {
  return {
    success: true,
    message: "Success",
    data,
    error: null,
    timestamp: new Date().toISOString(),
    path: "/api/admin/test",
  };
}

function errorEnvelope(message: string) {
  return {
    success: false,
    message,
    data: null,
    error: { code: "UNAUTHORIZED", message },
    timestamp: new Date().toISOString(),
    path: "/api/admin/me",
  };
}

test("admin page is private, responsive, and reaches the protected API proxy", async ({ page }) => {
  const adminApiResponses: Array<{ status: number; headers: Record<string, string> }> = [];
  const assetFailures: string[] = [];
  const consoleErrors: string[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/api/admin/")) {
      adminApiResponses.push({ status: response.status(), headers: response.headers() });
    }
    if (new URL(response.url()).pathname.startsWith("/_next/static/") && response.status() >= 400) {
      assetFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);
  const responseHeaders = response?.headers() ?? {};
  expect(responseHeaders["cache-control"]).toContain("no-store");
  expect(responseHeaders["x-content-type-options"]).toBe("nosniff");
  expect(responseHeaders["x-frame-options"]).toBe("DENY");
  expect(responseHeaders["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await expect.poll(() => adminApiResponses.map((item) => item.status)).toContain(401);
  const protectedResponse = adminApiResponses.find((item) => item.status === 401);
  expect(protectedResponse?.headers["cache-control"]).toContain("no-store");
  expect(protectedResponse?.headers["x-content-type-options"]).toBe("nosniff");
  expect(protectedResponse?.headers["x-frame-options"]).toBe("DENY");

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /width=device-width/);
  }
  expect(assetFailures).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("admin sign-in submits same-origin credentials and opens the private workspace", async ({ page }, testInfo) => {
  const meCalls = { count: 0 };
  const baseURL = String(testInfo.project.use.baseURL);
  const expectedOrigin = new URL(baseURL).origin;

  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/admin/me") {
      meCalls.count += 1;
      if (meCalls.count === 1) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify(errorEnvelope("Sign in to access this resource.")) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(successEnvelope({ id: "owner-test", email: "owner@example.test", role: "OWNER" })) });
      }
      return;
    }
    if (pathname === "/api/admin/auth/login" && request.method() === "POST") {
      expect(request.headers().origin).toBe(expectedOrigin);
      expect(request.headers()["content-type"]).toContain("application/json");
      expect(request.postDataJSON()).toEqual({ email: "owner@example.test", password: "temporary-test-password" });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(successEnvelope({ id: "owner-test", email: "owner@example.test", role: "OWNER" })) });
      return;
    }
    if (pathname === "/api/admin/content/project/demo-draft") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(successEnvelope({
        id: "demo-draft",
        type: "project",
        snapshot: { id: "demo-project", slug: "leafy-test-project", title: { en: "Leafy test", vi: "Leafy kiểm thử" }, summary: { en: "Test summary", vi: "Tóm tắt kiểm thử" }, contentBlocks: [] },
        version: 1,
        baseRevision: "published-seed",
        hasPublished: true,
        hasDraft: true,
        state: "DRAFT",
        updatedAt: "2026-10-23T00:00:00.000Z",
      })) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify(errorEnvelope("Unexpected test request.")) });
  });

  await page.goto("/admin?section=project&id=demo-draft");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password").fill("temporary-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "leafy-test-project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
  await expect(page.getByText("owner@example.test")).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
