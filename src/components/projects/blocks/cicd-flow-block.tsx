import { Card } from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import { BlockSection } from "./block-section";

type CiCdFlowBlockData = Extract<
  LocalizedProjectContentBlock,
  { type: "CI_CD_FLOW" }
>;

type CiCdFlowBlockProps = {
  block: CiCdFlowBlockData;
};

const stepIcons = ["commit", "settings", "deployed_code", "cloud_done"];

export function CiCdFlowBlock({ block }: CiCdFlowBlockProps) {
  if (block.steps.length === 0) {
    return null;
  }

  return (
    <BlockSection icon="rocket_launch" title={block.title}>
      <Card className="p-5 sm:p-6">
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {block.steps.map((step, index) => (
            <li
              className="relative border border-border bg-background p-5"
              key={step.id}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
                  <MaterialIcon
                    className="text-xl"
                    name={stepIcons[index] ?? "check_circle"}
                  />
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-base font-semibold leading-6 text-foreground">
                {step.label}
              </h3>
              {step.description ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>
    </BlockSection>
  );
}
