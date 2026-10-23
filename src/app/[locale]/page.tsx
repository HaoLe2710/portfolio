import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AboutSection } from "@/components/home/about-section";
import { CertificatesSection } from "@/components/home/certificates-section";
import { ContactSection } from "@/components/home/contact-section";
import { EducationAchievementsSection } from "@/components/home/education-achievements-section";
import { FeaturedProjectsSection } from "@/components/home/featured-projects-section";
import { HeroSection } from "@/components/home/hero-section";
import { LatestBlogSection } from "@/components/home/latest-blog-section";
import { SkillsSection } from "@/components/home/skills-section";
import {
  getHomeData,
  getProfile,
  normalizeLocale,
} from "@/lib/portfolio-service";
import { createSeoMetadata } from "@/lib/seo";

type HomePageProps = Readonly<{
  params: Promise<{
    locale: string;
  }>;
}>;

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  const profile = await getProfile(locale);

  return createSeoMetadata({
    description: profile.summary,
    locale,
    path: "/",
    title: profile.fullName,
    type: "profile",
  });
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);

  setRequestLocale(locale);

  const homeData = await getHomeData(locale);
  const [hero, actions, about, skills, projects, education, certificates, blog, contact] =
    await Promise.all([
      getTranslations("hero"),
      getTranslations("actions"),
      getTranslations("about"),
      getTranslations("skills"),
      getTranslations("projects"),
      getTranslations("education"),
      getTranslations("certificates"),
      getTranslations("blog"),
      getTranslations("contact"),
    ]);

  return (
    <>
      <HeroSection
        labels={{
          architectureApiGateway: hero("architectureApiGateway"),
          architectureCache: hero("architectureCache"),
          architectureCloud: hero("architectureCloud"),
          architectureDatabase: hero("architectureDatabase"),
          architectureServices: hero("architectureServices"),
          architectureTitle: hero("architectureTitle"),
          downloadCv: actions("downloadCv"),
          greeting: hero("eyebrow"),
          viewProjects: actions("viewProjects"),
          viewSource: actions("viewSource"),
        }}
        locale={locale}
        profile={homeData.profile}
        skillGroups={homeData.skillGroups}
      />
      <AboutSection
        labels={{
          description: about("description"),
          focus: about("focus"),
          gpa: about("gpa"),
          location: about("location"),
          major: about("major"),
          title: about("title"),
          university: about("university"),
        }}
        profile={homeData.profile}
      />
      <SkillsSection
        labels={{
          description: skills("description"),
          title: skills("title"),
        }}
        skillGroups={homeData.skillGroups}
      />
      <FeaturedProjectsSection
        labels={{
          description: projects("featuredDescription"),
          highlights: projects("highlights"),
          role: projects("role"),
          title: projects("featuredTitle"),
          viewDetails: actions("viewDetails"),
        }}
        projects={homeData.featuredProjects}
      />
      <EducationAchievementsSection
        achievements={homeData.achievements}
        labels={{
          achievements: education("achievements"),
          description: education("description"),
          gpa: about("gpa"),
          major: about("major"),
          title: education("title"),
        }}
        profile={homeData.profile}
      />
      <CertificatesSection
        certificates={homeData.certificates}
        labels={{
          description: certificates("description"),
          learningItem: certificates("learningItem"),
          officialCertificate: certificates("officialCertificate"),
          title: certificates("title"),
        }}
      />
      <LatestBlogSection
        labels={{
          description: blog("latestDescription"),
          readMore: actions("readMore"),
          readingTime: blog("readingTime"),
          title: blog("latestTitle"),
        }}
        locale={locale}
        posts={homeData.blogPosts}
      />
      <ContactSection
        contactLinks={homeData.contactLinks}
        labels={{
          contactMe: actions("contactMe"),
          description: contact("description"),
          downloadCv: actions("downloadCv"),
          openGithub: actions("openGithub"),
          sendEmail: actions("sendEmail"),
          title: contact("title"),
        }}
        profile={homeData.profile}
      />
    </>
  );
}
