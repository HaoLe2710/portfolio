"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type AnimatedSectionProps = {
  as?: "section" | "div";
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function AnimatedSection({
  as = "section",
  children,
  className,
  delay = 0,
}: AnimatedSectionProps) {
  const reduceMotion = useReducedMotion();
  const MotionComponent = as === "div" ? motion.div : motion.section;

  return (
    <MotionComponent
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      transition={{ delay, duration: 0.45, ease: "easeOut" }}
      viewport={{ once: true, margin: "-80px" }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
    >
      {children}
    </MotionComponent>
  );
}
