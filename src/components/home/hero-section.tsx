import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ExternalLinkButton } from "@/components/ui/external-link-button";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";
import type { LocalizedProfile, LocalizedSkillGroup } from "@/types/portfolio";
import { BackendArchitectureVisual } from "./backend-architecture-visual";

type HeroLabels = {
  greeting: string;
  viewProjects: string;
  downloadCv: string;
  viewSource: string;
  architectureTitle: string;
  architectureApiGateway: string;
  architectureDatabase: string;
  architectureCache: string;
  architectureCloud: string;
  architectureServices: string;
};

type HeroSectionProps = {
  labels: HeroLabels;
  locale: string;
  profile: LocalizedProfile;
  skillGroups: LocalizedSkillGroup[];
};

export function HeroSection({
  labels,
  locale,
  profile,
  skillGroups,
}: HeroSectionProps) {
  const skillPreview = skillGroups
    .flatMap((group) => group.skills)
    .slice(0, 7);

  return (
    <section id="home" className="border-b border-border">
      <Container className="grid min-h-[calc(100vh-4rem)] items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <p className="font-mono text-sm text-primary">{labels.greeting}</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-normal text-foreground sm:text-6xl">
            {profile.fullName}
          </h1>
          <p className="mt-5 text-2xl font-semibold text-foreground/90">
            {profile.role}
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {profile.summary}
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {skillPreview.map((skill) => (
              <Badge key={skill.id} variant="secondary">
                {skill.name}
              </Badge>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "primary" }), "rounded-md")}
              href="/projects"
            >
              {labels.viewProjects}
              <MaterialIcon name="arrow_forward" />
            </Link>
            <a
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-md")}
              href={profile.cvUrl}
            >
              <MaterialIcon name="description" />
              {labels.downloadCv}
            </a>
            <ExternalLinkButton
              className="rounded-md"
              href={profile.githubUrl}
              icon="code"
              label={labels.viewSource}
              size="lg"
              variant="ghost"
            />
          </div>
        </div>
        <BackendArchitectureVisual
          labels={{
            title: labels.architectureTitle,
            apiGateway: labels.architectureApiGateway,
            database: labels.architectureDatabase,
            cache: labels.architectureCache,
            cloud: labels.architectureCloud,
            services: labels.architectureServices,
          }}
        />
        <span className="sr-only">{locale}</span>
      </Container>
    </section>
  );
}
