import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hashPasswordNode, NODE_PASSWORD_ALGORITHM } from "./argon2id-node";

const confirmStaging = process.argv.includes("--confirm-staging");
const stagingApiUrl = process.env.PORTFOLIO_STAGING_API_URL;
const stagingDatabase = "portfolio_db_staging";
const ownerId = randomUUID();
const ownerEmail = `phase3-smoke-${ownerId}@example.invalid`;
const password = randomBytes(32).toString("base64url");
const draftSlug = `phase3-smoke-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
let draftId: string | null = null;
let ownerSetupAttempted = false;

function reportStage(stage: string) {
  console.log(`Staging smoke: ${stage}.`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function asRecord(value: Record<string, unknown> | Array<Record<string, unknown>> | null) {
  return value && !Array.isArray(value) ? value : null;
}

async function executeStagingSql(sql: string) {
  const folder = join(tmpdir(), `portfolio-stage-smoke-${randomUUID()}`);
  const file = join(folder, "operation.sql");
  await mkdir(folder, { recursive: true });
  await writeFile(file, sql, { encoding: "utf8", flag: "wx" });
  try {
    const wrangler = resolve(process.cwd(), "node_modules/wrangler/bin/wrangler.js");
    const result = spawnSync(process.execPath, [
      wrangler, "d1", "execute", stagingDatabase, "--remote", "--config", "wrangler.staging.toml", "--file", file,
    ], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (result.error || result.status !== 0) {
      throw new Error("Wrangler staging D1 operation failed.");
    }
    return result.stdout;
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

async function queryStagingSql(sql: string) {
  const wrangler = resolve(process.cwd(), "node_modules/wrangler/bin/wrangler.js");
  const result = spawnSync(process.execPath, [
    wrangler, "d1", "execute", stagingDatabase, "--remote", "--config", "wrangler.staging.toml", "--json", "--command", sql,
  ], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || result.status !== 0) throw new Error("Wrangler staging D1 query failed.");
  return JSON.parse(result.stdout) as Array<{ results: Array<Record<string, unknown>> }>;
}

async function callApi(path: string, options: {
  method?: string;
  body?: unknown;
  cookie?: string;
} = {}) {
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });
  if (method !== "GET" && method !== "HEAD") {
    headers.set("Origin", new URL(stagingApiUrl!).origin);
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.cookie) headers.set("Cookie", options.cookie);
  let response: Response;
  try {
    response = await fetch(new URL(path, stagingApiUrl), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new Error(`Staging API request ${method} ${path} failed: ${error instanceof Error ? error.message : "network error"}`);
  }
  const envelope = await response.json() as {
    success: boolean;
    data: Record<string, unknown> | Array<Record<string, unknown>> | null;
    error: { message: string } | null;
  };
  return { response, envelope };
}

async function main() {
  assert(confirmStaging, "This destructive test fixture requires --confirm-staging.");
  assert(stagingApiUrl, "Set PORTFOLIO_STAGING_API_URL to the deployed staging Worker URL.");
  const apiUrl = new URL(stagingApiUrl);
  assert(apiUrl.protocol === "https:" && apiUrl.hostname.startsWith("web-portfolio-api-staging.")
    && apiUrl.hostname.endsWith(".workers.dev"), "The API URL must belong to web-portfolio-api-staging on workers.dev.");
  const passwordHash = await hashPasswordNode(password);
  reportStage("Argon2id hash generated locally");
  ownerSetupAttempted = true;
  await executeStagingSql(`
    INSERT INTO admin_users (id, email, password_salt, password_hash, password_iterations, password_algorithm, role)
    SELECT ${sqlLiteral(ownerId)}, ${sqlLiteral(ownerEmail)}, ${sqlLiteral(passwordHash.salt)},
           ${sqlLiteral(passwordHash.hash)}, ${passwordHash.iterations}, ${sqlLiteral(passwordHash.algorithm)}, 'OWNER'
    WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE role = 'OWNER');
  `);
  const insertedOwner = await queryStagingSql(`
    SELECT id, email, password_salt, password_hash, password_iterations, password_algorithm, role
      FROM admin_users WHERE id = ${sqlLiteral(ownerId)};
  `);
  const fixtureState = insertedOwner[0]?.results[0];
  reportStage("temporary staging owner inserted and verified in D1");
  assert(fixtureState?.id === ownerId && fixtureState.email === ownerEmail && fixtureState.role === "OWNER"
    && fixtureState.password_salt === passwordHash.salt && fixtureState.password_hash === passwordHash.hash
    && fixtureState.password_iterations === passwordHash.iterations
    && fixtureState.password_algorithm === NODE_PASSWORD_ALGORITHM,
  "Temporary staging owner fixture did not match the requested hash and owner values.");
  const login = await callApi("/api/admin/auth/login", {
    method: "POST",
    body: { email: ownerEmail, password },
  });
  reportStage(`staging login responded HTTP ${login.response.status}`);
  if (login.response.status !== 200 || !login.envelope.success) {
    const diagnostics = await queryStagingSql(
      "SELECT metadata_json FROM admin_audit_logs WHERE action = 'LOGIN_FAILED' ORDER BY created_at DESC LIMIT 1;"
    );
    const metadata = JSON.parse(String(diagnostics[0]?.results[0]?.metadata_json ?? "{}")) as Record<string, unknown>;
    throw new Error(`Staging login returned HTTP ${login.response.status} (account record found: ${String(metadata.accountRecordFound ?? "unknown")}).`);
  }
  const setCookie = login.response.headers.get("set-cookie") ?? "";
  assert(/HttpOnly/i.test(setCookie) && /Secure/i.test(setCookie) && /SameSite=Lax/i.test(setCookie), "Login cookie security attributes are incomplete.");
  const sessionCookie = setCookie.split(";")[0];
  assert(sessionCookie.includes("="), "Staging login did not issue a session cookie.");

  const current = await callApi("/api/admin/me", { cookie: sessionCookie });
  reportStage("session verified");
  assert(current.response.status === 200 && current.envelope.success, "Authenticated session check failed.");
  assert(asRecord(current.envelope.data)?.role === "OWNER", "Temporary staging user did not receive owner authorization.");

  const dashboard = await callApi("/api/admin/dashboard", { cookie: sessionCookie });
  reportStage("dashboard verified");
  assert(dashboard.response.status === 200 && dashboard.envelope.success, "Authenticated dashboard request failed.");

  const snapshot = {
    slug: draftSlug,
    title: { en: "Staging smoke draft", vi: "Bản nháp staging kiểm thử" },
    subtitle: { en: "Temporary test content", vi: "Nội dung kiểm thử tạm thời" },
    role: { en: "Test", vi: "Kiểm thử" },
    summary: { en: "Initial staging smoke test.", vi: "Nội dung ban đầu cho smoke test staging." },
    description: { en: "This record is created and removed by the staging smoke test.", vi: "Bản ghi này do staging smoke test tạo và xóa." },
    featured: false,
    thumbnailUrl: "",
    displayOrder: 99999,
    statuses: [],
    techStack: [],
    highlights: [],
    links: [],
    contentBlocks: [{
      id: "staging-smoke-links",
      type: "LINK_GROUP",
      title: { en: "Links", vi: "Liên kết" },
      links: [],
    }],
  };

  const created = await callApi("/api/admin/content/project/drafts", {
    method: "POST",
    body: snapshot,
    cookie: sessionCookie,
  });
  reportStage(`project draft create responded HTTP ${created.response.status}`);
  assert(created.response.status === 201 && created.envelope.success, "Creating a staging draft failed.");
  draftId = String(asRecord(created.envelope.data)?.id ?? "");
  assert(draftId, "Create draft response did not contain an id.");

  const updatedSnapshot = { ...snapshot, title: { en: "Updated staging smoke draft", vi: "Bản nháp staging đã cập nhật" } };
  const saved = await callApi(`/api/admin/content/project/${encodeURIComponent(draftId)}/draft`, {
    method: "PUT",
    body: { expectedVersion: 1, snapshot: { ...updatedSnapshot, id: draftId } },
    cookie: sessionCookie,
  });
  reportStage(`project draft save responded HTTP ${saved.response.status}`);
  assert(saved.response.status === 200 && saved.envelope.success && asRecord(saved.envelope.data)?.version === 2, "Saving a staging draft failed.");

  const revisions = await callApi(`/api/admin/content/project/${encodeURIComponent(draftId)}/revisions`, { cookie: sessionCookie });
  reportStage(`revision list responded HTTP ${revisions.response.status}`);
  assert(revisions.response.status === 200 && revisions.envelope.success && Array.isArray(revisions.envelope.data), "Staging revision history could not be read.");
  const initialRevision = revisions.envelope.data.find((revision) => revision.revisionNumber === 1);
  assert(initialRevision, "Initial staging revision was not recorded.");
  const restored = await callApi(`/api/admin/content/project/${encodeURIComponent(draftId)}/revisions/${encodeURIComponent(String(initialRevision.id))}/restore`, {
    method: "POST",
    body: { expectedVersion: 2 },
    cookie: sessionCookie,
  });
  reportStage(`revision restore responded HTTP ${restored.response.status}`);
  assert(restored.response.status === 200 && restored.envelope.success && asRecord(restored.envelope.data)?.version === 3, "Restoring a staging revision failed.");

  const publicLookup = await callApi(`/api/public/projects/${encodeURIComponent(draftSlug)}?locale=en`);
  reportStage(`public draft isolation responded HTTP ${publicLookup.response.status}`);
  assert(publicLookup.response.status === 404, "A draft appeared in the public API.");

  const audit = await callApi("/api/admin/audit-logs?page=1&pageSize=100", { cookie: sessionCookie });
  reportStage(`audit list responded HTTP ${audit.response.status}`);
  const auditData = asRecord(audit.envelope.data);
  assert(audit.response.status === 200 && audit.envelope.success && Array.isArray(auditData?.items),
    `Owner audit log request returned HTTP ${audit.response.status}: ${audit.envelope.error?.message ?? "invalid response"}.`);
  const actions = new Set((auditData?.items as Array<Record<string, unknown>>).map((item) => item.action));
  for (const action of ["DRAFT_CREATED", "DRAFT_SAVED", "REVISION_RESTORED"]) {
    assert(actions.has(action), `Audit log omitted ${action}.`);
  }

  const discarded = await callApi(`/api/admin/content/project/${encodeURIComponent(draftId)}/draft`, {
    method: "DELETE",
    body: { expectedVersion: 3 },
    cookie: sessionCookie,
  });
  reportStage(`draft discard responded HTTP ${discarded.response.status}`);
  assert(discarded.response.status === 200 && discarded.envelope.success, "Discarding the staging draft failed.");

  const logout = await callApi("/api/admin/auth/logout", { method: "POST", cookie: sessionCookie });
  reportStage(`logout responded HTTP ${logout.response.status}`);
  const logoutCookie = logout.response.headers.get("set-cookie") ?? "";
  assert(logout.response.status === 200 && /Max-Age=0/i.test(logoutCookie),
    `Logout did not clear the session cookie (HTTP ${logout.response.status}; cookie header: ${Boolean(logoutCookie)}; clear attribute: ${/Max-Age=0/i.test(logoutCookie)}).`);
  const revokedSession = await callApi("/api/admin/me", { cookie: sessionCookie });
  assert(revokedSession.response.status === 401, "A logged-out session still has access.");

  console.log("Staging admin smoke PASS: secure owner login, session, dashboard, draft save, revision restore, public isolation, audit log, discard, logout.");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Staging smoke failed."}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (!ownerSetupAttempted) return;
  const cleanup = [
    ...(draftId ? [
      `DELETE FROM admin_audit_logs WHERE actor_id = ${sqlLiteral(ownerId)};`,
      `DELETE FROM admin_content_revisions WHERE entity_type = 'project' AND entity_id = ${sqlLiteral(draftId)};`,
      `DELETE FROM admin_content_drafts WHERE entity_type = 'project' AND entity_id = ${sqlLiteral(draftId)};`,
    ] : [`DELETE FROM admin_audit_logs WHERE actor_id = ${sqlLiteral(ownerId)};`]),
    `DELETE FROM admin_sessions WHERE admin_id = ${sqlLiteral(ownerId)};`,
    `DELETE FROM admin_users WHERE id = ${sqlLiteral(ownerId)};`,
  ].join("\n");
  try {
    await executeStagingSql(cleanup);
  } catch {
    process.stderr.write("Staging fixture cleanup failed. Remove only the phase3-smoke owner and its test draft from portfolio_db_staging before retrying.\n");
    process.exitCode = 1;
  }
});
