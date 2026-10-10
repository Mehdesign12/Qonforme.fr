/**
 * Paramètres › Ciblage (planche Parametres-ciblage.dc.html).
 * Réglages « targeting » (lib/seo/settings.ts). Les concurrents servent au
 * suivi interne seulement (lib/seo/competitors.ts).
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { load, seoDb } from "@/lib/seo/db"
import { getSettings, MAX_COMPETITORS, MAX_COUNTRIES } from "@/lib/seo/settings"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { TargetingForm } from "@/components/admin/seo/settings/TargetingForm"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO · Ciblage" }

export default async function SeoTargetingSettingsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const res = await load(() => getSettings(seoDb(), "targeting"))
  if (!res.ok) return <FailureState failure={res.failure} what="le ciblage" retryHref="/admin/seo/parametres/ciblage" />
  return (
    <TargetingForm initial={res.data.value} updatedAt={res.data.updatedAt} maxCountries={MAX_COUNTRIES} maxCompetitors={MAX_COMPETITORS} />
  )
}
