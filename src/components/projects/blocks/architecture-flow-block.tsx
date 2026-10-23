import { Fragment } from "react";
import { Card } from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import { BlockSection } from "./block-section";

type ArchitectureFlowBlockData = Extract<
  LocalizedProjectContentBlock,
  { type: "ARCHITECTURE_FLOW" }
>;

type ArchitectureFlowBlockProps = {
  block: ArchitectureFlowBlockData;
};

export function ArchitectureFlowBlock({ block }: ArchitectureFlowBlockProps) {
  if (block.steps.length === 0) {
    return null;
  }

  return (
    <BlockSection icon="account_tree" title={block.title}>
      <Card className="overflow-hidden p-4 sm:p-6">
        <div className="hidden items-stretch gap-3 lg:flex">
          {block.steps.map((step, index) => (
            <Fragment key={step.id}>
              <div className="flex min-h-32 flex-1 flex-col items-center justify-center border border-border bg-background p-4 text-center transition-colors hover:border-primary/40">
                <MaterialIcon className="text-3xl text-primary" name={step.icon} />
                <p className="mt-4 font-mono text-sm font-semibold leading-6 text-foreground">
                  {step.label}
                </p>
              </div>
              {index < block.steps.length - 1 ? (
                <div className="flex items-center text-primary/70" aria-hidden="true">
                  <MaterialIcon name="arrow_forward" />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>

        <div className="space-y-3 lg:hidden">
          {block.steps.map((step, index) => (
            <div className="flex gap-4" key={step.id}>
              <div className="flex flex-col items-center">
                <div className="flex size-11 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
                  <MaterialIcon className="text-2xl" name={step.icon} />
                </div>
                {index < block.steps.length - 1 ? (
                  <div className="h-full min-h-8 w-px bg-border" aria-hidden="true" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 border border-border bg-background p-4">
                <p className="font-mono text-sm font-semibold leading-6 text-foreground">
                  {step.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </BlockSection>
  );
}
