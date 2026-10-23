import type { D1Database } from "@cloudflare/workers-types";
import type { Context } from "hono";
import type { WorkerEnv } from "../types/env";
import { AdminError } from "./errors";
import { parseContentType, type ContentType, validateSnapshot } from "./schemas";
import { randomToken } from "./password";

type Row = Record<string, unknown>;
type PublishedSnapshot = { snapshot: Record<string, unknown>; baseRevision: string | null };

const listSql: Record<ContentType, string> = {
  profile: "SELECT id FROM profile WHERE id = 'primary' AND status = 'PUBLISHED'",
  skills: "SELECT id FROM skill_groups WHERE status = 'PUBLISHED' ORDER BY display_order, id",
  project: "SELECT id FROM projects WHERE status = 'PUBLISHED' ORDER BY display_order, id",
  blogPost: "SELECT id FROM blog_posts WHERE status = 'PUBLISHED' ORDER BY display_order, published_at DESC, id",
  achievement: "SELECT id FROM achievements WHERE status = 'PUBLISHED' ORDER BY display_order, achieved_at DESC, id",
  certificate: "SELECT id FROM certificates WHERE status = 'PUBLISHED' ORDER BY display_order, issued_at DESC, id",
  contactLink: "SELECT id FROM contact_links WHERE status = 'PUBLISHED' ORDER BY display_order, id",
  siteSettings: "SELECT id FROM site_settings WHERE id = 'primary' AND status = 'PUBLISHED'",
};

async function all<T extends Row>(database: D1Database, sql: string, ...values: unknown[]) {
  const result = await database.prepare(sql).bind(...values).all<T>();
  return result.results ?? [];
}

