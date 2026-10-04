import type { Metadata } from "next"
import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/server"
import { METIERS } from "@/lib/pseo/metiers"
import { GUIDES } from "@/lib/pseo/guides"
import { MODELES } from "@/lib/pseo/modeles"
import { GLOSSAIRE } from "@/lib/pseo/glossaire"
import { OUTILS_CATEGORIES } from "@/components/layout/public-links"
import { ContentHero, ContentPage, WRAP } from "@/components/content/ui"
import { fr } from "@/components/content/text"

/*
 * Plan du site en HTML, lié depuis le pied de page (PushRank, 04/10/2026).
 * Mêmes pages que app/sitemap.ts : seulement les pages publiques indexables,
 * jamais les pages métier × ville (noindex) ni les pages de l'application.
 */
export const metadata: Metadata = {
  title: "Plan du site",
  description: "Toutes les pages de Qonforme : tarifs, démo, outils gratuits, guides, modèles de devis et de factures, facturation par métier, glossaire et blog.",
  alternates: { canonical: "/plan-du-site" },
}

export const revalidate = 3600

type Item = { href: string; label: string }

/** Articles publiés ; en cas d'erreur, la rubrique garde au moins le lien vers le blog. */
async function getBlogPosts(): Promise<Item[]> {
  try {
    const { data, error } = await createAdminClient()
      .from("blog_posts")
      .select("slug, title")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
    if (error) return []
    return (data ?? []).map((p) => ({ href: `/blog/${p.slug}`, label: p.title }))
  } catch {
    return []
  }
}

function Section({ id, title, items, columns = 2 }: { id: string; title: string; items: Item[]; columns?: 1 | 2 | 3 }) {
  return (
    <section aria-labelledby={id} className="border-t border-q-line py-8 first:border-t-0 first:pt-0">
      <h2 id={id} className="font-display text-[22px] font-semibold tracking-[-0.02em] text-q-ink-strong">
        {title}
      </h2>
      <ul className={`mt-4 grid gap-x-8 gap-y-1 ${columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="inline-block py-1.5 text-[15px] leading-[1.45] text-q-text-2 transition-colors hover:text-q-accent-strong">
              {fr(item.label)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function PlanDuSitePage() {
  const posts = await getBlogPosts()

  const sections: { id: string; title: string; items: Item[]; columns?: 1 | 2 | 3 }[] = [
    {
      id: "plan-qonforme",
      title: "Qonforme",
      items: [
        { href: "/", label: "Accueil" },
        { href: "/pricing", label: "Tarifs" },
        { href: "/demo", label: "Démo du tableau de bord" },
        { href: "/signup", label: "Créer mon compte" },
        { href: "/login", label: "Se connecter" },
      ],
    },
    {
      id: "plan-outils",
      title: "Outils gratuits",
      columns: 3,
      items: [{ href: "/outils", label: "Tous les outils gratuits" }, ...OUTILS_CATEGORIES.flatMap((c) => c.items.map((o) => ({ href: o.href, label: o.label })))],
    },
    {
      id: "plan-modeles",
      title: "Modèles de devis et de factures",
      items: [{ href: "/modele", label: "Tous les modèles gratuits" }, ...MODELES.map((m) => ({ href: `/modele/${m.slug}`, label: m.titre }))],
    },
    {
      id: "plan-guides",
      title: "Guides pratiques",
      items: [{ href: "/guide", label: "Tous les guides" }, ...GUIDES.map((g) => ({ href: `/guide/${g.slug}`, label: g.titre }))],
    },
    {
      id: "plan-metiers",
      title: "Facturation par métier",
      columns: 3,
      items: [{ href: "/facturation", label: "Tous les métiers" }, ...METIERS.map((m) => ({ href: `/facturation/${m.slug}`, label: m.nom }))],
    },
    {
      id: "plan-glossaire",
      title: "Glossaire",
      columns: 3,
      items: [{ href: "/glossaire", label: "Tout le glossaire" }, ...GLOSSAIRE.map((t) => ({ href: `/glossaire/${t.slug}`, label: t.terme }))],
    },
    {
      id: "plan-blog",
      title: "Blog",
      columns: 1,
      items: [{ href: "/blog", label: "Tous les articles" }, ...posts],
    },
    {
      id: "plan-legal",
      title: "Informations légales",
      items: [
        { href: "/mentions-legales", label: "Mentions légales" },
        { href: "/cgu", label: "Conditions générales d'utilisation" },
        { href: "/confidentialite", label: "Politique de confidentialité" },
      ],
    },
  ]

  return (
    <ContentPage>
      <ContentHero
        align="start"
        size="md"
        crumbs={[{ label: "Accueil", href: "/" }, { label: "Plan du site" }]}
        title="Plan du"
        accent="site."
        sub="Toutes les pages publiques de Qonforme, rangées par rubrique."
      />
      <div className="px-4 pb-20 sm:px-6">
        <nav aria-label="Plan du site" className={`${WRAP} q-card p-6 sm:p-10`}>
          {sections.map((s) => (
            <Section key={s.id} {...s} />
          ))}
        </nav>
      </div>
    </ContentPage>
  )
}
