import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "./material-icon";
import {
  buttonVariants,
  type ButtonSize,
  type ButtonVariant,
} from "./button";

export type ExternalLinkButtonProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "href"
> & {
  href: string;
  label: string;
  icon?: string;
  hideExternalIcon?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function ExternalLinkButton({
  className,
  hideExternalIcon = false,
  href,
  icon,
  label,
  size = "md",
  variant = "outline",
  ...props
}: ExternalLinkButtonProps) {
  return (
    <a
      aria-label={props["aria-label"] ?? label}
      className={cn(buttonVariants({ variant, size }), className)}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      {...props}
    >
      {icon ? <MaterialIcon className="text-base" name={icon} /> : null}
      <span>{label}</span>
      {!hideExternalIcon ? (
        <MaterialIcon className="text-base" name="open_in_new" />
      ) : null}
    </a>
  );
}
