import type { Metadata } from "next"
import Image from "next/image"
import { createAdminClient } from "@/lib/supabase/server"
import { FileText } from "lucide-react"
import { getReadingTime, getCategoryFromPrompt } from "@/lib/blog-utils"
import type { TopicCategory } from "@/lib/ai/seo-topics"
import CategoryFilter from "@/components/blog/CategoryFilter"
import BlogHeader from "@/components/blog/BlogHeader"
import Footer from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Blog — Qonforme",
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

const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Picto%20Q.webp"

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

  // Enrich posts with category and reading time
  const posts: EnrichedPost[] = rawPosts.map((p) => ({
    ...p,
    category: getCategoryFromPrompt(p.ai_prompt),
    readingTime: getReadingTime(p.content),
  }))

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <BlogHeader />

      {/* Hero section — pt-24 compense le header fixed */}
      <section className="relative overflow-hidden pt-24 pb-12 sm:pt-28 sm:pb-16">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.03 }}>
          <Image src={PICTO_Q} alt="" width={500} height={500} className="w-[500px]" sizes="500px" loading="lazy" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0F172A]" style={{ fontFamily: "var(--font-bricolage)" }}>
            Le blog <span className="text-[#2563EB]">Qonforme</span>
          </h1>
          <p className="mt-3 text-[15px] sm:text-base text-slate-500 max-w-xl mx-auto">
            Guides pratiques, décryptages réglementaires et conseils pour maîtriser la facturation électronique.
          </p>
        </div>
      </section>

      {/* Articles */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-20 flex-1">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-semibold text-[#0F172A]">Bientôt disponible</p>
            <p className="mt-1 text-sm text-slate-500">Nos premiers articles arrivent très vite. Revenez bientôt !</p>
          </div>
        ) : (
          <CategoryFilter posts={posts} />
        )}
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
