import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "./material-icon";

export type SectionTitleProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  icon?: string;
};

export function SectionTitle({
  align = "left",
  className,
  description,
  eyebrow,
  icon,
  title,
  ...props
}: SectionTitleProps) {
  const isCenter = align === "center";

  return (
    <div
      className={cn(
        "max-w-3xl",
        isCenter && "mx-auto text-center",
        className
      )}
      {...props}
    >
      {(eyebrow || icon) && (
        <div
          className={cn(
            "mb-3 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-normal text-primary",
            isCenter && "justify-center"
          )}
        >
          {icon ? <MaterialIcon className="text-base" name={icon} /> : null}
          {eyebrow ? <span>{eyebrow}</span> : null}
        </div>
      )}
      <h2 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
