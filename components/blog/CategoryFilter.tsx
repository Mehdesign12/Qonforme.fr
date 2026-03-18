"use client"

import { useState, useMemo } from "react"
import type { TopicCategory } from "@/lib/ai/seo-topics"
import { CATEGORY_CONFIG } from "@/lib/blog-utils"

interface BlogPost {
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

interface Props {
  posts: BlogPost[]
  children: (filteredPosts: BlogPost[]) => React.ReactNode
}

/**
 * Category filter bar + passes filtered posts to render prop children.
 * Renders only categories that have at least one post.
 */
export default function CategoryFilter({ posts, children }: Props) {
  const [active, setActive] = useState<TopicCategory | "all">("all")

  // Only show categories that have posts
  const availableCategories = useMemo(() => {
    const cats = new Set(posts.map((p) => p.category))
    return Array.from(cats) as TopicCategory[]
  }, [posts])

  const filtered = active === "all" ? posts : posts.filter((p) => p.category === active)

  return (
    <>
      {/* Filter pills — horizontally scrollable on mobile */}
      <div className="mb-8 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max pb-1">
          <button
            onClick={() => setActive("all")}
            className={`shrink-0 text-[13px] font-medium px-4 py-2 rounded-full border transition-all duration-200 ${
              active === "all"
                ? "bg-[#0F172A] text-white border-[#0F172A]"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Tous
          </button>
          {availableCategories.map((cat) => {
            const config = CATEGORY_CONFIG[cat]
            const isActive = active === cat
            return (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`shrink-0 text-[13px] font-medium px-4 py-2 rounded-full border transition-all duration-200 ${
                  isActive
                    ? `${config.bg} ${config.color} ${config.border}`
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {config.label}
              </button>
            )
          })}
        </div>
      </div>

      {children(filtered)}
    </>
  )
}
