import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExternalLinkButton } from "@/components/ui/external-link-button";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { LocalizedProject } from "@/types/portfolio";
import { ProjectTechStack } from "./project-tech-stack";

export type ProjectCardLabels = {
  highlightsLabel: string;
  linksLabel: string;
  openProject: string;
  roleLabel: string;
  techStackLabel: string;
  viewDetails: string;
  viewRepository: string;
};

type ProjectCardProps = {
  labels: ProjectCardLabels;
  project: LocalizedProject;
};

export function ProjectCard({ labels, project }: ProjectCardProps) {
  return (
    <Card className="flex h-full flex-col rounded-lg" interactive>
      <CardHeader>
        <div className="mb-3 flex flex-wrap gap-2">
          {project.statusLabels.map((label) => (
            <Badge key={label} variant="primary">
              {label}
            </Badge>
          ))}
        </div>
        <CardTitle className="text-2xl">{project.title}</CardTitle>
        <p className="text-base leading-7 text-muted-foreground">
          {project.subtitle}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <p className="text-sm leading-6 text-muted-foreground">
          {project.description}
        </p>
        <div>
          <p className="font-mono text-xs uppercase text-muted-foreground">
            {labels.roleLabel}
          </p>
          <p className="mt-1 text-sm font-medium text-card-foreground">
            {project.role}
          </p>
        </div>
        <div>
          <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">
            {labels.techStackLabel}
          </p>
          <ProjectTechStack technologies={project.techStack} />
        </div>
        <div>
          <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">
            {labels.highlightsLabel}
          </p>
          <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
            {project.highlights.slice(0, 4).map((highlight) => (
              <li className="flex gap-2" key={highlight}>
                <MaterialIcon
                  className="mt-1 text-base text-primary"
                  name="check_circle"
                />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
        {project.links.length > 0 ? (
          <div>
            <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">
              {labels.linksLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {project.links.slice(0, 3).map((link) => (
                <ExternalLinkButton
                  aria-label={`${labels.viewRepository}: ${link.label}`}
                  className="rounded-md"
                  href={link.href}
                  key={link.id}
                  label={link.label}
                  size="sm"
                  variant="outline"
                />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="justify-between">
        <Link
          aria-label={`${labels.openProject}: ${project.title}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href={`/projects/${project.slug}`}
        >
          {labels.viewDetails}
          <MaterialIcon className="text-base" name="arrow_forward" />
        </Link>
      </CardFooter>
    </Card>
  );
}
