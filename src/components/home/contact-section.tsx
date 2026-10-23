import { AnimatedSection } from "@/components/ui/animated-section";
import { Container } from "@/components/ui/container";
import { ExternalLinkButton } from "@/components/ui/external-link-button";
import { SectionTitle } from "@/components/ui/section-title";
import { buttonVariants } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";
import type { LocalizedContactLink, LocalizedProfile } from "@/types/portfolio";

type ContactLabels = {
  title: string;
  description: string;
  contactMe: string;
  downloadCv: string;
  openGithub: string;
  sendEmail: string;
};

export function ContactSection({
  contactLinks,
  labels,
  profile,
}: {
  contactLinks: LocalizedContactLink[];
  labels: ContactLabels;
  profile: LocalizedProfile;
}) {
  const email = contactLinks.find((link) => link.type === "email");
  const github = contactLinks.find((link) => link.type === "github");

  return (
    <section id="contact" className="py-20">
      <Container>
        <AnimatedSection>
          <div className="rounded-lg border border-border bg-card p-8 shadow-[var(--shadow-soft)] md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <SectionTitle
                description={labels.description}
                icon="mail"
                title={labels.title}
              />
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                {email ? (
                  <a
                    aria-label={`${labels.sendEmail}: ${email.value}`}
                    className={cn(buttonVariants({ size: "lg", variant: "primary" }), "rounded-md")}
                    href={email.href}
                  >
                    <MaterialIcon name={email.icon} />
                    {labels.contactMe}
                  </a>
                ) : null}
                {github ? (
                  <ExternalLinkButton
                    aria-label={`${labels.openGithub}: ${github.value}`}
                    className="rounded-md"
                    href={github.href}
                    icon={github.icon}
                    label={github.label}
                    size="lg"
                    variant="outline"
                  />
                ) : null}
                <a
                  aria-label={labels.downloadCv}
                  className={cn(buttonVariants({ size: "lg", variant: "ghost" }), "rounded-md")}
                  download
                  href={profile.cvUrl}
                >
                  <MaterialIcon name="description" />
                  {labels.downloadCv}
                </a>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