async function one<T extends Row>(database: D1Database, sql: string, ...values: unknown[]) {
  return database.prepare(sql).bind(...values).first<T>();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function booleanValue(value: unknown) {
  return value === true || value === 1;
}

function localized(rows: Row[], enField: string, viField = enField) {
  const en = rows.find((row) => row.locale === "en");
  const vi = rows.find((row) => row.locale === "vi");
  return {
    en: stringValue(en?.[enField]),
    vi: stringValue(vi?.[viField]),
  };
}

async function translationRows(
  database: D1Database,
  table: string,
  foreignKey: string,
  id: string
) {
  return all(database, `SELECT * FROM ${table} WHERE ${foreignKey} = ? ORDER BY locale`, id);
}

function parseJsonObject(raw: unknown) {
  if (typeof raw !== "string") return {};
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function getProfile(database: D1Database): Promise<PublishedSnapshot | null> {
  const row = await one(database, "SELECT * FROM profile WHERE id = 'primary' AND status = 'PUBLISHED'");
  if (!row) return null;
  const translations = await translationRows(database, "profile_translations", "profile_id", "primary");
  return {
    baseRevision: stringValue(row.updated_at),
    snapshot: {
      id: "primary",
      fullName: stringValue(row.full_name),
      brand: stringValue(row.brand),
      gpa: stringValue(row.gpa),
      email: stringValue(row.email),
      githubUrl: stringValue(row.github_url),
      linkedInUrl: stringValue(row.linkedin_url),
      cvUrl: stringValue(row.cv_url),
      role: localized(translations, "role"),
      location: localized(translations, "location"),
      university: localized(translations, "university"),
      major: localized(translations, "major"),
      focus: localized(translations, "focus"),
      summary: localized(translations, "summary"),
      about: localized(translations, "about"),
      careerObjective: localized(translations, "career_objective"),
    },
  };
}

async function getSkills(database: D1Database, id: string): Promise<PublishedSnapshot | null> {
  const row = await one(database, "SELECT * FROM skill_groups WHERE id = ? AND status = 'PUBLISHED'", id);
  if (!row) return null;
  const translations = await translationRows(database, "skill_group_translations", "skill_group_id", id);
  const skillRows = await all(database,
    "SELECT * FROM skills WHERE skill_group_id = ? AND status = 'PUBLISHED' ORDER BY display_order, id", id);
  const skills = await Promise.all(skillRows.map(async (skill) => {
    const skillId = stringValue(skill.id);
    const names = await translationRows(database, "skill_translations", "skill_id", skillId);
    return {
      id: skillId,
      name: localized(names, "name"),
      icon: stringValue(skill.icon),
      level: stringValue(skill.level),
      displayOrder: Number(skill.display_order ?? 0),
    };
  }));
  return {
    baseRevision: stringValue(row.updated_at),
    snapshot: {
      id: stringValue(row.id),
      icon: stringValue(row.icon),
      displayOrder: Number(row.display_order ?? 0),
      name: localized(translations, "name"),
      description: localized(translations, "description"),
      skills,
    },
  };
}

async function getProject(database: D1Database, id: string): Promise<PublishedSnapshot | null> {
  const row = await one(database, "SELECT * FROM projects WHERE id = ? AND status = 'PUBLISHED'", id);
  if (!row) return null;
  const translations = await translationRows(database, "project_translations", "project_id", id);
  const statusRows = await all(database,
    "SELECT * FROM project_status_labels WHERE project_id = ? AND status = 'PUBLISHED' ORDER BY display_order, id", id);
  const statuses = await Promise.all(statusRows.map(async (status) => {
    const labelRows = await translationRows(database, "project_status_label_translations", "status_label_id", stringValue(status.id));
    return {
      id: stringValue(status.id),
      label: localized(labelRows, "label"),
      tone: stringValue(status.tone),
      icon: stringValue(status.icon),
      displayOrder: Number(status.display_order ?? 0),
    };
  }));
  const techRows = await all(database,
    "SELECT technology FROM project_tech_stack WHERE project_id = ? ORDER BY display_order, technology", id);
  const highlightRows = await all(database,
    "SELECT * FROM project_highlights WHERE project_id = ? AND status = 'PUBLISHED' ORDER BY display_order, id", id);
  const highlights = await Promise.all(highlightRows.map(async (highlight) => {
    const textRows = await translationRows(database, "project_highlight_translations", "highlight_id", stringValue(highlight.id));
    return { id: stringValue(highlight.id), text: localized(textRows, "text") };
  }));
  const linkRows = await all(database,
    "SELECT * FROM project_links WHERE project_id = ? AND status = 'PUBLISHED' ORDER BY display_order, id", id);
  const links = await Promise.all(linkRows.map(async (link) => {
    const labelRows = await translationRows(database, "project_link_translations", "project_link_id", stringValue(link.id));
    return {
      id: stringValue(link.id),
      label: localized(labelRows, "label"),
      href: stringValue(link.href),
      icon: stringValue(link.icon),
      isPrimary: booleanValue(link.is_primary),
    };
  }));
  const blockRows = await all(database,
    "SELECT * FROM project_content_blocks WHERE project_id = ? AND status = 'PUBLISHED' ORDER BY display_order, id", id);
  const contentBlocks = await Promise.all(blockRows.map(async (block) => {
    const blockId = stringValue(block.id);
    const blockType = stringValue(block.type);
    const blockTranslations = await translationRows(database, "project_content_block_translations", "content_block_id", blockId);
    const metadata = parseJsonObject(block.metadata_json);
    const common = {
      id: blockId,
      type: blockType,
      title: localized(blockTranslations, "title"),
    };
    switch (blockType) {
      case "MARKDOWN": return { ...common, body: localized(blockTranslations, "markdown") };
      case "FEATURE_GRID": return { ...common, items: asArray(metadata.items) };
      case "ARCHITECTURE_FLOW": return { ...common, steps: asArray(metadata.steps ?? metadata.nodes) };
      case "MODULE_LIST": return { ...common, items: asArray(metadata.items) };
      case "CI_CD_FLOW": return { ...common, steps: asArray(metadata.steps) };
      case "IMAGE_GALLERY": return { ...common, images: asArray(metadata.images) };
      case "METRIC_CARDS": return { ...common, metrics: asArray(metadata.metrics) };
      case "LINK_GROUP": return { ...common, links: asArray(metadata.links) };
      default: return { ...common, type: "MARKDOWN", body: { en: "", vi: "" } };
    }
  }));
  return {
    baseRevision: stringValue(row.updated_at),
    snapshot: {
      id: stringValue(row.id),
      slug: stringValue(row.slug),
      title: localized(translations, "title"),
      subtitle: localized(translations, "subtitle"),
      role: localized(translations, "role"),
      summary: localized(translations, "summary"),
      description: localized(translations, "description"),
      featured: booleanValue(row.featured),
      thumbnailUrl: stringValue(row.thumbnail_url),
      displayOrder: Number(row.display_order ?? 0),
      statuses,
      techStack: techRows.map((item) => stringValue(item.technology)),
      highlights,
      links,
      contentBlocks,
    },
  };
}

async function getBlogPost(database: D1Database, id: string): Promise<PublishedSnapshot | null> {
  const row = await one(database, "SELECT * FROM blog_posts WHERE id = ? AND status = 'PUBLISHED'", id);
  if (!row) return null;
  const translations = await translationRows(database, "blog_post_translations", "blog_post_id", id);
  const tagRows = await all(database,
    "SELECT tag FROM blog_post_tags WHERE blog_post_id = ? ORDER BY display_order, tag", id);
  const seoFor = (locale: "en" | "vi") => {
    const translation = translations.find((item) => item.locale === locale);
    return {
      title: stringValue(translation?.seo_title) || stringValue(translation?.title),
      description: stringValue(translation?.seo_description) || stringValue(translation?.summary),
      canonicalPath: stringValue(translation?.canonical_path) || `/${locale}/blog/${stringValue(row.slug)}`,
      ogImageUrl: stringValue(translation?.og_image_url),
    };
  };
  return {
    baseRevision: stringValue(row.updated_at),
    snapshot: {
      id: stringValue(row.id),
      slug: stringValue(row.slug),
      title: localized(translations, "title"),
      summary: localized(translations, "summary"),
      content: localized(translations, "content_markdown"),
      tags: tagRows.map((tag) => stringValue(tag.tag)),
      featured: booleanValue(row.featured),
      readingTimeMinutes: Number(row.reading_time_minutes ?? 1),
      publishedAt: stringValue(row.published_at).slice(0, 10),
      coverImageUrl: stringValue(row.cover_image_url),
      displayOrder: Number(row.display_order ?? 0),
      seo: { en: seoFor("en"), vi: seoFor("vi") },
    },
  };
}

async function getAchievement(database: D1Database, id: string): Promise<PublishedSnapshot | null> {
  const row = await one(database, "SELECT * FROM achievements WHERE id = ? AND status = 'PUBLISHED'", id);
  if (!row) return null;
  const translations = await translationRows(database, "achievement_translations", "achievement_id", id);
  return {
    baseRevision: stringValue(row.updated_at),
    snapshot: {
      id: stringValue(row.id),
      icon: stringValue(row.icon),
      issuer: stringValue(row.issuer),
      achievedAt: stringValue(row.achieved_at),
      displayOrder: Number(row.display_order ?? 0),
      title: localized(translations, "title"),
      description: localized(translations, "description"),
    },
  };
}

async function getCertificate(database: D1Database, id: string): Promise<PublishedSnapshot | null> {
  const row = await one(database, "SELECT * FROM certificates WHERE id = ? AND status = 'PUBLISHED'", id);
  if (!row) return null;
  const translations = await translationRows(database, "certificate_translations", "certificate_id", id);
  return {
    baseRevision: stringValue(row.updated_at),
    snapshot: {
      id: stringValue(row.id),
      icon: stringValue(row.icon),
      kind: stringValue(row.kind),
      official: booleanValue(row.official),
      credentialUrl: stringValue(row.credential_url),
      issuedAt: stringValue(row.issued_at),
      displayOrder: Number(row.display_order ?? 0),
      title: localized(translations, "title"),
      issuer: localized(translations, "issuer"),
      description: localized(translations, "description"),
    },
  };
}

async function getContactLink(database: D1Database, id: string): Promise<PublishedSnapshot | null> {
  const row = await one(database, "SELECT * FROM contact_links WHERE id = ? AND status = 'PUBLISHED'", id);
  if (!row) return null;
  const translations = await translationRows(database, "contact_link_translations", "contact_link_id", id);
  return {
    baseRevision: stringValue(row.updated_at),
    snapshot: {
      id: stringValue(row.id),
      type: stringValue(row.type),
      icon: stringValue(row.icon),
      href: stringValue(row.href),
      value: stringValue(row.value),
      isPrimary: booleanValue(row.is_primary),
      displayOrder: Number(row.display_order ?? 0),
      label: localized(translations, "label"),
    },
  };
}

async function getSiteSettings(database: D1Database): Promise<PublishedSnapshot | null> {
  const row = await one(database, "SELECT * FROM site_settings WHERE id = 'primary' AND status = 'PUBLISHED'");
  if (!row) return null;
  const translations = await translationRows(database, "site_settings_translations", "site_settings_id", "primary");
  let supportedLocales: unknown[] = [];
  try {
    supportedLocales = JSON.parse(stringValue(row.supported_locales_json)) as unknown[];
  } catch { /* Invalid stored settings are surfaced as empty locales for correction in the CMS. */ }
  return {
    baseRevision: stringValue(row.updated_at),
    snapshot: {
      id: "primary",
      defaultLocale: stringValue(row.default_locale),
      supportedLocales,
      defaultOgImageUrl: stringValue(row.default_og_image_url),
      githubUrl: stringValue(row.github_url),
      linkedInUrl: stringValue(row.linked_in_url),
      email: stringValue(row.email),
      cvUrl: stringValue(row.cv_url),
      siteName: localized(translations, "site_name"),
      authorName: localized(translations, "author_name"),
      defaultTitle: localized(translations, "default_title"),
      defaultDescription: localized(translations, "default_description"),
      titleTemplate: localized(translations, "title_template"),
    },
  };
}

async function getPublished(database: D1Database, type: ContentType, id: string) {
  switch (type) {
    case "profile": return id === "primary" ? getProfile(database) : null;
    case "skills": return getSkills(database, id);
    case "project": return getProject(database, id);
    case "blogPost": return getBlogPost(database, id);
    case "achievement": return getAchievement(database, id);
    case "certificate": return getCertificate(database, id);
    case "contactLink": return getContactLink(database, id);
    case "siteSettings": return id === "primary" ? getSiteSettings(database) : null;
  }
}

function draftSummary(type: ContentType, snapshot: Record<string, unknown>) {
  const localizedValue = (key: string) => {
    const value = snapshot[key];
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null) {
      const language = value as Record<string, unknown>;
      return stringValue(language.en || language.vi);
    }
    return "";
  };
  const title = localizedValue(
    type === "skills" ? "name"
      : type === "profile" ? "fullName"
        : type === "siteSettings" ? "siteName"
          : type === "contactLink" ? "label"
            : "title"
  );
  return {
    title,
    slug: stringValue(snapshot.slug),
    subtitle: localizedValue("subtitle"),
  };
}

export async function getContentDetail(
  database: D1Database,
  type: ContentType,
  id: string
) {
  const draft = await one(database,
    "SELECT snapshot_json, version, base_revision, state, updated_at FROM admin_content_drafts WHERE entity_type = ? AND entity_id = ?",
    type, id);
  const published = await getPublished(database, type, id);
  const hasPublished = Boolean(published);
  const isActiveDraft = draft?.state === "DRAFT";
  if (isActiveDraft && draft) {
    return {
      id,
      type,
      snapshot: JSON.parse(stringValue(draft.snapshot_json)) as Record<string, unknown>,
      version: Number(draft.version),
      baseRevision: stringValue(draft.base_revision) || null,
      hasPublished,
      hasDraft: true,
      state: "DRAFT" as const,
      updatedAt: stringValue(draft.updated_at),
    };
  }
  if (published) {
    return {
      id,
      type,
      snapshot: published.snapshot,
      version: Number(draft?.version ?? 0),
      baseRevision: published.baseRevision,
      hasPublished: true,
      hasDraft: false,
      state: "PUBLISHED" as const,
      updatedAt: published.baseRevision,
    };
  }
  if (draft) {
    const last = await one(database,
      `SELECT snapshot_json, created_at FROM admin_content_revisions
       WHERE entity_type = ? AND entity_id = ? ORDER BY revision_number DESC LIMIT 1`, type, id);
    if (last) {
      return {
        id,
        type,
        snapshot: JSON.parse(stringValue(last.snapshot_json)) as Record<string, unknown>,
        version: Number(draft.version),
        baseRevision: stringValue(draft.base_revision) || null,
        hasPublished: false,
        hasDraft: draft.state === "DRAFT",
        state: draft.state as "DRAFT" | "DISCARDED",
        updatedAt: stringValue(draft.updated_at),
      };
    }
  }
  throw new AdminError(404, "NOT_FOUND", "Content item not found.");
}

export async function listContent(
  database: D1Database,
  type: ContentType,
  options: { search: string; page: number; pageSize: number }
) {
  const publishedRows = await all(database, listSql[type]);
  const published: Array<{ id: string; value: PublishedSnapshot | null }> = await Promise.all(publishedRows.map(async (row) => {
    const id = stringValue(row.id);
    return { id, value: await getPublished(database, type, id) };
  }));
  const draftRows = await all(database,
    `SELECT entity_id, snapshot_json, version, state, updated_at FROM admin_content_drafts
     WHERE entity_type = ? AND state = 'DRAFT' ORDER BY updated_at DESC`, type);
  const entries = new Map<string, {
    id: string; type: ContentType; title: string; slug: string; subtitle: string;
    status: "PUBLISHED" | "DRAFT"; hasPublished: boolean; version: number;
    updatedAt: string | null; revisionCount: number;
  }>();

  for (const item of published) {
    if (!item.value) continue;
    const snapshot = item.value.snapshot;
    entries.set(item.id, {
      id: item.id,
      type,
      ...draftSummary(type, snapshot),
      status: "PUBLISHED",
      hasPublished: true,
      version: 0,
      updatedAt: item.value.baseRevision,
      revisionCount: 0,
    });
  }

  for (const draft of draftRows) {
    const id = stringValue(draft.entity_id);
    const snapshot = JSON.parse(stringValue(draft.snapshot_json)) as Record<string, unknown>;
    const previous = entries.get(id);
    const revisionCount = await one<{ count: number }>(database,
      "SELECT COUNT(*) AS count FROM admin_content_revisions WHERE entity_type = ? AND entity_id = ?", type, id);
    entries.set(id, {
      id,
      type,
      ...draftSummary(type, snapshot),
      status: "DRAFT",
      hasPublished: Boolean(previous),
      version: Number(draft.version),
      updatedAt: stringValue(draft.updated_at),
      revisionCount: Number(revisionCount?.count ?? 0),
    });
  }

  const normalizedSearch = options.search.trim().toLocaleLowerCase();
  const filtered = [...entries.values()].filter((entry) =>
    !normalizedSearch || `${entry.title} ${entry.slug} ${entry.id}`.toLocaleLowerCase().includes(normalizedSearch)
  );
  const total = filtered.length;
  const start = (options.page - 1) * options.pageSize;
  return {
    items: filtered.slice(start, start + options.pageSize),
    page: options.page,
    pageSize: options.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

export async function getDashboard(database: D1Database) {
  const [profiles, skills, projects, blogPosts, achievements, certificates, contactLinks, settings, drafts, recentAudit] = await Promise.all([
    one<{ count: number }>(database, "SELECT COUNT(*) AS count FROM profile WHERE status = 'PUBLISHED'"),
    one<{ count: number }>(database, "SELECT COUNT(*) AS count FROM skill_groups WHERE status = 'PUBLISHED'"),
    one<{ count: number }>(database, "SELECT COUNT(*) AS count FROM projects WHERE status = 'PUBLISHED'"),
    one<{ count: number }>(database, "SELECT COUNT(*) AS count FROM blog_posts WHERE status = 'PUBLISHED'"),
    one<{ count: number }>(database, "SELECT COUNT(*) AS count FROM achievements WHERE status = 'PUBLISHED'"),
    one<{ count: number }>(database, "SELECT COUNT(*) AS count FROM certificates WHERE status = 'PUBLISHED'"),
    one<{ count: number }>(database, "SELECT COUNT(*) AS count FROM contact_links WHERE status = 'PUBLISHED'"),
    one<{ count: number }>(database, "SELECT COUNT(*) AS count FROM site_settings WHERE status = 'PUBLISHED'"),
    one<{ count: number }>(database, "SELECT COUNT(*) AS count FROM admin_content_drafts WHERE state = 'DRAFT'"),
    all(database,
      `SELECT l.id, l.action, l.entity_type, l.entity_id, l.created_at, u.email AS actor_email
       FROM admin_audit_logs l LEFT JOIN admin_users u ON u.id = l.actor_id
       ORDER BY l.created_at DESC LIMIT 8`),
  ]);
  return {
    published: {
      profile: Number(profiles?.count ?? 0),
      skills: Number(skills?.count ?? 0),
      projects: Number(projects?.count ?? 0),
      blogPosts: Number(blogPosts?.count ?? 0),
      achievements: Number(achievements?.count ?? 0),
      certificates: Number(certificates?.count ?? 0),
      contactLinks: Number(contactLinks?.count ?? 0),
      siteSettings: Number(settings?.count ?? 0),
    },
    activeDrafts: Number(drafts?.count ?? 0),
    recentActivity: recentAudit.map((row) => ({
      id: stringValue(row.id),
      action: stringValue(row.action),
      entityType: stringValue(row.entity_type),
      entityId: stringValue(row.entity_id),
      actorEmail: stringValue(row.actor_email),
      createdAt: stringValue(row.created_at),
    })),
  };
}

export function snapshotFromJson(raw: unknown) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new AdminError(400, "VALIDATION_ERROR", "Content must be a JSON object.");
  }
  if (JSON.stringify(raw).length > 1_500_000) {
    throw new AdminError(400, "VALIDATION_ERROR", "Content exceeds the allowed size.");
  }
  return raw as Record<string, unknown>;
}

function getSlug(type: ContentType, snapshot: Record<string, unknown>) {
  if (type !== "project" && type !== "blogPost") return null;
  return typeof snapshot.slug === "string" ? snapshot.slug : null;
}

async function assertSlugAvailable(database: D1Database, type: ContentType, id: string, slug: string | null) {
  if (!slug) return;
  const table = type === "project" ? "projects" : "blog_posts";
  const published = await one(database, `SELECT id FROM ${table} WHERE slug = ? AND status = 'PUBLISHED' AND id <> ? LIMIT 1`, slug, id);
  if (published) throw new AdminError(409, "DUPLICATE_SLUG", "That slug is already used by published content.");
  const draft = await one(database,
    `SELECT entity_id FROM admin_content_drafts
     WHERE entity_type = ? AND state = 'DRAFT' AND entity_id <> ? AND json_extract(snapshot_json, '$.slug') = ? LIMIT 1`,
    type, id, slug);
  if (draft) throw new AdminError(409, "DUPLICATE_SLUG", "That slug is already used by another draft.");
}

export function adminAuditStatement(
  database: D1Database,
  context: Context<WorkerEnv>,
  action: string,
  type: ContentType,
  id: string,
  metadata: Record<string, string | number | boolean | null> = {}
) {
  return database.prepare(
    `INSERT INTO admin_audit_logs
      (id, actor_id, action, entity_type, entity_id, request_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    randomToken(18), context.get("admin").id, action, type, id,
    context.req.header("cf-ray") ?? randomToken(12), JSON.stringify(metadata)
  );
}

export async function createDraft(
  context: Context<WorkerEnv>,
  type: ContentType,
  input: unknown
) {
  if (["profile", "siteSettings"].includes(type)) {
    throw new AdminError(400, "VALIDATION_ERROR", "This content type is a singleton and cannot be created.");
  }
  const id = crypto.randomUUID();
  const inputRecord = snapshotFromJson(input);
  const candidate = { ...inputRecord, id };
  const validation = validateSnapshot(type, candidate);
  if (!validation.success) {
    throw new AdminError(400, "VALIDATION_ERROR", "Draft content is invalid.", { issues: validation.issues });
  }
  const snapshot = validation.data;
  await assertSlugAvailable(context.env.DB, type, id, getSlug(type, snapshot));
  const json = JSON.stringify(snapshot);
  const database = context.env.DB;
  const now = new Date().toISOString();
  try {
    await database.batch([
      database.prepare(
        `INSERT INTO admin_content_drafts
         (entity_type, entity_id, snapshot_json, version, base_revision, state, author_id, created_at, updated_at)
         VALUES (?, ?, ?, 1, NULL, 'DRAFT', ?, ?, ?)`
      ).bind(type, id, json, context.get("admin").id, now, now),
      database.prepare(
        `INSERT INTO admin_content_revisions
         (id, entity_type, entity_id, revision_number, version, snapshot_json, base_revision, author_id, created_at)
         VALUES (?, ?, ?, 1, 1, ?, NULL, ?, ?)`
      ).bind(randomToken(18), type, id, json, context.get("admin").id, now),
      adminAuditStatement(database, context, "DRAFT_CREATED", type, id),
    ]);
  } catch {
    throw new AdminError(409, "CONFLICT", "A draft with the same identifier already exists.");
  }
  return getContentDetail(database, type, id);
}

export async function saveDraft(
  context: Context<WorkerEnv>,
  type: ContentType,
  id: string,
  input: unknown,
  auditAction = "DRAFT_SAVED",
  auditMetadata: Record<string, string | number | boolean | null> = {}
) {
  const body = input as { expectedVersion?: unknown; snapshot?: unknown } | null;
  if (!body || !Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 0) {
    throw new AdminError(400, "VALIDATION_ERROR", "A non-negative expectedVersion is required.");
  }
  const expectedVersion = Number(body.expectedVersion);
  const snapshotInput = snapshotFromJson(body.snapshot);
  const validation = validateSnapshot(type, snapshotInput);
  if (!validation.success || validation.data.id !== id) {
    throw new AdminError(400, "VALIDATION_ERROR", "Draft content is invalid or has a mismatched identifier.",
      validation.success ? undefined : { issues: validation.issues });
  }
  const snapshot = validation.data;
  await assertSlugAvailable(context.env.DB, type, id, getSlug(type, snapshot));

  const database = context.env.DB;
  const current = await one(database,
    "SELECT version, base_revision FROM admin_content_drafts WHERE entity_type = ? AND entity_id = ?", type, id);
  if (expectedVersion === 0 && current) {
    throw new AdminError(409, "VERSION_CONFLICT", "This item changed in another tab. Reload before saving.");
  }
  if (expectedVersion > 0 && (!current || Number(current.version) !== expectedVersion)) {
    throw new AdminError(409, "VERSION_CONFLICT", "This item changed in another tab. Reload before saving.");
  }
  const published = await getPublished(database, type, id);
  if (!current && !published) {
    throw new AdminError(404, "NOT_FOUND", "Content item not found.");
  }
  const baseRevision = stringValue(current?.base_revision) || published?.baseRevision || null;
  const now = new Date().toISOString();
  const revisionId = randomToken(18);
  const json = JSON.stringify(snapshot);
  try {
    const results = expectedVersion === 0
      ? await database.batch([
          database.prepare(
            `INSERT INTO admin_content_drafts
             (entity_type, entity_id, snapshot_json, version, base_revision, state, author_id, created_at, updated_at)
             VALUES (?, ?, ?, 1, ?, 'DRAFT', ?, ?, ?)`
          ).bind(type, id, json, baseRevision, context.get("admin").id, now, now),
          database.prepare(
            `INSERT INTO admin_content_revisions
             (id, entity_type, entity_id, revision_number, version, snapshot_json, base_revision, author_id, created_at)
             VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?)`
          ).bind(revisionId, type, id, json, baseRevision, context.get("admin").id, now),
          adminAuditStatement(database, context, auditAction, type, id, { version: 1, ...auditMetadata }),
        ])
      : await database.batch([
          database.prepare(
            `UPDATE admin_content_drafts
             SET snapshot_json = ?, version = version + 1, state = 'DRAFT',
                 updated_at = ?, discarded_at = NULL
             WHERE entity_type = ? AND entity_id = ? AND version = ?`
          ).bind(json, now, type, id, expectedVersion),
          database.prepare(
            `INSERT INTO admin_content_revisions
             (id, entity_type, entity_id, revision_number, version, snapshot_json, base_revision, author_id, created_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
             WHERE EXISTS (SELECT 1 FROM admin_content_drafts WHERE entity_type = ? AND entity_id = ? AND version = ?)`
          ).bind(revisionId, type, id, expectedVersion + 1, expectedVersion + 1, json,
            baseRevision, context.get("admin").id, now, type, id, expectedVersion + 1),
          adminAuditStatement(database, context, auditAction, type, id, { version: expectedVersion + 1, ...auditMetadata }),
        ]);
    if (results[0]?.meta.changes !== 1) {
      throw new AdminError(409, "VERSION_CONFLICT", "This item changed in another tab. Reload before saving.");
    }
    return await getContentDetail(database, type, id);
  } catch (error) {
    if (error instanceof AdminError) throw error;
    throw new AdminError(409, "VERSION_CONFLICT", "This item changed in another tab. Reload before saving.");
  }
}

export async function discardDraft(context: Context<WorkerEnv>, type: ContentType, id: string, expectedVersion: number) {
  const database = context.env.DB;
  const now = new Date().toISOString();
  const results = await database.batch([
    database.prepare(
      `UPDATE admin_content_drafts
       SET state = 'DISCARDED', version = version + 1, updated_at = ?, discarded_at = ?
       WHERE entity_type = ? AND entity_id = ? AND state = 'DRAFT' AND version = ?`
    ).bind(now, now, type, id, expectedVersion),
    adminAuditStatement(database, context, "DRAFT_DISCARDED", type, id, { version: expectedVersion + 1 }),
  ]);
  if (results[0]?.meta.changes !== 1) {
    throw new AdminError(409, "VERSION_CONFLICT", "This item changed in another tab. Reload before discarding.");
  }
  return { discarded: true, version: expectedVersion + 1 };
}

export async function listRevisions(database: D1Database, type: ContentType, id: string) {
  const exists = await one(database,
    "SELECT entity_id FROM admin_content_drafts WHERE entity_type = ? AND entity_id = ?", type, id);
  if (!exists) {
    const published = await getPublished(database, type, id);
    if (!published) throw new AdminError(404, "NOT_FOUND", "Content item not found.");
    return [];
  }
  const revisions = await all(database,
    `SELECT r.id, r.revision_number, r.version, r.snapshot_json, r.base_revision, r.created_at, u.email AS author_email
       FROM admin_content_revisions r JOIN admin_users u ON u.id = r.author_id
      WHERE r.entity_type = ? AND r.entity_id = ?
      ORDER BY r.revision_number DESC LIMIT 50`, type, id);
  return revisions.map((revision) => {
    const snapshot = JSON.parse(stringValue(revision.snapshot_json)) as Record<string, unknown>;
    return {
      id: stringValue(revision.id),
      revisionNumber: Number(revision.revision_number),
      version: Number(revision.version),
      title: draftSummary(type, snapshot).title,
      authorEmail: stringValue(revision.author_email),
      createdAt: stringValue(revision.created_at),
      snapshot,
    };
  });
}

export async function restoreRevision(
  context: Context<WorkerEnv>, type: ContentType, id: string, revisionId: string, expectedVersion: number
) {
  const revision = await one(context.env.DB,
    `SELECT snapshot_json FROM admin_content_revisions
     WHERE entity_type = ? AND entity_id = ? AND id = ?`, type, id, revisionId);
  if (!revision) throw new AdminError(404, "NOT_FOUND", "Revision not found.");
  return saveDraft(context, type, id, {
    expectedVersion,
    snapshot: JSON.parse(stringValue(revision.snapshot_json)),
  }, "REVISION_RESTORED", { revisionId });
}

export async function listAuditLogs(database: D1Database, options: { page: number; pageSize: number; action: string }) {
  const filter = options.action.trim();
  const where = filter ? "WHERE l.action = ?" : "";
  const values = filter ? [filter] : [];
  const [count, rows] = await Promise.all([
    one<{ count: number }>(database, `SELECT COUNT(*) AS count FROM admin_audit_logs l ${where}`, ...values),
    all(database,
      `SELECT l.id, l.action, l.entity_type, l.entity_id, l.request_id, l.metadata_json, l.created_at, u.email AS actor_email
       FROM admin_audit_logs l LEFT JOIN admin_users u ON u.id = l.actor_id
       ${where} ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`,
      ...values, options.pageSize, (options.page - 1) * options.pageSize),
  ]);
  return {
    items: rows.map((row) => ({
      id: stringValue(row.id),
      action: stringValue(row.action),
      entityType: stringValue(row.entity_type),
      entityId: stringValue(row.entity_id),
      requestId: stringValue(row.request_id),
      metadata: parseJsonObject(row.metadata_json),
      createdAt: stringValue(row.created_at),
      actorEmail: stringValue(row.actor_email),
    })),
    page: options.page,
    pageSize: options.pageSize,
    total: Number(count?.count ?? 0),
  };
}

export function parseContentTypeParam(value: string) {
  const type = parseContentType(value);
  if (!type) throw new AdminError(404, "NOT_FOUND", "Content type not found.");
  return type;
}
