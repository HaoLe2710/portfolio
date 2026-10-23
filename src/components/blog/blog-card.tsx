import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { Locale, LocalizedBlogPost } from "@/types/portfolio";

export type BlogCardLabels = {
  readMore: string;
  readingTimeLabel: string;
};

type BlogCardProps = {
  labels: BlogCardLabels;
  locale: Locale;
  post: LocalizedBlogPost;
};

function formatDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function BlogCard({ labels, locale, post }: BlogCardProps) {
  return (
    <Card className="flex h-full flex-col rounded-lg p-6" interactive>
      <article className="flex h-full flex-col">
        <div className="mb-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        <h2 className="text-2xl font-semibold leading-8 tracking-normal text-card-foreground">
          {post.title}
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          {post.summary}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs text-muted-foreground">
          <time dateTime={post.publishedAt}>
            {formatDate(post.publishedAt, locale)}
          </time>
          <span aria-hidden="true">/</span>
          <span>
            {post.readingTimeMinutes} {labels.readingTimeLabel}
          </span>
        </div>

        <Link
          aria-label={`${labels.readMore}: ${post.title}`}
          className="mt-7 inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href={`/blog/${post.slug}`}
        >
          {labels.readMore}
          <MaterialIcon className="text-base" name="arrow_forward" />
        </Link>
      </article>
    </Card>
  );
}
