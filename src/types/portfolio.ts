export type Locale = "en" | "vi";

export type LocalizedText<T = string> = Record<Locale, T>;

export type ProjectContentBlockType =
  | "MARKDOWN"
  | "FEATURE_GRID"
  | "ARCHITECTURE_FLOW"
  | "MODULE_LIST"
  | "CI_CD_FLOW"
  | "IMAGE_GALLERY"
  | "METRIC_CARDS"
  | "LINK_GROUP";

export type ContactLinkType = "email" | "github" | "linkedin" | "cv";

export type CertificateKind = "learning" | "preparation" | "practice";

export type Profile = {
  fullName: string;
  brand: string;
  role: LocalizedText;
  location: LocalizedText;
  university: LocalizedText;
  major: LocalizedText;
  gpa: string;
  focus: LocalizedText;
  email: string;
  githubUrl: string;
  linkedInUrl: string;
  cvUrl: string;
  summary: LocalizedText;
  about: LocalizedText;
  careerObjective: LocalizedText;
};

export type Skill = {
  id: string;
  name: string;
};

export type SkillGroup = {
  id: string;
  icon: string;
  name: LocalizedText;
  skills: Skill[];
};

export type ProjectLink = {
  id: string;
  label: LocalizedText;
  href: string;
  icon: string;
};

export type FeatureGridItem = {
  id: string;
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
};

export type ArchitectureFlowStep = {
  id: string;
  icon: string;
  label: LocalizedText;
};

export type ModuleListItem = {
  id: string;
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
};

export type CiCdFlowStep = {
  id: string;
  label: LocalizedText;
  description?: LocalizedText;
};

export type GalleryImage = {
  id: string;
  src: string;
  alt: LocalizedText;
  caption?: LocalizedText;
};

export type MetricCard = {
  id: string;
  label: LocalizedText;
  value: string;
  description?: LocalizedText;
};

export type MarkdownContentBlock = {
  id: string;
  type: "MARKDOWN";
  title: LocalizedText;
  body: LocalizedText;
};

export type FeatureGridContentBlock = {
  id: string;
  type: "FEATURE_GRID";
  title: LocalizedText;
  items: FeatureGridItem[];
};

export type ArchitectureFlowContentBlock = {
  id: string;
  type: "ARCHITECTURE_FLOW";
  title: LocalizedText;
  steps: ArchitectureFlowStep[];
};

export type ModuleListContentBlock = {
  id: string;
  type: "MODULE_LIST";
  title: LocalizedText;
  items: ModuleListItem[];
};

export type CiCdFlowContentBlock = {
  id: string;
  type: "CI_CD_FLOW";
  title: LocalizedText;
  steps: CiCdFlowStep[];
};

export type ImageGalleryContentBlock = {
  id: string;
  type: "IMAGE_GALLERY";
  title: LocalizedText;
  images: GalleryImage[];
};

export type MetricCardsContentBlock = {
  id: string;
  type: "METRIC_CARDS";
  title: LocalizedText;
  metrics: MetricCard[];
};

export type LinkGroupContentBlock = {
  id: string;
  type: "LINK_GROUP";
  title: LocalizedText;
  links: ProjectLink[];
};

export type ProjectContentBlock =
  | MarkdownContentBlock
  | FeatureGridContentBlock
  | ArchitectureFlowContentBlock
  | ModuleListContentBlock
  | CiCdFlowContentBlock
  | ImageGalleryContentBlock
  | MetricCardsContentBlock
  | LinkGroupContentBlock;

export type Project = {
  id: string;
  slug: string;
  featured: boolean;
  title: LocalizedText;
  subtitle: LocalizedText;
  role: LocalizedText;
  description: LocalizedText;
  statusLabels: LocalizedText<string[]>;
  techStack: string[];
  highlights: LocalizedText<string[]>;
  links: ProjectLink[];
  contentBlocks: ProjectContentBlock[];
};

export type Achievement = {
  id: string;
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
};

export type Certificate = {
  id: string;
  icon: string;
  title: LocalizedText;
  issuer: LocalizedText;
  description: LocalizedText;
  kind: CertificateKind;
  official: boolean;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  content: LocalizedText;
  tags: string[];
  publishedAt: string;
  readingTimeMinutes: number;
  featured: boolean;
};

