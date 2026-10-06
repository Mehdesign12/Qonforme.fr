import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { METIERS } from "@/lib/pseo/metiers";
import { GUIDES } from "@/lib/pseo/guides";
import { MODELES } from "@/lib/pseo/modeles";
import { GLOSSAIRE } from "@/lib/pseo/glossaire";
import { INSTALLATIONS } from "@/lib/pseo/installation";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://qonforme.fr";

  // Fetch published blog posts for dynamic entries
  const admin = createAdminClient();
  const { data: posts } = await admin
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("is_published", true);

  // Articles marqués « noindex » par PushRank (colonne robots, migration 20261006) : hors du sitemap.
  // Sans la migration, la requête échoue et aucun article n'est retiré.
  const { data: noindex } = await admin
    .from("blog_posts")
    .select("slug")
    .eq("is_published", true)
    .eq("robots->>index", "false");
  const hidden = new Set((noindex ?? []).map((p) => p.slug));

  const blogPostEntries: MetadataRoute.Sitemap = (posts ?? []).filter((post) => !hidden.has(post.slug)).map((post) => ({
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
      url: `${baseUrl}/facturation`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guide`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/modele`,
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
      url: `${baseUrl}/plan-du-site`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/forgot-password`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    // Outils gratuits
    {
      url: `${baseUrl}/outils`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...[
      "calculateur-tva",
      "simulateur-charges-auto-entrepreneur",
      "verification-siret",
      "generateur-facture-gratuite",
      "generateur-devis-gratuit",
      "calculateur-penalites-retard",
      "verificateur-mentions-facture",
      "verificateur-conformite-facture",
      "simulateur-seuil-tva",
      "simulateur-revenu-net",
      "generateur-numero-facture",
      "generateur-conditions-paiement",
    ].map((slug) => ({
      url: `${baseUrl}/outils/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...blogPostEntries,
    ...metierEntries,
    ...guideEntries,
    ...modeleEntries,
    // S'installer à son compte (métiers du bâtiment)
    {
      url: `${baseUrl}/devenir-a-son-compte`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    ...INSTALLATIONS.map((i) => ({
      url: `${baseUrl}/devenir-a-son-compte/${i.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // Glossaire
    {
      url: `${baseUrl}/glossaire`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...GLOSSAIRE.map((t) => ({
      url: `${baseUrl}/glossaire/${t.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // pSEO géolocalisé : métier x ville — SUSPENDU (voir Audit SEO 09/04/2026)
    // Les 780 pages sont considérées comme thin content par Google.
    // À réintroduire quand le domaine a 100+ pages indexées, avec contenu unique.
  ];
}
