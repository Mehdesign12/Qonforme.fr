/**
 * Admin › SEO › Articles › Préférences (planche Articles-preferences) :
 * publication, rythme, rédaction (modèles par passe), image de couverture,
 * contrôle automatique, liens automatiques. Pas d'action primaire d'en-tête :
 * « Enregistrer les préférences » en pied de page.
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { load, seoDb } from "@/lib/seo/db"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { ArticlesHeader, ARTICLES_BASE } from "@/components/admin/seo/articles/ArticlesHeader"
import { PreferencesForm } from "@/components/admin/seo/articles/PreferencesForm"
import { loadPreferences } from "@/lib/seo/articles/data"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO, préférences des articles" }

export default async function SeoArticlesPreferencesPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const data = await load(() => loadPreferences(seoDb()))

  return (
    <>
      <ArticlesHeader current="preferences" />
      {!data.ok ? (
        <FailureState failure={data.failure} what="les préférences des articles" retryHref={`${ARTICLES_BASE}/preferences`} />
      ) : (
        <PreferencesForm
          key={data.data.updatedAt ?? "defaults"}
          initial={data.data.value}
          textModels={data.data.textModels}
          imageModels={data.data.imageModels}
          auditRules={data.data.auditRules}
        />
      )}
    </>
  )
}
