import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { ExternalLinkButton } from "@/components/ui/external-link-button";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { LocalizedProject } from "@/types/portfolio";
import { ProjectTechStack } from "./project-tech-stack";

type ProjectHeroLabels = {
  backToProjects: string;
  repositoryLinksLabel: string;
  roleLabel: string;
  techStackLabel: string;
  viewRepository: string;
};

type ProjectHeroProps = {
  labels: ProjectHeroLabels;
  project: LocalizedProject;
};

export function ProjectHero({ labels, project }: ProjectHeroProps) {
  return (
    <section className="border-b border-border bg-muted/25 py-12 sm:py-16 lg:py-20">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="max-w-4xl">
            <Link
              className="mb-8 inline-flex items-center gap-2 font-mono text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/projects"
            >
              <MaterialIcon className="text-base" name="arrow_back" />
              {labels.backToProjects}
            </Link>

            <div className="mb-5 flex flex-wrap gap-2">
              {project.statusLabels.map((label) => (
                <Badge key={label} size="md" variant="primary">
                  {label}
                </Badge>
              ))}
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-normal text-foreground sm:text-5xl lg:text-6xl">
              {project.title}
            </h1>
            <p className="mt-5 text-xl font-medium leading-8 text-primary sm:text-2xl">
              {project.subtitle}
            </p>
            <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
              {project.description}
            </p>

            <div className="mt-8 grid gap-5 border-y border-border py-6 sm:grid-cols-2">
              <div>
                <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">
                  {labels.roleLabel}
                </p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {project.role}
                </p>
              </div>
              <div>
                <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">
                  {labels.techStackLabel}
                </p>
                <div className="mt-3">
                  <ProjectTechStack
                    limit={project.techStack.length}
                    technologies={project.techStack}
                  />
                </div>
              </div>
            </div>
          </div>

          <aside className="border border-border bg-card p-6 text-card-foreground shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                <MaterialIcon name="hub" />
              </div>
              <div>
                <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">
                  {labels.repositoryLinksLabel}
                </p>
              </div>
            </div>

            {project.links.length > 0 ? (
              <div className="flex flex-col gap-3">
                {project.links.map((link, index) => (
                  <ExternalLinkButton
                    aria-label={`${labels.viewRepository}: ${link.label}`}
                    className="w-full rounded-md"
                    href={link.href}
                    icon={link.icon}
                    key={link.id}
                    label={link.label}
                    variant={index === 0 ? "primary" : "outline"}
                  />
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </Container>
    </section>
  );
}
