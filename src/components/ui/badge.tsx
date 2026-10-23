import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "primary" | "secondary" | "outline" | "muted";
export type BadgeSize = "sm" | "md";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-border bg-card text-card-foreground",
  primary: "border-primary/30 bg-primary/10 text-primary",
  secondary: "border-secondary bg-secondary text-secondary-foreground",
  outline: "border-border bg-transparent text-foreground",
  muted: "border-transparent bg-muted text-muted-foreground",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export function Badge({
  className,
  size = "sm",
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border font-mono font-medium leading-none tracking-normal",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
