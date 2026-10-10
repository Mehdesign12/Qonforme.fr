/**
 * Admin › SEO › Articles › Sujets (planche Articles-sujets) : sujets à
 * traiter, actions groupées (planifier, rédiger un brouillon), sujets archivés
 * (?archives=1). Primaire « Ajouter un sujet » (?ajouter=1).
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { load, seoDb } from "@/lib/seo/db"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { ArticlesHeader, ARTICLES_BASE } from "@/components/admin/seo/articles/ArticlesHeader"
import { TopicsView } from "@/components/admin/seo/articles/TopicsView"
import { loadTopics } from "@/lib/seo/articles/data"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO, sujets d'articles" }

type SearchParams = Record<string, string | string[] | undefined>

export default async function SeoArticlesTopicsPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const archived = searchParams.archives === "1"
  const data = await load(() => loadTopics(seoDb(), new Date(), { archived }))

  return (
    <>
      <ArticlesHeader current="sujets" action={{ href: `${ARTICLES_BASE}/sujets?ajouter=1`, label: "Ajouter un sujet", icon: "plus" }} />
      {!data.ok ? (
        <FailureState failure={data.failure} what="les sujets d'articles" retryHref={`${ARTICLES_BASE}/sujets`} />
      ) : (
        <TopicsView data={data.data} archived={archived} />
      )}
    </>
  )
}
