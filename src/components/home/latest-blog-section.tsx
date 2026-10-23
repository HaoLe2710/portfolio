import { Link } from "@/i18n/navigation";
import { AnimatedSection } from "@/components/ui/animated-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { MaterialIcon } from "@/components/ui/material-icon";
import { SectionTitle } from "@/components/ui/section-title";
import type { LocalizedBlogPost, Locale } from "@/types/portfolio";

type BlogLabels = {
  title: string;
  description: string;
  readMore: string;
  readingTime: string;
};

function formatDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function LatestBlogSection({
  labels,
  locale,
  posts,
}: {
  labels: BlogLabels;
  locale: Locale;
  posts: LocalizedBlogPost[];
}) {
  return (
    <section id="blog" className="border-y border-border bg-card/35 py-20">
      <Container>
        <AnimatedSection>
          <SectionTitle
            align="center"
            description={labels.description}
            icon="article"
            title={labels.title}
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {posts.slice(0, 3).map((post) => (
              <Card className="flex rounded-lg p-6" interactive key={post.id}>
                <div className="flex flex-col">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {post.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <h3 className="text-xl font-semibold leading-7 text-card-foreground">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {post.summary}
                  </p>
                  <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(post.publishedAt, locale)}</span>
                    <span aria-hidden="true">/</span>
                    <span>
                      {post.readingTimeMinutes} {labels.readingTime}
                    </span>
                  </div>
                  <Link
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    href={`/blog/${post.slug}`}
                  >
                    {labels.readMore}
                    <MaterialIcon className="text-base" name="arrow_forward" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
