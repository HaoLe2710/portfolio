import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { MarkdownContent } from "@/components/ui/markdown-content";

type BlogPostContentProps = {
  content: string;
};

export function BlogPostContent({ content }: BlogPostContentProps) {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <Card className="mx-auto max-w-4xl p-6 sm:p-8">
          <MarkdownContent content={content} />
        </Card>
      </Container>
    </section>
  );
}
