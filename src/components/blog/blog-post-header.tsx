import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { Locale, LocalizedBlogPost } from "@/types/portfolio";

type BlogPostHeaderLabels = {
  backToBlog: string;
  minuteRead: string;
  publishedLabel: string;
  readingTimeLabel: string;
  tagsLabel: string;
};

type BlogPostHeaderProps = {
  labels: BlogPostHeaderLabels;
  locale: Locale;
  post: LocalizedBlogPost;
};

function formatDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function BlogPostHeader({
  labels,
  locale,
  post,
}: BlogPostHeaderProps) {
  return (
    <section className="border-b border-border bg-muted/25 py-12 sm:py-16 lg:py-20">
      <Container>
        <div className="mx-auto max-w-4xl">
          <Link
            className="mb-8 inline-flex items-center gap-2 font-mono text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="/blog"
          >
            <MaterialIcon className="text-base" name="arrow_back" />
            {labels.backToBlog}
          </Link>

          <div className="mb-5 flex flex-wrap gap-2" aria-label={labels.tagsLabel}>
            {post.tags.map((tag) => (
              <Badge key={tag} size="md" variant="primary">
                {tag}
              </Badge>
            ))}
          </div>

          <h1 className="text-4xl font-semibold leading-tight tracking-normal text-foreground sm:text-5xl lg:text-6xl">
            {post.title}
          </h1>
          <p className="mt-6 text-base leading-8 text-muted-foreground sm:text-lg">
            {post.summary}
          </p>

          <div className="mt-8 flex flex-wrap gap-4 border-t border-border pt-6 font-mono text-xs text-muted-foreground">
            <span>
              {labels.publishedLabel}:{" "}
              <time dateTime={post.publishedAt}>
                {formatDate(post.publishedAt, locale)}
              </time>
            </span>
            <span aria-hidden="true">/</span>
            <span>
              {labels.readingTimeLabel}: {post.readingTimeMinutes}{" "}
              {labels.minuteRead}
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
