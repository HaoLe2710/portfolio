"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type NavLinkProps = {
  href: string;
  label: string;
  onClick?: () => void;
  variant?: "desktop" | "mobile";
};

function isActivePath(pathname: string, href: string) {
  const pathOnly = href.split("#")[0] || "/";

  if (pathOnly === "/") {
    return pathname === "/";
  }

  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

export function NavLink({
  href,
  label,
  onClick,
  variant = "desktop",
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = isActivePath(pathname, href);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "desktop" &&
          "relative py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
        variant === "desktop" &&
          isActive &&
          "text-foreground after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-primary",
        variant === "mobile" &&
          "flex min-h-11 items-center border-b border-border text-base font-medium text-foreground hover:text-primary",
        variant === "mobile" && isActive && "text-primary"
      )}
      href={href}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}
