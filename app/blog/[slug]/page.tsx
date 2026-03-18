import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { markdownToHtml } from "@/lib/markdown"
import {
  getReadingTime,
  getCategoryFromPrompt,
  extractHeadings,
} from "@/lib/blog-utils"
import { Calendar, Clock, ChevronLeft, ChevronRight, ArrowRight, Sparkles } from "lucide-react"
import CategoryBadge from "@/components/blog/CategoryBadge"
import ReadingProgressBar from "@/components/blog/ReadingProgressBar"
import TableOfContents from "@/components/blog/TableOfContents"
import ShareButtons from "@/components/blog/ShareButtons"
import Footer from "@/components/layout/Footer"

export const revalidate = 60

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"
const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Picto%20Q.webp"

async function getPost(slug: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("blog_posts")
    .select("slug, title, excerpt, content, cover_url, published_at, ai_prompt, ai_keywords")
    .eq("slug", slug)
    .eq("is_published", true)
    .single()
  return data
}

async function getSimilarPosts(currentSlug: string, aiPrompt: string | null) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("blog_posts")
    .select("slug, title, excerpt, cover_url, published_at, ai_prompt, content")
    .eq("is_published", true)
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(20)

  if (!data) return []

  const currentCategory = getCategoryFromPrompt(aiPrompt)

  // Prefer same category, fallback to any
  const sameCategory = data.filter((p) => getCategoryFromPrompt(p.ai_prompt) === currentCategory)
  const pool = sameCategory.length >= 3 ? sameCategory : data
  return pool.slice(0, 3)
}

