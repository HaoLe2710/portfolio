import type { D1Database } from "@cloudflare/workers-types";
import type { Context } from "hono";
import type { WorkerEnv } from "../types/env";
import { AdminError } from "./errors";
import { currentPublishedSnapshot, listPublishedSnapshots } from "./content";
import { validateSnapshot, type ContentType } from "./schemas";
import { randomToken } from "./password";
import {
  findPagesDeploymentForRelease,
  getPagesDeployment,
  PagesApiError,
  assertPagesDeploymentConfigured,
  preparePagesReleaseBuild,
  resolveGitBranchHead,
  triggerPagesPreviewDeployment,
  type PagesDeployment,
} from "./pages-deployments";

type SnapshotItem = {
  type: ContentType;
  id: string;
  snapshot: Record<string, unknown>;
  baseRevision?: string | null;
};

type JobRow = {
  id: string;
  release_id: string;
  environment: "staging" | "production";
  pages_project: string;
  git_branch: string;
  commit_sha: string | null;
  deployment_id: string | null;
  status: string;
  attempt_count: number;
  idempotency_key: string;
  request_marker: string;
  preview_url: string | null;
  retry_after: string | null;
};

type ReleaseRow = {
  id: string;
  environment: "staging" | "production";
  release_number: number;
  status: string;
  operation: string;
  entity_type: ContentType;
  entity_id: string;
  source_revision_id: string | null;
  source_draft_version: number | null;
  content_checksum: string;
  previous_release_id: string | null;
  created_at: string;
  activated_at: string | null;
  error_code: string | null;
  error_message: string | null;
  deployment_id?: string | null;
  preview_url?: string | null;
  deployment_status?: string | null;
  attempt_count?: number;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildableEnvironment(context: Context<WorkerEnv>) {
  const environment = context.env.RELEASE_ENVIRONMENT;
  if (environment !== "staging") {
    throw new AdminError(403, "STAGING_ONLY", "Content releases are currently restricted to staging.");
  }
  assertPagesDeploymentConfigured(context.env);
  return environment;
}

function parseSnapshot(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AdminError(500, "RELEASE_SNAPSHOT_CORRUPT", "A stored release snapshot is invalid.");
  }
  return parsed as Record<string, unknown>;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function releaseBaseline(database: D1Database, environment: "staging" | "production") {
  const state = await database.prepare(
    "SELECT live_release_id FROM release_environment_state WHERE environment = ?"
  ).bind(environment).first<{ live_release_id: string | null }>();
  if (state?.live_release_id) {
    const result = await database.prepare(
      `SELECT entity_type, entity_id, operation, snapshot_json
         FROM content_release_items WHERE release_id = ? ORDER BY entity_type, entity_id`
    ).bind(state.live_release_id).all<{
      entity_type: ContentType; entity_id: string; operation: string; snapshot_json: string;
    }>();
    return (result.results ?? []).filter((item) => item.operation !== "UNPUBLISH")
      .map((item) => ({ type: item.entity_type, id: item.entity_id, snapshot: parseSnapshot(item.snapshot_json) }));
  }
  return listPublishedSnapshots(database);
}

function ensureUniqueSlugs(items: SnapshotItem[]) {
  const seen = new Map<string, string>();
  for (const item of items) {
    if (item.type !== "project" && item.type !== "blogPost") continue;
    const slug = typeof item.snapshot.slug === "string" ? item.snapshot.slug : "";
    const key = `${item.type}:${slug}`;
    const previous = seen.get(key);
    if (previous && previous !== item.id) {
      throw new AdminError(409, "DUPLICATE_SLUG", `The ${item.type} slug is already used in the release snapshot.`);
    }
    seen.set(key, item.id);
  }
}

async function validateSlugAgainstDrafts(database: D1Database, type: ContentType, id: string, snapshot: Record<string, unknown>) {
  if (type !== "project" && type !== "blogPost") return;
  const slug = String(snapshot.slug ?? "");
  const table = type === "project" ? "projects" : "blog_posts";
  const published = await database.prepare(
    `SELECT id FROM ${table} WHERE slug = ? AND status = 'PUBLISHED' AND id <> ? LIMIT 1`
  ).bind(slug, id).first();
  if (published) throw new AdminError(409, "DUPLICATE_SLUG", "That slug is already used by published content.");
  const drafts = await database.prepare(
    `SELECT entity_id FROM admin_content_drafts
      WHERE entity_type = ? AND state = 'DRAFT' AND entity_id <> ?
        AND json_extract(snapshot_json, '$.slug') = ? LIMIT 1`
  ).bind(type, id, slug).first();
  if (drafts) throw new AdminError(409, "DUPLICATE_SLUG", "That slug is already used by another draft.");
}

async function createRelease(
  context: Context<WorkerEnv>,
  details: {
    type: ContentType;
    id: string;
    operation: "PUBLISH" | "UPDATE" | "UNPUBLISH" | "ROLLBACK";
    snapshot: Record<string, unknown>;
    revisionId: string | null;
    draftVersion: number | null;
    idempotencyKey: string;
    expectedVersion?: number;
  }
) {
  const environment = buildableEnvironment(context);
  const database = context.env.DB;
  const idempotency = details.idempotencyKey.trim();
  if (!/^[A-Za-z0-9._:-]{12,128}$/.test(idempotency)) {
    throw new AdminError(400, "INVALID_IDEMPOTENCY_KEY", "Provide a 12 to 128 character idempotency key.");
  }
  const existing = await database.prepare(
    `SELECT r.*, j.deployment_id, j.preview_url, j.status AS deployment_status, j.attempt_count
       FROM deployment_jobs j JOIN content_releases r ON r.id = j.release_id
      WHERE j.environment = ? AND j.idempotency_key = ?`
  ).bind(environment, idempotency).first<ReleaseRow>();
  if (existing) {
    if (existing.entity_type !== details.type || existing.entity_id !== details.id || existing.operation !== details.operation ||
        existing.source_draft_version !== details.draftVersion) {
      throw new AdminError(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different release request.");
    }
    return releaseDto(existing);
  }

  const active = await database.prepare(
    "SELECT active_release_id FROM release_environment_state WHERE environment = ?"
  ).bind(environment).first<{ active_release_id: string | null }>();
  if (active?.active_release_id) {
    throw new AdminError(409, "RELEASE_IN_PROGRESS", "A staging release is already in progress.");
  }

  const baseline = await releaseBaseline(database, environment);
  const targetIndex = baseline.findIndex((item) => item.type === details.type && item.id === details.id);
  const previousSnapshot = targetIndex >= 0 ? baseline[targetIndex].snapshot : null;
  if (details.operation === "UNPUBLISH" && !previousSnapshot) {
    throw new AdminError(409, "NOT_PUBLISHED", "This content is not part of the current live release.");
  }
  if (details.operation === "PUBLISH" || details.operation === "UPDATE" || details.operation === "ROLLBACK") {
    const validation = validateSnapshot(details.type, details.snapshot);
    if (!validation.success || validation.data.id !== details.id) {
      throw new AdminError(400, "VALIDATION_ERROR", "Release content is invalid.", validation.success ? undefined : { issues: validation.issues });
    }
    details.snapshot = validation.data;
    await validateSlugAgainstDrafts(database, details.type, details.id, details.snapshot);
    if (targetIndex >= 0) baseline[targetIndex] = { type: details.type, id: details.id, snapshot: details.snapshot };
    else baseline.push({ type: details.type, id: details.id, snapshot: details.snapshot });
  } else if (targetIndex >= 0) {
    baseline.splice(targetIndex, 1);
  }
  ensureUniqueSlugs(baseline);

  const releaseId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const requestMarker = `portfolio-release:${releaseId}:attempt:1`;
  const fullItems: Array<SnapshotItem & { operation: string; hash: string }> = [];
  for (const item of baseline) {
    const isTarget = item.type === details.type && item.id === details.id;
    const raw = canonical(item.snapshot);
    fullItems.push({
      ...item,
      operation: isTarget ? details.operation : "SNAPSHOT",
      hash: await sha256(raw),
    });
  }
  if (details.operation === "UNPUBLISH") {
    fullItems.push({
      type: details.type,
      id: details.id,
      snapshot: previousSnapshot!,
      operation: "UNPUBLISH",
      hash: await sha256(canonical(previousSnapshot)),
    });
  }
  const checksum = await sha256(fullItems
    .sort((left, right) => `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`))
    .map((item) => `${item.type}:${item.id}:${item.operation}:${item.hash}`).join("\n"));
  const previousPublishedJson = previousSnapshot ? canonical(previousSnapshot) : null;

  const statements = [
    database.prepare(
      `UPDATE release_environment_state
          SET active_release_id = ?, next_release_number = next_release_number + 1, updated_at = ?
        WHERE environment = ? AND active_release_id IS NULL`
    ).bind(releaseId, now, environment),
    database.prepare(
      `INSERT INTO content_releases
       (id, environment, release_number, status, operation, entity_type, entity_id, actor_id,
        source_revision_id, source_draft_version, previous_release_id, content_checksum, created_at)
       SELECT ?, environment, next_release_number - 1, 'PENDING_DEPLOYMENT', ?, ?, ?, ?, ?, ?, live_release_id, ?, ?
         FROM release_environment_state WHERE environment = ? AND active_release_id = ?`
    ).bind(releaseId, details.operation, details.type, details.id, context.get("admin").id,
      details.revisionId, details.draftVersion, checksum, now, environment, releaseId),
    ...fullItems.map((item) => database.prepare(
      `INSERT INTO content_release_items
       (release_id, entity_type, entity_id, operation, draft_revision_id, source_draft_version,
        snapshot_json, previous_published_json, snapshot_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(releaseId, item.type, item.id, item.operation,
      item.type === details.type && item.id === details.id ? details.revisionId : null,
      item.type === details.type && item.id === details.id ? details.draftVersion : null,
      canonical(item.snapshot), item.type === details.type && item.id === details.id ? previousPublishedJson : null, item.hash)),
    database.prepare(
      `INSERT INTO deployment_jobs
       (id, release_id, environment, provider, pages_project, git_branch, status, idempotency_key,
        request_marker, created_at, updated_at)
       VALUES (?, ?, ?, 'cloudflare_pages_api', 'web-porfolio', ?, 'QUEUED', ?, ?, ?, ?)`
    ).bind(jobId, releaseId, environment, context.env.PAGES_STAGING_BRANCH ?? "", idempotency, requestMarker, now, now),
    database.prepare(
      `INSERT INTO admin_audit_logs
       (id, actor_id, action, entity_type, entity_id, request_id, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(randomToken(18), context.get("admin").id, `${details.operation}_REQUESTED`, details.type,
      details.id, context.req.header("cf-ray") ?? randomToken(12),
      JSON.stringify({ releaseId, releaseChecksum: checksum, draftVersion: details.draftVersion })),
  ];
  try {
    const result = await database.batch(statements);
    if (result[0]?.meta.changes !== 1) throw new AdminError(409, "RELEASE_IN_PROGRESS", "Another release was started concurrently.");
  } catch (error) {
    if (error instanceof AdminError) throw error;
    const raced = await database.prepare(
      "SELECT active_release_id FROM release_environment_state WHERE environment = ?"
    ).bind(environment).first<{ active_release_id: string | null }>();
    if (raced?.active_release_id) throw new AdminError(409, "RELEASE_IN_PROGRESS", "Another release was started concurrently.");
    throw error;
  }
  context.executionCtx.waitUntil(processDeploymentJob(context.env, jobId));
  const result = await database.prepare(
    `SELECT r.*, j.deployment_id, j.preview_url, j.status AS deployment_status, j.attempt_count
       FROM deployment_jobs j JOIN content_releases r ON r.id = j.release_id WHERE j.id = ?`
  ).bind(jobId).first<ReleaseRow>();
  return result ? releaseDto(result) : { id: releaseId, status: "PENDING_DEPLOYMENT", checksum };
}

function releaseDto(row: ReleaseRow) {
  return {
    id: row.id,
    environment: row.environment,
    number: Number(row.release_number),
    status: row.status,
    operation: row.operation,
    entityType: row.entity_type,
    entityId: row.entity_id,
    sourceRevisionId: row.source_revision_id,
    draftVersion: row.source_draft_version,
    checksum: row.content_checksum,
    previousReleaseId: row.previous_release_id,
    deployment: row.deployment_id ? {
      id: row.deployment_id,
      url: row.preview_url,
      status: row.deployment_status,
      attemptCount: row.attempt_count,
    } : null,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    error: row.error_code ? { code: row.error_code, message: row.error_message } : null,
  };
}

export async function publishDraft(
  context: Context<WorkerEnv>,
  type: ContentType,
  id: string,
  input: unknown
) {
  const body = input as { expectedVersion?: unknown; idempotencyKey?: unknown } | null;
  if (!body || !Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 1 || typeof body.idempotencyKey !== "string") {
    throw new AdminError(400, "VALIDATION_ERROR", "expectedVersion and idempotencyKey are required.");
  }
  if (context.env.RELEASE_ENVIRONMENT !== "staging") {
    throw new AdminError(403, "STAGING_ONLY", "Content releases are currently restricted to staging.");
  }
  if (!/^[A-Za-z0-9._:-]{12,128}$/.test(body.idempotencyKey.trim())) {
    throw new AdminError(400, "INVALID_IDEMPOTENCY_KEY", "Provide a 12 to 128 character idempotency key.");
  }
  const existing = await context.env.DB.prepare(
    `SELECT r.*, j.deployment_id, j.preview_url, j.status AS deployment_status, j.attempt_count
       FROM deployment_jobs j JOIN content_releases r ON r.id = j.release_id
      WHERE j.environment = 'staging' AND j.idempotency_key = ?`
  ).bind(body.idempotencyKey.trim()).first<ReleaseRow>();
  if (existing) {
    if (existing.entity_type !== type || existing.entity_id !== id ||
        Number(existing.source_draft_version) !== Number(body.expectedVersion) ||
        !["PUBLISH", "UPDATE"].includes(existing.operation)) {
      throw new AdminError(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different release request.");
    }
    return releaseDto(existing);
  }
  const draft = await context.env.DB.prepare(
    `SELECT snapshot_json, version, base_revision, state FROM admin_content_drafts
      WHERE entity_type = ? AND entity_id = ?`
  ).bind(type, id).first<{ snapshot_json: string; version: number; base_revision: string | null; state: string }>();
  if (!draft || draft.state !== "DRAFT") throw new AdminError(404, "DRAFT_NOT_FOUND", "An active draft was not found.");
  if (Number(draft.version) !== Number(body.expectedVersion)) {
    throw new AdminError(409, "VERSION_CONFLICT", "The draft changed. Reload it before publishing.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(draft.snapshot_json); } catch { throw new AdminError(500, "DRAFT_CORRUPT", "The draft snapshot is invalid."); }
  const validation = validateSnapshot(type, parsed);
  if (!validation.success || validation.data.id !== id) {
    throw new AdminError(400, "VALIDATION_ERROR", "Draft content is invalid.", validation.success ? undefined : { issues: validation.issues });
  }
  await validateSlugAgainstDrafts(context.env.DB, type, id, validation.data);
  const currentPublished = await currentPublishedSnapshot(context.env.DB, type, id, "staging");
  if ((draft.base_revision ?? null) !== (currentPublished?.baseRevision ?? null)) {
    throw new AdminError(409, "PUBLISHED_VERSION_CONFLICT", "Published content changed since this draft was created.");
  }
  const revision = await context.env.DB.prepare(
    `SELECT id FROM admin_content_revisions WHERE entity_type = ? AND entity_id = ? AND version = ?
      ORDER BY revision_number DESC LIMIT 1`
  ).bind(type, id, Number(draft.version)).first<{ id: string }>();
  return createRelease(context, {
    type, id, operation: currentPublished ? "UPDATE" : "PUBLISH",
    snapshot: validation.data, revisionId: revision?.id ?? null,
    draftVersion: Number(draft.version), idempotencyKey: body.idempotencyKey,
    expectedVersion: Number(draft.version),
  });
}

export async function unpublishContent(
  context: Context<WorkerEnv>,
  type: ContentType,
  id: string,
  input: unknown
) {
  if (type === "profile" || type === "siteSettings") {
    throw new AdminError(400, "SINGLETON_UNPUBLISH_BLOCKED", "Profile and site settings cannot be unpublished.");
  }
  const body = input as { idempotencyKey?: unknown } | null;
  if (!body || typeof body.idempotencyKey !== "string") {
    throw new AdminError(400, "VALIDATION_ERROR", "idempotencyKey is required.");
  }
  return createRelease(context, {
    type, id, operation: "UNPUBLISH", snapshot: {}, revisionId: null,
    draftVersion: null, idempotencyKey: body.idempotencyKey,
  });
}

async function updateJob(database: D1Database, jobId: string, update: {
  status?: string; commitSha?: string | null; deploymentId?: string | null; previewUrl?: string | null;
  errorCode?: string | null; errorMessage?: string | null; retryAfter?: string | null;
}) {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  if (update.status !== undefined) { fields.push("status = ?"); values.push(update.status); }
  if (update.commitSha !== undefined) { fields.push("commit_sha = ?"); values.push(update.commitSha); }
  if (update.deploymentId !== undefined) { fields.push("deployment_id = ?"); values.push(update.deploymentId); }
  if (update.previewUrl !== undefined) { fields.push("preview_url = ?"); values.push(update.previewUrl); }
  if (update.errorCode !== undefined) { fields.push("error_code = ?"); values.push(update.errorCode); }
  if (update.errorMessage !== undefined) { fields.push("error_message = ?"); values.push(update.errorMessage?.slice(0, 500) ?? null); }
  if (update.retryAfter !== undefined) { fields.push("retry_after = ?"); values.push(update.retryAfter); }
  if (["SUCCESS", "FAILED", "CANCELED", "VERIFICATION_FAILED", "ROLLED_BACK"].includes(update.status ?? "")) {
    fields.push("completed_at = ?"); values.push(now);
  }
  values.push(jobId);
  await database.prepare(`UPDATE deployment_jobs SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
}

function stageStatus(deployment: PagesDeployment) {
  const status = deployment.latest_stage?.status?.toLowerCase() ?? "";
  const stage = deployment.latest_stage?.name?.toLowerCase() ?? "";
  if (["success", "succeeded"].includes(status)) return "SUCCESS";
  if (["failure", "failed", "error"].includes(status)) return "FAILED";
  if (["canceled", "cancelled"].includes(status)) return "CANCELED";
  if (stage.includes("build")) return "BUILDING";
  if (stage.includes("deploy")) return "DEPLOYING";
  if (stage.includes("clone")) return "CLONING";
  return "INITIALIZING";
}

function assertPreviewDeploymentIdentity(deployment: PagesDeployment, job: JobRow) {
  const metadata = deployment.deployment_trigger?.metadata;
  const expectedCommit = job.commit_sha?.toLowerCase();
  if (deployment.project_name !== "web-porfolio" || deployment.environment !== "preview" ||
      metadata?.branch !== job.git_branch || !expectedCommit || metadata.commit_hash?.toLowerCase() !== expectedCommit ||
      metadata.commit_message !== job.request_marker) {
    throw new Error("Cloudflare Pages returned a deployment that does not match the staging branch, commit, project and release attempt.");
  }
  try {
    const host = new URL(deployment.url.startsWith("http") ? deployment.url : `https://${deployment.url}`).hostname.toLowerCase();
    if (host === "web-porfolio.pages.dev" || !host.endsWith(".web-porfolio.pages.dev")) {
      throw new Error("The deployment URL is not an isolated Pages Preview hostname.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("isolated Pages Preview")) throw error;
    throw new Error("Cloudflare Pages returned an invalid Preview URL.");
  }
}

async function verifyPreview(env: WorkerEnv["Bindings"], release: ReleaseRow, deployment: PagesDeployment) {
  const base = deployment.url.startsWith("http") ? deployment.url : `https://${deployment.url}`;
  const manifestResponse = await fetch(new URL("/release-manifest.json", base), { redirect: "manual" });
  if (!manifestResponse.ok) throw new Error(`Release manifest returned HTTP ${manifestResponse.status}.`);
  const manifest = await manifestResponse.json() as { releaseId?: string; checksum?: string; commitSha?: string };
  if (manifest.releaseId !== release.id || manifest.checksum !== release.content_checksum ||
      manifest.commitSha !== (release as ReleaseRow & { commit_sha?: string }).commit_sha) {
    throw new Error("Release manifest does not match the requested release, checksum, and commit.");
  }
  const checks = ["/en", "/vi", "/sitemap.xml", "/robots.txt"];
  const removedRoutes: string[] = [];
  const expectedText = new Map<string, string[]>();
  const forbiddenHomeText: string[] = [];
  const localizedText = (value: unknown, locale: "en" | "vi") => {
    if (typeof value === "string") return value;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
    const localized = value as Record<string, unknown>;
    return typeof localized[locale] === "string" ? localized[locale] as string : "";
  };
  const addExpected = (path: string, value: string) => {
    if (!value.trim()) return;
    expectedText.set(path, [...(expectedText.get(path) ?? []), value]);
  };
  const htmlContains = (html: string, value: string) => {
    const escaped = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
    return html.includes(value) || html.includes(escaped);
  };
  const releases = await env.DB.prepare(
    "SELECT entity_type, operation, snapshot_json FROM content_release_items WHERE release_id = ?"
  ).bind(release.id).all<{ entity_type: string; operation: string; snapshot_json: string }>();
  for (const item of releases.results ?? []) {
    const snapshot = parseSnapshot(item.snapshot_json);
    if (item.operation === "UNPUBLISH") {
      const titleField = item.entity_type === "profile" ? "fullName"
        : item.entity_type === "skills" ? "name"
          : item.entity_type === "siteSettings" ? "siteName"
            : item.entity_type === "contactLink" ? "label" : "title";
      if (typeof snapshot[titleField] === "string") forbiddenHomeText.push(String(snapshot[titleField]));
      else {
        forbiddenHomeText.push(localizedText(snapshot[titleField], "en"), localizedText(snapshot[titleField], "vi"));
      }
      if (item.entity_type === "project" && typeof snapshot.slug === "string") {
        removedRoutes.push(`/en/projects/${encodeURIComponent(snapshot.slug)}`, `/vi/projects/${encodeURIComponent(snapshot.slug)}`);
      }
      if (item.entity_type === "blogPost" && typeof snapshot.slug === "string") {
        removedRoutes.push(`/en/blog/${encodeURIComponent(snapshot.slug)}`, `/vi/blog/${encodeURIComponent(snapshot.slug)}`);
      }
      continue;
    }
    if (item.entity_type === "project" && typeof snapshot.slug === "string") {
      for (const locale of ["en", "vi"] as const) {
        const path = `/${locale}/projects/${encodeURIComponent(snapshot.slug)}`;
        checks.push(path);
        addExpected(path, localizedText(snapshot.title, locale));
        for (const block of arrayValue(snapshot.contentBlocks)) addExpected(path, localizedText(objectValue(block).title, locale));
      }
    }
    if (item.entity_type === "blogPost" && typeof snapshot.slug === "string") {
      for (const locale of ["en", "vi"] as const) {
        const path = `/${locale}/blog/${encodeURIComponent(snapshot.slug)}`;
        checks.push(path);
        addExpected(path, localizedText(snapshot.title, locale));
      }
    }
    if (item.entity_type === "profile") {
      for (const locale of ["en", "vi"] as const) addExpected(`/${locale}`, String(snapshot.fullName ?? ""));
    }
    if (["skills", "achievement", "certificate", "contactLink"].includes(item.entity_type)) {
      const field = item.entity_type === "skills" ? "name" : item.entity_type === "contactLink" ? "label" : "title";
      for (const locale of ["en", "vi"] as const) addExpected(`/${locale}`, localizedText(snapshot[field], locale));
    }
  }
  const checkedPages = new Map<string, string>();
  for (const path of [...new Set(checks)]) {
    const response = await fetch(new URL(path, base), { redirect: "manual" });
    if (!response.ok) throw new Error(`Preview route ${path} returned HTTP ${response.status}.`);
    const body = await response.text();
    for (const expected of expectedText.get(path) ?? []) {
      if (!htmlContains(body, expected)) throw new Error(`Preview route ${path} does not contain the release content marker.`);
    }
    if (path === "/robots.txt" && !/Disallow:\s*\//i.test(body)) {
      throw new Error("Preview robots.txt does not block indexing.");
    }
    if (path === "/en" || path === "/vi") {
      const expectedLocale = path.slice(1);
      if (!new RegExp(`hreflang=["']${expectedLocale}["']`, "i").test(body) ||
          !/rel=["']canonical["']/i.test(body) ||
          !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(body)) {
        throw new Error(`Preview route ${path} is missing canonical, locale, or noindex metadata.`);
      }
      checkedPages.set(path, body);
      for (const forbidden of forbiddenHomeText) {
        if (forbidden && htmlContains(body, forbidden)) throw new Error("An unpublished content marker is still present on a locale home page.");
      }
      const assetUrls = [...body.matchAll(/(?:src|href)=["'](\/_next\/static\/(?:css|chunks)\/[^"']+)["']/g)]
        .map((match) => match[1]).filter((value): value is string => Boolean(value));
      for (const asset of new Set(assetUrls)) {
        const assetResponse = await fetch(new URL(asset, base), { redirect: "manual" });
        if (!assetResponse.ok) throw new Error(`Static asset ${asset} returned HTTP ${assetResponse.status}.`);
      }
    }
    if (path === "/sitemap.xml") {
      for (const removedPath of removedRoutes) {
        const slug = decodeURIComponent(removedPath.split("/").at(-1) ?? "");
        if (slug && body.includes(slug)) throw new Error(`Sitemap still contains unpublished slug ${slug}.`);
      }
    }
  }
  if (!checkedPages.get("/en")?.includes('hreflang="vi"') || !checkedPages.get("/vi")?.includes('hreflang="en"')) {
    throw new Error("Preview locale pages are missing reciprocal hreflang metadata.");
  }
  for (const path of [...new Set(removedRoutes)]) {
    const response = await fetch(new URL(path, base), { redirect: "manual" });
    if (response.status !== 404) throw new Error(`Unpublished route ${path} returned HTTP ${response.status}, expected 404.`);
  }
  const adminResponse = await fetch(new URL("/api/admin/me", base), { headers: { Accept: "application/json" }, redirect: "manual" });
  if (adminResponse.status !== 401) {
    throw new Error(`Pages Admin Function returned HTTP ${adminResponse.status}; expected an authenticated 401 through ADMIN_API.`);
  }
  if (deployment.uses_functions === false) {
    throw new Error("Cloudflare Pages reports that this Preview deployment does not include Pages Functions.");
  }
  return base;
}

async function activateRelease(env: WorkerEnv["Bindings"], release: ReleaseRow, job: JobRow, baseUrl: string) {
  const now = new Date().toISOString();
  const db = env.DB;
  const actorId = await db.prepare("SELECT actor_id FROM content_releases WHERE id = ?")
    .bind(release.id).first<{ actor_id: string }>();
  const audit = db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_id, action, entity_type, entity_id, request_id, metadata_json)
     VALUES (?, ?, 'RELEASE_LIVE', ?, ?, ?, ?)`
  ).bind(randomToken(18), actorId?.actor_id ?? null, release.entity_type, release.entity_id,
    `release:${release.id}`, JSON.stringify({ releaseId: release.id, deploymentId: job.deployment_id }));
  const draftStatements = release.operation === "UNPUBLISH"
    ? [
        db.prepare(
          `UPDATE admin_content_drafts SET state = 'DRAFT', base_revision = NULL,
                  updated_at = ?, discarded_at = NULL
            WHERE entity_type = ? AND entity_id = ?`
        ).bind(now, release.entity_type, release.entity_id),
        db.prepare(
          `INSERT INTO admin_content_drafts
             (entity_type, entity_id, snapshot_json, version, base_revision, state, author_id, created_at, updated_at)
           SELECT i.entity_type, i.entity_id, i.snapshot_json, 1, NULL, 'DRAFT', ?, ?, ?
             FROM content_release_items i WHERE i.release_id = ? AND i.entity_type = ? AND i.entity_id = ?
             AND i.operation = 'UNPUBLISH'
             AND NOT EXISTS (SELECT 1 FROM admin_content_drafts d WHERE d.entity_type = i.entity_type AND d.entity_id = i.entity_id)`
        ).bind(actorId?.actor_id ?? "", now, now, release.id, release.entity_type, release.entity_id),
        db.prepare(
          `INSERT INTO admin_content_revisions
             (id, entity_type, entity_id, revision_number, version, snapshot_json, base_revision, author_id, created_at)
           SELECT ?, i.entity_type, i.entity_id, 1, 1, i.snapshot_json, NULL, ?, ?
             FROM content_release_items i WHERE i.release_id = ? AND i.entity_type = ? AND i.entity_id = ?
               AND i.operation = 'UNPUBLISH'
               AND NOT EXISTS (SELECT 1 FROM admin_content_revisions r WHERE r.entity_type = i.entity_type AND r.entity_id = i.entity_id)`
        ).bind(randomToken(18), actorId?.actor_id ?? "", now, release.id, release.entity_type, release.entity_id),
      ]
    : release.operation === "ROLLBACK"
    ? [
        db.prepare(
          `UPDATE admin_content_drafts SET
             snapshot_json = (SELECT snapshot_json FROM content_release_items WHERE release_id = ? AND entity_type = ? AND entity_id = ?),
             version = version + 1,
             base_revision = (SELECT snapshot_hash FROM content_release_items WHERE release_id = ? AND entity_type = ? AND entity_id = ?),
             state = 'PUBLISHED', updated_at = ?, discarded_at = NULL
           WHERE entity_type = ? AND entity_id = ?`
        ).bind(release.id, release.entity_type, release.entity_id,
          release.id, release.entity_type, release.entity_id, now, release.entity_type, release.entity_id),
        db.prepare(
          `INSERT INTO admin_content_drafts
             (entity_type, entity_id, snapshot_json, version, base_revision, state, author_id, created_at, updated_at)
           SELECT i.entity_type, i.entity_id, i.snapshot_json, 1, i.snapshot_hash, 'PUBLISHED', ?, ?, ?
             FROM content_release_items i WHERE i.release_id = ? AND i.entity_type = ? AND i.entity_id = ?
             AND NOT EXISTS (SELECT 1 FROM admin_content_drafts d WHERE d.entity_type = i.entity_type AND d.entity_id = i.entity_id)`
        ).bind(actorId?.actor_id ?? "", now, now, release.id, release.entity_type, release.entity_id),
        db.prepare(
          `INSERT INTO admin_content_revisions
             (id, entity_type, entity_id, revision_number, version, snapshot_json, base_revision, author_id, created_at)
           SELECT ?, ?, ?, COALESCE(MAX(r.revision_number), 0) + 1,
                  COALESCE((SELECT version FROM admin_content_drafts WHERE entity_type = ? AND entity_id = ?), 1),
                  i.snapshot_json, i.snapshot_hash, ?, ?
             FROM content_release_items i LEFT JOIN admin_content_revisions r ON r.entity_type = i.entity_type AND r.entity_id = i.entity_id
            WHERE i.release_id = ? AND i.entity_type = ? AND i.entity_id = ?
            GROUP BY i.entity_type, i.entity_id, i.snapshot_json`
        ).bind(randomToken(18), release.entity_type, release.entity_id, release.entity_type, release.entity_id,
          actorId?.actor_id ?? "", now, release.id, release.entity_type, release.entity_id),
      ]
    : [db.prepare(
        `UPDATE admin_content_drafts SET
           state = CASE WHEN version = ? THEN 'PUBLISHED' ELSE 'DRAFT' END,
           base_revision = (SELECT snapshot_hash FROM content_release_items WHERE release_id = ? AND entity_type = ? AND entity_id = ?),
           updated_at = CASE WHEN version = ? THEN ? ELSE updated_at END,
           discarded_at = NULL
         WHERE entity_type = ? AND entity_id = ?`
      ).bind(release.source_draft_version ?? -1, release.id, release.entity_type, release.entity_id,
        release.source_draft_version ?? -1, now, release.entity_type, release.entity_id)];
  const result = await db.batch([
    db.prepare(
      `UPDATE content_releases SET status = 'SUPERSEDED'
        WHERE id = (SELECT live_release_id FROM release_environment_state WHERE environment = ?)
          AND id <> ? AND status = 'LIVE'`
    ).bind(release.environment, release.id),
    db.prepare(
      `UPDATE content_releases SET status = 'LIVE', published_at = ?, activated_at = ?, error_code = NULL, error_message = NULL
       WHERE id = ? AND status = 'VERIFYING'`
    ).bind(now, now, release.id),
    db.prepare(
      `UPDATE release_environment_state SET live_release_id = ?, active_release_id = NULL, updated_at = ?
       WHERE environment = ? AND active_release_id = ?`
    ).bind(release.id, now, release.environment, release.id),
    db.prepare(
      `UPDATE deployment_jobs SET status = 'SUCCESS', preview_url = ?, last_checked_at = ?, completed_at = ?, updated_at = ?
       WHERE id = ? AND deployment_id = ?`
    ).bind(baseUrl, now, now, now, job.id, job.deployment_id),
    ...draftStatements,
    audit,
  ]);
  if (result[1]?.meta.changes !== 1 || result[2]?.meta.changes !== 1 || result[3]?.meta.changes !== 1) {
    throw new Error("Release activation lost its state lock before commit.");
  }
}

async function releaseAndJob(database: D1Database, jobId: string) {
  return database.prepare(
    `SELECT j.*, r.release_number, r.status AS release_status, r.operation, r.entity_type, r.entity_id,
            r.source_revision_id, r.source_draft_version, r.content_checksum, r.previous_release_id,
            r.created_at AS release_created_at, r.activated_at, r.error_code AS release_error_code,
            r.error_message AS release_error_message
       FROM deployment_jobs j JOIN content_releases r ON r.id = j.release_id WHERE j.id = ?`
  ).bind(jobId).first<JobRow & ReleaseRow & {
    release_status: string; release_number: number; release_created_at: string;
    release_error_code: string | null; release_error_message: string | null;
  }>();
}

function isTerminal(status: string) {
  return ["SUCCESS", "FAILED", "CANCELED", "VERIFICATION_FAILED", "ROLLED_BACK"].includes(status);
}

export async function processDeploymentJob(env: WorkerEnv["Bindings"], jobId: string) {
  const db = env.DB;
  const joined = await releaseAndJob(db, jobId);
  if (!joined || isTerminal(joined.status)) return;
  const job = joined as JobRow;
  const release: ReleaseRow = {
    ...joined,
    id: joined.release_id,
    environment: joined.environment,
    release_number: joined.release_number,
    status: joined.release_status,
    operation: joined.operation,
    entity_type: joined.entity_type,
    entity_id: joined.entity_id,
    source_revision_id: joined.source_revision_id,
    source_draft_version: joined.source_draft_version,
    content_checksum: joined.content_checksum,
    previous_release_id: joined.previous_release_id,
    created_at: joined.release_created_at,
    activated_at: joined.activated_at,
    error_code: joined.release_error_code,
    error_message: joined.release_error_message,
  };

  let triggerMayHaveSucceeded = false;
  try {
    if (!job.deployment_id) {
      if (job.status === "TRIGGERING" && job.retry_after && Date.parse(job.retry_after) > Date.now()) return;
      const existing = await findPagesDeploymentForRelease(env, job.git_branch, job.commit_sha ?? "", job.request_marker);
      if (existing) {
        await updateJob(db, job.id, { status: "BUILDING", deploymentId: existing.id,
          previewUrl: existing.url.startsWith("http") ? existing.url : `https://${existing.url}` });
        await db.prepare(
          `UPDATE deployment_attempts SET provider_deployment_id = ?, status = 'RECONCILED', completed_at = ?
            WHERE job_id = ? AND status IN ('TRIGGERING', 'UNKNOWN')`
        ).bind(existing.id, new Date().toISOString(), job.id).run();
      } else {
        if (["TRIGGERING", "UNKNOWN", "RECONCILIATION_REQUIRED"].includes(job.status) && Number(job.attempt_count) > 0) {
          await updateJob(db, job.id, { status: "RECONCILIATION_REQUIRED",
            retryAfter: new Date(Date.now() + 120_000).toISOString() });
          return;
        }
        if (job.attempt_count >= 3) throw new PagesApiError(400, "RETRY_LIMIT_REACHED", "The release exceeded its deployment attempt limit.", false);
        const nextAttempt = Number(job.attempt_count) + 1;
        const requestMarker = `portfolio-release:${release.id}:attempt:${nextAttempt}`;
        const attemptId = crypto.randomUUID();
        const startedAt = new Date().toISOString();
        const retryAfter = new Date(Date.now() + 120_000).toISOString();
        const claimed = await db.batch([
          db.prepare(
            `INSERT INTO deployment_attempts (id, job_id, attempt_number, provider_request_reference, status, started_at)
             SELECT ?, ?, ?, ?, 'TRIGGERING', ?
              WHERE EXISTS (
                SELECT 1 FROM deployment_jobs
                 WHERE id = ? AND status = ? AND attempt_count = ? AND deployment_id IS NULL
              )`
          ).bind(attemptId, job.id, nextAttempt, requestMarker, startedAt, job.id, job.status, job.attempt_count),
          db.prepare(
            `UPDATE deployment_jobs
                SET status = 'TRIGGERING', attempt_count = ?, request_marker = ?, retry_after = ?, updated_at = ?
              WHERE id = ? AND status = ? AND attempt_count = ? AND deployment_id IS NULL
                AND EXISTS (SELECT 1 FROM deployment_attempts WHERE id = ? AND status = 'TRIGGERING')`
          ).bind(nextAttempt, requestMarker, retryAfter, startedAt, job.id, job.status, job.attempt_count, attemptId),
        ]);
        if (claimed[1]?.meta.changes !== 1) return;
        const branchHead = await resolveGitBranchHead(env, job.git_branch);
        if (job.commit_sha && branchHead !== job.commit_sha) {
          throw new PagesApiError(409, "STAGING_BRANCH_MOVED", "The staging branch head changed after this release was prepared.", false);
        }
        await db.prepare("UPDATE deployment_jobs SET commit_sha = ?, updated_at = ? WHERE id = ?")
          .bind(branchHead, new Date().toISOString(), job.id).run();
        const currentRelease = await db.prepare("SELECT content_checksum FROM content_releases WHERE id = ?")
          .bind(release.id).first<{ content_checksum: string }>();
        await preparePagesReleaseBuild(env, release.id, currentRelease?.content_checksum ?? release.content_checksum);
        triggerMayHaveSucceeded = true;
        const deployment = await triggerPagesPreviewDeployment(env, job.git_branch, branchHead, requestMarker);
        await recordDeployment(env, job.id, deployment, branchHead);
      }
    }

    const refreshed = await db.prepare("SELECT * FROM deployment_jobs WHERE id = ?")
      .bind(job.id).first<JobRow>();
    if (!refreshed?.deployment_id) return;
    const deployment = await getPagesDeployment(env, refreshed.deployment_id);
    assertPreviewDeploymentIdentity(deployment, refreshed);
    const mapped = stageStatus(deployment);
    const now = new Date().toISOString();
    if (mapped === "FAILED" || mapped === "CANCELED") {
      const message = `Cloudflare Pages deployment ${mapped.toLowerCase()}.`;
      await db.batch([
        db.prepare("UPDATE deployment_jobs SET status = ?, error_code = ?, error_message = ?, completed_at = ?, updated_at = ? WHERE id = ?")
          .bind(mapped, mapped, message, now, now, job.id),
        db.prepare("UPDATE content_releases SET status = 'FAILED', error_code = ?, error_message = ? WHERE id = ?")
          .bind(mapped, message, release.id),
        db.prepare("UPDATE release_environment_state SET active_release_id = NULL, updated_at = ? WHERE environment = ? AND active_release_id = ?")
          .bind(now, release.environment, release.id),
      ]);
      return;
    }
    if (mapped !== "SUCCESS") {
      await db.batch([
        db.prepare("UPDATE deployment_jobs SET status = ?, last_checked_at = ?, updated_at = ? WHERE id = ?")
          .bind(mapped, now, now, job.id),
        db.prepare("UPDATE content_releases SET status = 'BUILDING' WHERE id = ? AND status <> 'LIVE'").bind(release.id),
      ]);
      return;
    }
    await db.batch([
      db.prepare("UPDATE deployment_jobs SET status = 'VERIFYING', last_checked_at = ?, updated_at = ? WHERE id = ?")
        .bind(now, now, job.id),
      db.prepare("UPDATE content_releases SET status = 'VERIFYING' WHERE id = ? AND status <> 'LIVE'").bind(release.id),
    ]);
    try {
      const baseUrl = await verifyPreview(env, { ...release, commit_sha: refreshed.commit_sha } as ReleaseRow, deployment);
      await activateRelease(env, release, refreshed, baseUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preview verification failed.";
      await db.batch([
        db.prepare("UPDATE deployment_jobs SET status = 'VERIFICATION_FAILED', error_code = 'PREVIEW_VERIFICATION_FAILED', error_message = ?, completed_at = ?, updated_at = ? WHERE id = ?")
          .bind(message.slice(0, 500), new Date().toISOString(), new Date().toISOString(), job.id),
        db.prepare("UPDATE content_releases SET status = 'VERIFICATION_FAILED', error_code = 'PREVIEW_VERIFICATION_FAILED', error_message = ? WHERE id = ?")
          .bind(message.slice(0, 500), release.id),
        db.prepare("UPDATE release_environment_state SET active_release_id = NULL, updated_at = ? WHERE environment = ? AND active_release_id = ?")
          .bind(new Date().toISOString(), release.environment, release.id),
      ]);
    }
  } catch (error) {
    const now = new Date().toISOString();
    const providerError = error instanceof PagesApiError ? error : null;
    const unknownOutcome = triggerMayHaveSucceeded && (providerError?.retryable !== false);
    const status = unknownOutcome ? "RECONCILIATION_REQUIRED" : "FAILED";
    const code = providerError?.code ?? "RELEASE_JOB_FAILED";
    const message = providerError?.message ?? "The release job failed unexpectedly.";
    const next = unknownOutcome ? new Date(Date.now() + 30_000).toISOString() : null;
    await db.batch([
      db.prepare("UPDATE deployment_jobs SET status = ?, error_code = ?, error_message = ?, retry_after = ?, updated_at = ? WHERE id = ?")
        .bind(status, code, message.slice(0, 500), next, now, job.id),
      db.prepare("UPDATE content_releases SET status = ?, error_code = ?, error_message = ? WHERE id = ?")
        .bind(unknownOutcome ? "RECONCILIATION_REQUIRED" : "FAILED", code, message.slice(0, 500), release.id),
      db.prepare("UPDATE deployment_attempts SET status = 'UNKNOWN', completed_at = ? WHERE job_id = ? AND status = 'TRIGGERING'")
        .bind(now, job.id),
      ...(unknownOutcome ? [] : [db.prepare(
        "UPDATE release_environment_state SET active_release_id = NULL, updated_at = ? WHERE environment = ? AND active_release_id = ?"
      ).bind(now, release.environment, release.id)]),
    ]);
  }
}

async function recordDeployment(env: WorkerEnv["Bindings"], jobId: string, deployment: PagesDeployment, commitSha: string) {
  const db = env.DB;
  const now = new Date().toISOString();
  const url = deployment.url.startsWith("http") ? deployment.url : `https://${deployment.url}`;
  await db.batch([
    db.prepare("UPDATE deployment_jobs SET status = 'BUILDING', commit_sha = ?, deployment_id = ?, preview_url = ?, triggered_at = ?, updated_at = ? WHERE id = ?")
      .bind(commitSha, deployment.id, url, now, now, jobId),
    db.prepare("UPDATE deployment_attempts SET provider_deployment_id = ?, status = 'ACCEPTED', completed_at = ? WHERE job_id = ? AND status = 'TRIGGERING'")
      .bind(deployment.id, now, jobId),
  ]);
  const job = await db.prepare("SELECT release_id FROM deployment_jobs WHERE id = ?").bind(jobId).first<{ release_id: string }>();
  if (job) await db.prepare("UPDATE content_releases SET status = 'BUILDING' WHERE id = ?").bind(job.release_id).run();
}

export async function getRelease(database: D1Database, releaseId: string) {
  const row = await database.prepare(
    `SELECT r.*, j.deployment_id, j.preview_url, j.status AS deployment_status, j.attempt_count
       FROM content_releases r LEFT JOIN deployment_jobs j ON j.release_id = r.id
      WHERE r.id = ? AND r.environment = 'staging'`
  ).bind(releaseId).first<ReleaseRow>();
  if (!row) throw new AdminError(404, "NOT_FOUND", "Release was not found.");
  return releaseDto(row);
}

export async function listReleases(database: D1Database, limit = 30) {
  const rows = await database.prepare(
    `SELECT r.*, j.deployment_id, j.preview_url, j.status AS deployment_status, j.attempt_count
       FROM content_releases r LEFT JOIN deployment_jobs j ON j.release_id = r.id
      WHERE r.environment = 'staging' ORDER BY r.release_number DESC LIMIT ?`
  ).bind(Math.min(Math.max(limit, 1), 100)).all<ReleaseRow>();
  return (rows.results ?? []).map(releaseDto);
}

export async function retryRelease(context: Context<WorkerEnv>, releaseId: string) {
  const row = await context.env.DB.prepare(
    `SELECT j.*, r.status AS release_status FROM deployment_jobs j
      JOIN content_releases r ON r.id = j.release_id WHERE r.id = ? AND r.environment = 'staging'`
  ).bind(releaseId).first<JobRow & { release_status: string }>();
  if (!row) throw new AdminError(404, "NOT_FOUND", "Release was not found.");
  if (!["FAILED", "VERIFICATION_FAILED"].includes(row.status)) {
    throw new AdminError(409, "RETRY_NOT_ALLOWED", "This deployment cannot be retried in its current state.");
  }
  const active = await context.env.DB.prepare(
    "SELECT active_release_id FROM release_environment_state WHERE environment = 'staging'"
  ).first<{ active_release_id: string | null }>();
  if (active?.active_release_id && active.active_release_id !== releaseId) {
    throw new AdminError(409, "RELEASE_IN_PROGRESS", "Another staging release is in progress.");
  }
  if (Number(row.attempt_count) >= 3) throw new AdminError(409, "RETRY_LIMIT_REACHED", "The deployment retry limit has been reached.");
  const nextAttempt = Number(row.attempt_count) + 1;
  const idempotency = `retry:${releaseId}:${nextAttempt}`;
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE deployment_jobs SET status = 'QUEUED', deployment_id = NULL, preview_url = NULL, error_code = NULL, error_message = NULL, retry_after = NULL, idempotency_key = ?, request_marker = ?, updated_at = ? WHERE id = ?")
      .bind(idempotency, `portfolio-release:${releaseId}:attempt:${nextAttempt}`, new Date().toISOString(), row.id),
    context.env.DB.prepare("UPDATE content_releases SET status = 'PENDING_DEPLOYMENT', error_code = NULL, error_message = NULL WHERE id = ?")
      .bind(releaseId),
    context.env.DB.prepare("UPDATE release_environment_state SET active_release_id = ?, updated_at = ? WHERE environment = 'staging' AND (active_release_id IS NULL OR active_release_id = ?)")
      .bind(releaseId, new Date().toISOString(), releaseId),
  ]);
  context.executionCtx.waitUntil(processDeploymentJob(context.env, row.id));
  return getRelease(context.env.DB, releaseId);
}

export async function reconcileDeploymentJobs(env: WorkerEnv["Bindings"]) {
  const jobs = await env.DB.prepare(
    `SELECT id FROM deployment_jobs WHERE environment = 'staging'
       AND status IN ('QUEUED', 'TRIGGERING', 'UNKNOWN', 'INITIALIZING', 'CLONING', 'BUILDING', 'DEPLOYING', 'VERIFYING', 'RECONCILIATION_REQUIRED')
       AND (retry_after IS NULL OR retry_after <= ?)
     ORDER BY created_at LIMIT 5`
  ).bind(new Date().toISOString()).all<{ id: string }>();
  for (const row of jobs.results ?? []) await processDeploymentJob(env, row.id);
}

export async function rollbackContent(
  context: Context<WorkerEnv>,
  type: ContentType,
  id: string,
  input: unknown
) {
  const body = input as { releaseId?: unknown; idempotencyKey?: unknown } | null;
  if (!body || typeof body.releaseId !== "string" || typeof body.idempotencyKey !== "string") {
    throw new AdminError(400, "VALIDATION_ERROR", "A previous release ID and idempotencyKey are required.");
  }
  const target = await context.env.DB.prepare(
    `SELECT i.snapshot_json, i.operation FROM content_release_items i
       JOIN content_releases r ON r.id = i.release_id
      WHERE i.release_id = ? AND i.entity_type = ? AND i.entity_id = ? AND r.environment = 'staging'
        AND r.status IN ('LIVE', 'SUPERSEDED', 'ROLLED_BACK')`
  ).bind(body.releaseId, type, id).first<{ snapshot_json: string; operation: string }>();
  if (!target || target.operation === "UNPUBLISH") throw new AdminError(404, "ROLLBACK_TARGET_NOT_FOUND", "A published snapshot for this content was not found in the selected release.");
  return createRelease(context, {
    type, id, operation: "ROLLBACK", snapshot: parseSnapshot(target.snapshot_json),
    revisionId: null, draftVersion: null, idempotencyKey: body.idempotencyKey,
  });
}

export async function rejectPagesRollback() {
  throw new AdminError(403, "STAGING_ROLLBACK_UNSUPPORTED", "Cloudflare's Pages rollback API targets production deployments. Restore staging content by creating a new release instead.");
}
