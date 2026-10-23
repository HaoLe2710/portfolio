/* eslint-disable @next/next/no-img-element */
import { Card } from "@/components/ui/card";
import type { LocalizedProjectContentBlock } from "@/types/portfolio";
import { BlockSection } from "./block-section";

type ImageGalleryBlockData = Extract<
  LocalizedProjectContentBlock,
  { type: "IMAGE_GALLERY" }
>;

type ImageGalleryBlockProps = {
  block: ImageGalleryBlockData;
};

export function ImageGalleryBlock({ block }: ImageGalleryBlockProps) {
  if (block.images.length === 0) {
    return null;
  }

  return (
    <BlockSection icon="image" title={block.title}>
      <div className="grid gap-4 md:grid-cols-2">
        {block.images.map((image) => (
          <Card className="overflow-hidden" key={image.id}>
            <img
              alt={image.alt}
              className="aspect-[16/10] w-full object-cover"
              src={image.src}
            />
            {image.caption ? (
              <p className="p-4 text-sm leading-6 text-muted-foreground">
                {image.caption}
              </p>
            ) : null}
          </Card>
        ))}
      </div>
    </BlockSection>
  );
}
