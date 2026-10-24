import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mockPortfolio } from "../../src/data/mock-portfolio";
import app from "../src/app";
import { buildSeedSql } from "../src/seed-data";
import {
  CURRENT_PASSWORD_ALGORITHM,
  LEGACY_PASSWORD_ALGORITHM,
  LEGACY_PASSWORD_ITERATIONS,
  hashPassword,
  sha256,
  verifyPassword,
} from "../src/admin/password";
import { BLOCK_TYPES, validateSnapshot } from "../src/admin/schemas";
import { listPublishedSnapshots } from "../src/admin/content";
import { processDeploymentJob } from "../src/admin/release-service";
import adminSchemaSql from "../migrations/0002_admin_cms.sql?raw";
import passwordSchemaSql from "../migrations/0003_argon2id_auth.sql?raw";
import releaseSchemaSql from "../migrations/0004_content_release_workflow.sql?raw";
import schemaSql from "../migrations/0001_init_schema.sql?raw";
import type { WorkerBindings } from "../src/types/env";

const bindings: WorkerBindings = {
  DB: env.DB,
  CORS_ALLOWED_ORIGINS: "https://worker.test",
  RELEASE_ENVIRONMENT: "staging",
  PAGES_BUILD_TOKEN: "phase4-build-token-test-only",
};
const ownerId = "phase3-test-owner";
const ownerEmail = "phase3-owner@example.invalid";
const ownerPassword = "Testing-Only-Password-2026!";
let sessionCookie = "";

function cookieToken(cookie: string) {
  const value = cookie.split(";")[0] ?? "";
  return decodeURIComponent(value.slice(value.indexOf("=") + 1));
}

async function request(
  path: string,
  init: RequestInit = {},
  cookie = sessionCookie,
  origin = "https://worker.test",
  executionCtx?: Parameters<typeof app.fetch>[2]
) {
  const headers = new Headers(init.headers);
  headers.set("Origin", origin);
  if (cookie) headers.set("Cookie", cookie);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return app.request(`https://worker.test${path}`, { ...init, headers }, bindings, executionCtx);
}

async function parse<T>(response: Response) {
  return await response.json() as {
    success: boolean;
    message: string;
    data: T | null;
    error: { code: string; message: string } | null;
  };
}

