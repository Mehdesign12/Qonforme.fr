import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { METIERS } from "@/lib/pseo/metiers";
import { GUIDES } from "@/lib/pseo/guides";
import { MODELES } from "@/lib/pseo/modeles";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://qonforme.fr";

  // Fetch published blog posts for dynamic entries
  const admin = createAdminClient();
  const { data: posts } = await admin
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("is_published", true);

  const blogPostEntries: MetadataRoute.Sitemap = (posts ?? []).map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // pSEO pages
  const metierEntries: MetadataRoute.Sitemap = METIERS.map((m) => ({
    url: `${baseUrl}/facturation/${m.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const guideEntries: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: `${baseUrl}/guide/${g.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const modeleEntries: MetadataRoute.Sitemap = MODELES.map((m) => ({
    url: `${baseUrl}/modele/${m.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/demo`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/mentions-legales`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cgu`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/confidentialite`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/forgot-password`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    ...blogPostEntries,
    ...metierEntries,
    ...guideEntries,
    ...modeleEntries,
  ];
}
