import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/providers/theme-provider";
import { routing } from "@/i18n/routing";
import { getProfile } from "@/lib/portfolio-service";
import {
  createOpenGraphMetadata,
  DEFAULT_TITLE,
  getRobotsMetadata,
  getLocalizedAlternates,
  getSiteUrl,
  SITE_AUTHOR,
} from "@/lib/seo";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = hasLocale(routing.locales, localeParam)
    ? localeParam
    : routing.defaultLocale;
  const [common, profile] = await Promise.all([
    getTranslations({ locale, namespace: "common" }),
    getProfile(locale),
  ]);
  const description = common("defaultDescription");

  return {
    authors: [{ name: profile.fullName, url: profile.githubUrl }],
    creator: SITE_AUTHOR,
    description,
    metadataBase: getSiteUrl(),
    openGraph: createOpenGraphMetadata({
      description,
      locale,
      path: "/",
      title: DEFAULT_TITLE,
      type: "profile",
    }),
    robots: getRobotsMetadata(),
    title: {
      default: DEFAULT_TITLE,
      template: common("titleTemplate"),
    },
    alternates: getLocalizedAlternates(locale, "/"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <ThemeProvider>
            <a
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-primary focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary focus:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="#main-content"
            >
              Skip to content
            </a>
            <SiteHeader />
            <main id="main-content" className="flex flex-1 flex-col">
              {children}
            </main>
            <SiteFooter />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
