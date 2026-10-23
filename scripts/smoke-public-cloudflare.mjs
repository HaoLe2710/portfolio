import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const sites = [
  { name: "Preview", url: process.env.PORTFOLIO_STAGING_PREVIEW_URL },
  { name: "Production", url: process.env.PORTFOLIO_PRODUCTION_URL },
];
const routes = [
  "/en",
  "/vi",
  "/en/projects/leafy-aiot-smart-agriculture-platform",
  "/vi/projects/leafy-aiot-smart-agriculture-platform",
  "/en/blog/how-i-built-leafy-iot-alert-workflow",
  "/vi/blog/how-i-built-leafy-iot-alert-workflow",
];

for (const site of sites) assert(site.url, `Set the ${site.name} URL in the environment.`);

const browser = await chromium.launch({ headless: true });
try {
  for (const site of sites) {
    const origin = new URL(site.url).origin;
    const root = await fetch(`${origin}/`, { redirect: "manual" });
    assert([301, 302, 307, 308].includes(root.status), `${site.name} root did not redirect (HTTP ${root.status}).`);
    assert(new URL(root.headers.get("location"), origin).pathname === "/en", `${site.name} root redirect did not target /en.`);

    const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
    assert(sitemapResponse.status === 200, `${site.name} sitemap returned HTTP ${sitemapResponse.status}.`);
    const sitemap = await sitemapResponse.text();
    assert(sitemap.includes(`${origin}/en/projects/`) && sitemap.includes(`${origin}/vi/blog/`), `${site.name} sitemap is missing localized detail routes.`);
    assert([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].every(([, loc]) => new URL(loc).origin === origin), `${site.name} sitemap contains a foreign canonical origin.`);

    const robotsResponse = await fetch(`${origin}/robots.txt`);
    assert(robotsResponse.status === 200, `${site.name} robots.txt returned HTTP ${robotsResponse.status}.`);
    const robots = await robotsResponse.text();
    assert(robots.includes(`${origin}/sitemap.xml`), `${site.name} robots.txt has no matching sitemap URL.`);

    const consoleErrors = [];
    const pageErrors = [];
    const assetFailures = [];
    const publicHttpFailures = [];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("status of 404")) consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/_next/static/") && response.status() >= 400) assetFailures.push(`${response.status()} ${url.pathname}`);
      if (response.status() >= 400 && !url.pathname.includes("/not-found-smoke-")) publicHttpFailures.push(`${response.status()} ${url.pathname}`);
    });

    for (const route of routes) {
      const response = await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
      assert(response?.status() === 200, `${site.name} ${route} returned HTTP ${response?.status() ?? "no response"}.`);
      assert(await page.locator("body").innerText().then((text) => text.trim().length > 0), `${site.name} ${route} rendered an empty body.`);
      assert(await page.locator("html").getAttribute("lang") === route.split("/")[1], `${site.name} ${route} has the wrong document language.`);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      assert(canonical === `${origin}${route}`, `${site.name} ${route} canonical mismatch: ${canonical}.`);
      for (const locale of ["en", "vi"]) {
        const alternate = await page.locator(`link[rel="alternate"][hreflang="${locale}"]`).getAttribute("href");
        assert(alternate?.startsWith(`${origin}/${locale}`), `${site.name} ${route} is missing the ${locale} hreflang alternate.`);
      }

      const refreshed = await page.reload({ waitUntil: "networkidle" });
      assert(refreshed?.status() === 200, `${site.name} direct refresh failed for ${route}.`);
    }

    await page.goto(`${origin}/en`, { waitUntil: "networkidle" });
    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
    const robotsHeader = (await fetch(`${origin}/en`)).headers.get("x-robots-tag") ?? "";
    if (site.name === "Preview") {
      assert(/noindex/i.test(robotsMeta ?? "") || /noindex/i.test(robotsHeader), "Preview is missing noindex metadata/header.");
    } else {
      assert(!/noindex/i.test(robotsMeta ?? "") && !/noindex/i.test(robotsHeader), "Production is incorrectly marked noindex.");
    }

    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 0, `${site.name} /en overflows at ${width}px by ${overflow}px.`);
    }

    const missingPath = `/not-found-smoke-${randomUUID()}`;
    const missingResponse = await page.goto(`${origin}${missingPath}`, { waitUntil: "networkidle" });
    assert(missingResponse?.status() === 404, `${site.name} missing route returned HTTP ${missingResponse?.status() ?? "no response"}, expected 404.`);
    assert(assetFailures.length === 0, `${site.name} static asset failures: ${assetFailures.join(" | ")}`);
    assert(publicHttpFailures.length === 0, `${site.name} HTTP failures: ${publicHttpFailures.join(" | ")}`);
    assert(pageErrors.length === 0, `${site.name} runtime errors: ${pageErrors.join(" | ")}`);
    assert(consoleErrors.length === 0, `${site.name} browser console errors: ${consoleErrors.join(" | ")}`);
    await context.close();
    console.log(`${site.name} public regression PASS: root redirect, vi/en index and detail routes, direct refresh, canonical/hreflang, preview/production robots, sitemap, 404, CSS/JS, console and 375/768/1440 responsive.`);
  }
} finally {
  await browser.close();
}
