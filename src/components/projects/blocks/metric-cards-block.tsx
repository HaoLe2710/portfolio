import { Card } from "@/components/ui/card";
import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import { BlockSection } from "./block-section";

type MetricCardsBlockData = Extract<
  LocalizedProjectContentBlock,
  { type: "METRIC_CARDS" }
>;

type MetricCardsBlockProps = {
  block: MetricCardsBlockData;
};

export function MetricCardsBlock({ block }: MetricCardsBlockProps) {
  if (block.metrics.length === 0) {
    return null;
  }

  return (
    <BlockSection icon="query_stats" title={block.title}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.metrics.map((metric) => (
          <Card className="p-6" interactive key={metric.id}>
            <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-normal text-primary">
              {metric.value}
            </p>
            {metric.description ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {metric.description}
              </p>
            ) : null}
          </Card>
        ))}
      </div>
    </BlockSection>
  );
}
