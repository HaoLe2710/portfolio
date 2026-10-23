import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BlogList } from "@/components/blog/blog-list";
import { BlogPageHeader } from "@/components/blog/blog-page-header";
import { Container } from "@/components/ui/container";
import { getBlogPosts, normalizeLocale } from "@/lib/portfolio-service";
import { createSeoMetadata } from "@/lib/seo";

type BlogPageProps = Readonly<{
  params: Promise<{
    locale: string;
  }>;
}>;

export async function generateMetadata({
  params,
}: BlogPageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  const blog = await getTranslations({ locale, namespace: "blog" });

  return createSeoMetadata({
    description: blog("pageDescription"),
    locale,
    path: "/blog",
    title: blog("title"),
  });
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  setRequestLocale(locale);

  const [posts, blog, actions] = await Promise.all([
    getBlogPosts(locale),
    getTranslations("blog"),
    getTranslations("actions"),
  ]);

  return (
    <>
      <BlogPageHeader
        description={blog("pageDescription")}
        eyebrow={blog("pageEyebrow")}
        title={blog("pageTitle")}
      />
      <section className="py-14 sm:py-16">
        <Container>
          <BlogList
            labels={{
              emptyDescription: blog("emptyDescription"),
              emptyTitle: blog("emptyTitle"),
              readMore: actions("readMore"),
              readingTimeLabel: blog("minuteRead"),
            }}
            locale={locale}
            posts={posts}
          />
        </Container>
      </section>
    </>
  );
}
