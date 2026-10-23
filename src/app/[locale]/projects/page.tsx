import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AnimatedSection } from "@/components/ui/animated-section";
import { Container } from "@/components/ui/container";
import { ProjectFilterTabs } from "@/components/projects/project-filter-tabs";
import { ProjectsPageHeader } from "@/components/projects/projects-page-header";
import { getProjects, normalizeLocale } from "@/lib/portfolio-service";
import { createSeoMetadata } from "@/lib/seo";

type ProjectsPageProps = Readonly<{
  params: Promise<{
    locale: string;
  }>;
}>;

export async function generateMetadata({
  params,
}: ProjectsPageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  const projects = await getTranslations({ locale, namespace: "projects" });

  return createSeoMetadata({
    description: projects("pageDescription"),
    locale,
    path: "/projects",
    title: projects("title"),
  });
}

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);

  setRequestLocale(locale);

  const [projects, actions] = await Promise.all([
    getTranslations("projects"),
    getTranslations("actions"),
  ]);
  const projectItems = await getProjects(locale);

  return (
    <>
      <ProjectsPageHeader
        description={projects("pageDescription")}
        eyebrow={projects("pageEyebrow")}
        title={projects("pageTitle")}
      />
      <section className="py-14 sm:py-16">
        <Container>
          <AnimatedSection>
            <ProjectFilterTabs
              emptyState={{
                description: projects("emptyDescription"),
                title: projects("emptyTitle"),
              }}
              filters={{
                all: projects("filters.all"),
                backend: projects("filters.backend"),
                cicd: projects("filters.cicd"),
                cloud: projects("filters.cloud"),
                iot: projects("filters.iot"),
              }}
              labels={{
                highlightsLabel: projects("highlightsLabel"),
                linksLabel: projects("linksLabel"),
                openProject: actions("openProject"),
                roleLabel: projects("roleLabel"),
                techStackLabel: projects("techStackLabel"),
                viewDetails: actions("viewDetails"),
                viewRepository: actions("viewRepository"),
              }}
              projects={projectItems}
            />
          </AnimatedSection>
        </Container>
      </section>
    </>
  );
}
