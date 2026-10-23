import type { ReactNode } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";

type BlockSectionProps = {
  children: ReactNode;
  className?: string;
  icon?: string;
  title: string;
};

export function BlockSection({
  children,
  className,
  icon,
  title,
}: BlockSectionProps) {
  return (
    <section className={cn("space-y-6 py-8 sm:py-10", className)}>
      <SectionTitle
        className="max-w-4xl"
        icon={icon}
        title={title}
      />
      {children}
    </section>
  );
}
