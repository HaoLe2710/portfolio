import { Hono, type Context } from "hono";
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
import { getLiveReleasePublicResponse, getReleasePublicResponse } from "./admin/release-public";
import { reconcileDeploymentJobs } from "./admin/release-service";

const app = new Hono<WorkerEnv>();

function constantTimeEqual(first: string, second: string) {
  let difference = first.length ^ second.length;
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (first.charCodeAt(index) || 0) ^ (second.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function publicResponse<T>(
  context: Context<WorkerEnv>,
  resource: Parameters<typeof getReleasePublicResponse>[3],
  locale: "en" | "vi",
  fallback: () => Promise<T>,
  slug?: string
) {
  const releaseId = context.req.header("x-portfolio-release-id");
  const buildToken = context.req.header("x-portfolio-build-token");
  if (!releaseId && !buildToken) {
    const environment = context.env.RELEASE_ENVIRONMENT;
    if (environment === "staging" || environment === "production") {
      const live = await getLiveReleasePublicResponse(context.env.DB, environment, resource, locale, slug);
      if (live !== null) return successResponse(context, live);
    }
    return successResponse(context, await fallback());
  }
  if (!releaseId || !buildToken || !context.env.PAGES_BUILD_TOKEN ||
      !constantTimeEqual(buildToken, context.env.PAGES_BUILD_TOKEN)) {
    throw new AdminError(401, "UNAUTHORIZED", "Build release authentication failed.");
  }
  const environment = context.env.RELEASE_ENVIRONMENT;
  if (environment !== "staging" && environment !== "production") {
    throw new AdminError(503, "RELEASE_CONFIGURATION_MISSING", "Release environment is not configured.");
  }
  const response = await getReleasePublicResponse(
    context.env.DB,
    releaseId,
    environment,
    resource,
    locale,
    slug
  );
  return successResponse(context, response);
}

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

app.get("/api/public/profile", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  return publicResponse(context, "profile", locale, () => getProfile(context.env.DB, locale));
});

app.get("/api/public/skills", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  return publicResponse(context, "skills", locale, () => getSkillGroups(context.env.DB, locale));
});

app.get("/api/public/achievements", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  return publicResponse(context, "achievements", locale, () => getAchievements(context.env.DB, locale));
});

app.get("/api/public/certificates", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  return publicResponse(context, "certificates", locale, () => getCertificates(context.env.DB, locale));
});

app.get("/api/public/projects", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  return publicResponse(context, "projects", locale, () => getProjects(context.env.DB, locale));
});

app.get("/api/public/projects/:slug", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  const slug = parseSlug(context.req.param("slug"));
  return publicResponse(context, "project", locale,
    () => getProjectBySlug(context.env.DB, locale, slug), slug);
});

app.get("/api/public/blog-posts", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  return publicResponse(context, "blogPosts", locale, () => getBlogPosts(context.env.DB, locale));
});

app.get("/api/public/blog-posts/:slug", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  const slug = parseSlug(context.req.param("slug"));
  return publicResponse(context, "blogPost", locale,
    () => getBlogPostBySlug(context.env.DB, locale, slug), slug);
});

app.get("/api/public/contact-links", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  return publicResponse(context, "contactLinks", locale, () => getContactLinks(context.env.DB, locale));
});

app.get("/api/public/site-settings", async (context) => {
  const locale = parseLocale(context.req.query("locale"));
  return publicResponse(context, "siteSettings", locale, () => getSiteSettings(context.env.DB, locale));
});

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

export function scheduled(_controller: ScheduledController, env: WorkerEnv["Bindings"], context: ExecutionContext) {
  context.waitUntil(reconcileDeploymentJobs(env));
}
