import { AnimatedSection } from "@/components/ui/animated-section";
import { Container } from "@/components/ui/container";
import { SectionTitle } from "@/components/ui/section-title";

type ProjectsPageHeaderProps = {
  description: string;
  eyebrow: string;
  title: string;
};

export function ProjectsPageHeader({
  description,
  eyebrow,
  title,
}: ProjectsPageHeaderProps) {
  return (
    <section className="border-b border-border py-16 sm:py-20">
      <Container>
        <AnimatedSection>
          <SectionTitle
            align="center"
            description={description}
            eyebrow={eyebrow}
            icon="folder_code"
            title={title}
          />
        </AnimatedSection>
      </Container>
    </section>
  );
}
