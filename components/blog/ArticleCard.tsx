import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import CategoryBadge from "./CategoryBadge"
import type { TopicCategory } from "@/lib/ai/seo-topics"
import { cn } from "@/lib/utils"

export interface ArticleCardPost {
  slug: string
  title: string
  excerpt: string | null
  cover_url: string | null
  published_at: string | null
  category: TopicCategory
  readingTime?: number
}

interface Props {
  post: ArticleCardPost
  /** Rang dans la grille, pour décaler l'apparition des cartes. */
  index?: number
  /** Titre de carte : h2 dans la liste du blog, h3 sous un article. */
  as?: "h2" | "h3"
  sizes?: string
}

/** Date courte d'un article (« 2 oct. 2026 »). */
export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

/** Couverture absente : lavis bleu et Q de la marque, sans dégradé ni image distante. */
export function CoverFallback({ size = 56 }: { size?: number }) {
  return (
    <div aria-hidden className="flex h-full w-full items-center justify-center bg-q-wash">
      <span className="font-display font-semibold leading-none tracking-[-0.04em] text-q-accent opacity-30" style={{ fontSize: size }}>
        Q
      </span>
    </div>
  )
}

/**
 * Carte d'article du blog (canevas « Main » : carte blanche r20, photo en
 * tête, pastille de catégorie, méta discrète, lien « Lire » en bleu).
 */
export default function ArticleCard({ post, index = 0, as: Tag = "h2", sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px" }: Props) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        "group blog-card-animate flex flex-col overflow-hidden rounded-[20px] border border-q-line bg-q-surface shadow-[var(--q-shadow-card)]",
        "transition-[border-color,box-shadow] duration-300 hover:border-q-wash-line hover:shadow-[0_18px_36px_-22px_rgba(10,17,34,.35)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-q-sunken">
        {post.cover_url ? (
          <Image
            src={post.cover_url}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            sizes={sizes}
          />
        ) : (
          <CoverFallback />
        )}
        <div className="absolute left-3 top-3">
          <CategoryBadge category={post.category} onImage />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="mb-2 flex items-center gap-2 text-[12.5px] text-q-text-4">
          {post.published_at && <time dateTime={post.published_at}>{shortDate(post.published_at)}</time>}
          {post.published_at && post.readingTime ? <span aria-hidden>·</span> : null}
          {post.readingTime ? <span>{post.readingTime} min de lecture</span> : null}
        </p>
        <Tag className="line-clamp-3 font-display text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-q-ink-strong transition-colors group-hover:text-q-accent-strong">
          {post.title}
        </Tag>
        {post.excerpt && <p className="mt-2 line-clamp-2 text-[14px] leading-[1.6] text-q-text-3">{post.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[14px] font-semibold text-q-accent-strong">
          Lire l&apos;article
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </span>
      </div>
    </Link>
  )
}
