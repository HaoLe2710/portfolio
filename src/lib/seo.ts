import type { Metadata } from "next";
import { routing, type AppLocale } from "@/i18n/routing";

export const SITE_AUTHOR = "Le Ngoc Hao";
export const SITE_NAME = "Hao.dev";
export const DEFAULT_TITLE = "Le Ngoc Hao | Java Backend Developer";

export function shouldIndexSite() {
  const configuredValue = process.env.NEXT_PUBLIC_ROBOTS_INDEX;

  if (process.env.CF_PAGES === "1") {
    if (configuredValue !== "true" && configuredValue !== "false") {
      throw new Error(
        "Set NEXT_PUBLIC_ROBOTS_INDEX to true for Production and false for Preview in Cloudflare Pages."
      );
    }

    return configuredValue === "true";
  }

  return configuredValue !== "false";
}

export function getRobotsMetadata(): Metadata["robots"] {
  const index = shouldIndexSite();

  return {
    follow: true,
    googleBot: {
      follow: true,
      index,
    },
    index,
  };
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (process.env.CF_PAGES === "1" && !configuredUrl) {
    throw new Error(
      "Set NEXT_PUBLIC_SITE_URL in Cloudflare Pages build settings before deploying."
    );
  }

  const rawUrl =
    configuredUrl || process.env.CF_PAGES_URL || "http://localhost:3000";

  try {
    const siteUrl = new URL(rawUrl);

    if (!(["http:", "https:"] as string[]).includes(siteUrl.protocol)) {
      throw new Error("URL protocol must be http or https.");
    }

    if (siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash) {
      throw new Error("URL must contain only the site origin.");
    }

    return siteUrl;
  } catch (error) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be an absolute http(s) site origin.",
      { cause: error }
    );
  }
}

export function createPageTitle(title?: string) {
  return title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
}

function normalizePath(pathWithoutLocale = "/") {
  if (!pathWithoutLocale || pathWithoutLocale === "/") {
    return "";
  }

  return pathWithoutLocale.startsWith("/")
    ? pathWithoutLocale
    : `/${pathWithoutLocale}`;
}

export function getLocalizedPath(locale: AppLocale, pathWithoutLocale = "/") {
  return `/${locale}${normalizePath(pathWithoutLocale)}`;
}

export function getAbsoluteUrl(path = "/") {
  return new URL(path, getSiteUrl()).toString();
}

export function getLocalizedAlternates(
  locale: AppLocale,
  pathWithoutLocale = "/"
): Metadata["alternates"] {
  return {
    canonical: getLocalizedPath(locale, pathWithoutLocale),
    languages: Object.fromEntries(
      routing.locales.map((targetLocale) => [
        targetLocale,
        getLocalizedPath(targetLocale, pathWithoutLocale),
      ])
    ),
  };
}

function getOpenGraphLocale(locale: AppLocale) {
  return locale === "vi" ? "vi_VN" : "en_US";
}

export function createOpenGraphMetadata({
  description,
  locale,
  path,
  title,
  type = "website",
}: {
  description: string;
  locale: AppLocale;
  path?: string;
  title: string;
  type?: "article" | "profile" | "website";
}): NonNullable<Metadata["openGraph"]> {
  return {
    alternateLocale: routing.locales
      .filter((targetLocale) => targetLocale !== locale)
      .map((targetLocale) => getOpenGraphLocale(targetLocale)),
    description,
    locale: getOpenGraphLocale(locale),
    siteName: SITE_NAME,
    title,
    type,
    url: getLocalizedPath(locale, path),
  };
}

export function createSeoMetadata({
  description,
  locale,
  path = "/",
  title,
  type = "website",
}: {
  description: string;
  locale: AppLocale;
  path?: string;
  title: string;
  type?: "article" | "profile" | "website";
}): Metadata {
  return {
    alternates: getLocalizedAlternates(locale, path),
    description,
    openGraph: createOpenGraphMetadata({
      description,
      locale,
      path,
      title,
      type,
    }),
    title,
    twitter: {
      card: "summary",
      description,
      title,
    },
  };
}
