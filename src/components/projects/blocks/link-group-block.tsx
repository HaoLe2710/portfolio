import { ExternalLinkButton } from "@/components/ui/external-link-button";
import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import { BlockSection } from "./block-section";

type LinkGroupBlockData = Extract<
  LocalizedProjectContentBlock,
  { type: "LINK_GROUP" }
>;

type LinkGroupBlockProps = {
  block: LinkGroupBlockData;
  viewProjectLinksLabel: string;
};

export function LinkGroupBlock({
  block,
  viewProjectLinksLabel,
}: LinkGroupBlockProps) {
  if (block.links.length === 0) {
    return null;
  }

  return (
    <BlockSection icon="link" title={block.title}>
      <div className="flex flex-wrap gap-3">
        {block.links.map((link) => (
          <ExternalLinkButton
            aria-label={`${viewProjectLinksLabel}: ${link.label}`}
            className="rounded-md"
            href={link.href}
            icon={link.icon}
            key={link.id}
            label={link.label}
            variant="outline"
          />
        ))}
      </div>
    </BlockSection>
  );
}
