"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/material-icon";

type ThemeToggleProps = {
  label: string;
};

export function ThemeToggle({ label }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      aria-label={label}
      className="rounded-md"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon"
      variant="ghost"
    >
      <MaterialIcon className="text-xl dark:hidden" name="dark_mode" />
      <MaterialIcon className="hidden text-xl dark:inline-block" name="light_mode" />
    </Button>
  );
}
