import { isApiError, publicGet } from "@/lib/api";
import type {
  HomeData,
  Locale,
  PublicMediaAsset,
} from "@/types/portfolio";
import type {
  PublicAchievementResponse,
  PublicBlogPostDetailResponse,
  PublicBlogPostSummaryResponse,
  PublicCertificateResponse,
  PublicContactLinkResponse,
  PublicMediaAssetResponse,
  PublicProfileResponse,
  PublicProjectDetailResponse,
  PublicProjectSummaryResponse,
  PublicSiteSettingsResponse,
  PublicSkillGroupResponse,
} from "@/types/public-api";
import {
  mapPublicAchievements,
  mapPublicBlogDetail,
  mapPublicBlogSummaries,
  mapPublicCertificates,
  mapPublicContactLinks,
  mapPublicMediaAsset,
  mapPublicProfile,
  mapPublicProjectDetail,
  mapPublicProjectSummaries,
  mapPublicSiteSettings,
  mapPublicSkillGroups,
} from "./public-api-adapter";
import type { PortfolioSource } from "./portfolio-source";

const endpoints = {
  achievements: "/public/achievements",
  blogPost: (slug: string) => `/public/blog-posts/${slug}`,
  blogPosts: "/public/blog-posts",
  certificates: "/public/certificates",
  contactLinks: "/public/contact-links",
  profile: "/public/profile",
  project: (slug: string) => `/public/projects/${slug}`,
  projects: "/public/projects",
  siteSettings: "/public/site-settings",
  skillGroups: "/public/skills",
};

function localeParams(locale: Locale) {
  return { locale };
}

async function getNullableBySlug<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export const apiPortfolioSource: PortfolioSource = {
  async getAchievements(locale) {
    const achievements = await publicGet<PublicAchievementResponse[]>(
      endpoints.achievements,
      localeParams(locale)
    );

    return mapPublicAchievements(achievements, locale);
  },

  async getBlogPostBySlug(locale, slug) {
    const blogPost = await getNullableBySlug(() =>
      publicGet<PublicBlogPostDetailResponse>(
        endpoints.blogPost(slug),
        localeParams(locale)
      )
    );

    return blogPost ? mapPublicBlogDetail(blogPost, locale) : null;
  },

  async getBlogPosts(locale) {
    const blogPosts = await publicGet<PublicBlogPostSummaryResponse[]>(
      endpoints.blogPosts,
      localeParams(locale)
    );

    return mapPublicBlogSummaries(blogPosts, locale);
  },

  async getCertificates(locale) {
    const certificates = await publicGet<PublicCertificateResponse[]>(
      endpoints.certificates,
      localeParams(locale)
    );

    return mapPublicCertificates(certificates, locale);
  },

  async getContactLinks(locale) {
    const contactLinks = await publicGet<PublicContactLinkResponse[]>(
      endpoints.contactLinks,
      localeParams(locale)
    );

    return mapPublicContactLinks(contactLinks, locale);
  },

  async getFeaturedProjects(locale) {
    const projects = await this.getProjects(locale);

    return projects.filter((project) => project.featured);
  },

  async getHomeData(locale): Promise<HomeData> {
    const [
      profile,
      skillGroups,
      featuredProjects,
      achievements,
      certificates,
      blogPosts,
      contactLinks,
      siteSettings,
    ] = await Promise.all([
      this.getProfile(locale),
      this.getSkillGroups(locale),
      this.getFeaturedProjects(locale),
      this.getAchievements(locale),
      this.getCertificates(locale),
      this.getBlogPosts(locale),
      this.getContactLinks(locale),
      this.getSiteSettings(locale),
    ]);

    return {
      achievements,
      blogPosts,
      certificates,
      contactLinks,
      featuredProjects,
      profile,
      siteSettings,
      skillGroups,
    };
  },

  async getProfile(locale) {
    const profile = await publicGet<PublicProfileResponse>(
      endpoints.profile,
      localeParams(locale)
    );

    return mapPublicProfile(profile);
  },

  async getProjectBySlug(locale, slug) {
    const project = await getNullableBySlug(() =>
      publicGet<PublicProjectDetailResponse>(
        endpoints.project(slug),
        localeParams(locale)
      )
    );

    return project ? mapPublicProjectDetail(project, locale) : null;
  },

  async getProjects(locale) {
    const projects = await publicGet<PublicProjectSummaryResponse[]>(
      endpoints.projects,
      localeParams(locale)
    );

    return mapPublicProjectSummaries(projects, locale);
  },

  async getSiteSettings(locale) {
    const siteSettings = await publicGet<PublicSiteSettingsResponse>(
      endpoints.siteSettings,
      localeParams(locale)
    );

    return mapPublicSiteSettings(siteSettings);
  },

  async getSkillGroups(locale) {
    const skillGroups = await publicGet<PublicSkillGroupResponse[]>(
      endpoints.skillGroups,
      localeParams(locale)
    );

    return mapPublicSkillGroups(skillGroups, locale);
  },
};

export async function getPublicCvMediaAsset(
  locale: Locale
): Promise<PublicMediaAsset> {
  const mediaAsset = await publicGet<PublicMediaAssetResponse>(
    "/public/media-assets/cv",
    localeParams(locale)
  );

  return mapPublicMediaAsset(mediaAsset);
}
