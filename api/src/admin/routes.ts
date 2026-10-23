import { Hono } from "hono";
import { z } from "zod";
import type { WorkerEnv } from "../types/env";
import { errorResponse, successResponse } from "../utils/api-response";
import {
  createDraft,
  discardDraft,
  getContentDetail,
  getDashboard,
  listAuditLogs,
  listContent,
  listRevisions,
  parseContentTypeParam,
  restoreRevision,
  saveDraft,
} from "./content";
import { requireAdmin, requireOwner, currentAdmin, login, logout, changePassword } from "./auth";
import { AdminError } from "./errors";

const router = new Hono<WorkerEnv>();

function pagination(value: string | undefined, fallback: number, max: number) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, max) : fallback;
}

router.use("*", async (context, next) => {
  const path = new URL(context.req.url).pathname;
  if (path.endsWith("/api/admin/auth/login") && context.req.method === "POST") {
    return next();
  }
  return requireAdmin(context, next);
});

router.post("/auth/login", (context) => login(context));
router.get("/me", (context) => currentAdmin(context));
router.post("/auth/logout", (context) => logout(context));
router.post("/auth/password", (context) => changePassword(context));
router.get("/dashboard", async (context) =>
  successResponse(context, await getDashboard(context.env.DB))
);

router.get("/content/:type", async (context) => {
  const type = parseContentTypeParam(context.req.param("type"));
  const page = pagination(context.req.query("page"), 1, 1_000_000);
  const pageSize = pagination(context.req.query("pageSize"), 20, 100);
  return successResponse(context, await listContent(context.env.DB, type, {
    search: context.req.query("search") ?? "",
    page,
    pageSize,
  }));
});

router.post("/content/:type/drafts", async (context) => {
  const type = parseContentTypeParam(context.req.param("type"));
  const draft = await createDraft(context, type, await context.req.json().catch(() => null));
  return successResponse(context, draft, "Draft created.", 201);
});

router.get("/content/:type/:id", async (context) => {
  const type = parseContentTypeParam(context.req.param("type"));
  const detail = await getContentDetail(context.env.DB, type, context.req.param("id"));
  return successResponse(context, detail);
});

router.put("/content/:type/:id/draft", async (context) => {
  const type = parseContentTypeParam(context.req.param("type"));
  const detail = await saveDraft(context, type, context.req.param("id"), await context.req.json().catch(() => null));
  return successResponse(context, detail, "Draft saved.");
});

router.delete("/content/:type/:id/draft", async (context) => {
  const body = z.object({ expectedVersion: z.number().int().positive() }).strict()
    .safeParse(await context.req.json().catch(() => null));
  if (!body.success) throw new AdminError(400, "VALIDATION_ERROR", "A valid draft version is required.");
  const type = parseContentTypeParam(context.req.param("type"));
  return successResponse(context,
    await discardDraft(context, type, context.req.param("id"), body.data.expectedVersion),
    "Draft discarded.");
});

router.get("/content/:type/:id/revisions", async (context) => {
  const type = parseContentTypeParam(context.req.param("type"));
  return successResponse(context, await listRevisions(context.env.DB, type, context.req.param("id")));
});

router.post("/content/:type/:id/revisions/:revisionId/restore", async (context) => {
  const body = z.object({ expectedVersion: z.number().int().nonnegative() }).strict()
    .safeParse(await context.req.json().catch(() => null));
  if (!body.success) throw new AdminError(400, "VALIDATION_ERROR", "A valid draft version is required.");
  const type = parseContentTypeParam(context.req.param("type"));
  const detail = await restoreRevision(
    context,
    type,
    context.req.param("id"),
    context.req.param("revisionId"),
    body.data.expectedVersion
  );
  return successResponse(context, detail, "Draft revision restored.");
});

router.get("/audit-logs", async (context) => {
  requireOwner(context);
  const page = pagination(context.req.query("page"), 1, 1_000_000);
  const pageSize = pagination(context.req.query("pageSize"), 50, 100);
  return successResponse(context, await listAuditLogs(context.env.DB, {
    page,
    pageSize,
    action: context.req.query("action") ?? "",
  }));
});

router.notFound((context) => errorResponse(context, 404, "NOT_FOUND", "Admin resource not found."));

export default router;
