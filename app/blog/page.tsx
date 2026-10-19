import type { Metadata } from "next"
import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { BookOpen, Briefcase, FileText, Library } from "lucide-react"
import { getReadingTime, getCategoryFromPrompt } from "@/lib/blog-utils"
import { PictoCluster } from "@/components/brand/PictoCluster"
import type { TopicCategory } from "@/lib/ai/seo-topics"
import CategoryFilter from "@/components/blog/CategoryFilter"
import { ContentCta, ContentHero, ContentPage, LinkCard, SectionHeading, WRAP } from "@/components/content/ui"

export const metadata: Metadata = {
  // Le hub vise la cible du site, comme l'accueil (« artisans du bâtiment »), et non plus « TPE ».
  title: "Blog : devis, factures et TVA pour artisans du bâtiment",
  description: "Articles pour les artisans du bâtiment : rédiger ses devis et factures, appliquer la bonne TVA, se faire payer et préparer la facture électronique.",
  alternates: { canonical: "/blog" },
  openGraph: {
    images: [{ url: "/api/og?title=Blog%20Qonforme&subtitle=Devis%2C%20factures%20et%20TVA%20pour%20les%20artisans%20du%20b%C3%A2timent", width: 1200, height: 630 }],
  },
}

export const revalidate = 60

const POST_COLUMNS = "slug, title, excerpt, cover_url, published_at, content, ai_prompt"

/**
 * Articles publiés, avec le texte alternatif de leur couverture (cover_alt,
 * migration 20261006) ; si la colonne manque, relus sans elle : la liste ne
 * casse jamais.
 */
async function getPosts(): Promise<RawPost[]> {
  const admin = createAdminClient()
  const read = (columns: string) =>
    admin.from("blog_posts").select(columns).eq("is_published", true).order("published_at", { ascending: false })
  const withAlt = await read(`${POST_COLUMNS}, cover_alt`)
  if (withAlt.error && isMissingSchemaError(withAlt.error)) {
    const { data } = await read(POST_COLUMNS)
    return (data ?? []) as unknown as RawPost[]
  }
  return (withAlt.data ?? []) as unknown as RawPost[]
}

const RESOURCES = [
  { href: "/guide", title: "Guides pratiques", text: "Mentions obligatoires, TVA, délais de paiement, avoirs : les règles expliquées simplement.", icon: <BookOpen /> },
  { href: "/modele", title: "Modèles gratuits", text: "Factures, devis, avoirs et bons de commande, avec les mentions à ne pas oublier.", icon: <FileText /> },
  { href: "/facturation", title: "Facturation par métier", text: "Les obligations propres à votre métier, du plombier au couvreur.", icon: <Briefcase /> },
  { href: "/glossaire", title: "Glossaire", text: "Acompte, avoir, Factur-X, autoliquidation : les définitions des termes clés.", icon: <Library /> },
]

interface RawPost {
  slug: string
  title: string
  excerpt: string | null
  cover_url: string | null
  cover_alt?: string | null
  published_at: string | null
  content: string
  ai_prompt: string | null
}

/** Ce que reçoit la grille (composant client) : jamais le texte des articles. */
interface EnrichedPost extends Omit<RawPost, "content" | "ai_prompt"> {
  category: TopicCategory
  readingTime: number
}

export default async function BlogPage() {
  const rawPosts = await getPosts()

  // Catégorie et temps de lecture de chaque article ; le texte complet reste sur le serveur
  // (il partait dans la page pour chaque article, alors que la grille n'en affiche rien)
  const posts: EnrichedPost[] = rawPosts.map(({ content, ai_prompt, ...p }) => ({
    ...p,
    category: getCategoryFromPrompt(ai_prompt),
    readingTime: getReadingTime(content),
  }))

  return (
    <ContentPage>
      <ContentHero
        eyebrow="Le blog"
        title="Facturer sans détour,"
        accent="chantier après chantier."
        sub="Guides pratiques, décryptages de la réforme et conseils concrets pour vos devis, vos factures et vos relances."
      />

      {/* Articles */}
      <section aria-label="Articles" className="px-4 pb-6 sm:px-6">
        <div className={WRAP}>
          {posts.length === 0 ? (
            <div className="q-card q-empty">
              <PictoCluster icon={<FileText />} className="mb-1" />
              <p className="font-display text-[20px] font-semibold tracking-[-0.02em] text-q-ink-strong">Bientôt disponible</p>
              <p className="max-w-[420px] text-[15px] text-q-text-3">
                Les premiers articles arrivent. En attendant, nos guides pratiques répondent aux questions les plus courantes.
              </p>
              <Link href="/guide" className="q-btn q-btn-secondary mt-2">
                Voir les guides pratiques
              </Link>
            </div>
          ) : (
            <CategoryFilter posts={posts} />
          )}
        </div>
      </section>

      {/* Maillage pSEO */}
      <section className="px-4 pt-14 sm:px-6 sm:pt-20">
        <div className={WRAP}>
          <SectionHeading title="Pour aller" accent="plus loin." className="mb-8" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RESOURCES.map((r) => (
              <LinkCard key={r.href} href={r.href} title={r.title} text={r.text} icon={r.icon} cta="Découvrir" as="h3" />
            ))}
          </div>
        </div>
      </section>

      <ContentCta
        links={[
          { href: "/guide/facture-electronique-2026", label: "Facture électronique 2026" },
          { href: "/outils", label: "Outils gratuits" },
          { href: "/pricing", label: "Tarifs" },
          { href: "/demo", label: "Démo" },
        ]}
      />
    </ContentPage>
  )
}
