import type {
  CertificateKind,
  ContactLinkType,
  Locale,
  LocalizedAchievement,
  LocalizedBlogPost,
  LocalizedCertificate,
  LocalizedContactLink,
  LocalizedProject,
  LocalizedProjectContentBlock,
  LocalizedProjectLink,
  LocalizedProfile,
  LocalizedSiteSettings,
  LocalizedSkillGroup,
  ProjectContentBlockType,
  PublicMediaAsset,
} from "@/types/portfolio";
import type {
  PublicAchievementResponse,
  PublicBlogPostDetailResponse,
  PublicBlogPostSummaryResponse,
  PublicCertificateResponse,
  PublicContactLinkResponse,
  PublicContentBlockResponse,
  PublicLinkResponse,
  PublicMediaAssetResponse,
  PublicProfileResponse,
  PublicProjectDetailResponse,
  PublicProjectSummaryResponse,
  PublicSkillGroupResponse,
  PublicSiteSettingsResponse,
} from "@/types/public-api";

const DEFAULT_LOCALE: Locale = "en";
const SUPPORTED_LOCALES = new Set<Locale>(["en", "vi"]);
const SUPPORTED_BLOCK_TYPES = new Set<ProjectContentBlockType>([
  "MARKDOWN",
  "FEATURE_GRID",
  "ARCHITECTURE_FLOW",
  "MODULE_LIST",
  "CI_CD_FLOW",
  "IMAGE_GALLERY",
  "METRIC_CARDS",
  "LINK_GROUP",
]);

function normalizeLocale(locale: string | undefined): Locale {
  return SUPPORTED_LOCALES.has(locale as Locale)
    ? (locale as Locale)
    : DEFAULT_LOCALE;
}

