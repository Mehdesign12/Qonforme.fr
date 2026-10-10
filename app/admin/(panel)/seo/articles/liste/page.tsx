/**
 * Admin › SEO › Articles › Articles (planche Articles-liste) : tous les
 * articles du blog, leur statut, leur source et le contrôle automatique sur
 * leur texte actuel. Primaire « Générer un article » (?generer=1).
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { load, seoDb } from "@/lib/seo/db"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { ArticlesHeader, ARTICLES_BASE } from "@/components/admin/seo/articles/ArticlesHeader"
import { ArticleList } from "@/components/admin/seo/articles/ArticleList"
import { loadArticleList, loadGenerateDialog } from "@/lib/seo/articles/data"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO, articles" }

export default async function SeoArticlesListPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const db = seoDb()
  const now = new Date()
  const data = await load(async () => {
    const [list, generate] = await Promise.all([loadArticleList(db), loadGenerateDialog(db, now)])
    return { list, generate }
  })

  return (
    <>
      <ArticlesHeader current="liste" action={{ href: `${ARTICLES_BASE}/liste?generer=1`, label: "Générer un article", icon: "sparkles" }} />
      {!data.ok ? (
        <FailureState failure={data.failure} what="les articles du blog" retryHref={`${ARTICLES_BASE}/liste`} />
      ) : (
        <ArticleList items={data.data.list.items} sources={data.data.list.sources} generate={data.data.generate} />
      )}
    </>
  )
}
