/**
 * Paramètres › Stratégie SEO (planche Parametres-strategie.dc.html).
 * Réglages « strategy » (lib/seo/settings.ts).
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { load, seoDb } from "@/lib/seo/db"
import { getSettings, STRATEGY_GOALS, type StrategyGoal } from "@/lib/seo/settings"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { StrategyForm } from "@/components/admin/seo/settings/StrategyForm"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO · Stratégie" }

export default async function SeoStrategySettingsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const res = await load(() => getSettings(seoDb(), "strategy"))
  if (!res.ok) return <FailureState failure={res.failure} what="la stratégie SEO" retryHref="/admin/seo/parametres/strategie" />
  const goals = (Object.keys(STRATEGY_GOALS) as StrategyGoal[]).map((key) => ({ key, label: STRATEGY_GOALS[key] }))
  return <StrategyForm initial={res.data.value} updatedAt={res.data.updatedAt} goals={goals} />
}
