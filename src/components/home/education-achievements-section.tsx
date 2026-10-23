import { AnimatedSection } from "@/components/ui/animated-section";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { MaterialIcon } from "@/components/ui/material-icon";
import { SectionTitle } from "@/components/ui/section-title";
import type { LocalizedAchievement, LocalizedProfile } from "@/types/portfolio";

type EducationLabels = {
  title: string;
  description: string;
  achievements: string;
  major: string;
  gpa: string;
};

export function EducationAchievementsSection({
  achievements,
  labels,
  profile,
}: {
  achievements: LocalizedAchievement[];
  labels: EducationLabels;
  profile: LocalizedProfile;
}) {
  return (
    <section id="education" className="border-y border-border bg-card/35 py-20">
      <Container>
        <AnimatedSection>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionTitle
                description={labels.description}
                icon="school"
                title={labels.title}
              />
              <Card className="mt-8 rounded-lg p-6">
                <p className="text-xl font-semibold text-card-foreground">
                  {profile.university}
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="font-mono text-xs uppercase text-muted-foreground">
                      {labels.major}
                    </p>
                    <p className="mt-1 font-medium text-card-foreground">
                      {profile.major}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs uppercase text-muted-foreground">
                      {labels.gpa}
                    </p>
                    <p className="mt-1 font-medium text-card-foreground">
                      {profile.gpa}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
            <div>
              <h3 className="mb-5 text-2xl font-semibold text-foreground">
                {labels.achievements}
              </h3>
              <div className="grid gap-4">
                {achievements.map((achievement) => (
                  <Card className="rounded-lg p-5" interactive key={achievement.id}>
                    <div className="flex gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                        <MaterialIcon className="text-2xl" name={achievement.icon} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-card-foreground">
                          {achievement.title}
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {achievement.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
