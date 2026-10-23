import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";
import { errorResponse, successResponse } from "../utils/api-response";
import type { WorkerEnv } from "../types/env";
import { AdminError } from "./errors";
import {
  CURRENT_PASSWORD_ALGORITHM,
  DUMMY_PASSWORD_HASH,
  DUMMY_PASSWORD_SALT,
  LEGACY_PASSWORD_ITERATIONS,
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from "./password";
import { writeAudit } from "./audit";

export const SESSION_COOKIE = "portfolio_admin_session";
const SESSION_SECONDS = 60 * 60 * 12;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 5;

type AdminUserRow = {
  id: string;
  email: string;
  password_salt: string;
  password_hash: string;
  password_iterations: number;
  password_algorithm: string;
  role: "OWNER" | "ADMIN";
};

function readCookie(context: Context<WorkerEnv>, name: string) {
  const cookie = context.req.header("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function cookieHeader(context: Context<WorkerEnv>, token?: string) {
  const secure = new URL(context.req.url).protocol === "https:" ? "; Secure" : "";
  if (!token) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function requestHasSameOrigin(context: Context<WorkerEnv>) {
  const origin = context.req.header("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(context.req.url).origin;
  } catch {
    return false;
  }
}

async function getRateLimit(context: Context<WorkerEnv>, keyHash: string) {
  return context.env.DB.prepare(
    `SELECT blocked_until FROM admin_login_attempts WHERE key_hash = ?`
  ).bind(keyHash).first<{ blocked_until: number | null }>();
}

async function recordLoginFailure(context: Context<WorkerEnv>, keyHash: string) {
  await context.env.DB.prepare(
    `INSERT INTO admin_login_attempts (key_hash, window_started_at, attempts, blocked_until)
     VALUES (?, CAST(strftime('%s', 'now') AS INTEGER), 1, NULL)
     ON CONFLICT(key_hash) DO UPDATE SET
       attempts = CASE
         WHEN window_started_at <= CAST(strftime('%s', 'now') AS INTEGER) - ? THEN 1
         ELSE attempts + 1
       END,
       window_started_at = CASE
         WHEN window_started_at <= CAST(strftime('%s', 'now') AS INTEGER) - ?
           THEN CAST(strftime('%s', 'now') AS INTEGER)
         ELSE window_started_at
       END,
       blocked_until = CASE
         WHEN window_started_at <= CAST(strftime('%s', 'now') AS INTEGER) - ? THEN NULL
         WHEN attempts + 1 >= ? THEN CAST(strftime('%s', 'now') AS INTEGER) + ?
         ELSE blocked_until
       END`
  ).bind(keyHash, LOGIN_WINDOW_SECONDS, LOGIN_WINDOW_SECONDS, LOGIN_WINDOW_SECONDS, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_SECONDS).run();
}

async function createSession(context: Context<WorkerEnv>, admin: AdminUserRow) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await context.env.DB.prepare(
    `INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)`
  ).bind(await sha256(token), admin.id, expiresAt).run();
  context.header("Set-Cookie", cookieHeader(context, token));
}

export async function login(context: Context<WorkerEnv>) {
  if (!requestHasSameOrigin(context)) {
    await writeAudit(context, { action: "AUTH_ORIGIN_REJECTED" });
    return errorResponse(context, 403, "FORBIDDEN", "Request origin is not allowed.");
  }

  const body = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(256),
  }).safeParse(await context.req.json().catch(() => null));

  if (!body.success) {
    return errorResponse(context, 400, "VALIDATION_ERROR", "Enter a valid email and password.");
  }

  const ip = context.req.header("cf-connecting-ip") ?? "unknown";
  const rateKey = await sha256(`admin-login:${ip}`);
  const rateLimit = await getRateLimit(context, rateKey);
  if (rateLimit?.blocked_until && rateLimit.blocked_until > Math.floor(Date.now() / 1000)) {
    await writeAudit(context, { action: "LOGIN_RATE_LIMITED" });
    return errorResponse(context, 429, "RATE_LIMITED", "Too many login attempts. Try again later.");
  }

  const admin = await context.env.DB.prepare(
    `SELECT id, email, password_salt, password_hash, password_iterations, password_algorithm, role
     FROM admin_users WHERE email = ? LIMIT 1`
  ).bind(body.data.email.toLowerCase()).first<AdminUserRow>();

  const passwordMatches = await verifyPassword(
    body.data.password,
    admin?.password_salt ?? DUMMY_PASSWORD_SALT,
    admin?.password_hash ?? DUMMY_PASSWORD_HASH,
    admin?.password_iterations ?? LEGACY_PASSWORD_ITERATIONS,
    admin?.password_algorithm ?? CURRENT_PASSWORD_ALGORITHM
  );

  if (!admin || !passwordMatches) {
    await recordLoginFailure(context, rateKey);
    await writeAudit(context, {
      action: "LOGIN_FAILED",
      metadata: { reason: "invalid_credentials", accountRecordFound: Boolean(admin) },
    });
    return errorResponse(context, 401, "UNAUTHORIZED", "Email or password is incorrect.");
  }

  if (admin.password_algorithm !== CURRENT_PASSWORD_ALGORITHM) {
    const replacement = await hashPassword(body.data.password);
    await context.env.DB.prepare(
      `UPDATE admin_users SET password_salt = ?, password_hash = ?, password_iterations = ?, password_algorithm = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       password_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND password_algorithm = ?`
    ).bind(
      replacement.salt,
      replacement.hash,
      replacement.iterations,
      replacement.algorithm,
      admin.id,
      admin.password_algorithm
    ).run();
  }

  await context.env.DB.prepare("DELETE FROM admin_login_attempts WHERE key_hash = ?").bind(rateKey).run();
  await createSession(context, admin);
  await writeAudit(context, { action: "LOGIN_SUCCEEDED", actorId: admin.id });
  return successResponse(context, { id: admin.id, email: admin.email, role: admin.role }, "Signed in.");
}

