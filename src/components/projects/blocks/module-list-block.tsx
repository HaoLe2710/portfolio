import { Card } from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import { BlockSection } from "./block-section";

type ModuleListBlockData = Extract<
  LocalizedProjectContentBlock,
  { type: "MODULE_LIST" }
>;

type ModuleListBlockProps = {
  block: ModuleListBlockData;
};

export function ModuleListBlock({ block }: ModuleListBlockProps) {
  if (block.items.length === 0) {
    return null;
  }

  return (
    <BlockSection icon="view_module" title={block.title}>
      <div className="grid gap-4 lg:grid-cols-2">
        {block.items.map((item) => (
          <Card className="p-6" interactive key={item.id}>
            <div className="flex gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                <MaterialIcon className="text-2xl" name={item.icon} />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-normal text-card-foreground">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </BlockSection>
  );
}
