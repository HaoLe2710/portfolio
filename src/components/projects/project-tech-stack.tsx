import { Badge } from "@/components/ui/badge";

type ProjectTechStackProps = {
  technologies: string[];
  limit?: number;
};

export function ProjectTechStack({
  limit = 8,
  technologies,
}: ProjectTechStackProps) {
  const visibleTechnologies = technologies.slice(0, limit);
  const hiddenCount = Math.max(technologies.length - visibleTechnologies.length, 0);

  return (
    <div className="flex flex-wrap gap-2">
      {visibleTechnologies.map((technology) => (
        <Badge key={technology} variant="muted">
          {technology}
        </Badge>
      ))}
      {hiddenCount > 0 ? <Badge variant="outline">+{hiddenCount}</Badge> : null}
    </div>
  );
}