async function getAdjacentPosts(currentPublishedAt: string) {
  const admin = createAdminClient()

  // Previous (older) post
  const { data: prev } = await admin
    .from("blog_posts")
    .select("slug, title")
    .eq("is_published", true)
    .lt("published_at", currentPublishedAt)
    .order("published_at", { ascending: false })
    .limit(1)
    .single()

  // Next (newer) post
  const { data: next } = await admin
    .from("blog_posts")
    .select("slug, title")
    .eq("is_published", true)
    .gt("published_at", currentPublishedAt)
    .order("published_at", { ascending: true })
    .limit(1)
    .single()

  return { prev, next }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: "Article introuvable" }

  return {
    title: `${post.title} — Blog Qonforme`,
    description: post.excerpt || `${post.title} — Guide facturation électronique par Qonforme.`,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      type: "article",
      publishedTime: post.published_at || undefined,
      images: [{ url: `/api/og?title=${encodeURIComponent(post.title)}&subtitle=Blog%20Qonforme`, width: 1200, height: 630 }],
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const contentHtml = markdownToHtml(post.content)
  const readingTime = getReadingTime(post.content)
  const category = getCategoryFromPrompt(post.ai_prompt)
  const headings = extractHeadings(post.content)
  const keywords = (post.ai_keywords as string[] | null) ?? []

  const [similar, adjacent] = await Promise.all([
    getSimilarPosts(post.slug, post.ai_prompt),
    getAdjacentPosts(post.published_at ?? new Date().toISOString()),
  ])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <ReadingProgressBar />

      {/* Header */}
      <header className="border-b border-slate-200 bg-white relative z-40">
        <div className="mx-auto max-w-5xl flex items-center justify-between h-14 px-4 sm:px-6">
          <Link href="/" aria-label="Retour à l'accueil">
            <Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-7 w-auto" sizes="130px" priority />
          </Link>
          <Link href="/blog" className="text-sm font-medium text-slate-500 hover:text-[#2563EB] transition-colors">
            ← Tous les articles
          </Link>
        </div>
      </header>

      {/* Hero cover — full width, edge-to-edge */}
      <div className="relative w-full overflow-hidden bg-[#0F172A]">
        <div className="relative aspect-[16/7] sm:aspect-[16/5] lg:aspect-[16/4]">
          {post.cover_url ? (
            <Image
              src={post.cover_url}
              alt=""
              fill
              className="object-cover opacity-60 md:blog-parallax"
              sizes="100vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#2563EB] via-[#1d4ed8] to-[#0F172A] flex items-center justify-center">
              <Image src={PICTO_Q} alt="" width={160} height={160} className="w-32 h-32 opacity-15" sizes="128px" />
            </div>
          )}
        </div>
        {/* Gradient fade to page background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8FAFC] via-transparent to-transparent" />
      </div>

      {/* Breadcrumbs */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 -mt-6 relative z-10">
        <nav className="text-[12px] text-slate-400 flex items-center gap-1.5 flex-wrap">
          <Link href="/" className="hover:text-[#2563EB] transition-colors">Accueil</Link>
          <span>›</span>
          <Link href="/blog" className="hover:text-[#2563EB] transition-colors">Blog</Link>
          <span>›</span>
          <span className="text-slate-500 truncate max-w-[200px] sm:max-w-none">{post.title}</span>
        </nav>
      </div>

      {/* Main layout: share | article | TOC */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-8 lg:pb-16">
        <div className="lg:grid lg:grid-cols-[44px_1fr_220px] lg:gap-8 xl:grid-cols-[44px_1fr_240px] xl:gap-10">
          {/* Left sidebar — share buttons (desktop) */}
          <div className="hidden lg:block pt-8">
            <ShareButtons title={post.title} slug={post.slug} />
          </div>

          {/* Article body */}
          <article className="min-w-0 max-w-3xl mx-auto lg:mx-0 w-full">
            {/* Article header */}
            <header className="mb-8">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <CategoryBadge category={category} size="md" />
                {post.published_at && (
                  <span className="flex items-center gap-1.5 text-[13px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(post.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-[13px] text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  {readingTime} min de lecture
                </span>
              </div>

              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0F172A] leading-tight"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                {post.title}
              </h1>

              {post.excerpt && (
                <p className="mt-4 text-base sm:text-lg text-slate-500 leading-relaxed">{post.excerpt}</p>
              )}

              {/* Keywords */}
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {keywords.slice(0, 5).map((kw) => (
                    <span key={kw} className="text-[11px] px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {/* Article content — premium typography */}
            <div
              className="blog-prose"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />

            {/* CTA — premium gradient card */}
            <div className="mt-14 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-8 sm:p-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#2563EB]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-[#60A5FA]" />
                  <span className="text-[13px] font-semibold text-[#60A5FA] uppercase tracking-wider">Qonforme</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-snug" style={{ fontFamily: "var(--font-bricolage)" }}>
                  Prêt à passer à la facturation conforme ?
                </h2>
                <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-lg">
                  Créez votre première facture Factur-X en quelques clics. Conforme à la réforme 2026, conçu pour les artisans.
                </p>
                <Link
                  href="/signup"
                  className="mt-5 inline-flex h-11 px-6 items-center gap-2 rounded-xl bg-[#2563EB] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors"
                >
                  Commencer gratuitement <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Previous / Next navigation */}
            {(adjacent.prev || adjacent.next) && (
              <nav className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {adjacent.prev ? (
                  <Link
                    href={`/blog/${adjacent.prev.slug}`}
                    className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-[#2563EB]/30 hover:shadow-md transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-[#2563EB] transition-colors mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Précédent</span>
                      <p className="text-sm font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors line-clamp-2 leading-snug mt-0.5">
                        {adjacent.prev.title}
                      </p>
                    </div>
                  </Link>
                ) : <div />}

                {adjacent.next ? (
                  <Link
                    href={`/blog/${adjacent.next.slug}`}
                    className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-[#2563EB]/30 hover:shadow-md transition-all text-right sm:flex-row-reverse"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#2563EB] transition-colors mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Suivant</span>
                      <p className="text-sm font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors line-clamp-2 leading-snug mt-0.5">
                        {adjacent.next.title}
                      </p>
                    </div>
                  </Link>
                ) : <div />}
              </nav>
            )}

            {/* Similar articles */}
            {similar.length > 0 && (
              <section className="mt-14">
                <h2 className="text-xl font-extrabold text-[#0F172A] mb-6" style={{ fontFamily: "var(--font-bricolage)" }}>
                  Articles similaires
                </h2>
                <div className="grid gap-5 sm:grid-cols-3">
                  {similar.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/blog/${s.slug}`}
                      className="group rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg hover:border-[#2563EB]/20 transition-all"
                    >
                      <div className="relative aspect-[2/1] overflow-hidden bg-slate-100">
                        {s.cover_url ? (
                          <Image src={s.cover_url} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 640px) 100vw, 33vw" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#2563EB] to-[#0F172A] flex items-center justify-center">
                            <Image src={PICTO_Q} alt="" width={48} height={48} className="w-10 h-10 opacity-30" sizes="40px" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="mb-1.5">
                          <CategoryBadge category={getCategoryFromPrompt(s.ai_prompt)} />
                        </div>
                        <h3 className="text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors line-clamp-2 leading-snug">
                          {s.title}
                        </h3>
                        <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563EB]">
                          Lire <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* Right sidebar — table of contents (desktop) */}
          <div className="hidden xl:block pt-8">
            <TableOfContents headings={headings} />
          </div>
        </div>
      </div>

      {/* Mobile share bar (rendered by ShareButtons component) */}
      <ShareButtons title={post.title} slug={post.slug} />

      {/* Footer */}
      <div className="lg:mb-0 mb-14">
        <Footer />
      </div>
    </div>
  )
}
