import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "out");
const locales = ["en", "vi"];
const expectedSiteOrigin = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).origin;
const expectedRobotsContent =
  process.env.NEXT_PUBLIC_ROBOTS_INDEX === "false"
    ? /name="robots" content="noindex, follow"/
    : /name="robots" content="index, follow"/;

async function readOutputFile(relativePath) {
  return readFile(path.join(outputRoot, relativePath), "utf8");
}

async function assertFile(relativePath, description) {
  const filePath = path.join(outputRoot, relativePath);
  const fileStat = await stat(filePath).catch(() => null);

  assert.ok(fileStat?.isFile(), `${description} is missing: out/${relativePath}`);
}

function routeToHtmlFile(route) {
  const normalized = route.replace(/^\/+|\/+$/g, "");

  return normalized ? `${normalized}.html` : "index.html";
}

function getCanonicalUrl(html) {
  const match = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);

  assert.ok(match, "Generated page is missing a canonical link");

  return new URL(match[1]);
}

async function verify() {
  await assertFile("404.html", "Global 404 page");
  await assertFile("robots.txt", "robots.txt");
  await assertFile("sitemap.xml", "sitemap.xml");
  await assertFile("_redirects", "Cloudflare Pages redirects file");

  const redirects = await readOutputFile("_redirects");
  assert.match(redirects, /^\/\s+\/en\s+302\s*$/m, "Root must redirect to /en");

  const notFound = await readOutputFile("404.html");
  assert.match(notFound, /404 · Page not found/);
  assert.match(notFound, /href="\/en"/);
  assert.match(notFound, /href="\/vi"/);
  assert.match(notFound, /name="robots" content="noindex/);

  const sitemap = await readOutputFile("sitemap.xml");
  const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
    const url = new URL(match[1]);

    return { path: url.pathname, url: match[1] };
  });
  const routePaths = new Set(routes.map((route) => route.path));

  assert.ok(routes.length > 0, "Sitemap must contain routes");
  assert.equal(routePaths.size, routes.length, "Sitemap contains duplicate URLs");

  for (const locale of locales) {
    assert.ok(routePaths.has(`/${locale}`), `Missing ${locale} homepage in sitemap`);
    assert.ok(
      routePaths.has(`/${locale}/projects`),
      `Missing ${locale} projects page in sitemap`
    );
    assert.ok(
      routePaths.has(`/${locale}/blog`),
      `Missing ${locale} blog page in sitemap`
    );

    const localeProjectRoutes = routes.filter(
      ({ path: route }) => route.startsWith(`/${locale}/projects/`)
    );
    const localeBlogRoutes = routes.filter(({ path: route }) =>
      route.startsWith(`/${locale}/blog/`)
    );

    assert.ok(localeProjectRoutes.length > 0, `No ${locale} project details generated`);
    assert.ok(localeBlogRoutes.length > 0, `No ${locale} blog details generated`);
  }

  const routeCountsByLocale = locales.map((locale) => ({
    locale,
    projects: routes.filter(({ path: route }) =>
      route.startsWith(`/${locale}/projects/`)
    ).length,
    blog: routes.filter(({ path: route }) =>
      route.startsWith(`/${locale}/blog/`)
    ).length,
  }));
  assert.equal(routeCountsByLocale[0].projects, routeCountsByLocale[1].projects);
  assert.equal(routeCountsByLocale[0].blog, routeCountsByLocale[1].blog);

  for (const { path: route } of routes) {
    const relativePath = routeToHtmlFile(route);
    await assertFile(relativePath, `Static route ${route}`);

    const html = await readOutputFile(relativePath);
    const locale = route.split("/")[1];
    assert.match(html, new RegExp(`<html[^>]+lang="${locale}"`));
    const canonicalUrl = getCanonicalUrl(html);
    assert.equal(canonicalUrl.pathname, route);
    assert.equal(
      canonicalUrl.origin,
      expectedSiteOrigin,
      `Unexpected canonical origin for ${route}`
    );
    assert.match(
      html,
      expectedRobotsContent,
      `Unexpected robots metadata for ${route}`
    );
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.match(html, /<meta name="viewport" content="width=device-width/);
  }

  const robots = await readOutputFile("robots.txt");
  assert.match(robots, /Sitemap:\s+https?:\/\/[^\s]+\/sitemap\.xml/i);
  assert.ok(
    robots.includes(`${expectedSiteOrigin}/sitemap.xml`),
    "robots.txt sitemap must use the configured site origin"
  );

  const cssDirectory = path.join(outputRoot, "_next", "static", "chunks");
  const cssFiles = (await readdir(cssDirectory)).filter((file) => file.endsWith(".css"));
  assert.ok(cssFiles.length > 0, "Static CSS bundle is missing");

  const cssContent = await Promise.all(
    cssFiles.map((file) => readFile(path.join(cssDirectory, file), "utf8"))
  );
  assert.match(
    cssContent.join("\n"),
    /@media\s*\(min-width\s*:\s*(?:40rem|640px)\)/,
    "Responsive breakpoint styles are missing from the CSS bundle"
  );

  console.log(
    `PASS static export: ${routes.length} sitemap routes (${routeCountsByLocale[0].projects} projects and ${routeCountsByLocale[0].blog} blog posts per locale), 404, redirects, metadata, and responsive CSS.`
  );
}

await verify();
