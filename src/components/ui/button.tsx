import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonVariantOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariantOptions & {
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    isLoading?: boolean;
  };

const baseButtonClasses =
  "inline-flex shrink-0 items-center justify-center gap-2 border font-medium tracking-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  secondary:
    "border-secondary bg-secondary text-secondary-foreground hover:border-primary/40 hover:bg-secondary/80",
  outline:
    "border-border bg-background text-foreground hover:border-primary hover:text-primary",
  ghost:
    "border-transparent bg-transparent text-foreground hover:bg-muted hover:text-primary",
  link: "border-transparent bg-transparent p-0 text-primary underline-offset-4 hover:underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "h-10 w-10 p-0 text-lg",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: ButtonVariantOptions = {}) {
  return cn(baseButtonClasses, variantClasses[variant], sizeClasses[size], className);
}

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  leftIcon,
  rightIcon,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      className={buttonVariants({ variant, size, className })}
      disabled={isDisabled}
      type={type}
      {...props}
    >
      {isLoading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading ? rightIcon : null}
    </button>
  );
}
