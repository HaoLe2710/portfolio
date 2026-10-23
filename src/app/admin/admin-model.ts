export type ContentType =
  | "profile"
  | "skills"
  | "project"
  | "blogPost"
  | "achievement"
  | "certificate"
  | "contactLink"
  | "siteSettings";

export type AdminSection = ContentType | "dashboard" | "auditLogs" | "releases";
export type Locale = "en" | "vi";
export type Snapshot = Record<string, unknown>;

export const MODULES: Array<{ id: AdminSection; label: string; icon: string; singleton?: boolean }> = [
  { id: "dashboard", label: "Overview", icon: "grid_view" },
  { id: "profile", label: "Profile", icon: "person", singleton: true },
  { id: "skills", label: "Skills", icon: "hub" },
  { id: "project", label: "Projects", icon: "work" },
  { id: "blogPost", label: "Blog posts", icon: "article" },
  { id: "achievement", label: "Achievements", icon: "workspace_premium" },
  { id: "certificate", label: "Certificates", icon: "verified" },
  { id: "contactLink", label: "Contact links", icon: "link" },
  { id: "siteSettings", label: "Site settings", icon: "tune", singleton: true },
  { id: "releases", label: "Deployments", icon: "rocket_launch" },
  { id: "auditLogs", label: "Audit log", icon: "history" },
];

export const BLOCK_TYPES = [
  "MARKDOWN",
  "FEATURE_GRID",
  "ARCHITECTURE_FLOW",
  "MODULE_LIST",
  "CI_CD_FLOW",
  "IMAGE_GALLERY",
  "METRIC_CARDS",
  "LINK_GROUP",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export type AdminUser = {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN";
};

export type AdminDetail = {
  id: string;
  type: ContentType;
  snapshot: Snapshot;
  version: number;
  baseRevision: string | null;
  hasPublished: boolean;
  hasDraft: boolean;
  state: "DRAFT" | "PUBLISHED" | "DISCARDED";
  updatedAt: string | null;
};

export type ContentSummary = {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  subtitle: string;
  status: "PUBLISHED" | "DRAFT";
  hasPublished: boolean;
  version: number;
  updatedAt: string | null;
  revisionCount: number;
};

export type ContentPage = {
  items: ContentSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Revision = {
  id: string;
  revisionNumber: number;
  version: number;
  title: string;
  authorEmail: string;
  createdAt: string;
  snapshot: Snapshot;
};

export type Dashboard = {
  published: Record<ContentType, number>;
  activeDrafts: number;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorEmail: string;
    createdAt: string;
  }>;
};

export type AuditPage = {
  items: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    requestId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    actorEmail: string;
  }>;
  page: number;
  pageSize: number;
  total: number;
};

export type ContentRelease = {
  id: string;
  environment: "staging" | "production";
  number: number;
  status: string;
  operation: string;
  entityType: ContentType;
  entityId: string;
  sourceRevisionId: string | null;
  draftVersion: number | null;
  checksum: string;
  previousReleaseId: string | null;
  deployment: null | { id: string; url: string | null; status: string; attemptCount: number };
  createdAt: string;
  activatedAt: string | null;
  error: null | { code: string; message: string };
};

const emptyLocale = () => ({ en: "", vi: "" });
const createId = () => globalThis.crypto.randomUUID();

export function createBlock(type: BlockType): Snapshot {
  const id = createId();
  const title = emptyLocale();
  switch (type) {
    case "MARKDOWN": return { id, type, title, body: emptyLocale() };
    case "FEATURE_GRID": return { id, type, title, items: [] };
    case "ARCHITECTURE_FLOW": return { id, type, title, steps: [] };
    case "MODULE_LIST": return { id, type, title, items: [] };
    case "CI_CD_FLOW": return { id, type, title, steps: [] };
    case "IMAGE_GALLERY": return { id, type, title, images: [] };
    case "METRIC_CARDS": return { id, type, title, metrics: [] };
    case "LINK_GROUP": return { id, type, title, links: [] };
  }
}

