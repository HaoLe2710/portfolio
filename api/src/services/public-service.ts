import {
  findPublishedBlogPostBySlug,
  findPublishedProfile,
  findPublishedProjectBySlug,
  findPublishedSiteSettings,
  listPublishedAchievements,
  listPublishedBlogPosts,
  listPublishedCertificates,
  listPublishedContactLinks,
  listPublishedProjects,
  listPublishedSkillGroups,
} from "../repositories/public-repository";
import { ApiError } from "../utils/api-error";
import type { ApiLocale } from "../validators/public-query";

function requiredRecord<T>(record: T | null, resource: string): T {
  if (record === null) {
    throw new ApiError(404, "NOT_FOUND", `${resource} was not found.`);
  }

  return record;
}

function mapLink(link: {
  id: string;
  label: string;
  url: string;
  type: string | null;
  icon: string;
  is_primary: number;
}) {
  return {
    id: link.id,
    label: link.label,
    url: link.url,
    type: link.type,
    icon: link.icon,
    primary: Boolean(link.is_primary),
  };
}

function parseMetadata(metadataJson: string): Record<string, unknown> {
  const metadata: unknown = JSON.parse(metadataJson);
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    throw new Error("Stored content block metadata is not an object.");
  }

  return metadata as Record<string, unknown>;
}

function mapProject(project: Awaited<ReturnType<typeof listPublishedProjects>>[number]) {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    subtitle: project.subtitle,
    summary: project.summary,
    description: project.description,
    role: project.role,
    thumbnailUrl: project.thumbnail_url,
    featured: Boolean(project.featured),
    displayOrder: project.display_order,
    tags: [],
    techStack: project.techStack,
    highlights: project.highlights,
    statuses: project.statuses.map((status) => ({
      label: status.label,
      tone: status.tone,
      icon: status.icon,
    })),
    links: project.links.map(mapLink),
  };
}

export async function getProfile(database: D1Database, locale: ApiLocale) {
  const profile = requiredRecord(
    await findPublishedProfile(database, locale),
    "Profile"
  );

  return {
    locale,
    fullName: profile.fullName,
    brandName: profile.brand,
    headline: profile.role,
    role: profile.role,
    summary: profile.summary,
    about: profile.about,
    careerObjective: profile.careerObjective,
    location: profile.location,
    university: profile.university,
    major: profile.major,
    gpa: profile.gpa,
    focus: profile.focus,
    email: profile.email,
    githubUrl: profile.githubUrl,
    linkedInUrl: profile.linkedInUrl,
    cvUrl: profile.cvUrl,
  };
}

export async function getSkillGroups(database: D1Database, locale: ApiLocale) {
  const groups = await listPublishedSkillGroups(database, locale);

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    icon: group.icon,
    displayOrder: group.displayOrder,
    skills: group.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      level: skill.level,
      icon: skill.icon,
      displayOrder: skill.displayOrder,
    })),
  }));
}

export async function getAchievements(database: D1Database, locale: ApiLocale) {
  const achievements = await listPublishedAchievements(database, locale);

  return achievements.map((achievement) => ({
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    issuer: achievement.issuer,
    achievedAt: achievement.achieved_at,
    icon: achievement.icon,
    displayOrder: achievement.display_order,
  }));
}

export async function getCertificates(database: D1Database, locale: ApiLocale) {
  const certificates = await listPublishedCertificates(database, locale);

  return certificates.map((certificate) => ({
    id: certificate.id,
    title: certificate.title,
    description: certificate.description,
    issuer: certificate.issuer,
    status: certificate.kind,
    issuedAt: certificate.issued_at,
    credentialUrl: certificate.credential_url,
    official: Boolean(certificate.official),
    icon: certificate.icon,
    displayOrder: certificate.display_order,
  }));
}

export async function getProjects(database: D1Database, locale: ApiLocale) {
  const projects = await listPublishedProjects(database, locale);
  return projects.map(mapProject);
}

export async function getProjectBySlug(
  database: D1Database,
  locale: ApiLocale,
  slug: string
) {
  const project = requiredRecord(
    await findPublishedProjectBySlug(database, locale, slug),
    "Project"
  );
  const contentBlocks = project.contentBlocks.map((block) => ({
    id: block.id,
    type: block.type,
    displayOrder: block.display_order,
    title: block.title,
    description: block.description,
    markdown: block.markdown,
    metadata: parseMetadata(block.metadata_json),
  }));
  const metrics = contentBlocks.flatMap((block) => {
    const items = block.metadata.metrics;
    if (block.type !== "METRIC_CARDS" || !Array.isArray(items)) {
      return [];
    }

    return items.flatMap((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return [];
      }
      const metric = item as Record<string, unknown>;
      if (typeof metric.label !== "string" || typeof metric.value !== "string") {
        return [];
      }
      return [{
        label: metric.label,
        value: metric.value,
        description: typeof metric.description === "string" ? metric.description : null,
        icon: typeof metric.icon === "string" ? metric.icon : null,
      }];
    });
  });

  return {
    ...mapProject(project),
    responsibilities: [],
    metrics,
    contentBlocks,
  };
}

export async function getBlogPosts(database: D1Database, locale: ApiLocale) {
  const posts = await listPublishedBlogPosts(database, locale);

  return posts.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    excerpt: post.summary,
    coverImageUrl: post.cover_image_url,
    publishedAt: post.published_at,
    readingTime: `${post.reading_time_minutes} min read`,
    tags: post.tags,
    featured: Boolean(post.featured),
  }));
}

export async function getBlogPostBySlug(
  database: D1Database,
  locale: ApiLocale,
  slug: string
) {
  const post = requiredRecord(
    await findPublishedBlogPostBySlug(database, locale, slug),
    "Blog post"
  );

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    excerpt: post.summary,
    coverImageUrl: post.cover_image_url,
    publishedAt: post.published_at,
    readingTime: `${post.reading_time_minutes} min read`,
    tags: post.tags,
    featured: Boolean(post.featured),
    contentMarkdown: post.content_markdown,
    seo: post.seo_title || post.seo_description || post.canonical_path || post.og_image_url
      ? {
          title: post.seo_title ?? post.title,
          description: post.seo_description ?? post.summary,
          canonicalPath: post.canonical_path ?? `/${locale}/blog/${post.slug}`,
          ogImageUrl: post.og_image_url,
        }
      : null,
  };
}

export async function getContactLinks(database: D1Database, locale: ApiLocale) {
  const links = await listPublishedContactLinks(database, locale);

  return links.map((link) => ({
    id: link.id,
    label: link.label,
    value: link.value,
    url: link.href,
    type: link.type,
    icon: link.icon,
    primary: Boolean(link.is_primary),
    displayOrder: link.display_order,
  }));
}

export async function getSiteSettings(database: D1Database, locale: ApiLocale) {
  const settings = requiredRecord(
    await findPublishedSiteSettings(database, locale),
    "Site settings"
  );

  return {
    ...settings,
  };
}
