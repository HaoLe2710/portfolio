import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/portfolio-service";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

const navigationItems = [
  { href: "/", labelKey: "home" },
  { href: "/#about", labelKey: "about" },
  { href: "/#skills", labelKey: "skills" },
  { href: "/projects", labelKey: "projects" },
  { href: "/#education", labelKey: "education" },
  { href: "/blog", labelKey: "blog" },
  { href: "/#contact", labelKey: "contact" },
] as const;

export async function SiteHeader() {
  const locale = await getLocale();
  const profile = await getProfile(locale);
  const common = await getTranslations("common");
  const navigation = await getTranslations("navigation");
  const actions = await getTranslations("actions");
  const navItems = navigationItems.map((item) => ({
    href: item.href,
    label: navigation(item.labelKey),
  }));
  const actionLabels = {
    closeMenu: actions("closeMenu"),
    downloadCv: actions("downloadCv"),
    openMenu: actions("openMenu"),
    switchLanguage: actions("switchLanguage"),
    toggleTheme: actions("toggleTheme"),
    viewSource: actions("viewSource"),
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/88 backdrop-blur-xl">
      <Container className="relative flex min-h-16 items-center justify-between gap-4">
        <Link
          className="shrink-0 text-xl font-bold tracking-normal text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href="/"
        >
          {common("siteName")}
        </Link>
        <nav
          aria-label={navigation("home")}
          className="hidden items-center gap-6 lg:flex"
        >
          {navItems.map((item) => (
            <NavLink
              href={item.href}
              key={item.href}
              label={item.label}
            />
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "hidden rounded-md lg:inline-flex"
            )}
            href={profile.cvUrl}
          >
            <MaterialIcon name="description" />
            {actions("downloadCv")}
          </a>
          <a
            aria-label={actions("viewSource")}
            className={cn(
              buttonVariants({ size: "icon", variant: "ghost" }),
              "hidden rounded-md sm:inline-flex"
            )}
            href={profile.githubUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <MaterialIcon name="code" />
          </a>
          <div className="hidden items-center gap-1 lg:flex">
            <LanguageSwitcher label={actions("switchLanguage")} />
            <ThemeToggle label={actions("toggleTheme")} />
          </div>
          <MobileMenu
            actions={actionLabels}
            brand={common("siteName")}
            cvUrl={profile.cvUrl}
            githubUrl={profile.githubUrl}
            navigationItems={navItems}
          />
        </div>
      </Container>
    </header>
  );
}