export function createArrayEntry(key: string, parent: Snapshot): unknown {
  const id = createId();
  const localized = emptyLocale();
  switch (key) {
    case "contentBlocks": return createBlock("MARKDOWN");
    case "items": return parent.type === "FEATURE_GRID" || parent.type === "MODULE_LIST"
      ? { id, icon: "", title: localized, description: emptyLocale() }
      : { id, title: localized, description: emptyLocale() };
    case "steps": return parent.type === "ARCHITECTURE_FLOW"
      ? { id, icon: "", label: localized }
      : { id, label: localized, description: localized };
    case "images": return { id, src: "", alt: localized, caption: localized };
    case "metrics": return { id, label: localized, value: "", description: localized };
    case "links": return parent.slug
      ? { id, label: localized, href: "", icon: "", isPrimary: false }
      : { id, label: localized, href: "", icon: "" };
    case "statuses": return { id, label: localized, tone: "", icon: "", displayOrder: 0 };
    case "highlights": return { id, text: localized };
    case "skills": return { id, name: localized, icon: "", level: "", displayOrder: 0 };
    case "tags": return "";
    case "techStack": return "";
    case "supportedLocales": return "vi";
    default: return "";
  }
}

export function emptySnapshot(type: ContentType): Snapshot {
  const locale = emptyLocale();
  switch (type) {
    case "profile": return { id: "primary" };
    case "siteSettings": return { id: "primary" };
    case "skills": return {
      id: "",
      name: { en: "New skill group", vi: "Nhóm kỹ năng mới" },
      description: locale,
      icon: "code",
      displayOrder: 0,
      skills: [],
    };
    case "project": return {
      id: "",
      slug: `new-project-${Date.now().toString(36)}`,
      title: { en: "New project", vi: "Dự án mới" },
      subtitle: locale,
      role: locale,
      summary: locale,
      description: locale,
      featured: false,
      thumbnailUrl: "",
      displayOrder: 0,
      statuses: [],
      techStack: [],
      highlights: [],
      links: [],
      contentBlocks: [],
    };
    case "blogPost": return {
      id: "",
      slug: `new-post-${Date.now().toString(36)}`,
      title: { en: "New blog post", vi: "Bài viết mới" },
      summary: locale,
      content: { en: "", vi: "" },
      tags: [],
      featured: false,
      readingTimeMinutes: 1,
      publishedAt: new Date().toISOString().slice(0, 10),
      coverImageUrl: "",
      displayOrder: 0,
      seo: {
        en: { title: "", description: "", canonicalPath: "", ogImageUrl: "" },
        vi: { title: "", description: "", canonicalPath: "", ogImageUrl: "" },
      },
    };
    case "achievement": return {
      id: "", title: locale, description: locale, icon: "workspace_premium",
      issuer: "", achievedAt: "", displayOrder: 0,
    };
    case "certificate": return {
      id: "", title: locale, issuer: locale, description: locale, icon: "verified",
      kind: "learning", official: false, credentialUrl: "", issuedAt: "", displayOrder: 0,
    };
    case "contactLink": return {
      id: "", type: "github", icon: "link", label: locale, href: "", value: "",
      isPrimary: false, displayOrder: 0,
    };
  }
}

export function updateAtPath(value: unknown, path: Array<string | number>, replacement: unknown): unknown {
  if (path.length === 0) return replacement;
  const [key, ...rest] = path;
  if (Array.isArray(value)) {
    const next = [...value];
    const index = Number(key);
    next[index] = updateAtPath(next[index], rest, replacement);
    return next;
  }
  if (typeof value === "object" && value !== null) {
    const next = { ...(value as Snapshot) };
    next[String(key)] = updateAtPath(next[String(key)], rest, replacement);
    return next;
  }
  return value;
}

export function isLocalizedPair(value: unknown): value is { en: string | string[]; vi: string | string[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("en") || !keys.includes("vi")) return false;
  const pair = value as { en: unknown; vi: unknown };
  return (typeof pair.en === "string" && typeof pair.vi === "string") ||
    (Array.isArray(pair.en) && pair.en.every((item) => typeof item === "string") &&
      Array.isArray(pair.vi) && pair.vi.every((item) => typeof item === "string"));
}

export function textValue(value: unknown, locale: Locale) {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return "";
  const localized = value as Record<string, unknown>;
  const selected = localized[locale] ?? localized.en ?? localized.vi;
  return typeof selected === "string" ? selected : "";
}

export function formatTime(value: string | null | undefined, locale = "en-US") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
