import { z } from "zod";
import type { ApiLocale } from "../validators/public-query";

type SqlValue = string | number | null;

async function allRows<Row>(
  database: D1Database,
  sql: string,
  ...bindings: SqlValue[]
): Promise<Row[]> {
  const statement = database.prepare(sql);
  const result =
    bindings.length > 0
      ? await statement.bind(...bindings).all<Row>()
      : await statement.all<Row>();

  return result.results ?? [];
}

async function firstRow<Row>(
  database: D1Database,
  sql: string,
  ...bindings: SqlValue[]
): Promise<Row | null> {
  return database.prepare(sql).bind(...bindings).first<Row>();
}

export type ProfileRecord = {
  fullName: string;
  brand: string;
  gpa: string;
  email: string;
  githubUrl: string;
  linkedInUrl: string;
  cvUrl: string;
  role: string;
  location: string;
  university: string;
  major: string;
  focus: string;
  summary: string;
  about: string;
  careerObjective: string;
};

type ProfileRow = {
  full_name: string;
  brand: string;
  gpa: string;
  email: string;
  github_url: string;
  linkedin_url: string;
  cv_url: string;
  role: string;
  location: string;
  university: string;
  major: string;
  focus: string;
  summary: string;
  about: string;
  career_objective: string;
};

export async function findPublishedProfile(
  database: D1Database,
  locale: ApiLocale
): Promise<ProfileRecord | null> {
  const row = await firstRow<ProfileRow>(
    database,
    `SELECT p.full_name, p.brand, p.gpa, p.email, p.github_url,
            p.linkedin_url, p.cv_url, t.role, t.location, t.university,
            t.major, t.focus, t.summary, t.about, t.career_objective
       FROM profile p
       JOIN profile_translations t ON t.profile_id = p.id
      WHERE p.id = ? AND p.status = ? AND t.locale = ?`,
    "primary",
    "PUBLISHED",
    locale
  );

  if (!row) {
    return null;
  }

  return {
    fullName: row.full_name,
    brand: row.brand,
    gpa: row.gpa,
    email: row.email,
    githubUrl: row.github_url,
    linkedInUrl: row.linkedin_url,
    cvUrl: row.cv_url,
    role: row.role,
    location: row.location,
    university: row.university,
    major: row.major,
    focus: row.focus,
    summary: row.summary,
    about: row.about,
    careerObjective: row.career_objective,
  };
}

type SkillGroupRow = {
  id: string;
  icon: string;
  display_order: number;
  name: string;
  description: string | null;
};

type SkillRow = {
  id: string;
  skill_group_id: string;
  name: string;
  level: string | null;
  icon: string | null;
  display_order: number;
};

export type SkillGroupRecord = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  displayOrder: number;
  skills: Array<{
    id: string;
    name: string;
    level: string | null;
    icon: string | null;
    displayOrder: number;
  }>;
};

export async function listPublishedSkillGroups(
  database: D1Database,
  locale: ApiLocale
): Promise<SkillGroupRecord[]> {
  const [groups, skills] = await Promise.all([
    allRows<SkillGroupRow>(
      database,
      `SELECT g.id, g.icon, g.display_order, t.name, t.description
         FROM skill_groups g
         JOIN skill_group_translations t ON t.skill_group_id = g.id
        WHERE g.status = ? AND t.locale = ?
        ORDER BY g.display_order ASC, g.id ASC`,
      "PUBLISHED",
      locale
    ),
    allRows<SkillRow>(
      database,
      `SELECT s.id, s.skill_group_id, t.name, s.level, s.icon, s.display_order
         FROM skills s
         JOIN skill_groups g ON g.id = s.skill_group_id
         JOIN skill_translations t ON t.skill_id = s.id
        WHERE s.status = ? AND g.status = ? AND t.locale = ?
        ORDER BY g.display_order ASC, g.id ASC, s.display_order ASC, s.id ASC`,
      "PUBLISHED",
      "PUBLISHED",
      locale
    ),
  ]);
  const skillsByGroup = new Map<string, SkillGroupRecord["skills"]>();

  for (const skill of skills) {
    const groupSkills = skillsByGroup.get(skill.skill_group_id) ?? [];
    groupSkills.push({
      id: skill.id,
      name: skill.name,
      level: skill.level,
      icon: skill.icon,
      displayOrder: skill.display_order,
    });
    skillsByGroup.set(skill.skill_group_id, groupSkills);
  }

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    icon: group.icon,
    displayOrder: group.display_order,
    skills: skillsByGroup.get(group.id) ?? [],
  }));
}