export const requireAdmin: MiddlewareHandler<WorkerEnv> = async (context, next) => {
  const token = readCookie(context, SESSION_COOKIE);
  if (!token || token.length > 128) {
    if (token) await writeAudit(context, { action: "AUTHENTICATION_FAILURE", metadata: { reason: "invalid_cookie" } });
    return errorResponse(context, 401, "UNAUTHORIZED", "Sign in to access this resource.");
  }

  const tokenHash = await sha256(token);
  const session = await context.env.DB.prepare(
    `SELECT u.id, u.email, u.role, s.expires_at
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.admin_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL
      LIMIT 1`
  ).bind(tokenHash).first<{
    id: string;
    email: string;
    role: "OWNER" | "ADMIN";
    expires_at: string;
  }>();

  if (!session) {
    return errorResponse(context, 401, "UNAUTHORIZED", "Session is invalid. Sign in again.");
  }

  const expiresAt = Date.parse(session.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await context.env.DB.prepare(
      `UPDATE admin_sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE token_hash = ?`
    ).bind(tokenHash).run();
    context.header("Set-Cookie", cookieHeader(context));
    await writeAudit(context, { action: "SESSION_EXPIRED", actorId: session.id });
    return errorResponse(context, 401, "UNAUTHORIZED", "Session expired. Sign in again.");
  }

  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    await writeAudit(context, { action: "AUTHORIZATION_DENIED", actorId: session.id });
    return errorResponse(context, 403, "FORBIDDEN", "You do not have permission to access this resource.");
  }

  context.set("admin", { id: session.id, email: session.email, role: session.role });
  if (["POST", "PUT", "PATCH", "DELETE"].includes(context.req.method) && !requestHasSameOrigin(context)) {
    await writeAudit(context, { action: "AUTH_ORIGIN_REJECTED", actorId: session.id });
    return errorResponse(context, 403, "FORBIDDEN", "Request origin is not allowed.");
  }

  await next();
};

export function requireOwner(context: Context<WorkerEnv>) {
  if (context.get("admin").role !== "OWNER") {
    throw new AdminError(403, "FORBIDDEN", "Owner permission is required.");
  }
}

export async function logout(context: Context<WorkerEnv>) {
  const token = readCookie(context, SESSION_COOKIE);
  if (token) {
    await context.env.DB.prepare(
      `UPDATE admin_sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE token_hash = ? AND revoked_at IS NULL`
    ).bind(await sha256(token)).run();
  }
  context.header("Set-Cookie", cookieHeader(context));
  await writeAudit(context, { action: "LOGOUT", actorId: context.get("admin").id });
  return successResponse(context, { loggedOut: true }, "Signed out.");
}

export async function changePassword(context: Context<WorkerEnv>) {
  const admin = context.get("admin");
  const body = z.object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(12).max(256),
  }).safeParse(await context.req.json().catch(() => null));
  if (!body.success) {
    return errorResponse(context, 400, "VALIDATION_ERROR", "New password must be at least 12 characters.");
  }

  const user = await context.env.DB.prepare(
    `SELECT password_salt, password_hash, password_iterations, password_algorithm FROM admin_users WHERE id = ?`
  ).bind(admin.id).first<Pick<AdminUserRow, "password_salt" | "password_hash" | "password_iterations" | "password_algorithm">>();
  if (!user || !(await verifyPassword(
    body.data.currentPassword,
    user.password_salt,
    user.password_hash,
    user.password_iterations,
    user.password_algorithm as typeof CURRENT_PASSWORD_ALGORITHM | "pbkdf2-sha256"
  ))) {
    await writeAudit(context, { action: "PASSWORD_CHANGE_FAILED", actorId: admin.id });
    return errorResponse(context, 401, "UNAUTHORIZED", "Current password is incorrect.");
  }

  const password = await hashPassword(body.data.newPassword);
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE admin_users SET password_salt = ?, password_hash = ?, password_iterations = ?, password_algorithm = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       password_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).bind(password.salt, password.hash, password.iterations, password.algorithm, admin.id),
    context.env.DB.prepare(
      `UPDATE admin_sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE admin_id = ? AND revoked_at IS NULL`
    ).bind(admin.id),
  ]);
  context.header("Set-Cookie", cookieHeader(context));
  await writeAudit(context, { action: "PASSWORD_CHANGED", actorId: admin.id });
  return successResponse(context, { changed: true }, "Password changed. Sign in again.");
}

export function currentAdmin(context: Context<WorkerEnv>) {
  const admin = context.get("admin");
  return successResponse(context, { id: admin.id, email: admin.email, role: admin.role });
}
