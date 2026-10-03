import type { Metadata } from "next"
import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/server"
import { BookOpen, Briefcase, FileText, Library } from "lucide-react"
import { getReadingTime, getCategoryFromPrompt } from "@/lib/blog-utils"
import type { TopicCategory } from "@/lib/ai/seo-topics"
import CategoryFilter from "@/components/blog/CategoryFilter"
import { ContentCta, ContentHero, ContentPage, LinkCard, SectionHeading, WRAP } from "@/components/content/ui"

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides, conseils et actualités sur la facturation électronique, la conformité Factur-X et la réglementation 2026 pour artisans et TPE.",
  alternates: { canonical: "/blog" },
  openGraph: {
    images: [{ url: "/api/og?title=Blog%20Qonforme&subtitle=Guides%20et%20conseils%20facturation%20%C3%A9lectronique%20pour%20artisans%20et%20TPE", width: 1200, height: 630 }],
  },
}

export const revalidate = 60

async function getPosts() {
  const admin = createAdminClient()
  const { data } = await admin
    .from("blog_posts")
    .select("slug, title, excerpt, cover_url, published_at, content, ai_prompt")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
  return data ?? []
}

const RESOURCES = [
  { href: "/guide", title: "Guides pratiques", text: "Mentions obligatoires, TVA, délais de paiement, avoirs : les règles expliquées simplement.", icon: <BookOpen /> },
  { href: "/modele", title: "Modèles gratuits", text: "Factures, devis, avoirs et bons de commande, avec les mentions à ne pas oublier.", icon: <FileText /> },
  { href: "/facturation", title: "Facturation par métier", text: "Les obligations propres à votre métier, du plombier au couvreur.", icon: <Briefcase /> },
  { href: "/glossaire", title: "Glossaire", text: "Acompte, avoir, Factur-X, autoliquidation : les définitions des termes clés.", icon: <Library /> },
]

interface EnrichedPost {
  slug: string
  title: string
  excerpt: string | null
  cover_url: string | null
  published_at: string | null
  content: string
  ai_prompt: string | null
  category: TopicCategory
  readingTime: number
}

export default async function BlogPage() {
  const rawPosts = await getPosts()

  // Catégorie et temps de lecture de chaque article
  const posts: EnrichedPost[] = rawPosts.map((p) => ({
    ...p,
    category: getCategoryFromPrompt(p.ai_prompt),
    readingTime: getReadingTime(p.content),
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
              <span className="q-empty-icon">
                <FileText className="h-6 w-6" aria-hidden />
              </span>
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