type AchievementRow = {
  id: string;
  title: string;
  description: string;
  issuer: string | null;
  achieved_at: string | null;
  icon: string;
  display_order: number;
};

export async function listPublishedAchievements(
  database: D1Database,
  locale: ApiLocale
): Promise<AchievementRow[]> {
  return allRows<AchievementRow>(
    database,
    `SELECT a.id, t.title, t.description, a.issuer, a.achieved_at,
            a.icon, a.display_order
       FROM achievements a
       JOIN achievement_translations t ON t.achievement_id = a.id
      WHERE a.status = ? AND t.locale = ?
      ORDER BY a.display_order ASC, a.id ASC`,
    "PUBLISHED",
    locale
  );
}

type CertificateRow = {
  id: string;
  title: string;
  description: string;
  issuer: string;
  kind: "learning" | "preparation" | "practice";
  official: number;
  credential_url: string | null;
  issued_at: string | null;
  icon: string;
  display_order: number;
};

export async function listPublishedCertificates(
  database: D1Database,
  locale: ApiLocale
): Promise<CertificateRow[]> {
  return allRows<CertificateRow>(
    database,
    `SELECT c.id, t.title, t.description, t.issuer, c.kind, c.official,
            c.credential_url, c.issued_at, c.icon, c.display_order
       FROM certificates c
       JOIN certificate_translations t ON t.certificate_id = c.id
      WHERE c.status = ? AND t.locale = ?
      ORDER BY c.display_order ASC, c.id ASC`,
    "PUBLISHED",
    locale
  );
}

type ProjectBaseRow = {
  id: string;
  slug: string;
  featured: number;
  thumbnail_url: string | null;
  display_order: number;
  title: string;
  subtitle: string;
  role: string;
  summary: string;
  description: string;
};

type ProjectStatusRow = {
  label: string;
  tone: string | null;
  icon: string | null;
  display_order: number;
};

type ProjectTechRow = {
  technology: string;
  display_order: number;
};

type ProjectHighlightRow = {
  text: string;
  display_order: number;
};

type ProjectLinkRow = {
  id: string;
  label: string;
  url: string;
  type: string | null;
  icon: string;
  is_primary: number;
  display_order: number;
};

type ProjectContentBlockRow = {
  id: string;
  type: string;
  display_order: number;
  title: string;
  markdown: string | null;
  description: string | null;
  metadata_json: string;
};

export type ProjectRecord = ProjectBaseRow & {
  statuses: ProjectStatusRow[];
  techStack: string[];
  highlights: string[];
  links: ProjectLinkRow[];
  contentBlocks: ProjectContentBlockRow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function localizeMetadata(value: unknown, locale: ApiLocale): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => localizeMetadata(item, locale));
  }

  if (!isRecord(value)) {
    return value;
  }

  const keys = Object.keys(value);
  if (
    keys.length === 2 &&
    keys.includes("en") &&
    keys.includes("vi")
  ) {
    return localizeMetadata(value[locale], locale);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      localizeMetadata(item, locale),
    ])
  );
}

function parseLocalizedMetadata(
  metadataJson: string,
  locale: ApiLocale
): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(metadataJson);
  } catch (error) {
    throw new Error("Project content block metadata is invalid JSON.", {
      cause: error,
    });
  }

  const metadataResult = z.record(z.string(), z.unknown()).safeParse(parsed);
  if (!metadataResult.success) {
    throw new Error("Project content block metadata must be a JSON object.");
  }

  return localizeMetadata(metadataResult.data, locale) as Record<string, unknown>;
}

async function findProjectBaseBySlug(
  database: D1Database,
  locale: ApiLocale,
  slug: string
): Promise<ProjectBaseRow | null> {
  return firstRow<ProjectBaseRow>(
    database,
    `SELECT p.id, p.slug, p.featured, p.thumbnail_url, p.display_order,
            t.title, t.subtitle, t.role, t.summary, t.description
       FROM projects p
       JOIN project_translations t ON t.project_id = p.id
      WHERE p.slug = ? AND p.status = ? AND t.locale = ?`,
    slug,
    "PUBLISHED",
    locale
  );
}

async function findProjectBases(
  database: D1Database,
  locale: ApiLocale
): Promise<ProjectBaseRow[]> {
  return allRows<ProjectBaseRow>(
    database,
    `SELECT p.id, p.slug, p.featured, p.thumbnail_url, p.display_order,
            t.title, t.subtitle, t.role, t.summary, t.description
       FROM projects p
       JOIN project_translations t ON t.project_id = p.id
      WHERE p.status = ? AND t.locale = ?
      ORDER BY p.display_order ASC, p.id ASC`,
    "PUBLISHED",
    locale
  );
}