async function login(email = ownerEmail, password = ownerPassword, origin = "https://worker.test") {
  return request("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }, "", origin);
}

async function putDraft(type: string, id: string, expectedVersion: number, snapshot: unknown) {
  return request(`/api/admin/content/${type}/${id}/draft`, {
    method: "PUT",
    body: JSON.stringify({ expectedVersion, snapshot }),
  });
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, [
    { name: "0001_init_schema", queries: schemaSql.split(";").map((s) => s.trim()).filter(Boolean) },
    { name: "0002_admin_cms", queries: adminSchemaSql.split(";").map((s) => s.trim()).filter(Boolean) },
    { name: "0003_argon2id_auth", queries: passwordSchemaSql.split(";").map((s) => s.trim()).filter(Boolean) },
    { name: "0004_content_release_workflow", queries: releaseSchemaSql.split(";").map((s) => s.trim()).filter(Boolean) },
  ]);
  for (const statement of buildSeedSql("phase3-admin-tests").statements) {
    await env.DB.prepare(statement).run();
  }
  const password = await hashPassword(ownerPassword);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO admin_users (id, email, password_salt, password_hash, password_iterations, password_algorithm, role)
     VALUES (?, ?, ?, ?, ?, ?, 'OWNER')`
  ).bind(ownerId, ownerEmail, password.salt, password.hash, password.iterations, password.algorithm).run();
  const response = await login();
  expect(response.status).toBe(200);
  sessionCookie = response.headers.get("set-cookie") ?? "";
});

describe("Admin authentication and security", () => {
  it("uses the Argon2id production profile and rejects an incorrect password", async () => {
    const hash = await hashPassword(ownerPassword);
    expect(hash.algorithm).toBe(CURRENT_PASSWORD_ALGORITHM);
    expect(hash.iterations).toBe(LEGACY_PASSWORD_ITERATIONS);
    expect(await verifyPassword(ownerPassword, hash.salt, hash.hash, hash.iterations, hash.algorithm)).toBe(true);
    expect(await verifyPassword("wrong password", hash.salt, hash.hash, hash.iterations, hash.algorithm)).toBe(false);
    expect(await verifyPassword(ownerPassword, hash.salt, hash.hash, hash.iterations, "unsupported")).toBe(false);
  });

  it("serializes concurrent Argon2id work safely within the reused Worker isolate", async () => {
    const candidates = ["parallel-one-password", "parallel-two-password", "parallel-three-password"];
    const hashes = await Promise.all(candidates.map((password) => hashPassword(password)));
    const checks = await Promise.all(candidates.map((password, index) => {
      const hash = hashes[index]!;
      return verifyPassword(password, hash.salt, hash.hash, hash.iterations, hash.algorithm);
    }));
    expect(checks).toEqual([true, true, true]);
  });

  it("transparently upgrades a legacy PBKDF2 account after a valid login", async () => {
    const legacyId = "phase3-legacy-owner";
    const legacyEmail = "phase3-legacy-owner@example.invalid";
    const legacyPassword = "Legacy-Password-2026!";
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(legacyPassword), "PBKDF2", false, ["deriveBits"]);
    const digest = await crypto.subtle.deriveBits({
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: LEGACY_PASSWORD_ITERATIONS,
    }, key, 256);
    const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    await env.DB.prepare(
      `INSERT OR REPLACE INTO admin_users (id, email, password_salt, password_hash, password_iterations, password_algorithm, role)
       VALUES (?, ?, ?, ?, ?, ?, 'OWNER')`
    ).bind(legacyId, legacyEmail, encode(salt), encode(new Uint8Array(digest)), LEGACY_PASSWORD_ITERATIONS, LEGACY_PASSWORD_ALGORITHM).run();

    const response = await request("/api/admin/auth/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "legacy-upgrade-test" },
      body: JSON.stringify({ email: legacyEmail, password: legacyPassword }),
    }, "");
    expect(response.status).toBe(200);
    const upgraded = await env.DB.prepare("SELECT password_algorithm, password_salt, password_hash FROM admin_users WHERE id = ?")
      .bind(legacyId).first<{ password_algorithm: string; password_salt: string; password_hash: string }>();
    expect(upgraded?.password_algorithm).toBe(CURRENT_PASSWORD_ALGORITHM);
    expect(await verifyPassword(legacyPassword, upgraded!.password_salt, upgraded!.password_hash, LEGACY_PASSWORD_ITERATIONS, CURRENT_PASSWORD_ALGORITHM)).toBe(true);
    expect(await verifyPassword(legacyPassword, encode(salt), encode(new Uint8Array(digest)), LEGACY_PASSWORD_ITERATIONS, LEGACY_PASSWORD_ALGORITHM)).toBe(true);
  });

  it("requires a server-verified session and keeps only a token hash", async () => {
    const anonymous = await request("/api/admin/me", {}, "");
    expect(anonymous.status).toBe(401);
    expect((await parse(anonymous)).error?.code).toBe("UNAUTHORIZED");

    const current = await request("/api/admin/me");
    expect(current.status).toBe(200);
    expect((await parse<{ email: string; role: string }>(current)).data).toMatchObject({
      email: ownerEmail,
      role: "OWNER",
    });

    const rawToken = cookieToken(sessionCookie);
    const stored = await env.DB.prepare("SELECT token_hash FROM admin_sessions WHERE admin_id = ? LIMIT 1")
      .bind(ownerId).first<{ token_hash: string }>();
    expect(stored?.token_hash).toBe(await sha256(rawToken));
    expect(stored?.token_hash).not.toBe(rawToken);
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toContain("SameSite=Lax");
  });

  it("rejects wrong credentials, foreign origins, and locked login attempts", async () => {
    const wrongPassword = await login(ownerEmail, "incorrect password");
    expect(wrongPassword.status).toBe(401);
    expect((await parse(wrongPassword)).error?.message).toBe("Email or password is incorrect.");

    const badOrigin = await login(ownerEmail, ownerPassword, "https://attacker.example");
    expect(badOrigin.status).toBe(403);

    const keyHash = await sha256("admin-login:unknown");
    await env.DB.prepare(
      `INSERT OR REPLACE INTO admin_login_attempts (key_hash, window_started_at, attempts, blocked_until)
       VALUES (?, CAST(strftime('%s', 'now') AS INTEGER), 5, CAST(strftime('%s', 'now') AS INTEGER) + 300)`
    ).bind(keyHash).run();
    const blocked = await request("/api/admin/auth/login", {
      method: "POST",
      headers: { "CF-Connecting-IP": "unknown" },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    }, "");
    expect(blocked.status).toBe(429);
  });

  it("rejects expired or revoked sessions and prevents cross-origin mutations", async () => {
    const expiredToken = "expired-session-token";
    await env.DB.prepare(
      `INSERT INTO admin_sessions (token_hash, admin_id, expires_at)
       VALUES (?, ?, '2000-01-01T00:00:00.000Z')`
    ).bind(await sha256(expiredToken), ownerId).run();
    const expired = await request("/api/admin/me", {}, `portfolio_admin_session=${expiredToken}`);
    expect(expired.status).toBe(401);
    expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");

    const deniedMutation = await request("/api/admin/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: ownerPassword, newPassword: "Another-Long-Password-2026!" }),
    }, sessionCookie, "https://attacker.example");
    expect(deniedMutation.status).toBe(403);

    const logoutToken = "logout-test-session-token";
    await env.DB.prepare(
      `INSERT INTO admin_sessions (token_hash, admin_id, expires_at)
       VALUES (?, ?, ?)`
    ).bind(await sha256(logoutToken), ownerId, new Date(Date.now() + 60_000).toISOString()).run();
    const loggedOut = await request("/api/admin/auth/logout", {
      method: "POST",
    }, `portfolio_admin_session=${logoutToken}`);
    expect(loggedOut.status).toBe(200);
    const revoked = await env.DB.prepare("SELECT revoked_at FROM admin_sessions WHERE token_hash = ?")
      .bind(await sha256(logoutToken)).first<{ revoked_at: string | null }>();
    expect(revoked?.revoked_at).toBeTruthy();
    expect((await request("/api/admin/me", {}, `portfolio_admin_session=${logoutToken}`)).status).toBe(401);
  });

  it("enforces owner-only audit access with a server-side 403", async () => {
    await env.DB.prepare("UPDATE admin_users SET role = 'ADMIN' WHERE id = ?").bind(ownerId).run();
    const denied = await request("/api/admin/audit-logs");
    expect(denied.status).toBe(403);
    await env.DB.prepare("UPDATE admin_users SET role = 'OWNER' WHERE id = ?").bind(ownerId).run();
  });
});

describe("Draft revisions and Published isolation", () => {
  it("saves versioned Profile drafts without changing Published and restores an older revision", async () => {
    const before = await env.DB.prepare("SELECT full_name, status, updated_at FROM profile WHERE id = 'primary'")
      .first<{ full_name: string; status: string; updated_at: string }>();
    const detailResponse = await request("/api/admin/content/profile/primary");
    expect(detailResponse.status).toBe(200);
    const detail = (await parse<{
      snapshot: Record<string, unknown>;
      version: number;
      hasPublished: boolean;
      hasDraft: boolean;
    }>(detailResponse)).data!;
    expect(detail).toMatchObject({ version: 0, hasPublished: true, hasDraft: false });
    const originalSummary = (detail.snapshot.summary as { en: string }).en;
    const first = structuredClone(detail.snapshot);
    first.summary = { ...(first.summary as object), en: `${originalSummary} Draft revision one.` };
    const firstResponse = await putDraft("profile", "primary", 0, first);
    expect(firstResponse.status).toBe(200);
    const firstDraft = (await parse<{ version: number; hasDraft: boolean }>(firstResponse)).data!;
    expect(firstDraft).toMatchObject({ version: 1, hasDraft: true });

    const second = structuredClone(first);
    second.summary = { ...(second.summary as object), en: "Draft revision two." };
    const secondResponse = await putDraft("profile", "primary", 1, second);
    expect(secondResponse.status).toBe(200);

    const stale = await putDraft("profile", "primary", 1, second);
    expect(stale.status).toBe(409);
    expect((await parse(stale)).error?.code).toBe("VERSION_CONFLICT");

    const revisionsResponse = await request("/api/admin/content/profile/primary/revisions");
    const revisions = (await parse<Array<{ id: string; revisionNumber: number }>>(revisionsResponse)).data!;
    expect(revisions.map((revision) => revision.revisionNumber)).toEqual([2, 1]);
    const restore = await request(`/api/admin/content/profile/primary/revisions/${revisions[1]!.id}/restore`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    expect(restore.status).toBe(200);
    const restored = (await parse<{ snapshot: Record<string, unknown>; version: number }>(restore)).data!;
    expect(restored.version).toBe(3);
    expect((restored.snapshot.summary as { en: string }).en).toBe(`${originalSummary} Draft revision one.`);

    const after = await env.DB.prepare("SELECT full_name, status, updated_at FROM profile WHERE id = 'primary'")
      .first<{ full_name: string; status: string; updated_at: string }>();
    expect(after).toEqual(before);
    const publicProfile = await request("/api/public/profile?locale=en", {}, "");
    expect(publicProfile.status).toBe(200);
    expect((await parse<{ summary: string }>(publicProfile)).data?.summary).toBe(originalSummary);
    const auditCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM admin_audit_logs WHERE entity_type = 'profile' AND entity_id = 'primary'"
    ).first<{ count: number }>();
    expect(Number(auditCount?.count)).toBeGreaterThanOrEqual(3);
  });

  it("loads all nested Project block types, validates input, and rejects duplicate slugs", async () => {
    const project = mockPortfolio.projects[0]!;
    const existing = await request(`/api/admin/content/project/${project.id}`);
    expect(existing.status).toBe(200);
    const source = (await parse<{ snapshot: Record<string, unknown> }>(existing)).data!.snapshot;
    const blocks = source.contentBlocks as Array<{ type: string }>;
    const foundTypes = new Set(blocks.map((block) => block.type));
    for (const otherProject of mockPortfolio.projects.slice(1)) {
      const response = await request(`/api/admin/content/project/${otherProject.id}`);
      const other = (await parse<{ snapshot: Record<string, unknown> }>(response)).data!.snapshot;
      for (const block of other.contentBlocks as Array<{ type: string }>) foundTypes.add(block.type);
    }
    expect(foundTypes).toContain("MARKDOWN");
    const localized = { en: "CMS preview", vi: "Xem trước CMS" };
    const gallery = { id: "cms-gallery", src: "https://example.com/image.png", alt: localized, caption: localized };
    const blockSamples = BLOCK_TYPES.map((type, index) => {
      const base = { id: `cms-block-${index}`, type, title: localized };
      switch (type) {
        case "MARKDOWN": return { ...base, body: { en: "# Preview", vi: "# Xem trước" } };
        case "FEATURE_GRID": return { ...base, items: [{ id: "feature", icon: "check", title: localized, description: localized }] };
        case "ARCHITECTURE_FLOW": return { ...base, steps: [{ id: "step", icon: "hub", label: localized }] };
        case "MODULE_LIST": return { ...base, items: [{ id: "module", icon: "code", title: localized, description: localized }] };
        case "CI_CD_FLOW": return { ...base, steps: [{ id: "pipeline", label: localized, description: localized }] };
        case "IMAGE_GALLERY": return { ...base, images: [gallery] };
        case "METRIC_CARDS": return { ...base, metrics: [{ id: "metric", label: localized, value: "100", description: localized }] };
        case "LINK_GROUP": return { ...base, links: [{ id: "link", label: localized, href: "https://example.com", icon: "open_in_new" }] };
      }
    });
    expect(validateSnapshot("project", { ...source, contentBlocks: blockSamples }).success).toBe(true);

    const malformed = structuredClone(source);
    (malformed.contentBlocks as Array<{ type: string }>)[0]!.type = "ATTACK";
    expect((await putDraft("project", project.id, 0, malformed)).status).toBe(400);

    const duplicate = await request("/api/admin/content/project/drafts", {
      method: "POST",
      body: JSON.stringify({ ...source, slug: `${project.slug}-copy` }),
    });
    expect(duplicate.status).toBe(201);
    const duplicateData = (await parse<{ id: string; snapshot: Record<string, unknown> }>(duplicate)).data!;
    expect(duplicateData.snapshot.id).not.toBe(project.id);
    expect(duplicateData.snapshot.slug).toBe(`${project.slug}-copy`);
    const duplicateSave = await putDraft("project", duplicateData.id, 1, duplicateData.snapshot);
    expect(duplicateSave.status).toBe(200);

    const collidingSlug = await request("/api/admin/content/project/drafts", {
      method: "POST",
      body: JSON.stringify({ ...source, slug: project.slug }),
    });
    expect(collidingSlug.status).toBe(409);
  });
});

describe("Staging release authorization and configuration gates", () => {
  it("requires an authenticated Owner for publishing", async () => {
    const unauthorized = await request("/api/admin/content/profile/primary/publish", {
      method: "POST",
      body: JSON.stringify({ expectedVersion: 1, idempotencyKey: "phase4-owner-required-001" }),
    }, "");
    expect(unauthorized.status).toBe(401);
  });

  it("fails closed before writing a release when Pages secrets are not configured", async () => {
    const detailResponse = await request("/api/admin/content/profile/primary");
    expect(detailResponse.status).toBe(200);
    const detail = (await parse<{ version: number }>(detailResponse)).data!;
    const blocked = await request("/api/admin/content/profile/primary/publish", {
      method: "POST",
      body: JSON.stringify({ expectedVersion: detail.version, idempotencyKey: "phase4-config-missing-001" }),
    });
    expect(blocked.status).toBe(503);
    expect((await parse(blocked)).error?.code).toBe("PAGES_DEPLOYMENT_NOT_CONFIGURED");
    const releaseCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM content_releases WHERE operation IN ('PUBLISH', 'UPDATE')"
    ).first<{ count: number }>();
    expect(Number(releaseCount?.count ?? 0)).toBe(0);
    const state = await env.DB.prepare(
      "SELECT active_release_id FROM release_environment_state WHERE environment = 'staging'"
    ).first<{ active_release_id: string | null }>();
    expect(state?.active_release_id).toBeNull();
  });

  it("prevents unpublishing singleton site identity", async () => {
    const response = await request("/api/admin/content/profile/primary/unpublish", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "phase4-profile-unpublish-001" }),
    });
    expect(response.status).toBe(400);
    expect((await parse(response)).error?.code).toBe("SINGLETON_UNPUBLISH_BLOCKED");
  });
});

describe("Release-pinned public build data", () => {
  const releaseId = "phase4-release-public-test";
  const privateDraftId = "phase4-private-draft-test";
  let projectId = "";
  let projectSlug = "";

  beforeAll(async () => {
    const published = await listPublishedSnapshots(env.DB);
    const project = published.find((item) => item.type === "project");
    expect(project).toBeDefined();
    projectId = project!.id;
    projectSlug = String(project!.snapshot.slug);
    const changed = structuredClone(project!.snapshot);
    changed.title = { en: "Phase Four Frozen Release", vi: "Bản phát hành đóng băng Phase Four" };
    await env.DB.prepare(
      `INSERT INTO content_releases
       (id, environment, release_number, status, operation, entity_type, entity_id, actor_id, content_checksum, created_at)
       VALUES (?, 'staging', 9001, 'BUILDING', 'UPDATE', 'project', ?, ?, ?, ?)`
    ).bind(releaseId, projectId, ownerId, "phase4-release-checksum", new Date().toISOString()).run();

    const statements = published.map((item) => {
      const isTarget = item.type === "project" && item.id === projectId;
      const snapshot = isTarget ? changed : item.snapshot;
      return env.DB.prepare(
        `INSERT INTO content_release_items
         (release_id, entity_type, entity_id, operation, snapshot_json, snapshot_hash)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(releaseId, item.type, item.id, isTarget ? "UPDATE" : "SNAPSHOT", JSON.stringify(snapshot), "unit-test-hash");
    });
    if (statements.length) await env.DB.batch(statements);
    await env.DB.prepare(
      `INSERT INTO admin_content_drafts
       (entity_type, entity_id, snapshot_json, version, state, author_id)
       VALUES ('project', ?, ?, 1, 'DRAFT', ?)`
    ).bind(privateDraftId, JSON.stringify({
      id: privateDraftId,
      slug: "phase-four-private-draft-test",
      title: { en: "phase4-private-draft-marker", vi: "phase4-private-draft-marker" },
    }), ownerId).run();
  });

  it("requires a build token and serves the pinned bilingual release without exposing Drafts", async () => {
    const missingToken = await request(`/api/public/projects?locale=en`, {
      headers: { "x-portfolio-release-id": releaseId },
    }, "");
    expect(missingToken.status).toBe(401);

    const pinned = await request("/api/public/projects?locale=en", {
      headers: {
        "x-portfolio-release-id": releaseId,
        "x-portfolio-build-token": "phase4-build-token-test-only",
      },
    }, "");
    expect(pinned.status).toBe(200);
    const pinnedBody = await pinned.text();
    expect(pinnedBody).toContain("Phase Four Frozen Release");
    expect(pinnedBody).not.toContain("phase4-private-draft-marker");

    const vi = await request(`/api/public/projects/${projectSlug}?locale=vi`, {
      headers: {
        "x-portfolio-release-id": releaseId,
        "x-portfolio-build-token": "phase4-build-token-test-only",
      },
    }, "");
    expect(vi.status).toBe(200);
    expect(await vi.text()).toContain("Bản phát hành đóng băng Phase Four");

    const canonical = await request("/api/public/projects?locale=en", {}, "");
    expect(canonical.status).toBe(200);
    expect(await canonical.text()).not.toContain("Phase Four Frozen Release");
  });

  it("does not expose an unpublished item from a release snapshot", async () => {
    await env.DB.prepare(
      `UPDATE content_release_items SET operation = 'UNPUBLISH'
       WHERE release_id = ? AND entity_type = 'project' AND entity_id = ?`
    ).bind(releaseId, projectId).run();
    const detail = await request(`/api/public/projects/${projectSlug}?locale=en`, {
      headers: {
        "x-portfolio-release-id": releaseId,
        "x-portfolio-build-token": "phase4-build-token-test-only",
      },
    }, "");
    expect(detail.status).toBe(404);
  });

  it("serves the selected LIVE release to public and admin reads", async () => {
    await env.DB.batch([
      env.DB.prepare("UPDATE content_releases SET status = 'LIVE', activated_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), releaseId),
      env.DB.prepare("UPDATE content_release_items SET operation = 'UPDATE' WHERE release_id = ? AND entity_type = 'project' AND entity_id = ?")
        .bind(releaseId, projectId),
      env.DB.prepare("UPDATE release_environment_state SET live_release_id = ? WHERE environment = 'staging'")
        .bind(releaseId),
    ]);
    try {
      const publicResponse = await request("/api/public/projects?locale=en", {}, "");
      expect(publicResponse.status).toBe(200);
      expect(await publicResponse.text()).toContain("Phase Four Frozen Release");
      const adminResponse = await request(`/api/admin/content/project/${projectId}`);
      expect(adminResponse.status).toBe(200);
      const detail = (await parse<{ snapshot: { title: { en: string } } }>(adminResponse)).data!;
      expect(detail.snapshot.title.en).toBe("Phase Four Frozen Release");
    } finally {
      await env.DB.prepare("UPDATE release_environment_state SET live_release_id = NULL WHERE environment = 'staging'").run();
      await env.DB.prepare("UPDATE content_releases SET status = 'BUILDING', activated_at = NULL WHERE id = ?").bind(releaseId).run();
      await env.DB.prepare("UPDATE content_release_items SET operation = 'UNPUBLISH' WHERE release_id = ? AND entity_type = 'project' AND entity_id = ?")
        .bind(releaseId, projectId).run();
    }
  });
});

