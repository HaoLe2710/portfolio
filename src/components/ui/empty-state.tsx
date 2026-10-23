import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "./material-icon";

export type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  action,
  className,
  description,
  icon = "inbox",
  title,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "flex min-h-64 flex-col items-center justify-center border border-dashed border-border bg-card px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-5 flex size-12 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
        <MaterialIcon className="text-3xl" name={icon} />
      </div>
      <h2 className="text-xl font-semibold tracking-normal text-card-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
