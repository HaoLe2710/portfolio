"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ExternalLinkButton } from "@/components/ui/external-link-button";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-link";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

export type MobileMenuItem = {
  href: string;
  label: string;
};

export type MobileMenuProps = {
  actions: {
    closeMenu: string;
    downloadCv: string;
    openMenu: string;
    switchLanguage: string;
    toggleTheme: string;
    viewSource: string;
  };
  brand: string;
  cvUrl: string;
  githubUrl: string;
  navigationItems: MobileMenuItem[];
};

export function MobileMenu({
  actions,
  brand,
  cvUrl,
  githubUrl,
  navigationItems,
}: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <Button
        aria-expanded={isOpen}
        aria-label={isOpen ? actions.closeMenu : actions.openMenu}
        className="rounded-md"
        onClick={() => setIsOpen((current) => !current)}
        size="icon"
        variant="ghost"
      >
        <MaterialIcon name={isOpen ? "close" : "menu"} />
      </Button>
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            className="absolute inset-x-0 top-full z-40 border-b border-border bg-background/98 shadow-[var(--shadow-soft)] backdrop-blur-xl"
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="space-y-6 px-5 py-5">
              <div className="flex items-center justify-between">
                <Link
                  className="text-lg font-bold tracking-normal text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href="/"
                  onClick={() => setIsOpen(false)}
                >
                  {brand}
                </Link>
                <div className="flex items-center gap-1">
                  <ThemeToggle label={actions.toggleTheme} />
                  <LanguageSwitcher compact label={actions.switchLanguage} />
                </div>
              </div>
              <nav aria-label={actions.openMenu} className="grid">
                {navigationItems.map((item) => (
                  <NavLink
                    href={item.href}
                    key={item.href}
                    label={item.label}
                    onClick={() => setIsOpen(false)}
                    variant="mobile"
                  />
                ))}
              </nav>
              <div className="grid gap-3">
                <a
                  className={cn(buttonVariants({ variant: "primary" }), "rounded-md")}
                  href={cvUrl}
                  onClick={() => setIsOpen(false)}
                >
                  <MaterialIcon name="description" />
                  {actions.downloadCv}
                </a>
                <ExternalLinkButton
                  className="rounded-md"
                  href={githubUrl}
                  icon="code"
                  label={actions.viewSource}
                  size="md"
                  variant="outline"
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
