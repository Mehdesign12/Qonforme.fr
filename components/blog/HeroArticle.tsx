import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import CategoryBadge from "./CategoryBadge"
import { CoverFallback, type ArticleCardPost } from "./ArticleCard"

/** Date longue (« 2 octobre 2026 »). */
function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * Article à la une, en tête de la liste : grande carte blanche, photo à
 * gauche et texte à droite (empilés sur mobile).
 */
export default function HeroArticle({ post }: { post: ArticleCardPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group grid overflow-hidden rounded-[24px] border border-q-line bg-q-surface shadow-[var(--q-shadow-card)] transition-[border-color,box-shadow] duration-300 hover:border-q-wash-line hover:shadow-[0_24px_48px_-28px_rgba(10,17,34,.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent md:grid-cols-[1.15fr_1fr]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-q-sunken md:aspect-auto md:min-h-[340px]">
        {post.cover_url ? (
          <Image
            src={post.cover_url}
            alt=""
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            sizes="(max-width: 768px) 100vw, 640px"
            priority
          />
        ) : (
          <CoverFallback size={88} />
        )}
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="q-eyebrow">À la une</span>
          <CategoryBadge category={post.category} />
        </div>
        <h2 className="font-display text-[clamp(24px,2.6vw,34px)] font-semibold leading-[1.12] tracking-[-0.03em] text-q-ink-strong transition-colors group-hover:text-q-accent-strong [text-wrap:balance]">
          {post.title}
        </h2>
        {post.excerpt && <p className="mt-3 line-clamp-3 text-[15px] leading-[1.65] text-q-text-3 sm:text-[16px]">{post.excerpt}</p>}
        <p className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-q-text-4">
          {post.published_at && <time dateTime={post.published_at}>{longDate(post.published_at)}</time>}
          {post.published_at && post.readingTime ? <span aria-hidden>·</span> : null}
          {post.readingTime ? <span>{post.readingTime} min de lecture</span> : null}
        </p>
        <span className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-q-accent-strong">
          Lire l&apos;article
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </span>
      </div>
    </Link>
  )
}
