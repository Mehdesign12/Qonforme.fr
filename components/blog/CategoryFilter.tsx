"use client"

import { useState, useMemo } from "react"
import type { TopicCategory } from "@/lib/ai/seo-topics"
import { CATEGORY_CONFIG } from "@/lib/blog-utils"
import { cn } from "@/lib/utils"
import ArticleCard, { type ArticleCardPost } from "./ArticleCard"
import HeroArticle from "./HeroArticle"

interface BlogPost extends ArticleCardPost {
  readingTime: number
}

interface Props {
  posts: BlogPost[]
}

/** Nombre d'articles à partir duquel le plus récent passe « à la une ». */
const FEATURED_MIN = 4

/**
 * Filtre par catégorie + grille d'articles.
 * N'affiche que les catégories qui ont au moins un article.
 */
export default function CategoryFilter({ posts }: Props) {
  const [active, setActive] = useState<TopicCategory | "all">("all")

  const availableCategories = useMemo(() => {
    const cats = new Set(posts.map((p) => p.category))
    return Array.from(cats) as TopicCategory[]
  }, [posts])

  const filtered = active === "all" ? posts : posts.filter((p) => p.category === active)
  const featured = active === "all" && filtered.length >= FEATURED_MIN ? filtered[0] : null
  const grid = featured ? filtered.slice(1) : filtered

  const pill = (isActive: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold transition-colors",
      isActive
        ? "border-q-ink-strong bg-q-ink-strong text-q-surface"
        : "border-q-line bg-q-surface text-q-text-3 hover:border-q-field hover:text-q-ink",
    )

  return (
    <>
      {/* Catégories : défilement horizontal sur mobile */}
      <div className="-mx-4 mb-8 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div role="group" aria-label="Filtrer par catégorie" className="flex min-w-max items-center gap-2 pb-1">
          <button type="button" onClick={() => setActive("all")} aria-pressed={active === "all"} className={pill(active === "all")}>
            Tous
            <span className={cn("text-[12px] font-medium tabular-nums", active === "all" ? "opacity-70" : "text-q-text-4")}>{posts.length}</span>
          </button>
          {availableCategories.map((cat) => {
            const isActive = active === cat
            const count = posts.filter((p) => p.category === cat).length
            return (
              <button key={cat} type="button" onClick={() => setActive(cat)} aria-pressed={isActive} className={pill(isActive)}>
                {CATEGORY_CONFIG[cat]?.label ?? cat}
                <span className={cn("text-[12px] font-medium tabular-nums", isActive ? "opacity-70" : "text-q-text-4")}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {featured && (
        <div className="mb-6">
          <HeroArticle post={featured} />
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {grid.map((post, i) => (
          <ArticleCard key={post.slug} post={post} index={i} />
        ))}
      </div>
    </>
  )
}
