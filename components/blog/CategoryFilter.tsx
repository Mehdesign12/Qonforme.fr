"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import type { TopicCategory } from "@/lib/ai/seo-topics"
import { CATEGORY_CONFIG } from "@/lib/blog-utils"
import { Calendar, Clock, ArrowRight } from "lucide-react"

const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Picto%20Q.webp"

interface BlogPost {
  slug: string
  title: string
  excerpt: string | null
  cover_url: string | null
  published_at: string | null
  category: TopicCategory
  readingTime: number
}

interface Props {
  posts: BlogPost[]
}

/**
 * Category filter bar + article grid.
 * Renders only categories that have at least one post.
 */
export default function CategoryFilter({ posts }: Props) {
  const [active, setActive] = useState<TopicCategory | "all">("all")

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

      {/* Article grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((post, i) => {
          const catConfig = CATEGORY_CONFIG[post.category] ?? CATEGORY_CONFIG["guide"]
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group blog-card-animate rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:shadow-blue-500/5 hover:border-[#2563EB]/20 transition-all duration-300"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Cover */}
              <div className="relative aspect-[2/1] overflow-hidden bg-slate-100">
                {post.cover_url ? (
                  <img
                    src={post.cover_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#2563EB] via-[#1d4ed8] to-[#0F172A] flex items-center justify-center">
                    <img src={PICTO_Q} alt="" width={80} height={80} className="w-16 h-16 opacity-30" />
                  </div>
                )}
                {/* Category badge on image */}
                <div className="absolute top-3 left-3">
                  <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${catConfig.color} ${catConfig.bg} ${catConfig.border}`}>
                    {catConfig.label}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                <div className="flex items-center gap-3 mb-2.5">
                  {post.published_at && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    {post.readingTime} min
                  </span>
                </div>

                <h2 className="text-[17px] font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors leading-snug line-clamp-2">
                  {post.title}
                </h2>

                {post.excerpt && (
                  <p className="mt-2 text-[13px] text-slate-500 line-clamp-2 leading-relaxed">
                    {post.excerpt}
                  </p>
                )}

                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB]">
                  Lire <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
