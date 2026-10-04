import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { markdownToHtml } from "@/lib/markdown"
import { autoLinkPseo } from "@/lib/blog-autolink"
import {
  getReadingTime,
  getCategoryFromPrompt,
  extractHeadings,
  extractFaqItems,
} from "@/lib/blog-utils"
import ArticleView from "@/components/blog/ArticleView"
import { fitDescription, fitTitle } from "@/lib/seo/meta"

export const revalidate = 60

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
    title: fitTitle(post.title),
    description: fitDescription(post.excerpt || `${post.title} — Guide facturation électronique par Qonforme.`),
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt ? fitDescription(post.excerpt) : undefined,
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

  const contentHtml = autoLinkPseo(markdownToHtml(post.content))
  const readingTime = getReadingTime(post.content)
  const category = getCategoryFromPrompt(post.ai_prompt)
  const headings = extractHeadings(post.content)
  const keywords = (post.ai_keywords as string[] | null) ?? []

  const faqItems = extractFaqItems(post.content)

  const [similar, adjacent] = await Promise.all([
    getSimilarPosts(post.slug, post.ai_prompt),
    getAdjacentPosts(post.published_at ?? new Date().toISOString()),
  ])

  // JSON-LD: Article + FAQPage (if questions found)
  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.excerpt || undefined,
      datePublished: post.published_at || undefined,
      author: { "@type": "Organization", name: "Qonforme" },
      publisher: {
        "@type": "Organization",
        name: "Qonforme",
        url: "https://qonforme.fr",
      },
      mainEntityOfPage: `https://qonforme.fr/blog/${post.slug}`,
      image: post.cover_url || undefined,
      keywords: keywords.length > 0 ? keywords.join(", ") : undefined,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://qonforme.fr" },
        { "@type": "ListItem", position: 2, name: "Blog", item: "https://qonforme.fr/blog" },
        { "@type": "ListItem", position: 3, name: post.title, item: `https://qonforme.fr/blog/${post.slug}` },
      ],
    },
  ]

  if (faqItems.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    })
  }

  return (
    <>
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <ArticleView
        post={post}
        category={category}
        readingTime={readingTime}
        keywords={keywords}
        headings={headings}
        contentHtml={contentHtml}
        similar={similar.map((s) => ({ ...s, category: getCategoryFromPrompt(s.ai_prompt), readingTime: getReadingTime(s.content) }))}
        adjacent={adjacent}
      />
    </>
  )
}
