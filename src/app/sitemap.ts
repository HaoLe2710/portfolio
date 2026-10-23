import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getBlogPosts, getProjects } from "@/lib/portfolio-service";
import { getAbsoluteUrl, getLocalizedPath } from "@/lib/seo";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["/", "/projects", "/blog"];
  const projectEntries = await Promise.all(
    routing.locales.map(async (locale) => {
      const projects = await getProjects(locale);

      return projects.map((project) => ({
        url: getAbsoluteUrl(
          getLocalizedPath(locale, `/projects/${project.slug}`)
        ),
      }));
    })
  );
  const blogEntries = await Promise.all(
    routing.locales.map(async (locale) => {
      const posts = await getBlogPosts(locale);

      return posts.map((post) => ({
        lastModified: new Date(post.publishedAt),
        url: getAbsoluteUrl(getLocalizedPath(locale, `/blog/${post.slug}`)),
      }));
    })
  );

  return [
    ...routing.locales.flatMap((locale) =>
      staticPaths.map((path) => ({
        url: getAbsoluteUrl(getLocalizedPath(locale, path)),
      }))
    ),
    ...projectEntries.flat(),
    ...blogEntries.flat(),
  ];
}
