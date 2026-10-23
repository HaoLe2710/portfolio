import { getDataSourceMode, isApiMode } from "@/lib/data-source";
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
import { apiPortfolioSource } from "./portfolio/api-portfolio-source";
import { mockPortfolioSource } from "./portfolio/mock-portfolio-source";
import type { LocaleInput, PortfolioSource } from "./portfolio/portfolio-source";

const FALLBACK_LOCALE: Locale = "en";
const SUPPORTED_LOCALES = new Set<Locale>(["en", "vi"]);

export function normalizeLocale(locale: LocaleInput): Locale {
  return SUPPORTED_LOCALES.has(locale as Locale)
    ? (locale as Locale)
    : FALLBACK_LOCALE;
}

function getPrimarySource(): PortfolioSource {
  return isApiMode() ? apiPortfolioSource : mockPortfolioSource;
}

function logFallback(functionName: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.warn(
    `[portfolio-service] ${getDataSourceMode()} source failed in ${functionName}; falling back to mock data.`,
    error
  );
}

async function withMockFallback<TResult>(
  functionName: string,
  locale: LocaleInput,
  fetcher: (source: PortfolioSource, locale: Locale) => Promise<TResult>
): Promise<TResult> {
  const normalizedLocale = normalizeLocale(locale);
  const primarySource = getPrimarySource();

  if (primarySource === mockPortfolioSource) {
    return fetcher(mockPortfolioSource, normalizedLocale);
  }

  try {
    return await fetcher(primarySource, normalizedLocale);
  } catch (error) {
    if (process.env.NODE_ENV !== "development") {
      throw error;
    }

    logFallback(functionName, error);

    return fetcher(mockPortfolioSource, normalizedLocale);
  }
}

export async function getProfile(
  locale: LocaleInput
): Promise<LocalizedProfile> {
  return withMockFallback("getProfile", locale, (source, normalizedLocale) =>
    source.getProfile(normalizedLocale)
  );
}

export async function getSkillGroups(
  locale: LocaleInput
): Promise<LocalizedSkillGroup[]> {
  return withMockFallback("getSkillGroups", locale, (source, normalizedLocale) =>
    source.getSkillGroups(normalizedLocale)
  );
}

export async function getProjects(
  locale: LocaleInput
): Promise<LocalizedProject[]> {
  return withMockFallback("getProjects", locale, (source, normalizedLocale) =>
    source.getProjects(normalizedLocale)
  );
}

export async function getFeaturedProjects(
  locale: LocaleInput
): Promise<LocalizedProject[]> {
  return withMockFallback(
    "getFeaturedProjects",
    locale,
    (source, normalizedLocale) => source.getFeaturedProjects(normalizedLocale)
  );
}

export async function getProjectBySlug(
  locale: LocaleInput,
  slug: string
): Promise<LocalizedProject | null> {
  return withMockFallback(
    "getProjectBySlug",
    locale,
    (source, normalizedLocale) =>
      source.getProjectBySlug(normalizedLocale, slug)
  );
}

export async function getAchievements(
  locale: LocaleInput
): Promise<LocalizedAchievement[]> {
  return withMockFallback("getAchievements", locale, (source, normalizedLocale) =>
    source.getAchievements(normalizedLocale)
  );
}

export async function getCertificates(
  locale: LocaleInput
): Promise<LocalizedCertificate[]> {
  return withMockFallback("getCertificates", locale, (source, normalizedLocale) =>
    source.getCertificates(normalizedLocale)
  );
}

export async function getBlogPosts(
  locale: LocaleInput
): Promise<LocalizedBlogPost[]> {
  return withMockFallback("getBlogPosts", locale, (source, normalizedLocale) =>
    source.getBlogPosts(normalizedLocale)
  );
}

export async function getBlogPostBySlug(
  locale: LocaleInput,
  slug: string
): Promise<LocalizedBlogPost | null> {
  return withMockFallback(
    "getBlogPostBySlug",
    locale,
    (source, normalizedLocale) =>
      source.getBlogPostBySlug(normalizedLocale, slug)
  );
}

export async function getContactLinks(
  locale: LocaleInput
): Promise<LocalizedContactLink[]> {
  return withMockFallback("getContactLinks", locale, (source, normalizedLocale) =>
    source.getContactLinks(normalizedLocale)
  );
}

export async function getSiteSettings(
  locale: LocaleInput
): Promise<LocalizedSiteSettings> {
  return withMockFallback("getSiteSettings", locale, (source, normalizedLocale) =>
    source.getSiteSettings(normalizedLocale)
  );
}

export async function getHomeData(locale: LocaleInput): Promise<HomeData> {
  return withMockFallback("getHomeData", locale, (source, normalizedLocale) =>
    source.getHomeData(normalizedLocale)
  );
}
