import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { mockPortfolio } from "../../src/data/mock-portfolio";
import type { Locale, ProjectContentBlock } from "../../src/types/portfolio";
import app from "../src/app";
import { buildSeedSql } from "../src/seed-data";
import schemaSql from "../migrations/0001_init_schema.sql?raw";
import type { WorkerBindings } from "../src/types/env";

const bindings: WorkerBindings = {
  DB: env.DB,
  CORS_ALLOWED_ORIGINS: "https://web-porfolio.pages.dev,http://localhost:3000",
};

async function request(path: string, init?: RequestInit) {
  return app.request(`https://worker.test${path}`, init, bindings);
}

async function json<T>(response: Response) {
  return (await response.json()) as {
    success: boolean;
    message: string;
    data: T | null;
    error: { code: string; message: string; details?: Record<string, unknown> } | null;
    timestamp: string;
    path: string;
  };
}

function localize(value: unknown, locale: Locale): unknown {
  if (Array.isArray(value)) return value.map((item) => localize(item, locale));
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length === 2 && "en" in record && "vi" in record) {
    return localize(record[locale], locale);
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, localize(child, locale)])
  );
}

function expectedBlockMetadata(block: ProjectContentBlock): Record<string, unknown> {
  switch (block.type) {
    case "MARKDOWN":
      return {};
    case "FEATURE_GRID":
    case "MODULE_LIST":
      return { items: block.items };
    case "ARCHITECTURE_FLOW":
      return { nodes: block.steps };
    case "CI_CD_FLOW":
      return { steps: block.steps };
    case "IMAGE_GALLERY":
      return { images: block.images };
    case "METRIC_CARDS":
      return { metrics: block.metrics };
    case "LINK_GROUP":
      return { links: block.links };
  }
}

beforeAll(async () => {
  const migration = {
    name: "0001_init_schema",
    queries: schemaSql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean),
  };
  await applyD1Migrations(env.DB, [migration]);
  for (const statement of buildSeedSql("vitest-mock-baseline").statements) {
    await env.DB.prepare(statement).run();
  }
});

