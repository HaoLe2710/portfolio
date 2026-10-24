import type { D1Database } from "@cloudflare/workers-types";
import { ApiError } from "../utils/api-error";
import type { ContentType } from "./schemas";

type ReleaseRow = {
  entity_type: string;
  entity_id: string;
  operation: string;
  snapshot_json: string;
};

type Snapshot = Record<string, unknown>;
type Localized = { en?: unknown; vi?: unknown };
type Locale = "en" | "vi";
type PublicResource =
  | "profile" | "skills" | "achievements" | "certificates" | "projects"
  | "project" | "blogPosts" | "blogPost" | "contactLinks" | "siteSettings";

function previewHostname(value: string) {
  try {
    const url = new URL(value.startsWith("https://") ? value : `https://${value}`);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash ||
        (url.pathname !== "" && url.pathname !== "/")) return null;
    const hostname = url.hostname.toLowerCase();
    return hostname !== "web-porfolio.pages.dev" && hostname.endsWith(".web-porfolio.pages.dev")
      ? hostname
      : null;
  } catch {
    return null;
  }
}

function record(value: unknown): Snapshot {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Snapshot
    : {};
}

function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function localized(value: unknown, locale: Locale) {
  if (typeof value === "string") return value;
  const pair = record(value) as Localized;
  return text(pair[locale]);
}

