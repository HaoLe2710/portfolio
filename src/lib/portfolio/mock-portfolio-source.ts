import { mockPortfolio } from "@/data/mock-portfolio";
import type { HomeData, Locale } from "@/types/portfolio";
import {
  localizeAchievement,
  localizeBlogPost,
  localizeCertificate,
  localizeContactLink,
  localizeProfile,
  localizeProject,
  localizeSiteSettings,
  localizeSkillGroup,
} from "./portfolio-adapter";
import type { PortfolioSource } from "./portfolio-source";

export const mockPortfolioSource: PortfolioSource = {
  async getAchievements(locale) {
    return mockPortfolio.achievements.map((achievement) =>
      localizeAchievement(achievement, locale)
    );
  },

  async getBlogPostBySlug(locale, slug) {
    const blogPost = mockPortfolio.blogPosts.find((item) => item.slug === slug);

    return blogPost ? localizeBlogPost(blogPost, locale) : null;
  },

  async getBlogPosts(locale) {
    return mockPortfolio.blogPosts.map((blogPost) =>
      localizeBlogPost(blogPost, locale)
    );
  },

  async getCertificates(locale) {
    return mockPortfolio.certificates.map((certificate) =>
      localizeCertificate(certificate, locale)
    );
  },

  async getContactLinks(locale) {
    return mockPortfolio.contactLinks.map((contactLink) =>
      localizeContactLink(contactLink, locale)
    );
  },

  async getFeaturedProjects(locale) {
    const projects = await this.getProjects(locale);

    return projects.filter((project) => project.featured);
  },

  async getHomeData(locale: Locale): Promise<HomeData> {
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
    return localizeProfile(mockPortfolio.profile, locale);
  },

  async getProjectBySlug(locale, slug) {
    const project = mockPortfolio.projects.find((item) => item.slug === slug);

    return project ? localizeProject(project, locale) : null;
  },

  async getProjects(locale) {
    return mockPortfolio.projects.map((project) =>
      localizeProject(project, locale)
    );
  },

  async getSiteSettings(locale) {
    return localizeSiteSettings(mockPortfolio.siteSettings, locale);
  },

  async getSkillGroups(locale) {
    return mockPortfolio.skillGroups.map((skillGroup) =>
      localizeSkillGroup(skillGroup, locale)
    );
  },
};
