import { AnimatedSection } from "@/components/ui/animated-section";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SectionTitle } from "@/components/ui/section-title";
import type { LocalizedProfile } from "@/types/portfolio";
import { InfoItem } from "./info-item";

type AboutLabels = {
  title: string;
  description: string;
  location: string;
  university: string;
  major: string;
  gpa: string;
  focus: string;
};

export function AboutSection({
  labels,
  profile,
}: {
  labels: AboutLabels;
  profile: LocalizedProfile;
}) {
  const infoItems = [
    { icon: "location_on", label: labels.location, value: profile.location },
    { icon: "school", label: labels.university, value: profile.university },
    { icon: "menu_book", label: labels.major, value: profile.major },
    { icon: "grade", label: labels.gpa, value: profile.gpa },
    { icon: "center_focus_strong", label: labels.focus, value: profile.focus },
  ];

  return (
    <section id="about" className="py-20">
      <Container>
        <AnimatedSection>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <SectionTitle
              description={labels.description}
              icon="person"
              title={labels.title}
            />
            <Card className="rounded-lg">
              <CardContent className="p-6">
                <p className="text-lg leading-8 text-card-foreground">
                  {profile.about}
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {infoItems.map((item) => (
                    <InfoItem
                      icon={item.icon}
                      key={item.label}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
