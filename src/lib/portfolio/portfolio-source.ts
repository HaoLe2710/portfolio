import type {
  HomeData,
  Locale,
  LocalizedAchievement,
  LocalizedBlogPost,
  LocalizedCertificate,
  LocalizedContactLink,
  LocalizedProfile,
  LocalizedProject,
  LocalizedSiteSettings,
  LocalizedSkillGroup,
} from "@/types/portfolio";

export type LocaleInput = Locale | string | undefined;

export type PortfolioSource = {
  getAchievements(locale: Locale): Promise<LocalizedAchievement[]>;
  getBlogPostBySlug(
    locale: Locale,
    slug: string
  ): Promise<LocalizedBlogPost | null>;
  getBlogPosts(locale: Locale): Promise<LocalizedBlogPost[]>;
  getCertificates(locale: Locale): Promise<LocalizedCertificate[]>;
  getContactLinks(locale: Locale): Promise<LocalizedContactLink[]>;
  getFeaturedProjects(locale: Locale): Promise<LocalizedProject[]>;
  getHomeData(locale: Locale): Promise<HomeData>;
  getProfile(locale: Locale): Promise<LocalizedProfile>;
  getProjectBySlug(
    locale: Locale,
    slug: string
  ): Promise<LocalizedProject | null>;
  getProjects(locale: Locale): Promise<LocalizedProject[]>;
  getSiteSettings(locale: Locale): Promise<LocalizedSiteSettings>;
  getSkillGroups(locale: Locale): Promise<LocalizedSkillGroup[]>;
};