export type ContactLink = {
  id: string;
  type: ContactLinkType;
  icon: string;
  label: LocalizedText;
  href: string;
  value: string;
};

export type SiteSettings = {
  siteName: string;
  authorName: string;
  defaultLocale: Locale;
  supportedLocales: Locale[];
};

export type LocalizedProfile = Omit<
  Profile,
  | "role"
  | "location"
  | "university"
  | "major"
  | "focus"
  | "summary"
  | "about"
  | "careerObjective"
> & {
  locale: Locale;
  role: string;
  location: string;
  university: string;
  major: string;
  focus: string;
  summary: string;
  about: string;
  careerObjective: string;
};

export type LocalizedSkillGroup = Omit<SkillGroup, "name"> & {
  locale: Locale;
  name: string;
};

export type LocalizedProjectLink = Omit<ProjectLink, "label"> & {
  label: string;
};

export type LocalizedProjectContentBlock =
  | (Omit<MarkdownContentBlock, "title" | "body"> & {
      title: string;
      body: string;
    })
  | (Omit<FeatureGridContentBlock, "title" | "items"> & {
      title: string;
      items: Array<Omit<FeatureGridItem, "title" | "description"> & {
        title: string;
        description: string;
      }>;
    })
  | (Omit<ArchitectureFlowContentBlock, "title" | "steps"> & {
      title: string;
      steps: Array<Omit<ArchitectureFlowStep, "label"> & { label: string }>;
    })
  | (Omit<ModuleListContentBlock, "title" | "items"> & {
      title: string;
      items: Array<Omit<ModuleListItem, "title" | "description"> & {
        title: string;
        description: string;
      }>;
    })
  | (Omit<CiCdFlowContentBlock, "title" | "steps"> & {
      title: string;
      steps: Array<Omit<CiCdFlowStep, "label" | "description"> & {
        label: string;
        description?: string;
      }>;
    })
  | (Omit<ImageGalleryContentBlock, "title" | "images"> & {
      title: string;
      images: Array<Omit<GalleryImage, "alt" | "caption"> & {
        alt: string;
        caption?: string;
      }>;
    })
  | (Omit<MetricCardsContentBlock, "title" | "metrics"> & {
      title: string;
      metrics: Array<Omit<MetricCard, "label" | "description"> & {
        label: string;
        description?: string;
      }>;
    })
  | (Omit<LinkGroupContentBlock, "title" | "links"> & {
      title: string;
      links: LocalizedProjectLink[];
    });

export type LocalizedProject = Omit<
  Project,
  | "title"
  | "subtitle"
  | "role"
  | "description"
  | "statusLabels"
  | "highlights"
  | "links"
  | "contentBlocks"
> & {
  locale: Locale;
  title: string;
  subtitle: string;
  role: string;
  description: string;
  statusLabels: string[];
  highlights: string[];
  links: LocalizedProjectLink[];
  contentBlocks: LocalizedProjectContentBlock[];
};

export type LocalizedAchievement = Omit<
  Achievement,
  "title" | "description"
> & {
  locale: Locale;
  title: string;
  description: string;
};

export type LocalizedCertificate = Omit<
  Certificate,
  "title" | "issuer" | "description"
> & {
  locale: Locale;
  title: string;
  issuer: string;
  description: string;
};

export type LocalizedBlogPost = Omit<
  BlogPost,
  "title" | "summary" | "content"
> & {
  locale: Locale;
  title: string;
  summary: string;
  content: string;
};

export type LocalizedContactLink = Omit<ContactLink, "label"> & {
  locale: Locale;
  label: string;
};

export type LocalizedSiteSettings = SiteSettings & {
  locale: Locale;
};

export type HomeData = {
  profile: LocalizedProfile;
  skillGroups: LocalizedSkillGroup[];
  featuredProjects: LocalizedProject[];
  achievements: LocalizedAchievement[];
  certificates: LocalizedCertificate[];
  blogPosts: LocalizedBlogPost[];
  contactLinks: LocalizedContactLink[];
  siteSettings: LocalizedSiteSettings;
};

export type PublicMediaAsset = {
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
