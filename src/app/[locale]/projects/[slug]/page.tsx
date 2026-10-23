import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectDetailLayout } from "@/components/projects/project-detail-layout";
import { routing } from "@/i18n/routing";
import {
  getProjects,
  getProjectBySlug,
  normalizeLocale,
} from "@/lib/portfolio-service";
import { createSeoMetadata } from "@/lib/seo";

type ProjectDetailPageProps = Readonly<{
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}>;

export const dynamicParams = false;

export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const locale = routing.locales.find((item) => item === params.locale);

  if (!locale) {
    return [];
  }

  const projects = await getProjects(locale);

  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: ProjectDetailPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const [project, projects] = await Promise.all([
    getProjectBySlug(locale, slug),
    getTranslations({ locale, namespace: "projects" }),
  ]);

  if (!project) {
    return createSeoMetadata({
      description: projects("notFoundDescription"),
      locale,
      path: `/projects/${slug}`,
      title: projects("notFoundTitle"),
    });
  }

  return createSeoMetadata({
    description: project.description,
    locale,
    path: `/projects/${project.slug}`,
    title: `${project.title} | ${projects("title")}`,
  });
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  setRequestLocale(locale);

  const [project, projects, actions] = await Promise.all([
    getProjectBySlug(locale, slug),
    getTranslations("projects"),
    getTranslations("actions"),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ProjectDetailLayout
      labels={{
        backToProjects: projects("backToProjects"),
        repositoryLinksLabel: projects("repositoryLinksLabel"),
        roleLabel: projects("roleLabel"),
        techStackLabel: projects("techStackLabel"),
        viewProjectLinks: projects("viewProjectLinks"),
        viewRepository: actions("viewRepository"),
      }}
      project={project}
    />
  );
}