describe("public Worker API", () => {
  it("reports API and D1 health with the standard envelope", async () => {
    const response = await request("/healthz");
    const body = await json<{ status: string; database: string }>(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: { status: "ok", database: "ok" },
      error: null,
      path: "/healthz",
    });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it.each<Locale>(["en", "vi"])("returns the complete published DTO set for %s", async (locale) => {
    const project = mockPortfolio.projects[0];
    const blogPost = mockPortfolio.blogPosts[0];
    const endpoints = [
      "/profile",
      "/skills",
      "/achievements",
      "/certificates",
      "/projects",
      `/projects/${project.slug}`,
      "/blog-posts",
      `/blog-posts/${blogPost.slug}`,
      "/contact-links",
      "/site-settings",
    ];

    for (const endpoint of endpoints) {
      const response = await request(`/api/public${endpoint}?locale=${locale}`);
      const body = await json<unknown>(response);
      expect(response.status, endpoint).toBe(200);
      expect(body.success, endpoint).toBe(true);
      expect(body.error, endpoint).toBeNull();
      expect(body.timestamp, endpoint).toBeTruthy();
      expect(body.path, endpoint).toBe(`/api/public${endpoint}`);
      expect(body.data, endpoint).not.toBeNull();
    }

    const profile = await json<Record<string, unknown>>(
      await request(`/api/public/profile?locale=${locale}`)
    );
    expect(profile.data).toMatchObject({
      fullName: mockPortfolio.profile.fullName,
      brandName: mockPortfolio.profile.brand,
      role: mockPortfolio.profile.role[locale],
      summary: mockPortfolio.profile.summary[locale],
      cvUrl: mockPortfolio.profile.cvUrl,
      locale,
    });

    const groups = await json<Array<Record<string, unknown>>>(
      await request(`/api/public/skills?locale=${locale}`)
    );
    expect(groups.data).toHaveLength(mockPortfolio.skillGroups.length);
    expect(groups.data?.[0]).toMatchObject({
      id: mockPortfolio.skillGroups[0].id,
      name: mockPortfolio.skillGroups[0].name[locale],
      skills: mockPortfolio.skillGroups[0].skills,
    });

    const projects = await json<Array<Record<string, unknown>>>(
      await request(`/api/public/projects?locale=${locale}`)
    );
    expect(projects.data).toHaveLength(mockPortfolio.projects.length);
    for (const [index, source] of mockPortfolio.projects.entries()) {
      expect(projects.data?.[index]).toMatchObject({
        id: source.id,
        slug: source.slug,
        title: source.title[locale],
        description: source.description[locale],
        featured: source.featured,
        techStack: source.techStack,
        highlights: source.highlights[locale],
        statuses: source.statusLabels[locale].map((label) => ({ label })),
        links: source.links.map((link) => ({
          id: link.id,
          label: link.label[locale],
          url: link.href,
        })),
      });
    }

    const projectDetail = await json<Record<string, unknown>>(
      await request(`/api/public/projects/${project.slug}?locale=${locale}`)
    );
    const detail = projectDetail.data as {
      contentBlocks: Array<Record<string, unknown>>;
    };
    expect(detail.contentBlocks).toHaveLength(project.contentBlocks.length);
    project.contentBlocks.forEach((block, index) => {
      expect(detail.contentBlocks[index]).toMatchObject({
        id: block.id,
        type: block.type,
        displayOrder: index,
        title: block.title[locale],
        metadata: localize(expectedBlockMetadata(block), locale),
        ...(block.type === "MARKDOWN" ? { markdown: block.body[locale] } : {}),
      });
    });

    const blogs = await json<Array<Record<string, unknown>>>(
      await request(`/api/public/blog-posts?locale=${locale}`)
    );
    expect(blogs.data).toHaveLength(mockPortfolio.blogPosts.length);
    expect(blogs.data?.[0]).toMatchObject({
      id: blogPost.id,
      slug: blogPost.slug,
      title: blogPost.title[locale],
      summary: blogPost.summary[locale],
      tags: blogPost.tags,
    });

    const blogDetail = await json<Record<string, unknown>>(
      await request(`/api/public/blog-posts/${blogPost.slug}?locale=${locale}`)
    );
    expect(blogDetail.data).toMatchObject({
      id: blogPost.id,
      contentMarkdown: blogPost.content[locale],
      title: blogPost.title[locale],
    });

    const achievements = await json<Array<Record<string, unknown>>>(
      await request(`/api/public/achievements?locale=${locale}`)
    );
    expect(achievements.data).toHaveLength(mockPortfolio.achievements.length);
    expect(achievements.data?.[0]).toMatchObject({
      id: mockPortfolio.achievements[0].id,
      title: mockPortfolio.achievements[0].title[locale],
      description: mockPortfolio.achievements[0].description[locale],
    });

    const certificates = await json<Array<Record<string, unknown>>>(
      await request(`/api/public/certificates?locale=${locale}`)
    );
    expect(certificates.data).toHaveLength(mockPortfolio.certificates.length);
    expect(certificates.data?.[0]).toMatchObject({
      id: mockPortfolio.certificates[0].id,
      title: mockPortfolio.certificates[0].title[locale],
      issuer: mockPortfolio.certificates[0].issuer[locale],
      official: mockPortfolio.certificates[0].official,
    });

    const contacts = await json<Array<Record<string, unknown>>>(
      await request(`/api/public/contact-links?locale=${locale}`)
    );
    expect(contacts.data).toHaveLength(mockPortfolio.contactLinks.length);
    expect(contacts.data?.[0]).toMatchObject({
      id: mockPortfolio.contactLinks[0].id,
      label: mockPortfolio.contactLinks[0].label[locale],
      url: mockPortfolio.contactLinks[0].href,
    });

    const settings = await json<Record<string, unknown>>(
      await request(`/api/public/site-settings?locale=${locale}`)
    );
    expect(settings.data).toMatchObject({
      locale,
      defaultLocale: mockPortfolio.siteSettings.defaultLocale,
      supportedLocales: mockPortfolio.siteSettings.supportedLocales,
      siteName: mockPortfolio.siteSettings.siteName,
      authorName: mockPortfolio.siteSettings.authorName,
    });
  });

  it("defaults locale to English and rejects invalid locales and slugs", async () => {
    const defaultLocale = await json<Record<string, unknown>>(
      await request("/api/public/profile")
    );
    expect(defaultLocale.data?.locale).toBe("en");

    const invalidLocale = await request("/api/public/projects?locale=fr");
    expect(invalidLocale.status).toBe(400);
    expect((await json(invalidLocale)).error?.code).toBe("VALIDATION_ERROR");

    const injection = await request(
      "/api/public/projects/leafy%27%20OR%201%3D1--?locale=en"
    );
    expect(injection.status).toBe(400);
    expect((await json(injection)).error?.code).toBe("VALIDATION_ERROR");
  });

  it("returns a 404 error envelope for missing and draft resources", async () => {
    const missing = await request(
      "/api/public/projects/not-a-published-project?locale=en"
    );
    expect(missing.status).toBe(404);
    expect(await json(missing)).toMatchObject({
      success: false,
      data: null,
      error: { code: "NOT_FOUND" },
    });

    await env.DB.prepare(
      `INSERT INTO projects (id, slug, status) VALUES (?, ?, ?)`
    )
      .bind("draft-project", "draft-project", "DRAFT")
      .run();
    await env.DB.prepare(
      `INSERT INTO project_translations (project_id, locale, title, subtitle, role, summary, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind("draft-project", "en", "Draft", "Draft", "Draft", "Draft", "Draft")
      .run();

    const listed = await json<Array<{ slug: string }>>(
      await request("/api/public/projects?locale=en")
    );
    expect(listed.data?.some((item) => item.slug === "draft-project")).toBe(false);
    const detail = await request("/api/public/projects/draft-project?locale=en");
    expect(detail.status).toBe(404);
  });

  it("applies allowed-origin CORS without credentials or wildcard access", async () => {
    const preflight = await request("/api/public/profile", {
      method: "OPTIONS",
      headers: {
        Origin: "https://web-porfolio.pages.dev",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(preflight.headers.get("access-control-allow-origin")).toBe(
      "https://web-porfolio.pages.dev"
    );
    expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();

    const rejected = await request("/api/public/profile", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.invalid",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns deterministic ordering and stable unique ids", async () => {
    const response = await json<Array<{ id: string; displayOrder: number }>>(
      await request("/api/public/projects?locale=en")
    );
    const ids = response.data?.map((project) => project.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(response.data?.map((project) => project.displayOrder)).toEqual([0, 1]);

    const groups = await json<Array<{ skills: Array<{ id: string }> }>>(
      await request("/api/public/skills?locale=en")
    );
    for (const group of groups.data ?? []) {
      const skillIds = group.skills.map((skill) => skill.id);
      expect(new Set(skillIds).size).toBe(skillIds.length);
    }
  });

  it("enforces unique slugs and foreign keys", async () => {
    await expect(
      env.DB.prepare("INSERT INTO projects (id, slug) VALUES (?, ?)")
        .bind("duplicate-project", mockPortfolio.projects[0].slug)
        .run()
    ).rejects.toThrow();

    await expect(
      env.DB.prepare(
        `INSERT INTO project_translations (project_id, locale, title, subtitle, role, summary, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind("no-parent", "en", "Title", "Subtitle", "Role", "Summary", "Description")
        .run()
    ).rejects.toThrow();
  });

  it("does not expose database error details", async () => {
    const brokenBindings = {
      ...bindings,
      DB: {
        prepare() {
          throw new Error("SQLITE_ERROR: private table name and database detail");
        },
      } as unknown as D1Database,
    };
    const response = await app.request(
      "https://worker.test/api/public/profile?locale=en",
      {},
      brokenBindings
    );
    const body = await json(response);

    expect(response.status).toBe(500);
    expect(body.error?.message).toBe("An unexpected error occurred.");
    expect(JSON.stringify(body)).not.toContain("SQLITE_ERROR");
  });

  it("keeps the initial seed idempotent and preserves existing edits", async () => {
    await env.DB.prepare("UPDATE profile SET brand = ? WHERE id = ?")
      .bind("Admin edit", "primary")
      .run();
    for (const statement of buildSeedSql("vitest-mock-baseline").statements) {
      await env.DB.prepare(statement).run();
    }

    const result = await env.DB.prepare("SELECT brand FROM profile WHERE id = ?")
      .bind("primary")
      .first<{ brand: string }>();
    const seedRuns = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM seed_runs WHERE source_hash = ?"
    )
      .bind("vitest-mock-baseline")
      .first<{ count: number }>();

    expect(result?.brand).toBe("Admin edit");
    expect(seedRuns?.count).toBe(1);
  });
});
