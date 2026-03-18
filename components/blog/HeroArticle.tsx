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
}

/**
 * Full-width hero card for the latest blog article.
 * Displayed at the top of the listing page.
 */
export default function HeroArticle({ post }: Props) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative block rounded-2xl overflow-hidden bg-[#0F172A] mb-10"
    >
      {/* Cover image */}
      <div className="relative aspect-[16/7] sm:aspect-[16/6] overflow-hidden">
        {post.cover_url ? (
          <Image
            src={post.cover_url}
            alt=""
            fill
            className="object-cover opacity-70 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2563EB] via-[#1d4ed8] to-[#0F172A] flex items-center justify-center">
            <Image src={PICTO_Q} alt="" width={120} height={120} className="w-24 h-24 opacity-20" sizes="96px" />
          </div>
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/60 to-transparent" />

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
        <div className="flex items-center gap-3 mb-3">
          <CategoryBadge category={post.category} size="md" />
          {post.published_at && (
            <span className="flex items-center gap-1.5 text-[12px] text-white/60">
              <Calendar className="w-3 h-3" />
              {new Date(post.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[12px] text-white/60">
            <Clock className="w-3 h-3" />
            {post.readingTime} min
          </span>
        </div>

        <h2
          className="text-xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight group-hover:text-blue-200 transition-colors duration-300"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          {post.title}
        </h2>

        {post.excerpt && (
          <p className="mt-2 text-sm sm:text-base text-white/70 line-clamp-2 max-w-2xl">
            {post.excerpt}
          </p>
        )}

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white group-hover:text-blue-200 transition-colors">
          Lire l&apos;article <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </span>
      </div>
    </Link>
  )
}
