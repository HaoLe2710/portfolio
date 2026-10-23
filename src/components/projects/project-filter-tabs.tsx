"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LocalizedProject } from "@/types/portfolio";
import { ProjectsGrid } from "./projects-grid";
import type { ProjectCardLabels } from "./project-card";

type ProjectFilter = "all" | "backend" | "iot" | "cicd" | "cloud";

type ProjectFilterTabsProps = {
  emptyState: {
    description: string;
    title: string;
  };
  filters: Record<ProjectFilter, string>;
  labels: ProjectCardLabels;
  projects: LocalizedProject[];
};

const filterMatchers: Record<ProjectFilter, (project: LocalizedProject) => boolean> = {
  all: () => true,
  backend: (project) => hasProjectTerm(project, "backend"),
  iot: (project) => hasProjectTerm(project, "iot"),
  cicd: (project) => hasProjectTerm(project, "ci/cd") || hasProjectTerm(project, "github actions"),
  cloud: (project) => hasProjectTerm(project, "cloud") || hasProjectTerm(project, "aws"),
};

function hasProjectTerm(project: LocalizedProject, term: string) {
  const normalizedTerm = term.toLowerCase();
  const haystack = [
    project.role,
    project.description,
    ...project.statusLabels,
    ...project.techStack,
    ...project.highlights,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedTerm);
}

export function ProjectFilterTabs({
  emptyState,
  filters,
  labels,
  projects,
}: ProjectFilterTabsProps) {
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>("all");
  const filteredProjects = useMemo(
    () => projects.filter(filterMatchers[activeFilter]),
    [activeFilter, projects]
  );
  const filterEntries = Object.entries(filters) as Array<[ProjectFilter, string]>;

  return (
    <div>
      <div
        aria-label="Project filters"
        className="mb-8 flex flex-wrap gap-2"
        role="group"
      >
        {filterEntries.map(([filter, label]) => {
          const isActive = filter === activeFilter;

          return (
            <Button
              aria-pressed={isActive}
              className="rounded-md"
              key={filter}
              onClick={() => setActiveFilter(filter)}
              size="sm"
              variant={isActive ? "primary" : "outline"}
            >
              {label}
            </Button>
          );
        })}
      </div>
      <ProjectsGrid
        emptyState={emptyState}
        labels={labels}
        projects={filteredProjects}
      />
    </div>
  );
}
