import { AnimatedSection } from "@/components/ui/animated-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { MaterialIcon } from "@/components/ui/material-icon";
import { SectionTitle } from "@/components/ui/section-title";
import type { LocalizedSkillGroup } from "@/types/portfolio";

type SkillsLabels = {
  title: string;
  description: string;
};

export function SkillsSection({
  labels,
  skillGroups,
}: {
  labels: SkillsLabels;
  skillGroups: LocalizedSkillGroup[];
}) {
  return (
    <section id="skills" className="border-y border-border bg-card/35 py-20">
      <Container>
        <AnimatedSection>
          <SectionTitle
            align="center"
            description={labels.description}
            icon="terminal"
            title={labels.title}
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {skillGroups.map((group) => (
              <Card className="rounded-lg p-6" interactive key={group.id}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                    <MaterialIcon className="text-2xl" name={group.icon} />
                  </div>
                  <h3 className="text-xl font-semibold text-card-foreground">
                    {group.name}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.skills.map((skill) => (
                    <Badge key={skill.id} variant="muted">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