async function findProjectRelations(
  database: D1Database,
  projectId: string,
  locale: ApiLocale,
  includeContentBlocks: boolean
): Promise<Omit<ProjectRecord, keyof ProjectBaseRow>> {
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `SELECT t.label, s.tone, s.icon, s.display_order
           FROM project_status_labels s
           JOIN project_status_label_translations t ON t.status_label_id = s.id
          WHERE s.project_id = ? AND s.status = ? AND t.locale = ?
          ORDER BY s.display_order ASC, s.id ASC`
      )
      .bind(projectId, "PUBLISHED", locale),
    database
      .prepare(
        `SELECT technology, display_order
           FROM project_tech_stack
          WHERE project_id = ?
          ORDER BY display_order ASC, technology ASC`
      )
      .bind(projectId),
    database
      .prepare(
        `SELECT t.text, h.display_order
           FROM project_highlights h
           JOIN project_highlight_translations t ON t.highlight_id = h.id
          WHERE h.project_id = ? AND h.status = ? AND t.locale = ?
          ORDER BY h.display_order ASC, h.id ASC`
      )
      .bind(projectId, "PUBLISHED", locale),
    database
      .prepare(
        `SELECT l.id, t.label, l.href AS url, l.link_type AS type, l.icon,
                l.is_primary, l.display_order
           FROM project_links l
           JOIN project_link_translations t ON t.project_link_id = l.id
          WHERE l.project_id = ? AND l.status = ? AND t.locale = ?
          ORDER BY l.display_order ASC, l.id ASC`
      )
      .bind(projectId, "PUBLISHED", locale),
  ];

  if (includeContentBlocks) {
    statements.push(
      database
        .prepare(
          `SELECT b.id, b.type, b.display_order, t.title, t.markdown,
                  t.description, b.metadata_json
             FROM project_content_blocks b
             JOIN project_content_block_translations t
               ON t.content_block_id = b.id
            WHERE b.project_id = ? AND b.status = ? AND t.locale = ?
            ORDER BY b.display_order ASC, b.id ASC`
        )
        .bind(projectId, "PUBLISHED", locale)
    );
  }

  const results = await database.batch(statements);
  const getRows = <Row>(index: number): Row[] =>
    (results[index]?.results ?? []) as Row[];
  const contentBlockRows = includeContentBlocks
    ? getRows<ProjectContentBlockRow>(4)
    : [];

  return {
    statuses: getRows<ProjectStatusRow>(0),
    techStack: getRows<ProjectTechRow>(1).map((row) => row.technology),
    highlights: getRows<ProjectHighlightRow>(2).map((row) => row.text),
    links: getRows<ProjectLinkRow>(3),
    contentBlocks: contentBlockRows.map((row) => ({
      ...row,
      metadata_json: JSON.stringify(
        parseLocalizedMetadata(row.metadata_json, locale)
      ),
    })),
  };
}

export async function listPublishedProjects(
  database: D1Database,
  locale: ApiLocale
): Promise<ProjectRecord[]> {
  const projects = await findProjectBases(database, locale);

  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      ...(await findProjectRelations(database, project.id, locale, false)),
    }))
  );
}

export async function findPublishedProjectBySlug(
  database: D1Database,
  locale: ApiLocale,
  slug: string
): Promise<ProjectRecord | null> {
  const project = await findProjectBaseBySlug(database, locale, slug);

  if (!project) {
    return null;
  }

  return {
    ...project,
    ...(await findProjectRelations(database, project.id, locale, true)),
  };
}

type BlogPostRow = {
  id: string;
  slug: string;
  featured: number;
  published_at: string;
  reading_time_minutes: number;
  cover_image_url: string | null;
  display_order: number;
  title: string;
  summary: string;
  content_markdown: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_path: string | null;
  og_image_url: string | null;
};

type BlogTagRow = {
  tag: string;
};

export type BlogPostRecord = BlogPostRow & {
  tags: string[];
};

async function listBlogTags(
  database: D1Database,
  blogPostId: string
): Promise<string[]> {
  const rows = await allRows<BlogTagRow>(
    database,
    `SELECT tag
       FROM blog_post_tags
      WHERE blog_post_id = ?
      ORDER BY display_order ASC, tag ASC`,
    blogPostId
  );

  return rows.map((row) => row.tag);
}

