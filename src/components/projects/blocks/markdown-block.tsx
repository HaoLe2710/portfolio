import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import { BlockSection } from "./block-section";

type MarkdownBlockData = Extract<
  LocalizedProjectContentBlock,
  { type: "MARKDOWN" }
>;

type MarkdownBlockProps = {
  block: MarkdownBlockData;
};

export function MarkdownBlock({ block }: MarkdownBlockProps) {
  return (
    <BlockSection icon="article" title={block.title}>
      <Card className="p-6 sm:p-8">
        <MarkdownContent className="max-w-4xl" content={block.body} />
      </Card>
    </BlockSection>
  );
}
