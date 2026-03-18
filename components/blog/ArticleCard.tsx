import Link from "next/link"
import Image from "next/image"
import { Calendar, Clock, ArrowRight } from "lucide-react"
import CategoryBadge from "./CategoryBadge"
import type { TopicCategory } from "@/lib/ai/seo-topics"

const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Picto%20Q.webp"

interface Props {
  post: {
    slug: string
    title: string
    excerpt: string | null
    cover_url: string | null
    published_at: string | null
    category: TopicCategory
    readingTime: number
  }
  /** Index for staggered fade-in animation */
  index: number
}

/**
 * Blog article card with category badge, reading time, and hover effects.
 * Uses CSS animation with stagger delay.
 */
export default function ArticleCard({ post, index }: Props) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group blog-card-animate rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:shadow-blue-500/5 hover:border-[#2563EB]/20 transition-all duration-300"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Cover */}
      <div className="relative aspect-[2/1] overflow-hidden bg-slate-100">
        {post.cover_url ? (
          <Image
            src={post.cover_url}
            alt=""
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2563EB] via-[#1d4ed8] to-[#0F172A] flex items-center justify-center">
            <Image src={PICTO_Q} alt="" width={80} height={80} className="w-16 h-16 opacity-30" sizes="64px" />
          </div>
        )}
        {/* Category badge on image */}
        <div className="absolute top-3 left-3">
          <CategoryBadge category={post.category} />
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Meta row */}
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

        {/* Title */}
        <h2 className="text-[17px] font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors leading-snug line-clamp-2">
          {post.title}
        </h2>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="mt-2 text-[13px] text-slate-500 line-clamp-2 leading-relaxed">
            {post.excerpt}
          </p>
        )}

        {/* Read more */}
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB]">
          Lire <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
        </span>
      </div>
    </Link>
  )
}
