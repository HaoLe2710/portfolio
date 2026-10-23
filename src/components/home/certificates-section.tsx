import { AnimatedSection } from "@/components/ui/animated-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { MaterialIcon } from "@/components/ui/material-icon";
import { SectionTitle } from "@/components/ui/section-title";
import type { LocalizedCertificate } from "@/types/portfolio";

type CertificatesLabels = {
  title: string;
  description: string;
  learningItem: string;
  officialCertificate: string;
};

export function CertificatesSection({
  certificates,
  labels,
}: {
  certificates: LocalizedCertificate[];
  labels: CertificatesLabels;
}) {
  return (
    <section id="certificates" className="py-20">
      <Container>
        <AnimatedSection>
          <SectionTitle
            description={labels.description}
            icon="workspace_premium"
            title={labels.title}
          />
          {certificates.length === 0 ? (
            <EmptyState
              className="mt-10 rounded-lg"
              description={labels.description}
              title={labels.title}
            />
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {certificates.map((certificate) => (
                <Card className="rounded-lg p-6" key={certificate.id}>
                  <MaterialIcon
                    className="text-3xl text-primary"
                    name={certificate.icon}
                  />
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Badge variant={certificate.official ? "primary" : "muted"}>
                      {certificate.official
                        ? labels.officialCertificate
                        : labels.learningItem}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-card-foreground">
                    {certificate.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {certificate.issuer}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {certificate.description}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </AnimatedSection>
      </Container>
    </section>
  );
}
