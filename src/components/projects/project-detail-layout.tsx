import { Container } from "@/components/ui/container";
import { ProjectContentRenderer } from "@/components/projects/project-content-renderer";
import { ProjectHero } from "@/components/projects/project-hero";
import type { LocalizedProject } from "@/types/portfolio";

type ProjectDetailLabels = {
  backToProjects: string;
  repositoryLinksLabel: string;
  roleLabel: string;
  techStackLabel: string;
  viewProjectLinks: string;
  viewRepository: string;
};

type ProjectDetailLayoutProps = {
  labels: ProjectDetailLabels;
  project: LocalizedProject;
};

export function ProjectDetailLayout({
  labels,
  project,
}: ProjectDetailLayoutProps) {
  return (
    <>
      <ProjectHero
        labels={{
          backToProjects: labels.backToProjects,
          repositoryLinksLabel: labels.repositoryLinksLabel,
          roleLabel: labels.roleLabel,
          techStackLabel: labels.techStackLabel,
          viewRepository: labels.viewRepository,
        }}
        project={project}
      />
      <Container className="py-8 sm:py-12">
        <ProjectContentRenderer
          blocks={project.contentBlocks}
          labels={{ viewProjectLinks: labels.viewProjectLinks }}
        />
      </Container>
    </>
  );
}
