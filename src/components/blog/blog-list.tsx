import { AnimatedSection } from "@/components/ui/animated-section";
import { EmptyState } from "@/components/ui/empty-state";
import type { Locale, LocalizedBlogPost } from "@/types/portfolio";
import { BlogCard, type BlogCardLabels } from "./blog-card";

type BlogListLabels = BlogCardLabels & {
  emptyDescription: string;
  emptyTitle: string;
};

type BlogListProps = {
  labels: BlogListLabels;
  locale: Locale;
  posts: LocalizedBlogPost[];
};

export function BlogList({ labels, locale, posts }: BlogListProps) {
  if (posts.length === 0) {
    return (
      <EmptyState
        description={labels.emptyDescription}
        icon="article"
        title={labels.emptyTitle}
      />
    );
  }

  return (
    <AnimatedSection>
      <div className="grid gap-5 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogCard
            key={post.id}
            labels={{
              readMore: labels.readMore,
              readingTimeLabel: labels.readingTimeLabel,
            }}
            locale={locale}
            post={post}
          />
        ))}
      </div>
    </AnimatedSection>
  );
}
