import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { TopicCategory } from "@/lib/ai/seo-topics"
import { Breadcrumbs, ChipLinks, ContentCta, ContentPage, SectionHeading, WRAP } from "@/components/content/ui"
import ArticleCard, { CoverFallback, type ArticleCardPost } from "./ArticleCard"
import CategoryBadge from "./CategoryBadge"
import ReadingProgressBar from "./ReadingProgressBar"
import ShareButtons from "./ShareButtons"
import TableOfContents from "./TableOfContents"

export interface ArticleViewProps {
  post: {
    slug: string
    title: string
    excerpt: string | null
    cover_url: string | null
    published_at: string | null
    /** Texte alternatif de la couverture (vide : image décorative). */
    cover_alt?: string | null
    /** Article et couverture produits par une IA : la couverture porte la mention « Illustration générée par IA ». */
    ai_generated?: boolean | null
  }
  category: TopicCategory
  readingTime: number
  keywords: string[]
  headings: { id: string; text: string; level: number }[]
  /** HTML de l'article (lib/markdown + maillage automatique). */
  contentHtml: string
  similar: ArticleCardPost[]
  adjacent: { prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }
}

/** Ressources pSEO proposées sous chaque article (maillage interne). */
const RESOURCES = [
  { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires sur une facture" },
  { href: "/guide/facture-electronique-2026", label: "Facture électronique 2026" },
  { href: "/guide/facture-auto-entrepreneur", label: "Facture auto-entrepreneur" },
  { href: "/guide/delai-paiement-facture", label: "Délais de paiement" },
  { href: "/modele/facture-classique", label: "Modèle de facture gratuit" },
  { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
  { href: "/facturation", label: "Facturation par métier" },
  { href: "/guide", label: "Tous les guides" },
]

/**
 * Mise en page d'un article du blog (canevas « Main ») : en-tête sur le fond
 * clair, couverture arrondie, colonne de lecture d'environ 68 caractères,
 * partage à gauche, sommaire à droite sur grand écran.
 * Présentation seule : la page charge les données et pose le JSON-LD.
 */
export default function ArticleView({ post, category, readingTime, keywords, headings, contentHtml, similar, adjacent }: ArticleViewProps) {
  return (
    <ContentPage bottomBarSpace>
      <ReadingProgressBar />

      <div className="px-4 pb-10 pt-[112px] sm:px-6 sm:pt-[140px]" style={{ backgroundImage: "var(--q-glow)" }}>
        <div className={`${WRAP} lg:grid lg:grid-cols-[44px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[44px_minmax(0,1fr)_220px]`}>
          {/* Partage : colonne collée à gauche (ordinateur), barre fixée en bas (mobile) */}
          <div className="lg:pt-[190px]">
            <ShareButtons title={post.title} slug={post.slug} />
          </div>

          <article className="mx-auto w-full min-w-0 max-w-[700px]">
            <header>
              <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.title }]} className="mb-6" />
              <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-q-text-4">
                <CategoryBadge category={category} size="md" />
                <span className="whitespace-nowrap">
                  {post.published_at && (
                    <>
                      <time dateTime={post.published_at}>
                        {new Date(post.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </time>
                      <span aria-hidden> · </span>
                    </>
                  )}
                  {readingTime} min de lecture
                </span>
              </div>
              <h1 className="font-display text-[clamp(30px,4vw,46px)] font-semibold leading-[1.08] tracking-[-0.03em] text-q-ink-strong [text-wrap:balance]">
                {post.title}
              </h1>
              {post.excerpt && <p className="mt-5 text-[18px] leading-[1.6] text-q-text-3 sm:text-[19px]">{post.excerpt}</p>}
              {keywords.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2" aria-label="Mots-clés">
                  {keywords.slice(0, 5).map((kw) => (
                    <li key={kw} className="q-tag h-6 rounded-full px-2.5 text-[12px] font-medium">
                      {kw}
                    </li>
                  ))}
                </ul>
              )}
            </header>

            <figure className="mt-8">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[20px] border border-q-line bg-q-sunken">
                {post.cover_url ? (
                  <Image src={post.cover_url} alt={post.cover_alt ?? ""} fill className="object-cover" sizes="(max-width: 760px) 100vw, 700px" priority />
                ) : (
                  <CoverFallback size={96} />
                )}
              </div>
              {/* Transparence sur les images de synthèse (AI Act, art. 50) */}
              {post.cover_url && post.ai_generated && (
                <figcaption className="mt-2 text-[13px] text-q-text-4">Illustration générée par IA</figcaption>
              )}
            </figure>

            {/* Contenu : typographie .blog-prose (app/globals.css) */}
            <div className="blog-prose mt-10" dangerouslySetInnerHTML={{ __html: contentHtml }} />

            {/* Article précédent / suivant */}
            {(adjacent.prev || adjacent.next) && (
              <nav aria-label="Autres articles" className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {adjacent.prev ? (
                  <Link
                    href={`/blog/${adjacent.prev.slug}`}
                    className="group flex items-start gap-3 rounded-2xl border border-q-line bg-q-surface p-4 transition-colors hover:border-q-wash-line"
                  >
                    <ChevronLeft className="mt-0.5 h-5 w-5 shrink-0 text-q-text-4 transition-colors group-hover:text-q-accent-strong" aria-hidden />
                    <span className="min-w-0">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-q-text-4">Précédent</span>
                      <span className="mt-1 line-clamp-2 block text-[15px] font-semibold leading-snug text-q-ink transition-colors group-hover:text-q-accent-strong">
                        {adjacent.prev.title}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="hidden sm:block" />
                )}
                {adjacent.next && (
                  <Link
                    href={`/blog/${adjacent.next.slug}`}
                    className="group flex items-start gap-3 rounded-2xl border border-q-line bg-q-surface p-4 text-right transition-colors hover:border-q-wash-line sm:flex-row-reverse"
                  >
                    <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-q-text-4 transition-colors group-hover:text-q-accent-strong" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-q-text-4">Suivant</span>
                      <span className="mt-1 line-clamp-2 block text-[15px] font-semibold leading-snug text-q-ink transition-colors group-hover:text-q-accent-strong">
                        {adjacent.next.title}
                      </span>
                    </span>
                  </Link>
                )}
              </nav>
            )}

            {/* Ressources pSEO — maillage interne */}
            <section aria-labelledby="ressources-utiles" className="mt-10 rounded-[20px] border border-q-line bg-q-surface p-6">
              <h2 id="ressources-utiles" className="q-eyebrow mb-4">
                Ressources utiles
              </h2>
              <ChipLinks links={RESOURCES} />
            </section>
          </article>

          {/* Sommaire (grand écran) */}
          <div className="hidden pt-[190px] xl:block">
            <TableOfContents headings={headings} />
          </div>
        </div>
      </div>

      {/* Articles similaires */}
      {similar.length > 0 && (
        <section className="px-4 pt-6 sm:px-6 sm:pt-10">
          <div className={WRAP}>
            <SectionHeading title="Articles" accent="similaires." className="mb-8" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {similar.map((s, i) => (
                <ArticleCard key={s.slug} post={s} index={i} as="h3" />
              ))}
            </div>
          </div>
        </section>
      )}

      <ContentCta links={[{ href: "/blog", label: "Tous les articles" }, { href: "/pricing", label: "Tarifs" }, { href: "/demo", label: "Tester la démo" }]} />
    </ContentPage>
  )
}