function boolean(value: unknown) {
  return value === true;
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function contentBlock(blockValue: unknown, index: number, locale: Locale) {
  const block = record(blockValue);
  const type = text(block.type);
  const metadata: Snapshot = {};
  const copyArray = (source: string, target = source) => {
    metadata[target] = rows(block[source]);
  };

  switch (type) {
    case "FEATURE_GRID": copyArray("items"); break;
    case "ARCHITECTURE_FLOW": copyArray("steps"); break;
    case "MODULE_LIST": copyArray("items"); break;
    case "CI_CD_FLOW": copyArray("steps"); break;
    case "IMAGE_GALLERY": copyArray("images"); break;
    case "METRIC_CARDS": copyArray("metrics"); break;
    case "LINK_GROUP":
      metadata.links = rows(block.links).map((item) => {
        const link = record(item);
        return {
          id: text(link.id),
          label: localized(link.label, locale),
          url: text(link.href),
          href: text(link.href),
          icon: text(link.icon),
        };
      });
      break;
  }

  return {
    id: text(block.id),
    type,
    displayOrder: index,
    title: localized(block.title, locale),
    description: "",
    markdown: type === "MARKDOWN" ? localized(block.body, locale) : null,
    metadata,
  };
}

function projectSummary(snapshot: Snapshot, locale: Locale) {
  return {
    id: text(snapshot.id),
    slug: text(snapshot.slug),
    title: localized(snapshot.title, locale),
    subtitle: localized(snapshot.subtitle, locale),
    summary: localized(snapshot.summary, locale),
    description: localized(snapshot.description, locale),
    role: localized(snapshot.role, locale),
    thumbnailUrl: text(snapshot.thumbnailUrl) || null,
    featured: boolean(snapshot.featured),
    displayOrder: number(snapshot.displayOrder),
    tags: [] as string[],
    techStack: rows(snapshot.techStack).map((item) => text(item)).filter(Boolean),
    highlights: rows(snapshot.highlights).map((item) => localized(record(item).text, locale)),
    statuses: rows(snapshot.statuses).map((item) => {
      const status = record(item);
      return {
        label: localized(status.label, locale),
        tone: text(status.tone) || null,
        icon: text(status.icon) || null,
      };
    }),
    links: rows(snapshot.links).map((item) => {
      const link = record(item);
      return {
        id: text(link.id),
        label: localized(link.label, locale),
        url: text(link.href),
        type: null,
        icon: text(link.icon) || null,
        primary: boolean(link.isPrimary),
      };
    }),
  };
}

function blogSummary(snapshot: Snapshot, locale: Locale) {
  const readingMinutes = Math.max(1, number(snapshot.readingTimeMinutes, 1));
  const seo = record(record(snapshot.seo)[locale]);
  return {
    id: text(snapshot.id),
    slug: text(snapshot.slug),
    title: localized(snapshot.title, locale),
    summary: localized(snapshot.summary, locale),
    excerpt: localized(snapshot.summary, locale),
    coverImageUrl: text(snapshot.coverImageUrl) || null,
    publishedAt: text(snapshot.publishedAt),
    readingTime: `${readingMinutes} min read`,
    tags: rows(snapshot.tags).map((item) => text(item)).filter(Boolean),
    featured: boolean(snapshot.featured),
    seo: Object.keys(seo).length ? {
      title: text(seo.title, localized(snapshot.title, locale)),
      description: text(seo.description, localized(snapshot.summary, locale)),
      canonicalPath: text(seo.canonicalPath, `/${locale}/blog/${text(snapshot.slug)}`),
      ogImageUrl: text(seo.ogImageUrl) || null,
    } : null,
  };
}

function toPublicSnapshot(type: ContentType, snapshot: Snapshot, locale: Locale) {
  switch (type) {
    case "profile": {
      const role = localized(snapshot.role, locale);
      return {
        locale,
        fullName: text(snapshot.fullName),
        brandName: text(snapshot.brand),
        headline: role,
        role,
        summary: localized(snapshot.summary, locale),
        about: localized(snapshot.about, locale),
        careerObjective: localized(snapshot.careerObjective, locale),
        location: localized(snapshot.location, locale),
        university: localized(snapshot.university, locale),
        major: localized(snapshot.major, locale),
        gpa: text(snapshot.gpa),
        focus: localized(snapshot.focus, locale),
        email: text(snapshot.email),
        githubUrl: text(snapshot.githubUrl),
        linkedInUrl: text(snapshot.linkedInUrl),
        cvUrl: text(snapshot.cvUrl),
      };
    }
    case "skills":
      return {
        id: text(snapshot.id),
        name: localized(snapshot.name, locale),
        description: localized(snapshot.description, locale),
        icon: text(snapshot.icon) || null,
        displayOrder: number(snapshot.displayOrder),
        skills: rows(snapshot.skills).map((item) => {
          const skill = record(item);
          return {
            id: text(skill.id),
            name: localized(skill.name, locale),
            level: text(skill.level) || null,
            icon: text(skill.icon) || null,
            displayOrder: number(skill.displayOrder),
          };
        }),
      };
    case "achievement":
      return {
        id: text(snapshot.id),
        title: localized(snapshot.title, locale),
        description: localized(snapshot.description, locale),
        issuer: text(snapshot.issuer) || null,
        achievedAt: text(snapshot.achievedAt) || null,
        icon: text(snapshot.icon),
        displayOrder: number(snapshot.displayOrder),
      };
    case "certificate":
      return {
        id: text(snapshot.id),
        title: localized(snapshot.title, locale),
        description: localized(snapshot.description, locale),
        issuer: localized(snapshot.issuer, locale),
        status: text(snapshot.kind),
        issuedAt: text(snapshot.issuedAt) || null,
        credentialUrl: text(snapshot.credentialUrl) || null,
        official: boolean(snapshot.official),
        icon: text(snapshot.icon),
        displayOrder: number(snapshot.displayOrder),
      };
    case "project":
      return projectSummary(snapshot, locale);
    case "blogPost":
      return blogSummary(snapshot, locale);
    case "contactLink":
      return {
        id: text(snapshot.id),
        label: localized(snapshot.label, locale),
        value: text(snapshot.value),
        url: text(snapshot.href),
        type: text(snapshot.type),
        icon: text(snapshot.icon) || null,
        primary: boolean(snapshot.isPrimary),
        displayOrder: number(snapshot.displayOrder),
      };
    case "siteSettings":
      return {
        locale,
        defaultLocale: text(snapshot.defaultLocale) || "en",
        supportedLocales: rows(snapshot.supportedLocales).map((item) => text(item)).filter(Boolean),
        siteName: localized(snapshot.siteName, locale),
        authorName: localized(snapshot.authorName, locale),
        defaultTitle: localized(snapshot.defaultTitle, locale) || null,
        defaultDescription: localized(snapshot.defaultDescription, locale) || null,
        titleTemplate: localized(snapshot.titleTemplate, locale) || null,
        defaultOgImageUrl: text(snapshot.defaultOgImageUrl) || null,
        githubUrl: text(snapshot.githubUrl),
        linkedInUrl: text(snapshot.linkedInUrl),
        email: text(snapshot.email),
        cvUrl: text(snapshot.cvUrl),
      };
  }
}

export async function getReleasePublicResponse(
  database: D1Database,
  releaseId: string,
  expectedEnvironment: "staging" | "production",
  resource: PublicResource,
  locale: Locale,
  slug?: string
) {
  const release = await database.prepare(
    `SELECT environment, status FROM content_releases WHERE id = ?`
  ).bind(releaseId).first<{ environment: string; status: string }>();
  if (!release || release.environment !== expectedEnvironment || !["PENDING_DEPLOYMENT", "BUILDING", "VERIFYING", "LIVE", "RECONCILIATION_REQUIRED"].includes(release.status)) {
    throw new ApiError(404, "NOT_FOUND", "The requested build release is unavailable.");
  }

  const result = await database.prepare(
    `SELECT entity_type, entity_id, operation, snapshot_json
       FROM content_release_items WHERE release_id = ? ORDER BY entity_type, entity_id`
  ).bind(releaseId).all<ReleaseRow>();
  const entries = (result.results ?? [])
    .filter((row) => row.operation !== "UNPUBLISH")
    .map((row) => ({
      type: row.entity_type as ContentType,
      id: row.entity_id,
      snapshot: JSON.parse(row.snapshot_json) as Snapshot,
    }));
  const ofType = (type: ContentType) => entries.filter((item) => item.type === type);

  switch (resource) {
    case "profile": {
      const item = ofType("profile")[0];
      if (!item) throw new ApiError(404, "NOT_FOUND", "Profile was not found.");
      return toPublicSnapshot("profile", item.snapshot, locale);
    }
    case "skills": return ofType("skills").map((item) => toPublicSnapshot("skills", item.snapshot, locale));
    case "achievements": return ofType("achievement").map((item) => toPublicSnapshot("achievement", item.snapshot, locale));
    case "certificates": return ofType("certificate").map((item) => toPublicSnapshot("certificate", item.snapshot, locale));
    case "projects": return ofType("project").map((item) => projectSummary(item.snapshot, locale));
    case "project": {
      const item = ofType("project").find((candidate) => text(candidate.snapshot.slug) === slug);
      if (!item) throw new ApiError(404, "NOT_FOUND", "Project was not found.");
      const blocks = rows(item.snapshot.contentBlocks).map((block, index) => contentBlock(block, index, locale));
      const metrics = blocks.flatMap((block) => block.type === "METRIC_CARDS"
        ? rows(block.metadata.metrics).flatMap((value) => {
            const metric = record(value);
            if (typeof metric.label !== "string" || typeof metric.value !== "string") return [];
            return [{
              label: text(metric.label),
              value: text(metric.value),
              description: text(metric.description) || null,
              icon: text(metric.icon) || null,
            }];
          })
        : []);
      return {
        ...projectSummary(item.snapshot, locale),
        responsibilities: [] as string[],
        metrics,
        contentBlocks: blocks,
      };
    }
    case "blogPosts": return ofType("blogPost").map((item) => {
      const readingMinutes = Math.max(1, number(item.snapshot.readingTimeMinutes, 1));
      return {
        id: text(item.snapshot.id),
        slug: text(item.snapshot.slug),
        title: localized(item.snapshot.title, locale),
        summary: localized(item.snapshot.summary, locale),
        excerpt: localized(item.snapshot.summary, locale),
        coverImageUrl: text(item.snapshot.coverImageUrl) || null,
        publishedAt: text(item.snapshot.publishedAt),
        readingTime: `${readingMinutes} min read`,
        tags: rows(item.snapshot.tags).map((tag) => text(tag)).filter(Boolean),
        featured: boolean(item.snapshot.featured),
      };
    });
    case "blogPost": {
      const item = ofType("blogPost").find((candidate) => text(candidate.snapshot.slug) === slug);
      if (!item) throw new ApiError(404, "NOT_FOUND", "Blog post was not found.");
      return {
        ...blogSummary(item.snapshot, locale),
        contentMarkdown: localized(item.snapshot.content, locale),
      };
    }
    case "contactLinks": return ofType("contactLink").map((item) => toPublicSnapshot("contactLink", item.snapshot, locale));
    case "siteSettings": {
      const item = ofType("siteSettings")[0];
      if (!item) throw new ApiError(404, "NOT_FOUND", "Site settings were not found.");
      return toPublicSnapshot("siteSettings", item.snapshot, locale);
    }
  }
}

export async function getLiveReleasePublicResponse(
  database: D1Database,
  expectedEnvironment: "staging" | "production",
  resource: PublicResource,
  locale: Locale,
  slug?: string
) {
  const state = await database.prepare(
    "SELECT live_release_id FROM release_environment_state WHERE environment = ?"
  ).bind(expectedEnvironment).first<{ live_release_id: string | null }>();
  if (!state?.live_release_id) return null;
  return getReleasePublicResponse(database, state.live_release_id, expectedEnvironment, resource, locale, slug);
}

export async function resolveStagingReleaseBuild(
  database: D1Database,
  input: { branch: string; commitSha: string; previewUrl: string }
) {
  const requestedHost = previewHostname(input.previewUrl);
  if (!requestedHost) return null;

  const state = await database.prepare(
    "SELECT active_release_id FROM release_environment_state WHERE environment = 'staging'"
  ).first<{ active_release_id: string | null }>();
  if (!state?.active_release_id) return null;

  const job = await database.prepare(
    `SELECT j.preview_url, r.id AS release_id, r.content_checksum
       FROM deployment_jobs j
       JOIN content_releases r ON r.id = j.release_id
      WHERE j.environment = 'staging' AND j.pages_project = 'web-porfolio'
        AND j.release_id = ? AND j.git_branch = ? AND j.commit_sha = ?
        AND j.preview_url IS NOT NULL
        AND j.status IN ('INITIALIZING', 'CLONING', 'BUILDING', 'DEPLOYING', 'VERIFYING', 'RECONCILIATION_REQUIRED')
        AND r.status IN ('PENDING_DEPLOYMENT', 'BUILDING', 'VERIFYING', 'RECONCILIATION_REQUIRED')`
  ).bind(state.active_release_id, input.branch, input.commitSha).first<{
    preview_url: string;
    release_id: string;
    content_checksum: string;
  }>();

  if (!job || previewHostname(job.preview_url) !== requestedHost ||
      !/^[0-9a-f]{64}$/.test(job.content_checksum) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(job.release_id)) return null;
  return {
    releaseId: job.release_id,
    checksum: job.content_checksum,
    commitSha: input.commitSha,
  };
}
