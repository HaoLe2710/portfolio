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

function releaseBuildHeaders(): Record<string, string> | undefined {
  const releaseId = process.env.PORTFOLIO_RELEASE_ID?.trim();
  const buildToken = process.env.PORTFOLIO_BUILD_TOKEN?.trim();
  if (Boolean(releaseId) !== Boolean(buildToken)) {
    throw new Error("Portfolio release builds require both PORTFOLIO_RELEASE_ID and PORTFOLIO_BUILD_TOKEN.");
  }
  if (!releaseId) return undefined;
  if (process.env.CF_PAGES !== "1") {
    throw new Error("Portfolio release snapshot access is only available during a Cloudflare Pages build.");
  }
  return {
    "x-portfolio-release-id": releaseId,
    "x-portfolio-build-token": buildToken!,
  };
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
      localeParams(locale),
      releaseBuildHeaders()
    );

    return mapPublicAchievements(achievements, locale);
  },

  async getBlogPostBySlug(locale, slug) {
    const blogPost = await getNullableBySlug(() =>
      publicGet<PublicBlogPostDetailResponse>(
        endpoints.blogPost(slug),
        localeParams(locale),
        releaseBuildHeaders()
      )
    );

    return blogPost ? mapPublicBlogDetail(blogPost, locale) : null;
  },

  async getBlogPosts(locale) {
    const blogPosts = await publicGet<PublicBlogPostSummaryResponse[]>(
      endpoints.blogPosts,
      localeParams(locale),
      releaseBuildHeaders()
    );

    return mapPublicBlogSummaries(blogPosts, locale);
  },

  async getCertificates(locale) {
    const certificates = await publicGet<PublicCertificateResponse[]>(
      endpoints.certificates,
      localeParams(locale),
      releaseBuildHeaders()
    );

    return mapPublicCertificates(certificates, locale);
  },

  async getContactLinks(locale) {
    const contactLinks = await publicGet<PublicContactLinkResponse[]>(
      endpoints.contactLinks,
      localeParams(locale),
      releaseBuildHeaders()
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
      localeParams(locale),
      releaseBuildHeaders()
    );

    return mapPublicProfile(profile);
  },

  async getProjectBySlug(locale, slug) {
    const project = await getNullableBySlug(() =>
      publicGet<PublicProjectDetailResponse>(
        endpoints.project(slug),
        localeParams(locale),
        releaseBuildHeaders()
      )
    );

    return project ? mapPublicProjectDetail(project, locale) : null;
  },

  async getProjects(locale) {
    const projects = await publicGet<PublicProjectSummaryResponse[]>(
      endpoints.projects,
      localeParams(locale),
      releaseBuildHeaders()
    );

    return mapPublicProjectSummaries(projects, locale);
  },

  async getSiteSettings(locale) {
    const siteSettings = await publicGet<PublicSiteSettingsResponse>(
      endpoints.siteSettings,
      localeParams(locale),
      releaseBuildHeaders()
    );

    return mapPublicSiteSettings(siteSettings);
  },

  async getSkillGroups(locale) {
    const skillGroups = await publicGet<PublicSkillGroupResponse[]>(
      endpoints.skillGroups,
      localeParams(locale),
      releaseBuildHeaders()
    );

    return mapPublicSkillGroups(skillGroups, locale);
  },
};

export async function getPublicCvMediaAsset(
  locale: Locale
): Promise<PublicMediaAsset> {
  const mediaAsset = await publicGet<PublicMediaAssetResponse>(
    "/public/media-assets/cv",
    localeParams(locale),
    releaseBuildHeaders()
  );

  return mapPublicMediaAsset(mediaAsset);
}
