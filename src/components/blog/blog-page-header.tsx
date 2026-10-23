import { AnimatedSection } from "@/components/ui/animated-section";
import { Container } from "@/components/ui/container";
import { MaterialIcon } from "@/components/ui/material-icon";

type BlogPageHeaderProps = {
  description: string;
  eyebrow: string;
  title: string;
};

export function BlogPageHeader({
  description,
  eyebrow,
  title,
}: BlogPageHeaderProps) {
  return (
    <section className="border-b border-border py-16 sm:py-20">
      <Container>
        <AnimatedSection>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-3 flex items-center justify-center gap-2 font-mono text-xs font-semibold uppercase tracking-normal text-primary">
              <MaterialIcon className="text-base" name="article" />
              <span>{eyebrow}</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
              {description}
            </p>
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
