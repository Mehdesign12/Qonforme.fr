import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { createAdminClient } from "@/lib/supabase/server"
import { FileText, ArrowRight, Calendar } from "lucide-react"

export const metadata: Metadata = {
  title: "Blog — Qonforme",
  description: "Guides, conseils et actualit\u00e9s sur la facturation \u00e9lectronique, la conformit\u00e9 Factur-X et la r\u00e9glementation 2026 pour artisans et TPE.",
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
    .select("slug, title, excerpt, cover_url, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
  return data ?? []
}

const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Picto%20Q.webp"
const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl flex items-center justify-between h-14 px-4 sm:px-6">
          <Link href="/" aria-label="Retour \u00e0 l\u2019accueil">
            <Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-7 w-auto" sizes="130px" priority />
          </Link>
          <Link href="/signup" className="h-8 px-4 rounded-lg bg-[#2563EB] text-white text-sm font-medium flex items-center hover:bg-[#1d4ed8] transition-colors">
            Essayer Qonforme
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-16 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.04 }}>
          <Image src={PICTO_Q} alt="" width={400} height={400} className="w-[400px]" sizes="400px" loading="lazy" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]" style={{ fontFamily: "var(--font-bricolage)" }}>
            Blog <span className="text-[#2563EB]">Qonforme</span>
          </h1>
          <p className="mt-3 text-[15px] text-slate-500 max-w-lg mx-auto">
            Guides pratiques, d\u00e9cryptages r\u00e9glementaires et conseils pour ma\u00eetriser la facturation \u00e9lectronique.
          </p>
        </div>
      </section>

      {/* Articles */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-20">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-semibold text-[#0F172A]">Bient\u00f4t disponible</p>
            <p className="mt-1 text-sm text-slate-500">Nos premiers articles arrivent tr\u00e8s vite. Revenez bient\u00f4t !</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg hover:border-[#2563EB]/30 transition-all"
              >
                {post.cover_url && (
                  <div className="aspect-[2/1] overflow-hidden bg-slate-100">
                    <img src={post.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <div className="p-5">
                  {post.published_at && (
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-2">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                  <h2 className="text-lg font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors leading-tight">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-2 text-sm text-slate-500 line-clamp-2">{post.excerpt}</p>
                  )}
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB]">
                    Lire l&apos;article <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

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
