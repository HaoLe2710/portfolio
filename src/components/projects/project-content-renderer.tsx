import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import { ArchitectureFlowBlock } from "./blocks/architecture-flow-block";
import { CiCdFlowBlock } from "./blocks/cicd-flow-block";
import { FeatureGridBlock } from "./blocks/feature-grid-block";
import { ImageGalleryBlock } from "./blocks/image-gallery-block";
import { LinkGroupBlock } from "./blocks/link-group-block";
import { MarkdownBlock } from "./blocks/markdown-block";
import { MetricCardsBlock } from "./blocks/metric-cards-block";
import { ModuleListBlock } from "./blocks/module-list-block";

type ProjectContentRendererLabels = {
  viewProjectLinks: string;
};

type ProjectContentRendererProps = {
  blocks: LocalizedProjectContentBlock[];
  labels: ProjectContentRendererLabels;
};

type OrderedProjectContentBlock = LocalizedProjectContentBlock & {
  order?: number;
};

function getBlockOrder(block: OrderedProjectContentBlock) {
  return typeof block.order === "number" ? block.order : 0;
}

function renderBlock(
  block: LocalizedProjectContentBlock,
  labels: ProjectContentRendererLabels
) {
  switch (block.type) {
    case "MARKDOWN":
      return <MarkdownBlock block={block} key={block.id} />;
    case "FEATURE_GRID":
      return <FeatureGridBlock block={block} key={block.id} />;
    case "ARCHITECTURE_FLOW":
      return <ArchitectureFlowBlock block={block} key={block.id} />;
    case "MODULE_LIST":
      return <ModuleListBlock block={block} key={block.id} />;
    case "CI_CD_FLOW":
      return <CiCdFlowBlock block={block} key={block.id} />;
    case "IMAGE_GALLERY":
      return <ImageGalleryBlock block={block} key={block.id} />;
    case "METRIC_CARDS":
      return <MetricCardsBlock block={block} key={block.id} />;
    case "LINK_GROUP":
      return (
        <LinkGroupBlock
          block={block}
          key={block.id}
          viewProjectLinksLabel={labels.viewProjectLinks}
        />
      );
    default:
      return null;
  }
}

export function ProjectContentRenderer({
  blocks,
  labels,
}: ProjectContentRendererProps) {
  const orderedBlocks = [...blocks].sort(
    (first, second) =>
      getBlockOrder(first as OrderedProjectContentBlock) -
      getBlockOrder(second as OrderedProjectContentBlock)
  );

  return <>{orderedBlocks.map((block) => renderBlock(block, labels))}</>;
}