async function listPublishedBlogRows(
  database: D1Database,
  locale: ApiLocale
): Promise<BlogPostRow[]> {
  return allRows<BlogPostRow>(
    database,
    `SELECT b.id, b.slug, b.featured, b.published_at,
            b.reading_time_minutes, b.cover_image_url, b.display_order,
            t.title, t.summary, t.content_markdown, t.seo_title,
            t.seo_description, t.canonical_path, t.og_image_url
       FROM blog_posts b
       JOIN blog_post_translations t ON t.blog_post_id = b.id
      WHERE b.status = ? AND t.locale = ?
      ORDER BY b.display_order ASC, b.published_at DESC, b.id ASC`,
    "PUBLISHED",
    locale
  );
}

export async function listPublishedBlogPosts(
  database: D1Database,
  locale: ApiLocale
): Promise<BlogPostRecord[]> {
  const posts = await listPublishedBlogRows(database, locale);

  return Promise.all(
    posts.map(async (post) => ({
      ...post,
      tags: await listBlogTags(database, post.id),
    }))
  );
}

export async function findPublishedBlogPostBySlug(
  database: D1Database,
  locale: ApiLocale,
  slug: string
): Promise<BlogPostRecord | null> {
  const row = await firstRow<BlogPostRow>(
    database,
    `SELECT b.id, b.slug, b.featured, b.published_at,
            b.reading_time_minutes, b.cover_image_url, b.display_order,
            t.title, t.summary, t.content_markdown, t.seo_title,
            t.seo_description, t.canonical_path, t.og_image_url
       FROM blog_posts b
       JOIN blog_post_translations t ON t.blog_post_id = b.id
      WHERE b.slug = ? AND b.status = ? AND t.locale = ?`,
    slug,
    "PUBLISHED",
    locale
  );

  if (!row) {
    return null;
  }

  return {
    ...row,
    tags: await listBlogTags(database, row.id),
  };
}

type ContactLinkRow = {
  id: string;
  type: string;
  icon: string;
  href: string;
  value: string;
  is_primary: number;
  display_order: number;
  label: string;
};

export async function listPublishedContactLinks(
  database: D1Database,
  locale: ApiLocale
): Promise<ContactLinkRow[]> {
  return allRows<ContactLinkRow>(
    database,
    `SELECT c.id, c.type, c.icon, c.href, c.value, c.is_primary,
            c.display_order, t.label
       FROM contact_links c
       JOIN contact_link_translations t ON t.contact_link_id = c.id
      WHERE c.status = ? AND t.locale = ?
      ORDER BY c.display_order ASC, c.id ASC`,
    "PUBLISHED",
    locale
  );
}

type SiteSettingsRow = {
  locale: string;
  default_locale: ApiLocale;
  supported_locales_json: string;
  default_og_image_url: string | null;
  github_url: string | null;
  linked_in_url: string | null;
  email: string | null;
  cv_url: string | null;
  site_name: string;
  author_name: string;
  default_title: string | null;
  default_description: string | null;
  title_template: string | null;
};

export type SiteSettingsRecord = {
  locale: ApiLocale;
  defaultLocale: ApiLocale;
  supportedLocales: ApiLocale[];
  defaultOgImageUrl: string | null;
  githubUrl: string | null;
  linkedInUrl: string | null;
  email: string | null;
  cvUrl: string | null;
  siteName: string;
  authorName: string;
  defaultTitle: string | null;
  defaultDescription: string | null;
  titleTemplate: string | null;
};

export async function findPublishedSiteSettings(
  database: D1Database,
  locale: ApiLocale
): Promise<SiteSettingsRecord | null> {
  const row = await firstRow<SiteSettingsRow>(
    database,
    `SELECT t.locale, s.default_locale, s.supported_locales_json,
            s.default_og_image_url, s.github_url, s.linked_in_url,
            s.email, s.cv_url, t.site_name, t.author_name,
            t.default_title, t.default_description, t.title_template
       FROM site_settings s
       JOIN site_settings_translations t ON t.site_settings_id = s.id
      WHERE s.id = ? AND s.status = ? AND t.locale = ?`,
    "primary",
    "PUBLISHED",
    locale
  );

  if (!row) {
    return null;
  }

  const supportedLocales = z
    .array(z.enum(["en", "vi"]))
    .parse(JSON.parse(row.supported_locales_json));

  return {
    locale,
    defaultLocale: row.default_locale,
    supportedLocales,
    defaultOgImageUrl: row.default_og_image_url,
    githubUrl: row.github_url,
    linkedInUrl: row.linked_in_url,
    email: row.email,
    cvUrl: row.cv_url,
    siteName: row.site_name,
    authorName: row.author_name,
    defaultTitle: row.default_title,
    defaultDescription: row.default_description,
    titleTemplate: row.title_template,
  };
}
