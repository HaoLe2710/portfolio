"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  compact?: boolean;
  label?: string;
};

export function LanguageSwitcher({ compact = false, label }: LanguageSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const t = useTranslations("actions");
  const ariaLabel = label ?? t("switchLanguage");

  return (
    <nav aria-label={ariaLabel} className="flex items-center gap-1">
      {routing.locales.map((targetLocale) => {
        const isActive = targetLocale === locale;

        return (
          <Link
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "inline-flex items-center justify-center border border-border text-xs font-semibold uppercase tracking-normal transition-colors",
              "hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              compact ? "h-9 min-w-9 px-2" : "h-9 min-w-10 px-3",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground"
            )}
            href={pathname}
            key={targetLocale}
            locale={targetLocale}
          >
            {targetLocale}
          </Link>
        );
      })}
    </nav>
  );
}
