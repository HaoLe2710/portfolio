import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getContactLinks, getProfile } from "@/lib/portfolio-service";
import { Container } from "@/components/ui/container";
import { MaterialIcon } from "@/components/ui/material-icon";

const quickLinks = [
  { href: "/", labelKey: "home" },
  { href: "/projects", labelKey: "projects" },
  { href: "/blog", labelKey: "blog" },
  { href: "/#contact", labelKey: "contact" },
] as const;

export async function SiteFooter() {
  const locale = await getLocale();
  const common = await getTranslations("common");
  const navigation = await getTranslations("navigation");
  const footer = await getTranslations("footer");
  const profile = await getProfile(locale);
  const contactLinks = (await getContactLinks(locale)).filter(
    (link) => link.href && link.type !== "linkedin"
  );

  return (
    <footer className="border-t border-border bg-card/40">
      <Container className="grid gap-10 py-10 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div className="max-w-xl">
          <Link
            className="text-xl font-bold tracking-normal text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="/"
          >
            {common("siteName")}
          </Link>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {footer("description")}
          </p>
          <p className="mt-4 text-sm font-medium text-foreground">
            {profile.role}
          </p>
        </div>
        <nav aria-label={footer("quickLinks")}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {footer("quickLinks")}
          </h2>
          <div className="grid gap-2">
            {quickLinks.map((item) => (
              <Link
                className="text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href={item.href}
                key={item.href}
              >
                {navigation(item.labelKey)}
              </Link>
            ))}
          </div>
        </nav>
        <nav aria-label={footer("contact")}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {footer("contact")}
          </h2>
          <div className="grid gap-2">
            {contactLinks.map((link) => {
              const isExternal = link.href.startsWith("http");

              return (
                <a
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href={link.href}
                  key={link.id}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  target={isExternal ? "_blank" : undefined}
                >
                  <MaterialIcon className="text-base" name={link.icon} />
                  {link.label}
                </a>
              );
            })}
          </div>
        </nav>
      </Container>
      <div className="border-t border-border">
        <Container className="flex min-h-14 flex-col justify-center gap-1 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{footer("copyright")}</span>
          <span>{footer("builtWith")}</span>
        </Container>
      </div>
    </footer>
  );
}
