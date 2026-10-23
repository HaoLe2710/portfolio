import { EmptyState } from "@/components/ui/empty-state";
import type { LocalizedProject } from "@/types/portfolio";
import { ProjectCard, type ProjectCardLabels } from "./project-card";

type ProjectsGridProps = {
  emptyState: {
    description: string;
    title: string;
  };
  labels: ProjectCardLabels;
  projects: LocalizedProject[];
};

export function ProjectsGrid({ emptyState, labels, projects }: ProjectsGridProps) {
  if (projects.length === 0) {
    return (
      <EmptyState
        className="rounded-lg"
        description={emptyState.description}
        icon="folder_off"
        title={emptyState.title}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard key={project.id} labels={labels} project={project} />
      ))}
    </div>
  );
}
