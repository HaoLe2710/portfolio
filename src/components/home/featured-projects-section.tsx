import { AnimatedSection } from "@/components/ui/animated-section";
import { Container } from "@/components/ui/container";
import { SectionTitle } from "@/components/ui/section-title";
import type { LocalizedProject } from "@/types/portfolio";
import { FeaturedProjectCard } from "./featured-project-card";

type FeaturedProjectsLabels = {
  title: string;
  description: string;
  role: string;
  highlights: string;
  viewDetails: string;
};

export function FeaturedProjectsSection({
  labels,
  projects,
}: {
  labels: FeaturedProjectsLabels;
  projects: LocalizedProject[];
}) {
  return (
    <section id="projects" className="py-20">
      <Container>
        <AnimatedSection>
          <SectionTitle
            description={labels.description}
            icon="folder_code"
            title={labels.title}
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {projects.map((project) => (
              <FeaturedProjectCard
                key={project.id}
                labels={{
                  highlights: labels.highlights,
                  role: labels.role,
                  viewDetails: labels.viewDetails,
                }}
                project={project}
              />
            ))}
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
