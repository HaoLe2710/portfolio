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

async function fetchWithSafeRetry(input, init = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const attempts = method === "GET" || method === "HEAD" ? 3 : 1;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 500));
    }
  }
  throw lastError;
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
  const httpFailures = [];
  page.on("dialog", async (dialog) => { await dialog.accept(); });
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400) httpFailures.push(`${response.status()} ${url.pathname}`);
    if (url.pathname.startsWith("/_next/static/") && response.status() >= 400) {
      assetFailures.push(`${response.status()} ${url.pathname}`);
    }
  });

  let testProjectId = null;
  let testBlogId = null;
  let testSkillsId = null;
  let testProfileTouched = false;
  let cleanupApiRequest = null;
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
    console.log("PASS: Pages Preview admin login and dashboard.");

    const sessionCookie = (await context.cookies([preview.href])).find((cookie) => cookie.name === "portfolio_admin_session");
    assert(sessionCookie?.httpOnly && sessionCookie.secure && sessionCookie.sameSite === "Lax", "Session cookie security attributes are incomplete.");
    const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}`;
    const apiRequest = (path, init = {}) => fetchWithSafeRetry(new URL(path, preview), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.method && init.method !== "GET" ? { Origin: preview.origin, "Content-Type": "application/json" } : {}),
        Cookie: cookieHeader,
        ...init.headers,
      },
    });
    cleanupApiRequest = apiRequest;
    const parseEnvelope = async (response) => await response.json();
    const meResponse = await apiRequest("/api/admin/me");
    assert(meResponse.status === 200 && (await parseEnvelope(meResponse)).success, "Authenticated Pages Function session check failed.");
    const me = await parseEnvelope(await apiRequest("/api/admin/me"));
    const unauthorized = await fetchWithSafeRetry(new URL("/api/admin/me", preview), { headers: { Accept: "application/json" } });
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
    console.log("PASS: Session cookie, authorization, CSRF and invalid-input checks.");

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await page.getByRole("heading", { name: "Profile", exact: true }).waitFor({ state: "visible" });
    const profileDetail = await parseEnvelope(await apiRequest("/api/admin/content/profile/primary"));
    assert(profileDetail.success && profileDetail.data, "Could not read Profile version before browser edits.");
    const profileBaseVersion = profileDetail.data.version;
    testProfileTouched = true;
    const publishedProfileBefore = await fetchWithSafeRetry(new URL("/api/public/profile?locale=en", api)).then((response) => response.json());
    const profileSummary = page.getByRole("group", { name: "Summary" }).locator("textarea").first();
    await profileSummary.fill(`${await profileSummary.inputValue()} Phase 3.1 browser test.`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText(`Draft v${profileBaseVersion + 1}`, { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("group", { name: "Summary" }).locator("textarea").first().fill("Phase 3.1 second Profile draft revision.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText(`Draft v${profileBaseVersion + 2}`, { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "History" }).click();
    const profileHistory = await parseEnvelope(await apiRequest(`/api/admin/content/profile/primary/revisions`));
    assert(profileHistory.success && profileHistory.data?.length, "Profile revision history is empty in Preview.");
    const profileRestoreNumber = profileHistory.data.at(-1).revisionNumber;
    await page.locator('[class*="revisionRow"]').filter({ hasText: new RegExp(`Revision ${profileRestoreNumber} ·`) }).getByRole("button", { name: "Restore" }).click();
    await page.getByText(`Draft v${profileBaseVersion + 3}`, { exact: true }).waitFor({ state: "visible" });
    await page.waitForTimeout(150);
    const publishedProfileAfter = await fetchWithSafeRetry(new URL("/api/public/profile?locale=en", api)).then((response) => response.json());
    assert(JSON.stringify(publishedProfileAfter.data) === JSON.stringify(publishedProfileBefore.data), "A Profile draft changed the staging public API response.");
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get("section") === "profile" && !new URL(location.href).searchParams.has("id"));
    console.log("PASS: Profile draft, history restore, discard and published-data isolation.");

    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await page.getByRole("heading", { name: "Skills", exact: true }).waitFor({ state: "visible" });
    const skillsApi = await apiRequest("/api/admin/content/skills");
    const skillsApiEnvelope = await parseEnvelope(skillsApi);
    assert(skillsApi.status === 200 && skillsApiEnvelope.success, "Skills list endpoint failed in Pages Preview.");
    await page.getByRole("button", { name: "Create draft", exact: true }).waitFor({ state: "visible" });
    const skillRowCount = await page.locator("tbody tr").count();
    if (skillRowCount) {
      await page.getByRole("button", { name: /^Open / }).first().click();
    } else {
      await page.getByRole("button", { name: "Create draft", exact: true }).click();
    }
    await page.getByRole("button", { name: "Save draft" }).waitFor({ state: "visible" });
    const skillsId = new URL(page.url()).searchParams.get("id");
    assert(skillsId, "Skills editor ID is missing from the route.");
    testSkillsId = skillsId;
    const skillsDetail = await parseEnvelope(await apiRequest(`/api/admin/content/skills/${encodeURIComponent(skillsId)}`));
    assert(skillsDetail.success && skillsDetail.data, "Could not read Skills version before browser edits.");
    const skillsBaseVersion = skillsDetail.data.version;
    const skillName = page.getByRole("group", { name: "Name" }).locator("input").first();
    await skillName.fill(`${await skillName.inputValue()} E2E`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText(`Draft v${skillsBaseVersion + 1}`, { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("group", { name: "Name" }).locator("input").first().fill("Staging Skills second revision");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText(`Draft v${skillsBaseVersion + 2}`, { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "History" }).click();
    const skillsHistory = await parseEnvelope(await apiRequest(`/api/admin/content/skills/${encodeURIComponent(skillsId)}/revisions`));
    assert(skillsHistory.success && skillsHistory.data?.length, "Skills revision history is empty in Preview.");
    const skillsRestoreNumber = skillsHistory.data.at(-1).revisionNumber;
    await page.locator('[class*="revisionRow"]').filter({ hasText: new RegExp(`Revision ${skillsRestoreNumber} ·`) }).getByRole("button", { name: "Restore" }).click();
    await page.getByText(`Draft v${skillsBaseVersion + 3}`, { exact: true }).waitFor({ state: "visible" });
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get("section") === "skills" && !new URL(location.href).searchParams.has("id"));
    console.log("PASS: Skills draft, revision restore and discard.");
    await page.getByRole("button", { name: "Projects", exact: true }).click();
    await page.getByRole("heading", { name: "Projects", exact: true }).waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Create draft" }).click();
    await page.getByRole("button", { name: "Save draft" }).waitFor({ state: "visible" });
    const projectSlug = (await page.locator("main h1").textContent())?.trim();
    assert(projectSlug?.startsWith("new-project-"), "Project draft did not open in the editor.");
    testProjectId = new URL(page.url()).searchParams.get("id");
    assert(testProjectId, "Created project draft ID is missing from the editor route.");
    const newProjectDetail = await parseEnvelope(await apiRequest(`/api/admin/content/project/${encodeURIComponent(testProjectId)}`));
    assert(newProjectDetail.success && newProjectDetail.data, "Could not read new Project draft version.");
    const projectBaseVersion = newProjectDetail.data.version;

    const blockTypes = ["MARKDOWN", "FEATURE_GRID", "ARCHITECTURE_FLOW", "MODULE_LIST", "CI_CD_FLOW", "IMAGE_GALLERY", "METRIC_CARDS", "LINK_GROUP"];
    const blockList = page.locator('[aria-label="Content blocks"]');
    for (const type of blockTypes) {
      await blockList.getByLabel("New content block type").selectOption({ label: type.replaceAll("_", " ") });
      await blockList.getByRole("button", { name: "Add block" }).click();
      const typeLabel = type.replaceAll("_", " ");
      const blockSummary = blockList.locator("summary").filter({ hasText: type }).last();
      await blockSummary.waitFor({ state: "visible" });
      const blockDetails = blockSummary.locator("xpath=..");
      if (!(await blockDetails.evaluate((element) => element.open))) await blockSummary.click();
      const blockRow = blockDetails.locator("xpath=..");
      const blockDiagnostic = await blockDetails.evaluate((element) => ({
        open: element.open,
        summary: element.querySelector("summary")?.textContent?.trim(),
        legends: Array.from(element.querySelectorAll("legend")).map((legend) => ({
          text: legend.textContent?.trim(),
          display: getComputedStyle(legend).display,
          visibility: getComputedStyle(legend).visibility,
          height: legend.getBoundingClientRect().height,
        })),
      }));
      console.log(`Block editor ${type}: ${JSON.stringify(blockDiagnostic)}.`);
      await blockRow.locator("legend").filter({ hasText: typeLabel }).waitFor({ state: "visible" });
    }
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText(`Draft v${projectBaseVersion + 1}`, { exact: true }).waitFor({ state: "visible" });
    const titleGroup = page.getByRole("group", { name: "Title" });
    await titleGroup.locator("input").first().fill("Phase 3.1 staging project v1");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText(`Draft v${projectBaseVersion + 2}`, { exact: true }).waitFor({ state: "visible" });

    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("heading", { name: "Revision history" }).waitFor({ state: "visible" });
    const projectHistory = await parseEnvelope(await apiRequest(`/api/admin/content/project/${encodeURIComponent(testProjectId)}/revisions`));
    assert(projectHistory.success && projectHistory.data?.length, "Project revision history is empty in Preview.");
    const projectRestoreNumber = projectHistory.data.at(-1).revisionNumber;
    const revisionOne = page.locator('[class*="revisionRow"]').filter({ hasText: new RegExp(`Revision ${projectRestoreNumber} ·`) });
    await revisionOne.getByRole("button", { name: "Restore" }).click();
    await page.getByText(`Draft v${projectBaseVersion + 3}`, { exact: true }).waitFor({ state: "visible" });

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
    const publicProject = await fetchWithSafeRetry(new URL(`/api/public/projects/${encodeURIComponent(projectSlug)}?locale=en`, api));
    assert(publicProject.status === 404, `Staging Worker public API exposed a draft project (HTTP ${publicProject.status}).`);
    console.log("PASS: Project draft, eight blocks, restore, concurrent edit and public isolation.");

    await page.getByRole("button", { name: "Blog posts", exact: true }).click();
    await page.getByRole("heading", { name: "Blog posts", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Create draft" }).click();
    await page.getByRole("button", { name: "Save draft" }).waitFor({ state: "visible" });
    const blogSlug = (await page.locator("main h1").textContent())?.trim();
    testBlogId = new URL(page.url()).searchParams.get("id");
    assert(blogSlug?.startsWith("new-post-") && testBlogId, "Blog draft did not open in the editor.");
    const newBlogDetail = await parseEnvelope(await apiRequest(`/api/admin/content/blogPost/${encodeURIComponent(testBlogId)}`));
    assert(newBlogDetail.success && newBlogDetail.data, "Could not read new Blog draft version.");
    const blogBaseVersion = newBlogDetail.data.version;
    const blogTitleField = page.getByRole("group", { name: "Title" }).locator("input").first();
    await blogTitleField.fill("Phase 3.1 staging blog v1");
    const blogSaveButton = page.getByRole("button", { name: "Save draft" });
    assert(await blogSaveButton.isEnabled(), "Editing the new Blog title did not enable Save draft.");
    await blogSaveButton.click();
    await page.getByText(`Draft v${blogBaseVersion + 1}`, { exact: true }).waitFor({ state: "visible" });
    await blogTitleField.fill("Phase 3.1 staging blog v2");
    assert(await blogSaveButton.isEnabled(), "Editing the Blog title a second time did not enable Save draft.");
    await blogSaveButton.click();
    await page.getByText(`Draft v${blogBaseVersion + 2}`, { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "History" }).click();
    const blogHistory = await parseEnvelope(await apiRequest(`/api/admin/content/blogPost/${encodeURIComponent(testBlogId)}/revisions`));
    assert(blogHistory.success && blogHistory.data?.length, "Blog revision history is empty in Preview.");
    const blogRestoreNumber = blogHistory.data.at(-1).revisionNumber;
    const blogRevisionOne = page.locator('[class*="revisionRow"]').filter({ hasText: new RegExp(`Revision ${blogRestoreNumber} ·`) });
    await blogRevisionOne.getByRole("button", { name: "Restore" }).click();
    await page.getByText(`Draft v${blogBaseVersion + 3}`, { exact: true }).waitFor({ state: "visible" });
    const publicBlog = await fetchWithSafeRetry(new URL(`/api/public/blog-posts/${encodeURIComponent(blogSlug)}?locale=en`, api));
    assert(publicBlog.status === 404, `Staging Worker public API exposed a draft blog post (HTTP ${publicBlog.status}).`);
    console.log("PASS: Blog draft, revision restore and public isolation.");

    const expiredToken = randomBytes(32).toString("base64url");
    expiredTokenHash = createHash("sha256").update(expiredToken).digest("base64url");
    stagingDatabaseCommand(`INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (${sqlLiteral(expiredTokenHash)}, ${sqlLiteral(me.data.id)}, '2000-01-01T00:00:00.000Z');`);
    const expired = await fetchWithSafeRetry(new URL("/api/admin/me", preview), {
      headers: { Cookie: `portfolio_admin_session=${expiredToken}` },
    });
    assert(expired.status === 401 && (expired.headers.get("set-cookie") ?? "").includes("Max-Age=0"), "Expired staging session was not rejected and cleared.");
    stagingDatabaseCommand(`DELETE FROM admin_sessions WHERE token_hash = ${sqlLiteral(expiredTokenHash)};`);
    expiredTokenHash = null;

    await page.getByRole("button", { name: "Audit log", exact: true }).click();
    await page.getByRole("heading", { name: "Audit log", exact: true }).waitFor({ state: "visible" });
    await page.getByText(/draft saved/i).first().waitFor({ state: "visible" });

    await page.goto(new URL(`/admin?section=project&id=${encodeURIComponent(testProjectId)}`, preview).href);
    await page.getByRole("button", { name: "Discard draft" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.getByRole("button", { name: "Create draft" }).waitFor({ state: "visible" });
    await page.goto(new URL(`/admin?section=blogPost&id=${encodeURIComponent(testBlogId)}`, preview).href);
    await page.getByRole("button", { name: "Discard draft" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.getByRole("button", { name: "Create draft" }).waitFor({ state: "visible" });

    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert(scrollWidth <= width, `Admin UI overflows viewport ${width}px (${scrollWidth}px scroll width).`);
    }

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByLabel("Email address").waitFor({ state: "visible" });
    const loggedOut = await fetchWithSafeRetry(new URL("/api/admin/me", preview), { headers: { Cookie: cookieHeader } });
    assert(loggedOut.status === 401, "A logged-out session still has access to the admin API.");
    const expectedUnauthorizedResponses = httpFailures.filter((failure) => failure === "401 /api/admin/me").length;
    const unexpectedConsoleErrors = consoleErrors.filter((error) => !error.includes("status of 401"));
    assert(unexpectedConsoleErrors.length === 0 && consoleErrors.length <= expectedUnauthorizedResponses,
      `Browser console errors: ${consoleErrors.join(" | ")}; HTTP failures: ${httpFailures.join(" | ")}`);
    assert(pageErrors.length === 0, `Browser runtime errors: ${pageErrors.join(" | ")}`);
    assert(assetFailures.length === 0, `Failed static assets: ${assetFailures.join(" | ")}`);
    console.log("Pages Preview CMS E2E PASS: login/session, Profile, Skills, Projects, eight block editors, Blog, Draft save, revision restore, audit, unauthorized, expiry, CSRF, invalid input, concurrent edit, public isolation, responsive, logout.");
  } finally {
    if (cleanupApiRequest) {
      const cleanupCandidates = [
        ...(testProfileTouched ? [["profile", "primary"]] : []),
        ...(testSkillsId ? [["skills", testSkillsId]] : []),
        ...(testProjectId ? [["project", testProjectId]] : []),
        ...(testBlogId ? [["blogPost", testBlogId]] : []),
      ];
      for (const [type, id] of cleanupCandidates) {
        try {
          const detailResponse = await cleanupApiRequest(`/api/admin/content/${type}/${encodeURIComponent(id)}`);
          const envelope = await detailResponse.json();
          if (envelope.success && envelope.data?.hasDraft) {
            await cleanupApiRequest(`/api/admin/content/${type}/${encodeURIComponent(id)}/draft`, {
              method: "DELETE",
              body: JSON.stringify({ expectedVersion: envelope.data.version }),
            });
          }
        } catch { /* preserve the primary E2E result if staging cleanup cannot reach the API */ }
      }
    }
    if (expiredTokenHash) {
      try { stagingDatabaseCommand(`DELETE FROM admin_sessions WHERE token_hash = ${sqlLiteral(expiredTokenHash)};`); } catch { /* keep the original test failure */ }
    }
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.message}${error.cause ? ` (cause: ${error.cause.code ?? error.cause.message})` : ""}` : "Pages Preview CMS E2E failed.");
  process.exitCode = 1;
});
