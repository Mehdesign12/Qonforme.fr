import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { markdownToHtml } from "@/lib/markdown"
import { ArrowLeft, Calendar } from "lucide-react"

export const revalidate = 60

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

async function getPost(slug: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("blog_posts")
    .select("slug, title, excerpt, content, cover_url, published_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .single()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: "Article introuvable" }

  return {
    title: `${post.title} \u2014 Blog Qonforme`,
    description: post.excerpt || `${post.title} \u2014 Guide facturation \u00e9lectronique par Qonforme.`,
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

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl flex items-center justify-between h-14 px-4 sm:px-6">
          <Link href="/" aria-label="Retour \u00e0 l\u2019accueil">
            <Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-7 w-auto" sizes="130px" priority />
          </Link>
          <Link href="/blog" className="text-sm font-medium text-slate-500 hover:text-[#2563EB] transition-colors">
            \u2190 Tous les articles
          </Link>
        </div>
      </header>

      {/* Article */}
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Back link */}
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#2563EB] transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Retour au blog
        </Link>

        {/* Cover */}
        {post.cover_url && (
          <div className="rounded-2xl overflow-hidden mb-8 aspect-[2/1] bg-slate-100">
            <img src={post.cover_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Title + date */}
        <header className="mb-8">
          {post.published_at && (
            <p className="flex items-center gap-1.5 text-[13px] text-slate-400 mb-3">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] leading-tight" style={{ fontFamily: "var(--font-bricolage)" }}>
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-4 text-lg text-slate-500 leading-relaxed">{post.excerpt}</p>
          )}
        </header>

        {/* Content */}
        <div
          className="prose prose-slate prose-headings:font-extrabold prose-headings:tracking-tight prose-a:text-[#2563EB] prose-a:no-underline hover:prose-a:underline max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        {/* CTA */}
        <div className="mt-12 rounded-2xl bg-[#0F172A] p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Pr\u00eat \u00e0 passer \u00e0 la facturation conforme ?</h2>
          <p className="text-sm text-slate-400 mb-5">Cr\u00e9ez votre premi\u00e8re facture Factur-X en 5 minutes.</p>
          <Link
            href="/signup"
            className="inline-flex h-10 px-6 items-center rounded-lg bg-[#2563EB] text-white font-medium text-sm hover:bg-[#1d4ed8] transition-colors"
          >
            Commencer gratuitement
          </Link>
        </div>
      </article>

      {/* Footer minimal */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-[13px] text-slate-400">
        <Link href="/" className="hover:text-[#2563EB] transition-colors">\u00a9 {new Date().getFullYear()} Qonforme</Link>
        {" \u00b7 "}
        <Link href="/mentions-legales" className="hover:text-[#2563EB] transition-colors">Mentions l\u00e9gales</Link>
        {" \u00b7 "}
        <Link href="/confidentialite" className="hover:text-[#2563EB] transition-colors">Confidentialit\u00e9</Link>
      </footer>
    </div>
  )
}
