/**
 * Paramètres › Contexte de marque (planche Parametres-marque.dc.html).
 * Réglages « brand » (lib/seo/settings.ts) : valeurs par défaut tant que rien
 * n'est enregistré ; une lecture en échec n'est jamais remplacée par elles.
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { load, seoDb } from "@/lib/seo/db"
import { getSettings, MAX_PROOFS } from "@/lib/seo/settings"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { BrandForm } from "@/components/admin/seo/settings/BrandForm"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO · Contexte de marque" }

export default async function SeoBrandSettingsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const res = await load(() => getSettings(seoDb(), "brand"))
  if (!res.ok) return <FailureState failure={res.failure} what="le contexte de marque" retryHref="/admin/seo/parametres" />
  return <BrandForm initial={res.data.value} saved={res.data.saved} updatedAt={res.data.updatedAt} maxProofs={MAX_PROOFS} />
}
