import { IconCard } from "@/components/ui/icon-card";
import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import { BlockSection } from "./block-section";

type FeatureGridBlockData = Extract<
  LocalizedProjectContentBlock,
  { type: "FEATURE_GRID" }
>;

type FeatureGridBlockProps = {
  block: FeatureGridBlockData;
};

export function FeatureGridBlock({ block }: FeatureGridBlockProps) {
  if (block.items.length === 0) {
    return null;
  }

  return (
    <BlockSection icon="dashboard_customize" title={block.title}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {block.items.map((item) => (
          <IconCard
            description={item.description}
            icon={item.icon}
            interactive
            key={item.id}
            title={item.title}
          />
        ))}
      </div>
    </BlockSection>
  );
}