function valueOrEmpty(value: string | null | undefined) {
  return value ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getObjectArray(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function sortByDisplayOrder<T extends { displayOrder?: number | null }>(
  items: T[]
) {
  return [...items].sort(
    (first, second) => (first.displayOrder ?? 0) - (second.displayOrder ?? 0)
  );
}

function mapContactLinkType(type: string | null | undefined): ContactLinkType {
  switch (type) {
    case "email":
    case "github":
    case "linkedin":
    case "cv":
      return type;
    default:
      return "github";
  }
}

function mapCertificateKind(status: string | null | undefined): CertificateKind {
  switch (status) {
    case "practice":
    case "preparation":
    case "learning":
      return status;
    default:
      return "learning";
  }
}

function parseReadingTimeMinutes(readingTime: string) {
  const match = readingTime.match(/\d+/);

  return match ? Number.parseInt(match[0], 10) : 1;
}

function mapPublicProjectLink(
  link: PublicLinkResponse,
  index: number
): LocalizedProjectLink {
  return {
    href: link.url,
    icon: link.icon ?? "open_in_new",
    id: `${link.type ?? "link"}-${index}-${link.label}`,
    label: link.label,
  };
}

function mapMetadataLinks(
  metadata: Record<string, unknown>
): LocalizedProjectLink[] {
  return getObjectArray(metadata, "links").map((link, index) =>
    mapPublicProjectLink(
      {
        label: getString(link.label, `Link ${index + 1}`),
        url: getString(link.url),
        icon: getOptionalString(link.icon),
        type: getOptionalString(link.type),
        primary: typeof link.primary === "boolean" ? link.primary : undefined,
      },
      index
    )
  );
}

function mapPublicContentBlock(
  block: PublicContentBlockResponse
): LocalizedProjectContentBlock | null {
  if (!SUPPORTED_BLOCK_TYPES.has(block.type as ProjectContentBlockType)) {
    return null;
  }

  const type = block.type as ProjectContentBlockType;
  const title = valueOrEmpty(block.title);
  const metadata = block.metadata ?? {};

  switch (type) {
    case "MARKDOWN":
      return {
        body: valueOrEmpty(block.markdown),
        id: block.id,
        title,
        type,
      };
    case "FEATURE_GRID":
      return {
        id: block.id,
        items: getObjectArray(metadata, "items").map((item, index) => ({
          description: getString(item.description),
          icon: getString(item.icon, "check_circle"),
          id: getString(item.id, `${block.id}-item-${index}`),
          title: getString(item.title),
        })),
        title,
        type,
      };
    case "ARCHITECTURE_FLOW":
      const architectureSteps = getObjectArray(metadata, "nodes");

      return {
        id: block.id,
        steps: (architectureSteps.length > 0
          ? architectureSteps
          : getObjectArray(metadata, "steps")
        ).map((step, index) => ({
          icon: getString(step.icon, "radio_button_checked"),
          id: getString(step.id, `${block.id}-step-${index}`),
          label: getString(step.label),
        })),
        title,
        type,
      };
    case "MODULE_LIST":
      return {
        id: block.id,
        items: getObjectArray(metadata, "items").map((item, index) => ({
          description: getString(item.description),
          icon: getString(item.icon, "view_module"),
          id: getString(item.id, `${block.id}-module-${index}`),
          title: getString(item.title),
        })),
        title,
        type,
      };
    case "CI_CD_FLOW":
      return {
        id: block.id,
        steps: getObjectArray(metadata, "steps").map((step, index) => ({
          description: getOptionalString(step.description),
          id: getString(step.id, `${block.id}-step-${index}`),
          label: getString(step.label),
        })),
        title,
        type,
      };
    case "IMAGE_GALLERY":
      return {
        id: block.id,
        images: getObjectArray(metadata, "images").map((image, index) => ({
          alt: getString(image.alt, title),
          caption: getOptionalString(image.caption),
          id: getString(image.id, `${block.id}-image-${index}`),
          src: getString(image.src),
        })),
        title,
        type,
      };
    case "METRIC_CARDS":
      return {
        id: block.id,
        metrics: getObjectArray(metadata, "metrics").map((metric, index) => ({
          description: getOptionalString(metric.description),
          id: getString(metric.id, `${block.id}-metric-${index}`),
          label: getString(metric.label),
          value: getString(metric.value),
        })),
        title,
        type,
      };
    case "LINK_GROUP":
      return {
        id: block.id,
        links: mapMetadataLinks(metadata),
        title,
        type,
      };
  }
}

function mapProjectBase(
  dto: PublicProjectSummaryResponse,
  locale: Locale,
  contentBlocks: LocalizedProjectContentBlock[] = []
): LocalizedProject {
  return {
    contentBlocks,
    description: dto.description || dto.summary,
    featured: dto.featured ?? false,
    highlights: dto.highlights,
    id: dto.id,
    links: dto.links.map(mapPublicProjectLink),
    locale,
    role: dto.role,
    slug: dto.slug,
    statusLabels: dto.statuses.map((status) => status.label),
    subtitle: dto.subtitle,
    techStack: dto.techStack,
    title: dto.title,
  };
}

export function mapPublicProfile(
  dto: PublicProfileResponse
): LocalizedProfile {
  const locale = normalizeLocale(dto.locale);

  return {
    about: dto.about,
    brand: dto.brandName,
    careerObjective: dto.careerObjective,
    cvUrl: dto.cvUrl,
    email: dto.email,
    focus: dto.focus,
    fullName: dto.fullName,
    githubUrl: dto.githubUrl,
    gpa: dto.gpa,
    linkedInUrl: dto.linkedInUrl,
    locale,
    location: dto.location,
    major: dto.major,
    role: dto.role || dto.headline,
    summary: dto.summary,
    university: dto.university,
  };
}

export function mapPublicSkillGroups(
  dto: PublicSkillGroupResponse[],
  locale: Locale = DEFAULT_LOCALE
): LocalizedSkillGroup[] {
  return sortByDisplayOrder(dto).map((group) => ({
    icon: group.icon ?? "dns",
    id: group.id,
    locale,
    name: group.name,
    skills: sortByDisplayOrder(group.skills).map((skill) => ({
      id: skill.id,
      name: skill.name,
    })),
  }));
}

export function mapPublicAchievements(
  dto: PublicAchievementResponse[],
  locale: Locale = DEFAULT_LOCALE
): LocalizedAchievement[] {
  return sortByDisplayOrder(dto).map((achievement) => ({
    description: achievement.description,
    icon: achievement.icon ?? "emoji_events",
    id: achievement.id,
    locale,
    title: achievement.title,
  }));
}

export function mapPublicCertificates(
  dto: PublicCertificateResponse[],
  locale: Locale = DEFAULT_LOCALE
): LocalizedCertificate[] {
  return sortByDisplayOrder(dto).map((certificate) => ({
    description: certificate.description,
    icon: certificate.icon ?? "workspace_premium",
    id: certificate.id,
    issuer: certificate.issuer,
    kind: mapCertificateKind(certificate.status),
    locale,
    official: Boolean(certificate.credentialUrl),
    title: certificate.title,
  }));
}

export function mapPublicSiteSettings(
  dto: PublicSiteSettingsResponse
): LocalizedSiteSettings {
  return {
    authorName: dto.authorName,
    defaultLocale: normalizeLocale(dto.locale),
    locale: normalizeLocale(dto.locale),
    siteName: dto.siteName,
    supportedLocales: ["en", "vi"],
  };
}

export function mapPublicContactLinks(
  dto: PublicContactLinkResponse[],
  locale: Locale = DEFAULT_LOCALE
): LocalizedContactLink[] {
  return sortByDisplayOrder(dto).map((link) => ({
    href: link.url,
    icon: link.icon ?? "link",
    id: link.id,
    label: link.label,
    locale,
    type: mapContactLinkType(link.type),
    value: link.value,
  }));
}

export function mapPublicProjectSummaries(
  dto: PublicProjectSummaryResponse[],
  locale: Locale = DEFAULT_LOCALE
): LocalizedProject[] {
  return sortByDisplayOrder(dto).map((project) =>
    mapProjectBase(project, locale)
  );
}

export function mapPublicProjectDetail(
  dto: PublicProjectDetailResponse,
  locale: Locale = DEFAULT_LOCALE
): LocalizedProject {
  const contentBlocks = sortByDisplayOrder(dto.contentBlocks)
    .map(mapPublicContentBlock)
    .filter((block): block is LocalizedProjectContentBlock => block !== null);

  return mapProjectBase(dto, locale, contentBlocks);
}

export function mapPublicBlogSummaries(
  dto: PublicBlogPostSummaryResponse[],
  locale: Locale = DEFAULT_LOCALE
): LocalizedBlogPost[] {
  return dto.map((post) => ({
    content: "",
    featured: post.featured ?? false,
    id: post.id,
    locale,
    publishedAt: post.publishedAt,
    readingTimeMinutes: parseReadingTimeMinutes(post.readingTime),
    slug: post.slug,
    summary: post.summary || valueOrEmpty(post.excerpt),
    tags: post.tags,
    title: post.title,
  }));
}

export function mapPublicBlogDetail(
  dto: PublicBlogPostDetailResponse,
  locale: Locale = DEFAULT_LOCALE
): LocalizedBlogPost {
  return {
    content: dto.contentMarkdown,
    featured: dto.featured ?? false,
    id: dto.id,
    locale,
    publishedAt: dto.publishedAt,
    readingTimeMinutes: parseReadingTimeMinutes(dto.readingTime),
    slug: dto.slug,
    summary: dto.summary || valueOrEmpty(dto.excerpt),
    tags: dto.tags,
    title: dto.title,
  };
}

export function mapPublicMediaAsset(
  dto: PublicMediaAssetResponse
): PublicMediaAsset {
  return {
    altText: dto.altText,
    contentType: dto.contentType,
    displayOrder: dto.displayOrder,
    fileName: dto.fileName,
    id: dto.id,
    mediaType: dto.mediaType,
    originalFileName: dto.originalFileName,
    sizeBytes: dto.sizeBytes,
    storageProvider: dto.storageProvider,
    url: dto.url,
  };
}
