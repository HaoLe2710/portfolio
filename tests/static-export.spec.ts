import { expect, test } from "@playwright/test";

const projectSlug = "leafy-aiot-smart-agriculture-platform";
const blogSlug = "how-i-built-leafy-iot-alert-workflow";

test("root redirects to the default locale", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("both locale homepages expose localized canonical metadata", async ({
  page,
}) => {
  for (const locale of ["en", "vi"]) {
    const response = await page.goto(`/${locale}`);

    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /.+/
    );

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical && new URL(canonical).pathname).toBe(`/${locale}`);

    const alternateLocale = locale === "en" ? "vi" : "en";
    const alternate = await page
      .locator(`link[rel="alternate"][hreflang="${alternateLocale}"]`)
      .getAttribute("href");
    expect(alternate && new URL(alternate).pathname).toBe(`/${alternateLocale}`);
  }
});

test("locale pages expose the configured indexability policy", async ({ page }) => {
  const expectedRobots =
    process.env.NEXT_PUBLIC_ROBOTS_INDEX === "false"
      ? "noindex, follow"
      : "index, follow";

  for (const locale of ["en", "vi"]) {
    await page.goto(`/${locale}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      expectedRobots
    );
  }
});

test("project and blog detail routes survive a direct reload", async ({
  page,
}) => {
  const paths = [
    `/en/projects/${projectSlug}`,
    `/vi/projects/${projectSlug}`,
    `/en/blog/${blogSlug}`,
    `/vi/blog/${blogSlug}`,
  ];

  for (const path of paths) {
    const response = await page.goto(path);

    expect(response?.status(), path).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical && new URL(canonical).pathname, path).toBe(path);

    const reloadResponse = await page.reload();
    expect(reloadResponse?.status(), `reload ${path}`).toBe(200);
  }
});

test("static sitemap and robots files are served", async ({ request }) => {
  const sitemapResponse = await request.get("/sitemap.xml");
  const robotsResponse = await request.get("/robots.txt");

  expect(sitemapResponse.status()).toBe(200);
  expect(await sitemapResponse.text()).toContain("/en/projects/");
  expect(await sitemapResponse.text()).toContain("/vi/blog/");
  expect(robotsResponse.status()).toBe(200);
  expect(await robotsResponse.text()).toContain("Sitemap:");
});

test("internal navigation preserves the current locale and route", async ({
  page,
}) => {
  await page.goto("/en");
  await page.locator('a[href="/en/projects"]').first().click();
  await expect(page).toHaveURL(/\/en\/projects$/);

  await page.locator('a[href="/vi/projects"]').first().click();
  await expect(page).toHaveURL(/\/vi\/projects$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test("unknown routes use the exported 404 page", async ({ page }) => {
  const response = await page.goto("/en/projects/not-a-real-project");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("404 · Page not found")).toBeVisible();
  await expect(page.getByRole("link", { name: "English home" })).toHaveAttribute(
    "href",
    "/en"
  );
  await expect(
    page.getByRole("link", { name: "Trang chủ tiếng Việt" })
  ).toHaveAttribute("href", "/vi");
});

test("all primary routes fit mobile, tablet, and desktop viewports", async ({
  page,
}) => {
  const paths = [
    "/en",
    "/vi",
    "/en/projects",
    "/vi/projects",
    "/en/blog",
    "/vi/blog",
    `/en/projects/${projectSlug}`,
    `/vi/projects/${projectSlug}`,
    `/en/blog/${blogSlug}`,
    `/vi/blog/${blogSlug}`,
  ];

  for (const path of paths) {
    await page.goto(path);

    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const documentWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      const overflowingElements = await page.evaluate(() =>
        Array.from(document.body.querySelectorAll<HTMLElement>("*"))
          .map((element) => {
            const bounds = element.getBoundingClientRect();

            return {
              className: typeof element.className === "string" ? element.className : "",
              left: Math.round(bounds.left),
              right: Math.round(bounds.right),
              tagName: element.tagName.toLowerCase(),
            };
          })
          .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1)
          .sort((first, second) => second.right - first.right)
          .slice(0, 8)
      );

      expect(
        documentWidth,
        `${path} at ${width}px; overflowing elements: ${JSON.stringify(overflowingElements)}`
      ).toBeLessThanOrEqual(width);
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
        "content",
        /width=device-width/
      );
    }
  }
});
