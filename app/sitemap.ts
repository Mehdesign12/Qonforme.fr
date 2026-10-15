import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { METIERS } from "@/lib/pseo/metiers";
import { GUIDES } from "@/lib/pseo/guides";
import { MODELES } from "@/lib/pseo/modeles";
import { GLOSSAIRE } from "@/lib/pseo/glossaire";
import { INSTALLATIONS } from "@/lib/pseo/installation";

/**
 * Recalculé au plus toutes les heures, et aussitôt après une publication
 * (lib/blog-revalidate.ts). Sans cette durée, la page restait figée environ 28 h.
 */
export const revalidate = 3600

/**
 * Dernière modification réelle du contenu, par adresse (AAAA-MM-JJ, tirées du
 * suivi des modifications de CLAUDE.md). Une adresse absente d'ici n'a pas de
 * `lastmod` : mieux vaut aucune date qu'une fausse, car Google cesse de se
 * fier à un `lastmod` toujours égal à « maintenant » (c'était le cas de 104
 * adresses). Les articles de blog prennent leur `updated_at`, les guides leur
 * date de vérification (`verifieLe`). À compléter quand une page change de
 * façon significative.
 */
const MAJ: Record<string, string> = {
  "/": "2026-10-05",
  "/pricing": "2026-10-02",
  "/demo": "2026-10-04",
  "/signup": "2026-10-06",
  "/guide": "2026-10-05",
  "/outils": "2026-10-15",
  "/outils/calculateur-beton": "2026-10-15",
  "/outils/calculateur-pente": "2026-10-15",
  "/modele": "2026-10-15",
  "/modele/devis-travaux": "2026-10-15",
  "/modele/devis-electricien": "2026-10-15",
  "/facturation": "2026-10-15",
  "/facturation/electricien": "2026-10-15",
  "/facturation/macon": "2026-10-15",
  "/facturation/couvreur": "2026-10-15",
  "/facturation/paysagiste": "2026-10-15",
  "/devenir-a-son-compte/electricien": "2026-10-15",
}

const jour = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** `{ lastModified }` si la date de l'adresse est connue, sinon rien. */
const dateDe = (path: string): { lastModified?: Date } => (MAJ[path] ? { lastModified: jour(MAJ[path]) } : {})

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://qonforme.fr";

  // Fetch published blog posts for dynamic entries
  const admin = createAdminClient();
  const { data: posts } = await admin
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("is_published", true);

  // Articles marqués « noindex » (colonne robots, migration 20261006) : hors du sitemap.
  // Sans la migration, la requête échoue et aucun article n'est retiré.
  const { data: noindex } = await admin
    .from("blog_posts")
    .select("slug")
    .eq("is_published", true)
    .eq("robots->>index", "false");
  const hidden = new Set((noindex ?? []).map((p) => p.slug));

  const visibles = (posts ?? []).filter((post) => !hidden.has(post.slug));
  const blogPostEntries: MetadataRoute.Sitemap = visibles.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Le hub du blog change quand un article change : date du plus récent
  const dernierArticle = visibles.reduce<Date | null>((max, p) => {
    const d = new Date(p.updated_at)
    return Number.isNaN(d.getTime()) || (max && d <= max) ? max : d
  }, null)

  // pSEO pages
  const metierEntries: MetadataRoute.Sitemap = METIERS.map((m) => ({
    url: `${baseUrl}/facturation/${m.slug}`,
    ...dateDe(`/facturation/${m.slug}`),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const guideEntries: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: `${baseUrl}/guide/${g.slug}`,
    ...(g.verifieLe ? { lastModified: jour(g.verifieLe) } : {}),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const modeleEntries: MetadataRoute.Sitemap = MODELES.map((m) => ({
    url: `${baseUrl}/modele/${m.slug}`,
    ...dateDe(`/modele/${m.slug}`),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      ...dateDe("/"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      ...dateDe("/pricing"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/demo`,
      ...dateDe("/demo"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      ...(dernierArticle ? { lastModified: dernierArticle } : {}),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/facturation`,
      ...dateDe("/facturation"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guide`,
      ...dateDe("/guide"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/modele`,
      ...dateDe("/modele"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      ...dateDe("/signup"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // /login et /forgot-password ne sont plus listés (15/10/2026) : pages de connexion sans valeur de recherche.
    {
      url: `${baseUrl}/mentions-legales`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cgu`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/confidentialite`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/plan-du-site`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    // Outils gratuits
    {
      url: `${baseUrl}/outils`,
      ...dateDe("/outils"),
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
      "calculateur-beton",
      "calculateur-pente",
    ].map((slug) => ({
      url: `${baseUrl}/outils/${slug}`,
      ...dateDe(`/outils/${slug}`),
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
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    ...INSTALLATIONS.map((i) => ({
      url: `${baseUrl}/devenir-a-son-compte/${i.slug}`,
      ...dateDe(`/devenir-a-son-compte/${i.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // Glossaire
    {
      url: `${baseUrl}/glossaire`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...GLOSSAIRE.map((t) => ({
      url: `${baseUrl}/glossaire/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Pages métier × ville : supprimées le 15/10/2026 (thin content, hors de ce plan depuis le 09/04).
    // Elles sont dans l'historique du code ; à réintroduire seulement avec du contenu local unique.
  ];
}
