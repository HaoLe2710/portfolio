export type PublicLinkResponse = {
  label: string;
  url: string;
  type?: string | null;
  icon?: string | null;
  primary?: boolean | null;
};

export type PublicMetricResponse = {
  label: string;
  value: string;
  description?: string | null;
  icon?: string | null;
};

export type PublicContentBlockResponse = {
  id: string;
  type: string;
  displayOrder: number;
  title?: string | null;
  description?: string | null;
  markdown?: string | null;
  metadata: Record<string, unknown>;
};

export type PublicSeoResponse = {
  title: string;
  description: string;
  canonicalPath: string;
  ogImageUrl?: string | null;
};

export type PublicProfileResponse = {
  locale: string;
  fullName: string;
  brandName: string;
  headline: string;
  role: string;
  summary: string;
  about: string;
  careerObjective: string;
  location: string;
  university: string;
  major: string;
  gpa: string;
  focus: string;
  email: string;
  githubUrl: string;
  linkedInUrl: string;
  cvUrl: string;
};

export type PublicSkillItemResponse = {
  id: string;
  name: string;
  level?: string | null;
  icon?: string | null;
  displayOrder?: number | null;
};

export type PublicSkillGroupResponse = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  displayOrder?: number | null;
  skills: PublicSkillItemResponse[];
};

export type PublicAchievementResponse = {
  id: string;
  title: string;
  description: string;
  issuer?: string | null;
  achievedAt?: string | null;
  icon?: string | null;
  displayOrder?: number | null;
};

export type PublicCertificateResponse = {
  id: string;
  title: string;
  description: string;
  issuer: string;
  status?: string | null;
  issuedAt?: string | null;
  credentialUrl?: string | null;
  icon?: string | null;
  displayOrder?: number | null;
};

export type PublicProjectStatusResponse = {
  label: string;
  tone?: string | null;
  icon?: string | null;
};

export type PublicProjectLinkResponse = PublicLinkResponse;

export type PublicProjectSummaryResponse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  description: string;
  role: string;
  thumbnailUrl?: string | null;
  featured?: boolean | null;
  displayOrder?: number | null;
  tags: string[];
  techStack: string[];
  highlights: string[];
  statuses: PublicProjectStatusResponse[];
  links: PublicProjectLinkResponse[];
};

export type PublicProjectDetailResponse = PublicProjectSummaryResponse & {
  responsibilities: string[];
  metrics: PublicMetricResponse[];
  contentBlocks: PublicContentBlockResponse[];
};

export type PublicBlogPostSummaryResponse = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  publishedAt: string;
  readingTime: string;
  tags: string[];
  featured?: boolean | null;
};

export type PublicBlogPostDetailResponse = PublicBlogPostSummaryResponse & {
  contentMarkdown: string;
  seo?: PublicSeoResponse | null;
};

export type PublicSiteSettingsResponse = {
  locale: string;
  siteName: string;
  authorName: string;
  defaultTitle?: string | null;
  defaultDescription?: string | null;
  titleTemplate?: string | null;
  defaultOgImageUrl?: string | null;
  githubUrl?: string | null;
  linkedInUrl?: string | null;
  email?: string | null;
  cvUrl?: string | null;
};

export type PublicContactLinkResponse = {
  id: string;
  label: string;
  value: string;
  url: string;
  type: string;
  icon?: string | null;
  primary?: boolean | null;
  displayOrder?: number | null;
};

export type PublicMediaAssetResponse = {
  id: string;
  fileName: string;
  originalFileName: string;
  contentType: string;
  sizeBytes?: number | null;
  url: string;
  storageProvider: string;
  mediaType: string;
  altText?: string | null;
  displayOrder: number;
};
