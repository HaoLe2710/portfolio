import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestLogger } from "./middleware/request-logger";
import {
  getAchievements,
  getBlogPostBySlug,
  getBlogPosts,
  getCertificates,
  getContactLinks,
  getProfile,
  getProjectBySlug,
  getProjects,
  getSiteSettings,
  getSkillGroups,
} from "./services/public-service";
import { ApiError } from "./utils/api-error";
import { errorResponse, successResponse } from "./utils/api-response";
import { parseLocale, parseSlug } from "./validators/public-query";
import type { WorkerEnv } from "./types/env";
import adminRoutes from "./admin/routes";
import { AdminError } from "./admin/errors";

const app = new Hono<WorkerEnv>();

function allowedOrigins(configured: string | undefined) {
  return new Set(
    (configured ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

app.use("*", requestLogger);
app.use(
  "/api/public/*",
  cors({
    origin: (origin, context) =>
      allowedOrigins(context.env.CORS_ALLOWED_ORIGINS).has(origin)
        ? origin
        : null,
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Accept", "Content-Type"],
    maxAge: 600,
  })
);

app.route("/api/admin", adminRoutes);

app.get("/healthz", async (context) => {
  const row = await context.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

  if (row?.ok !== 1) {
    throw new Error("D1 health query returned an unexpected result.");
  }

  return successResponse(context, { status: "ok", database: "ok" });
});

app.get("/api/public/profile", async (context) =>
  successResponse(
    context,
    await getProfile(context.env.DB, parseLocale(context.req.query("locale")))
  )
);

app.get("/api/public/skills", async (context) =>
  successResponse(
    context,
    await getSkillGroups(context.env.DB, parseLocale(context.req.query("locale")))
  )
);

app.get("/api/public/achievements", async (context) =>
  successResponse(
    context,
    await getAchievements(context.env.DB, parseLocale(context.req.query("locale")))
  )
);

app.get("/api/public/certificates", async (context) =>
  successResponse(
    context,
    await getCertificates(context.env.DB, parseLocale(context.req.query("locale")))
  )
);

app.get("/api/public/projects", async (context) =>
  successResponse(
    context,
    await getProjects(context.env.DB, parseLocale(context.req.query("locale")))
  )
);

app.get("/api/public/projects/:slug", async (context) =>
  successResponse(
    context,
    await getProjectBySlug(
      context.env.DB,
      parseLocale(context.req.query("locale")),
      parseSlug(context.req.param("slug"))
    )
  )
);

app.get("/api/public/blog-posts", async (context) =>
  successResponse(
    context,
    await getBlogPosts(context.env.DB, parseLocale(context.req.query("locale")))
  )
);

app.get("/api/public/blog-posts/:slug", async (context) =>
  successResponse(
    context,
    await getBlogPostBySlug(
      context.env.DB,
      parseLocale(context.req.query("locale")),
      parseSlug(context.req.param("slug"))
    )
  )
);

app.get("/api/public/contact-links", async (context) =>
  successResponse(
    context,
    await getContactLinks(context.env.DB, parseLocale(context.req.query("locale")))
  )
);

app.get("/api/public/site-settings", async (context) =>
  successResponse(
    context,
    await getSiteSettings(context.env.DB, parseLocale(context.req.query("locale")))
  )
);

app.notFound((context) =>
  errorResponse(context, 404, "NOT_FOUND", "Resource not found.")
);

app.onError((error, context) => {
  if (error instanceof AdminError) {
    return errorResponse(context, error.status, error.code, error.message, error.details);
  }

  if (error instanceof ApiError) {
    return errorResponse(
      context,
      error.status,
      error.code,
      error.message,
      error.details
    );
  }

  console.error(
    JSON.stringify({
      event: "request_error",
      method: context.req.method,
      path: context.req.path,
      errorName: error instanceof Error ? error.name : "UnknownError",
    })
  );

  return errorResponse(
    context,
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred."
  );
});

export default app;