describe("Release and Pages provider workflow", () => {
  it("creates one pinned release and activates it only after Pages verification", async () => {
    const sourceResponse = await request(`/api/admin/content/project/${mockPortfolio.projects[0]!.id}`);
    expect(sourceResponse.status).toBe(200);
    const source = (await parse<{ snapshot: Record<string, unknown> }>(sourceResponse)).data!.snapshot;
    const uniqueSuffix = crypto.randomUUID().slice(0, 8);
    const draftResponse = await request("/api/admin/content/project/drafts", {
      method: "POST",
      body: JSON.stringify({
        ...source,
        slug: `phase-four-release-${uniqueSuffix}`,
        title: { en: "Phase Four Release Integration Test", vi: "Kiểm thử tích hợp phát hành Phase Four" },
      }),
    });
    expect(draftResponse.status).toBe(201);
    const draft = (await parse<{ id: string; version: number; snapshot: Record<string, unknown> }>(draftResponse)).data!;
    const expectedDetailText: string[] = [];
    const expectedHomeText: string[] = [];
    for (const item of await listPublishedSnapshots(env.DB)) {
      const localized = (value: unknown) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) return;
        const pair = value as { en?: unknown; vi?: unknown };
        if (typeof pair.en === "string") expectedHomeText.push(pair.en);
        if (typeof pair.vi === "string") expectedHomeText.push(pair.vi);
      };
      if (item.type === "profile") expectedHomeText.push(String(item.snapshot.fullName ?? ""));
      if (item.type === "skills") localized(item.snapshot.name);
      if (item.type === "achievement" || item.type === "certificate") localized(item.snapshot.title);
      if (item.type === "contactLink") localized(item.snapshot.label);
      if (item.type !== "project" && item.type !== "blogPost") continue;
      const title = item.snapshot.title as { en?: string; vi?: string } | undefined;
      if (title?.en) expectedDetailText.push(title.en);
      if (title?.vi) expectedDetailText.push(title.vi);
      if (item.type === "project" && Array.isArray(item.snapshot.contentBlocks)) {
        for (const block of item.snapshot.contentBlocks as Array<{ title?: { en?: string; vi?: string } }>) {
          if (block.title?.en) expectedDetailText.push(block.title.en);
          if (block.title?.vi) expectedDetailText.push(block.title.vi);
        }
      }
    }
    expectedDetailText.push("Phase Four Release Integration Test", "Kiểm thử tích hợp phát hành Phase Four");

    Object.assign(bindings, {
      CLOUDFLARE_ACCOUNT_ID: "unit-account-id",
      PAGES_PROJECT_NAME: "web-porfolio",
      PAGES_STAGING_BRANCH: "feat/phase4-publish-workflow",
      GITHUB_REPOSITORY: "HaoLe2710/portfolio",
      CLOUDFLARE_API_TOKEN: "unit-pages-token",
      PAGES_BUILD_TOKEN: "phase4-build-token-test-only",
    });
    const commitSha = "a".repeat(40);
    const previewHost = "release-test.web-porfolio.pages.dev";
    let releaseId = "";
    let releaseChecksum = "";
    let projectPreviewConfigPatches = 0;
    let buildContextChecksCompleted = false;
    let requestMarker = "";
    let deploymentNumber = 0;
    let deploymentListCalls = 0;
    let releaseListBarrier!: () => void;
    const releaseListReads = new Promise<void>((resolve) => { releaseListBarrier = resolve; });
    const deployments = new Map<string, Record<string, unknown>>();
    const releaseIds: string[] = [];
    let expectedUnpublishedSlug = "";
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname === "api.github.com") {
        return Response.json({ commit: { sha: commitSha } });
      }
      if (url.hostname === "api.cloudflare.com") {
        if (url.pathname.endsWith("/pages/projects/web-porfolio") && init?.method === "PATCH") {
          projectPreviewConfigPatches += 1;
          return Response.json({ success: true, result: {
            name: "web-porfolio", source: { type: "github", config: { owner: "HaoLe2710", repo_name: "portfolio", production_branch: "main", preview_deployment_setting: "all" } },
          } });
        }
        if (url.pathname.endsWith("/pages/projects/web-porfolio") && init?.method !== "PATCH") {
          return Response.json({ success: true, result: {
            name: "web-porfolio", source: { type: "github", config: { owner: "HaoLe2710", repo_name: "portfolio", production_branch: "main", preview_deployment_setting: "all" } },
          } });
        }
        if (url.pathname.endsWith("/deployments") && (!init?.method || init.method === "GET")) {
          deploymentListCalls++;
          if (deploymentListCalls === 2) releaseListBarrier();
          await releaseListReads;
          return Response.json({ success: true, result: [...deployments.values()] });
        }
        if (url.pathname.endsWith("/deployments") && init?.method === "POST") {
          const form = init.body as FormData;
          requestMarker = String(form.get("commit_message"));
          const id = `phase4-pages-deployment-${++deploymentNumber}`;
          const nextDeployment = {
            id,
            url: `https://${previewHost}`,
            environment: "preview",
            project_name: "web-porfolio",
            deployment_trigger: { metadata: {
              branch: String(form.get("branch")), commit_hash: String(form.get("commit_hash")), commit_message: requestMarker,
            } },
            latest_stage: { name: "deploy", status: "success" },
            uses_functions: true,
          };
          deployments.set(id, nextDeployment);
          return Response.json({ success: true, result: nextDeployment });
        }
        if (url.pathname.includes("/deployments/")) {
          const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
          return Response.json({ success: true, result: deployments.get(id) ?? null });
        }
        return Response.json({ success: false, errors: [{ code: 500, message: "Unexpected fake Pages API call." }] }, { status: 500 });
      }
      if (url.hostname === previewHost) {
        if (url.pathname === "/release-manifest.json") {
          const buildContextUrl = new URL("https://worker.test/api/build/release-context");
          buildContextUrl.searchParams.set("branch", "feat/phase4-publish-workflow");
          buildContextUrl.searchParams.set("commitSha", commitSha);
          buildContextUrl.searchParams.set("previewUrl", `https://${previewHost}`);
          const buildContextRequest = (overrides: { branch?: string; commitSha?: string; previewUrl?: string } = {}, token = "phase4-build-token-test-only") => {
            const candidate = new URL(buildContextUrl);
            if (overrides.branch !== undefined) candidate.searchParams.set("branch", overrides.branch);
            if (overrides.commitSha !== undefined) candidate.searchParams.set("commitSha", overrides.commitSha);
            if (overrides.previewUrl !== undefined) candidate.searchParams.set("previewUrl", overrides.previewUrl);
            return app.request(candidate, { headers: { "x-portfolio-build-token": token } }, bindings);
          };
          const buildContextResponse = await buildContextRequest();
          expect(buildContextResponse.status).toBe(200);
          const buildContextBody = await buildContextResponse.json() as {
            success: boolean;
            data: { releaseId: string; checksum: string; commitSha: string };
          };
          releaseId = buildContextBody.data.releaseId;
          releaseChecksum = buildContextBody.data.checksum;

          if (!buildContextChecksCompleted) {
            expect((await buildContextRequest({}, "wrong-build-token")).status).toBe(401);
            expect((await buildContextRequest({ branch: "another-preview-branch" })).status).toBe(204);
            expect((await buildContextRequest({ commitSha: "b".repeat(40) })).status).toBe(404);
            expect((await buildContextRequest({ previewUrl: "https://other-release.web-porfolio.pages.dev" })).status).toBe(404);
            const configuredEnvironment = bindings.RELEASE_ENVIRONMENT;
            bindings.RELEASE_ENVIRONMENT = "production";
            expect((await buildContextRequest()).status).toBe(403);
            bindings.RELEASE_ENVIRONMENT = configuredEnvironment;
            const concurrentContexts = await Promise.all([buildContextRequest(), buildContextRequest()]);
            expect(concurrentContexts.map((response) => response.status)).toEqual([200, 200]);
            buildContextChecksCompleted = true;
          }
          return Response.json({ releaseId, checksum: releaseChecksum, commitSha });
        }
        if (url.pathname === "/api/admin/me") {
          return Response.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
        }
        if (url.pathname === "/robots.txt") return new Response("User-agent: *\nAllow: /\nDisallow: /admin\n", { status: 200 });
        if (url.pathname === "/sitemap.xml") return new Response("<urlset></urlset>", { status: 200 });
        if (expectedUnpublishedSlug && url.pathname.endsWith(`/projects/${expectedUnpublishedSlug}`)) {
          return new Response("Not found", { status: 404 });
        }
        if (url.pathname === "/en" || url.pathname === "/vi") {
          const locale = url.pathname.slice(1);
          return new Response(`<html><head><meta name="robots" content="noindex, follow"><link rel="canonical" href="https://${previewHost}/${locale}"><link rel="alternate" hreflang="en" href="https://${previewHost}/en"><link rel="alternate" hreflang="vi" href="https://${previewHost}/vi"></head><body>${expectedHomeText.join(" ")}</body><link rel="stylesheet" href="/_next/static/css/test.css"><script src="/_next/static/chunks/test.js"></script></html>`, { status: 200 });
        }
        if (url.pathname.startsWith("/_next/static/")) return new Response("asset", { status: 200 });
        if (url.pathname.includes("/projects/") || url.pathname.includes("/blog/")) {
          return new Response(`<html><body>${expectedDetailText.join(" ")}</body></html>`, { status: 200 });
        }
        return new Response("Static detail page", { status: 200 });
      }
      return originalFetch(input, init);
    }));

    let background: Promise<unknown>[] = [];
    const executionCtx = {
      waitUntil(promise: Promise<unknown>) { background.push(promise); },
      passThroughOnException() {},
    } as Parameters<typeof app.fetch>[2];
    try {
      const published = await request(`/api/admin/content/project/${encodeURIComponent(draft.id)}/publish`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: draft.version, idempotencyKey: `phase4-publish-${uniqueSuffix}` }),
      }, sessionCookie, "https://worker.test", executionCtx);
      expect(published.status).toBe(201);
      const release = (await parse<{ id: string; status: string; checksum: string }>(published)).data!;
      releaseIds.push(release.id);
      expect(release.checksum).toMatch(/^[0-9a-f]{64}$/);
      const initialBackground = background;
      background = [];
      const job = await env.DB.prepare("SELECT id FROM deployment_jobs WHERE release_id = ?")
        .bind(release.id).first<{ id: string }>();
      expect(job?.id).toBeTruthy();
      await Promise.allSettled([...initialBackground, processDeploymentJob(bindings, job!.id)]);
      const storedRelease = await env.DB.prepare("SELECT status, content_checksum FROM content_releases WHERE id = ?")
        .bind(release.id).first<{ status: string; content_checksum: string }>();
      const releaseFailure = await env.DB.prepare("SELECT error_code, error_message FROM content_releases WHERE id = ?")
        .bind(release.id).first<{ error_code: string | null; error_message: string | null }>();
      expect(storedRelease?.status, JSON.stringify(releaseFailure)).toBe("LIVE");
      expect(storedRelease?.content_checksum).toBe(release.checksum);
      expect(releaseId).toBe(release.id);
      expect(releaseChecksum).toBe(release.checksum);
      expect(projectPreviewConfigPatches).toBe(0);
      expect(buildContextChecksCompleted).toBe(true);
      expect(requestMarker).toBe(`portfolio-release:${release.id}:attempt:1`);
      const liveState = await env.DB.prepare("SELECT live_release_id, active_release_id FROM release_environment_state WHERE environment = 'staging'")
        .first<{ live_release_id: string | null; active_release_id: string | null }>();
      expect(liveState).toEqual({ live_release_id: release.id, active_release_id: null });
      const items = await env.DB.prepare("SELECT entity_type, entity_id, operation FROM content_release_items WHERE release_id = ? AND entity_type = 'project' AND entity_id = ?")
        .bind(release.id, draft.id).first<{ entity_type: string; entity_id: string; operation: string }>();
      expect(items?.operation).toBe("PUBLISH");
      const liveDraft = await env.DB.prepare("SELECT state, base_revision FROM admin_content_drafts WHERE entity_type = 'project' AND entity_id = ?")
        .bind(draft.id).first<{ state: string; base_revision: string }>();
      const targetHash = await env.DB.prepare("SELECT snapshot_hash FROM content_release_items WHERE release_id = ? AND entity_type = 'project' AND entity_id = ?")
        .bind(release.id, draft.id).first<{ snapshot_hash: string }>();
      expect(liveDraft).toEqual({ state: "PUBLISHED", base_revision: targetHash?.snapshot_hash });
      const publicView = await request("/api/public/projects?locale=en", {}, "");
      expect(publicView.status).toBe(200);
      expect(await publicView.text()).toContain("Phase Four Release Integration Test");
      const duplicatePublish = await request(`/api/admin/content/project/${encodeURIComponent(draft.id)}/publish`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: draft.version, idempotencyKey: `phase4-publish-${uniqueSuffix}` }),
      });
      expect(duplicatePublish.status).toBe(201);
      expect((await parse<{ id: string }>(duplicatePublish)).data?.id).toBe(release.id);
      expect(deploymentNumber).toBe(1);

      expectedUnpublishedSlug = String(draft.snapshot.slug);
      background = [];
      const unpublishResponse = await request(`/api/admin/content/project/${encodeURIComponent(draft.id)}/unpublish`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: `phase4-unpublish-${uniqueSuffix}` }),
      }, sessionCookie, "https://worker.test", executionCtx);
      expect(unpublishResponse.status).toBe(201);
      const unpublished = (await parse<{ id: string }>(unpublishResponse)).data!;
      releaseIds.push(unpublished.id);
      await Promise.allSettled(background);
      const unpublishedStatus = await env.DB.prepare("SELECT status FROM content_releases WHERE id = ?")
        .bind(unpublished.id).first<{ status: string }>();
      expect(unpublishedStatus?.status).toBe("LIVE");
      const unpublishedRoute = await request(`/api/public/projects/${encodeURIComponent(draft.snapshot.slug as string)}?locale=en`, {}, "");
      expect(unpublishedRoute.status).toBe(404);
      const retainedDraft = await env.DB.prepare("SELECT state, base_revision FROM admin_content_drafts WHERE entity_type = 'project' AND entity_id = ?")
        .bind(draft.id).first<{ state: string; base_revision: string | null }>();
      expect(retainedDraft).toEqual({ state: "DRAFT", base_revision: null });

      expectedUnpublishedSlug = "";
      background = [];
      const rollbackResponse = await request(`/api/admin/content/project/${encodeURIComponent(draft.id)}/rollback`, {
        method: "POST",
        body: JSON.stringify({ releaseId: release.id, idempotencyKey: `phase4-rollback-${uniqueSuffix}` }),
      }, sessionCookie, "https://worker.test", executionCtx);
      expect(rollbackResponse.status).toBe(201);
      const rollback = (await parse<{ id: string }>(rollbackResponse)).data!;
      releaseIds.push(rollback.id);
      await Promise.allSettled(background);
      const rollbackStatus = await env.DB.prepare("SELECT status, operation FROM content_releases WHERE id = ?")
        .bind(rollback.id).first<{ status: string; operation: string }>();
      expect(rollbackStatus).toEqual({ status: "LIVE", operation: "ROLLBACK" });
      const restoredPublic = await request("/api/public/projects?locale=en", {}, "");
      expect(restoredPublic.status).toBe(200);
      expect(await restoredPublic.text()).toContain("Phase Four Release Integration Test");
      const expiredBuildContext = new URL("https://worker.test/api/build/release-context");
      expiredBuildContext.searchParams.set("branch", "feat/phase4-publish-workflow");
      expiredBuildContext.searchParams.set("commitSha", commitSha);
      expiredBuildContext.searchParams.set("previewUrl", `https://${previewHost}`);
      expect((await app.request(expiredBuildContext, {
        headers: { "x-portfolio-build-token": "phase4-build-token-test-only" },
      }, bindings)).status).toBe(404);
    } finally {
      vi.unstubAllGlobals();
      bindings.CLOUDFLARE_ACCOUNT_ID = undefined;
      bindings.PAGES_PROJECT_NAME = undefined;
      bindings.PAGES_STAGING_BRANCH = undefined;
      bindings.GITHUB_REPOSITORY = undefined;
      bindings.CLOUDFLARE_API_TOKEN = undefined;
      bindings.PAGES_BUILD_TOKEN = "phase4-build-token-test-only";
      await env.DB.prepare("UPDATE release_environment_state SET live_release_id = NULL, active_release_id = NULL, next_release_number = 1 WHERE environment = 'staging'").run();
      for (const id of [...releaseIds].reverse()) {
        const job = await env.DB.prepare("SELECT id FROM deployment_jobs WHERE release_id = ?").bind(id).first<{ id: string }>();
        if (job) await env.DB.prepare("DELETE FROM deployment_jobs WHERE id = ?").bind(job.id).run();
        await env.DB.prepare("DELETE FROM content_releases WHERE id = ?").bind(id).run();
      }
      await env.DB.prepare("DELETE FROM admin_audit_logs WHERE entity_id = ?").bind(draft.id).run();
      await env.DB.prepare("DELETE FROM admin_content_revisions WHERE entity_type = 'project' AND entity_id = ?").bind(draft.id).run();
      await env.DB.prepare("DELETE FROM admin_content_drafts WHERE entity_type = 'project' AND entity_id = ?").bind(draft.id).run();
    }
  }, 30_000);
});
