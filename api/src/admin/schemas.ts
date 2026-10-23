import { z } from "zod";

const text = z.string().trim().max(50_000);
const shortText = z.string().trim().max(2_000);
const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const url = z.string().trim().max(2_048).refine(
  (value) => value === "" || /^(https?:\/\/|mailto:|tel:|\/)/i.test(value),
  "Use an https, http, mailto, tel, or site-relative URL."
);
const localeText = z.object({ en: text, vi: text }).strict();
const localeShortText = z.object({ en: shortText, vi: shortText }).strict();
const skillSchema = z.object({
  id,
  name: localeShortText,
  icon: shortText,
  level: shortText,
  displayOrder: z.number().int().min(0).max(100_000),
}).strict();

const skillGroupSchema = z.object({
  id,
  name: localeShortText,
  description: localeShortText,
  icon: shortText,
  displayOrder: z.number().int().min(0).max(100_000),
  skills: z.array(skillSchema).max(200),
}).strict();

const projectLinkSchema = z.object({
  id,
  label: localeShortText,
  href: url,
  icon: shortText,
  isPrimary: z.boolean(),
}).strict();
const contentBlockLinkSchema = z.object({
  id,
  label: localeShortText,
  href: url,
  icon: shortText,
}).strict();

const blockTitle = { id, title: localeShortText };
const featureItemSchema = z.object({
  id, icon: shortText, title: localeShortText, description: localeText,
}).strict();
const architectureStepSchema = z.object({ id, icon: shortText, label: localeShortText }).strict();
const moduleItemSchema = z.object({
  id, icon: shortText, title: localeShortText, description: localeText,
}).strict();
const pipelineStepSchema = z.object({
  id, label: localeShortText, description: localeShortText.optional(),
}).strict();
const galleryImageSchema = z.object({
  id, src: url, alt: localeShortText, caption: localeShortText.optional(),
}).strict();
const metricSchema = z.object({
  id, label: localeShortText, value: shortText, description: localeShortText.optional(),
}).strict();

const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ ...blockTitle, type: z.literal("MARKDOWN"), body: localeText }).strict(),
  z.object({ ...blockTitle, type: z.literal("FEATURE_GRID"), items: z.array(featureItemSchema).max(100) }).strict(),
  z.object({ ...blockTitle, type: z.literal("ARCHITECTURE_FLOW"), steps: z.array(architectureStepSchema).max(100) }).strict(),
  z.object({ ...blockTitle, type: z.literal("MODULE_LIST"), items: z.array(moduleItemSchema).max(100) }).strict(),
  z.object({ ...blockTitle, type: z.literal("CI_CD_FLOW"), steps: z.array(pipelineStepSchema).max(100) }).strict(),
  z.object({ ...blockTitle, type: z.literal("IMAGE_GALLERY"), images: z.array(galleryImageSchema).max(100) }).strict(),
  z.object({ ...blockTitle, type: z.literal("METRIC_CARDS"), metrics: z.array(metricSchema).max(100) }).strict(),
  z.object({ ...blockTitle, type: z.literal("LINK_GROUP"), links: z.array(contentBlockLinkSchema).max(100) }).strict(),
]);

const projectSchema = z.object({
  id,
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: localeShortText,
  subtitle: localeShortText,
  role: localeShortText,
  summary: localeText,
  description: localeText,
  featured: z.boolean(),
  thumbnailUrl: url,
  displayOrder: z.number().int().min(0).max(100_000),
  statuses: z.array(z.object({
    id, label: localeShortText, tone: shortText, icon: shortText,
    displayOrder: z.number().int().min(0).max(100_000),
  }).strict()).max(100),
  techStack: z.array(shortText).max(100),
  highlights: z.array(z.object({ id, text: localeShortText }).strict()).max(100),
  links: z.array(projectLinkSchema).max(100),
  contentBlocks: z.array(contentBlockSchema).max(200),
}).strict();

const blogPostSchema = z.object({
  id,
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: localeShortText,
  summary: localeText,
  content: localeText,
  tags: z.array(shortText).max(100),
  featured: z.boolean(),
  readingTimeMinutes: z.number().int().min(1).max(1_000),
  publishedAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  coverImageUrl: url,
  displayOrder: z.number().int().min(0).max(100_000),
  seo: z.object({
    en: z.object({ title: shortText, description: text, canonicalPath: shortText, ogImageUrl: url }).strict(),
    vi: z.object({ title: shortText, description: text, canonicalPath: shortText, ogImageUrl: url }).strict(),
  }).strict(),
}).strict();

const profileSchema = z.object({
  id,
  fullName: shortText,
  brand: shortText,
  role: localeShortText,
  location: localeShortText,
  university: localeShortText,
  major: localeShortText,
  gpa: shortText,
  focus: localeShortText,
  email: z.string().trim().email().max(254),
  githubUrl: url,
  linkedInUrl: url,
  cvUrl: url,
  summary: localeText,
  about: localeText,
  careerObjective: localeText,
}).strict();

const achievementSchema = z.object({
  id,
  title: localeShortText,
  description: localeText,
  icon: shortText,
  issuer: shortText,
  achievedAt: shortText,
  displayOrder: z.number().int().min(0).max(100_000),
}).strict();

const certificateSchema = z.object({
  id,
  title: localeShortText,
  issuer: localeShortText,
  description: localeText,
  icon: shortText,
  kind: z.enum(["learning", "preparation", "practice"]),
  official: z.boolean(),
  credentialUrl: url,
  issuedAt: shortText,
  displayOrder: z.number().int().min(0).max(100_000),
}).strict();

const contactLinkSchema = z.object({
  id,
  type: z.enum(["email", "github", "linkedin", "cv"]),
  icon: shortText,
  label: localeShortText,
  href: url,
  value: shortText,
  isPrimary: z.boolean(),
  displayOrder: z.number().int().min(0).max(100_000),
}).strict();

const siteSettingsSchema = z.object({
  id,
  siteName: localeShortText,
  authorName: localeShortText,
  defaultLocale: z.enum(["en", "vi"]),
  supportedLocales: z.array(z.enum(["en", "vi"])).min(1).max(2),
  defaultTitle: localeShortText,
  defaultDescription: localeText,
  titleTemplate: localeShortText,
  defaultOgImageUrl: url,
  githubUrl: url,
  linkedInUrl: url,
  email: z.string().trim().email().max(254),
  cvUrl: url,
}).strict();

export const CONTENT_TYPES = [
  "profile", "skills", "project", "blogPost", "achievement",
  "certificate", "contactLink", "siteSettings",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

const schemas = {
  profile: profileSchema,
  skills: skillGroupSchema,
  project: projectSchema,
  blogPost: blogPostSchema,
  achievement: achievementSchema,
  certificate: certificateSchema,
  contactLink: contactLinkSchema,
  siteSettings: siteSettingsSchema,
} satisfies Record<ContentType, z.ZodType>;

export function parseContentType(value: string): ContentType | null {
  return (CONTENT_TYPES as readonly string[]).includes(value) ? value as ContentType : null;
}

export function validateSnapshot(type: ContentType, input: unknown) {
  const result = schemas[type].safeParse(input);
  if (!result.success) {
    return { success: false as const, issues: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) };
  }
  return { success: true as const, data: result.data as Record<string, unknown> };
}

export const BLOCK_TYPES = [
  "MARKDOWN", "FEATURE_GRID", "ARCHITECTURE_FLOW", "MODULE_LIST",
  "CI_CD_FLOW", "IMAGE_GALLERY", "METRIC_CARDS", "LINK_GROUP",
] as const;
