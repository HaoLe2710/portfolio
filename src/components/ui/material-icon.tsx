import { cn } from "@/lib/utils";

type MaterialIconProps = Readonly<{
  name: string;
  className?: string;
  filled?: boolean;
  label?: string;
}>;

export function MaterialIcon({
  name,
  className,
  filled = false,
  label,
}: MaterialIconProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("material-symbols-outlined select-none", className)}
      role={label ? "img" : undefined}
      style={{ fontVariationSettings: `"FILL" ${filled ? 1 : 0}` }}
    >
      {name}
    </span>
  );
}
