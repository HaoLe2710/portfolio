import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
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
import adminSchemaSql from "../migrations/0002_admin_cms.sql?raw";
import passwordSchemaSql from "../migrations/0003_argon2id_auth.sql?raw";
import schemaSql from "../migrations/0001_init_schema.sql?raw";
import type { WorkerBindings } from "../src/types/env";

const bindings: WorkerBindings = {
  DB: env.DB,
  CORS_ALLOWED_ORIGINS: "https://worker.test",
};
const ownerId = "phase3-test-owner";
const ownerEmail = "phase3-owner@example.invalid";
const ownerPassword = "Testing-Only-Password-2026!";
let sessionCookie = "";

function cookieToken(cookie: string) {
  const value = cookie.split(";")[0] ?? "";
  return decodeURIComponent(value.slice(value.indexOf("=") + 1));
}

async function request(path: string, init: RequestInit = {}, cookie = sessionCookie, origin = "https://worker.test") {
  const headers = new Headers(init.headers);
  headers.set("Origin", origin);
  if (cookie) headers.set("Cookie", cookie);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return app.request(`https://worker.test${path}`, { ...init, headers }, bindings);
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
