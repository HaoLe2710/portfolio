import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const previewUrl = process.env.PORTFOLIO_STAGING_PREVIEW_URL;
const stagingApiUrl = process.env.PORTFOLIO_STAGING_API_URL;
const credentialsPath = process.env.PORTFOLIO_STAGING_CREDENTIALS_FILE;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function stagingDatabaseCommand(sql) {
  const configPath = resolve("api/wrangler.staging.toml");
  const config = readFileSync(configPath, "utf8");
  assert(/database_name\s*=\s*"portfolio_db_staging"/.test(config), "Staging D1 config does not target portfolio_db_staging.");
  assert(!/database_name\s*=\s*"portfolio_db"\s*(?:\r?\n|$)/m.test(config), "Refusing to execute staging test SQL with a production D1 config.");
  const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
  const result = spawnSync(process.execPath, [
    wrangler,
    "d1",
    "execute",
    "portfolio_db_staging",
    "--remote",
    "--config",
    "wrangler.staging.toml",
    "--command",
    sql,
  ], { cwd: resolve("api"), encoding: "utf8", stdio: ["ignore", "ignore", "ignore"] });
  assert(!result.error && result.status === 0, "Staging-only D1 test operation failed.");
}

async function main() {
  assert(previewUrl, "Set PORTFOLIO_STAGING_PREVIEW_URL to the actual Pages Preview URL.");
  assert(stagingApiUrl, "Set PORTFOLIO_STAGING_API_URL to the staging Worker URL.");
  assert(credentialsPath, "Set PORTFOLIO_STAGING_CREDENTIALS_FILE to the ignored staging credential file.");
  const preview = new URL(previewUrl);
  const api = new URL(stagingApiUrl);
  assert(preview.protocol === "https:" && preview.hostname.endsWith(".pages.dev"), "Preview URL must be a real HTTPS Cloudflare Pages URL.");
  assert(preview.hostname !== "web-porfolio.pages.dev", "Refusing to test the Pages production hostname.");
  assert(api.protocol === "https:" && api.hostname.startsWith("web-portfolio-api-staging.") && api.hostname.endsWith(".workers.dev"),
    "API URL must belong to the staging portfolio Worker.");

  const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
  assert(typeof credentials.email === "string" && typeof credentials.password === "string", "Credential file must contain email and password fields.");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const assetFailures = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/_next/static/") && response.status() >= 400) {
      assetFailures.push(`${response.status()} ${url.pathname}`);
    }
  });

  let testProjectId = null;
  let testBlogId = null;
  let expiredTokenHash = null;
  try {
    const adminResponse = await page.goto(new URL("/admin", preview).href);
    assert(adminResponse?.status() === 200, `Pages Preview /admin returned HTTP ${adminResponse?.status() ?? "no response"}.`);
    const adminHeaders = await adminResponse.headers();
    assert((adminHeaders["x-robots-tag"] ?? "").includes("noindex"), "Admin response is missing X-Robots-Tag noindex.");
    assert((adminHeaders["cache-control"] ?? "").includes("no-store"), "Admin response is missing no-store cache policy.");
    await page.getByLabel("Email address").fill(credentials.email);
    await page.getByLabel("Password").fill(credentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("heading", { name: "Portfolio Studio" }).waitFor({ state: "visible" });
    await page.getByRole("heading", { name: "Keep your portfolio current." }).waitFor({ state: "visible" });

    const sessionCookie = (await context.cookies(preview)).find((cookie) => cookie.name === "portfolio_admin_session");
    assert(sessionCookie?.httpOnly && sessionCookie.secure && sessionCookie.sameSite === "Lax", "Session cookie security attributes are incomplete.");
    const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}`;
    const apiRequest = (path, init = {}) => fetch(new URL(path, preview), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.method && init.method !== "GET" ? { Origin: preview.origin, "Content-Type": "application/json" } : {}),
        Cookie: cookieHeader,
        ...init.headers,
      },
    });
    const parseEnvelope = async (response) => await response.json();
    const meResponse = await apiRequest("/api/admin/me");
    assert(meResponse.status === 200 && (await parseEnvelope(meResponse)).success, "Authenticated Pages Function session check failed.");
    const me = await parseEnvelope(await apiRequest("/api/admin/me"));
    const unauthorized = await fetch(new URL("/api/admin/me", preview), { headers: { Accept: "application/json" } });
    assert(unauthorized.status === 401, `Anonymous admin API request returned ${unauthorized.status}, expected 401.`);

    const csrf = await apiRequest("/api/admin/auth/logout", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
      body: "{}",
    });
    assert(csrf.status === 403, `Cross-origin mutation returned ${csrf.status}, expected 403.`);
    const invalid = await apiRequest("/api/admin/content/project/drafts", {
      method: "POST",
      body: JSON.stringify({ slug: "<script>", unknown: true }),
    });
    assert(invalid.status === 400, `Invalid content returned ${invalid.status}, expected 400.`);

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await page.getByRole("heading", { name: "Profile", exact: true }).waitFor({ state: "visible" });
    const publishedProfileBefore = await fetch(new URL("/api/public/profile?locale=en", api)).then((response) => response.json());
    const profileSummary = page.getByRole("group", { name: "Summary" }).locator("textarea").first();
    await profileSummary.fill(`${await profileSummary.inputValue()} Phase 3.1 browser test.`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByRole("status").filter({ hasText: /Draft saved/i }).waitFor({ state: "visible" });
    await page.getByRole("group", { name: "Summary" }).locator("textarea").first().fill("Phase 3.1 second Profile draft revision.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByRole("status").filter({ hasText: /Draft saved/i }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "History" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".revisionRow").filter({ hasText: "Revision 1" }).getByRole("button", { name: "Restore" }).click();
    await page.getByText("Draft v3", { exact: true }).waitFor({ state: "visible" });
    const publishedProfileAfter = await fetch(new URL("/api/public/profile?locale=en", api)).then((response) => response.json());
    assert(JSON.stringify(publishedProfileAfter.data) === JSON.stringify(publishedProfileBefore.data), "A Profile draft changed the staging public API response.");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.getByRole("button", { name: "Profile", exact: true }).waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await page.getByRole("heading", { name: "Skills", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Open", exact: false }).first().click();
    await page.getByRole("button", { name: "Save draft" }).waitFor({ state: "visible" });
    const skillName = page.getByRole("group", { name: "Name" }).locator("input").first();
    await skillName.fill(`${await skillName.inputValue()} E2E`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByRole("status").filter({ hasText: /Draft saved/i }).waitFor({ state: "visible" });
    await page.getByRole("group", { name: "Name" }).locator("input").first().fill("Staging Skills second revision");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByRole("status").filter({ hasText: /Draft saved/i }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "History" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".revisionRow").filter({ hasText: "Revision 1" }).getByRole("button", { name: "Restore" }).click();
    await page.getByText("Draft v3", { exact: true }).waitFor({ state: "visible" });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.getByRole("heading", { name: "Skills", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("heading", { name: "Projects", exact: true }).waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Create draft" }).click();
    await page.getByRole("button", { name: "Save draft" }).waitFor({ state: "visible" });
    const projectSlug = (await page.locator("main h1").textContent())?.trim();
    assert(projectSlug?.startsWith("new-project-"), "Project draft did not open in the editor.");
    testProjectId = new URL(page.url()).searchParams.get("id");
    assert(testProjectId, "Created project draft ID is missing from the editor route.");

    const blockTypes = ["MARKDOWN", "FEATURE_GRID", "ARCHITECTURE_FLOW", "MODULE_LIST", "CI_CD_FLOW", "IMAGE_GALLERY", "METRIC_CARDS", "LINK_GROUP"];
    const blockList = page.locator('[aria-label="Content blocks"]');
    for (const type of blockTypes) {
      await blockList.getByLabel("New content block type").selectOption({ label: type.replaceAll("_", " ") });
      await blockList.getByRole("button", { name: "Add block" }).click();
      await blockList.locator("legend", { hasText: type.replaceAll("_", " ") }).waitFor({ state: "visible" });
    }
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByRole("status").filter({ hasText: "Draft saved" }).waitFor({ state: "visible" });
    const titleGroup = page.getByRole("group", { name: "Title" });
    await titleGroup.locator("input").first().fill("Phase 3.1 staging project v1");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByRole("status").filter({ hasText: "Draft saved" }).waitFor({ state: "visible" });

    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("heading", { name: "Revision history" }).waitFor({ state: "visible" });
    const revisionOne = page.locator(".revisionRow").filter({ hasText: "Revision 1" });
    page.once("dialog", (dialog) => dialog.accept());
    await revisionOne.getByRole("button", { name: "Restore" }).click();
    await page.getByText("Draft v4", { exact: true }).waitFor({ state: "visible" });

    const projectDetail = await parseEnvelope(await apiRequest(`/api/admin/content/project/${encodeURIComponent(testProjectId)}`));
    assert(projectDetail.success && projectDetail.data, "Could not read project draft for concurrent-edit check.");
    const expectedVersion = projectDetail.data.version;
    const snapshotA = structuredClone(projectDetail.data.snapshot);
    const snapshotB = structuredClone(projectDetail.data.snapshot);
    snapshotA.summary.en = "Concurrent staging edit A";
    snapshotB.summary.en = "Concurrent staging edit B";
    const concurrentResults = await Promise.all([snapshotA, snapshotB].map((snapshot) => apiRequest(
      `/api/admin/content/project/${encodeURIComponent(testProjectId)}/draft`,
      { method: "PUT", body: JSON.stringify({ expectedVersion, snapshot }) },
    )));
    const concurrentStatuses = concurrentResults.map((response) => response.status).sort((a, b) => a - b);
    assert(concurrentStatuses[0] === 200 && concurrentStatuses[1] === 409, `Concurrent updates returned ${concurrentStatuses.join(", ")}, expected one 200 and one 409.`);
    await page.reload();
    await page.getByText(`Draft v${expectedVersion + 1}`, { exact: true }).waitFor({ state: "visible" });
    const publicProject = await fetch(new URL(`/api/public/projects/${encodeURIComponent(projectSlug)}?locale=en`, api));
    assert(publicProject.status === 404, `Staging Worker public API exposed a draft project (HTTP ${publicProject.status}).`);

    await page.getByRole("button", { name: "Blog posts", exact: true }).click();
    await page.getByRole("heading", { name: "Blog posts", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Create draft" }).click();
    await page.getByRole("button", { name: "Save draft" }).waitFor({ state: "visible" });
    const blogSlug = (await page.locator("main h1").textContent())?.trim();
    testBlogId = new URL(page.url()).searchParams.get("id");
    assert(blogSlug?.startsWith("new-post-") && testBlogId, "Blog draft did not open in the editor.");
    await page.getByRole("group", { name: "Title" }).locator("input").first().fill("Phase 3.1 staging blog v1");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByRole("status").filter({ hasText: "Draft saved" }).waitFor({ state: "visible" });
    await page.getByRole("group", { name: "Title" }).locator("input").first().fill("Phase 3.1 staging blog v2");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByRole("status").filter({ hasText: "Draft saved" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "History" }).click();
    const blogRevisionOne = page.locator(".revisionRow").filter({ hasText: "Revision 1" });
    page.once("dialog", (dialog) => dialog.accept());
    await blogRevisionOne.getByRole("button", { name: "Restore" }).click();
    await page.getByText("Draft v4", { exact: true }).waitFor({ state: "visible" });
    const publicBlog = await fetch(new URL(`/api/public/blog-posts/${encodeURIComponent(blogSlug)}?locale=en`, api));
    assert(publicBlog.status === 404, `Staging Worker public API exposed a draft blog post (HTTP ${publicBlog.status}).`);

    const expiredToken = randomBytes(32).toString("base64url");
    expiredTokenHash = createHash("sha256").update(expiredToken).digest("base64url");
    stagingDatabaseCommand(`INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (${sqlLiteral(expiredTokenHash)}, ${sqlLiteral(me.data.id)}, '2000-01-01T00:00:00.000Z');`);
    const expired = await fetch(new URL("/api/admin/me", preview), {
      headers: { Cookie: `portfolio_admin_session=${expiredToken}` },
    });
    assert(expired.status === 401 && (expired.headers.get("set-cookie") ?? "").includes("Max-Age=0"), "Expired staging session was not rejected and cleared.");
    stagingDatabaseCommand(`DELETE FROM admin_sessions WHERE token_hash = ${sqlLiteral(expiredTokenHash)};`);
    expiredTokenHash = null;

    await page.getByRole("button", { name: "Audit log", exact: true }).click();
    await page.getByRole("heading", { name: "Audit log", exact: true }).waitFor({ state: "visible" });
    await page.getByText(/draft saved/i).first().waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Projects", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.getByRole("button", { name: "Create draft" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Blog posts", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.getByRole("button", { name: "Create draft" }).waitFor({ state: "visible" });

    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert(scrollWidth <= width, `Admin UI overflows viewport ${width}px (${scrollWidth}px scroll width).`);
    }

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByLabel("Email address").waitFor({ state: "visible" });
    const loggedOut = await fetch(new URL("/api/admin/me", preview), { headers: { Cookie: cookieHeader } });
    assert(loggedOut.status === 401, "A logged-out session still has access to the admin API.");
    assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);
    assert(pageErrors.length === 0, `Browser runtime errors: ${pageErrors.join(" | ")}`);
    assert(assetFailures.length === 0, `Failed static assets: ${assetFailures.join(" | ")}`);
    console.log("Pages Preview CMS E2E PASS: login/session, Profile, Skills, Projects, eight block editors, Blog, Draft save, revision restore, audit, unauthorized, expiry, CSRF, invalid input, concurrent edit, public isolation, responsive, logout.");
  } finally {
    if (expiredTokenHash) {
      try { stagingDatabaseCommand(`DELETE FROM admin_sessions WHERE token_hash = ${sqlLiteral(expiredTokenHash)};`); } catch { /* keep the original test failure */ }
    }
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Pages Preview CMS E2E failed.");
  process.exitCode = 1;
});
