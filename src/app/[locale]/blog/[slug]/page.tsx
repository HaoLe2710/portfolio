import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BlogPostContent } from "@/components/blog/blog-post-content";
import { BlogPostHeader } from "@/components/blog/blog-post-header";
import { routing } from "@/i18n/routing";
import {
  getBlogPosts,
  getBlogPostBySlug,
  normalizeLocale,
} from "@/lib/portfolio-service";
import { createSeoMetadata } from "@/lib/seo";

type BlogDetailPageProps = Readonly<{
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}>;

export const dynamicParams = false;

export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const locale = routing.locales.find((item) => item === params.locale);

  if (!locale) {
    return [];
  }

  const posts = await getBlogPosts(locale);

  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogDetailPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const [post, blog] = await Promise.all([
    getBlogPostBySlug(locale, slug),
    getTranslations({ locale, namespace: "blog" }),
  ]);

  if (!post) {
    return createSeoMetadata({
      description: blog("postNotFoundDescription"),
      locale,
      path: `/blog/${slug}`,
      title: blog("postNotFoundTitle"),
    });
  }

  return createSeoMetadata({
    description: post.summary,
    locale,
    path: `/blog/${post.slug}`,
    title: `${post.title} | ${blog("title")}`,
    type: "article",
  });
}

export default async function BlogDetailPage({
  params,
}: BlogDetailPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  setRequestLocale(locale);

  const [post, blog, actions] = await Promise.all([
    getBlogPostBySlug(locale, slug),
    getTranslations("blog"),
    getTranslations("actions"),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <>
      <BlogPostHeader
        labels={{
          backToBlog: actions("backToBlog"),
          minuteRead: blog("minuteRead"),
          publishedLabel: blog("publishedLabel"),
          readingTimeLabel: blog("readingTimeLabel"),
          tagsLabel: blog("tagsLabel"),
        }}
        locale={locale}
        post={post}
      />
      <BlogPostContent content={post.content} />
    </>
  );
}
