import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { LocalizedProject } from "@/types/portfolio";

type FeaturedProjectCardProps = {
  labels: {
    highlights: string;
    role: string;
    viewDetails: string;
  };
  project: LocalizedProject;
};

export function FeaturedProjectCard({
  labels,
  project,
}: FeaturedProjectCardProps) {
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
        <CardTitle>{project.title}</CardTitle>
        <p className="text-base leading-7 text-muted-foreground">
          {project.subtitle}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div>
          <p className="font-mono text-xs uppercase text-muted-foreground">
            {labels.role}
          </p>
          <p className="mt-1 text-sm font-medium text-card-foreground">
            {project.role}
          </p>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {project.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {project.techStack.slice(0, 7).map((tech) => (
            <Badge key={tech} variant="muted">
              {tech}
            </Badge>
          ))}
        </div>
        <div>
          <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">
            {labels.highlights}
          </p>
          <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
            {project.highlights.slice(0, 2).map((highlight) => (
              <li className="flex gap-2" key={highlight}>
                <MaterialIcon className="mt-1 text-base text-primary" name="check_circle" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <Link
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
