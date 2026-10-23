import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { MaterialIcon } from "./material-icon";

export type IconCardProps = HTMLAttributes<HTMLDivElement> & {
  icon: string;
  title: string;
  description: string;
  interactive?: boolean;
};

export function IconCard({
  className,
  description,
  icon,
  interactive = false,
  title,
  ...props
}: IconCardProps) {
  return (
    <Card
      className={cn("p-6", className)}
      interactive={interactive}
      {...props}
    >
      <div className="mb-5 flex size-11 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
        <MaterialIcon className="text-2xl" name={icon} />
      </div>
      <h3 className="text-xl font-semibold tracking-normal text-card-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </Card>
  );
}
