import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PLANS, isPlanId, periodPrice, withVat } from "@/lib/stripe/plans"
import { canIssueInvoices } from "@/lib/stripe/access"
import { SettingsOverview, type OverviewCompany, type OverviewPlan } from "@/components/settings/SettingsOverview"

export const metadata: Metadata = { title: "Paramètres" }
export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  let company: OverviewCompany | null = null
  let plan: OverviewPlan | null = null
  let email = ""

  // Non bloquant : une lecture en échec laisse la liste des rubriques utilisable.
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      email = user.email ?? ""
      const [{ data: c }, { data: sub }] = await Promise.all([
        supabase.from("companies").select("name, siren, city, vat_number, iban").eq("user_id", user.id).maybeSingle(),
        supabase.from("subscriptions").select("plan, billing_period, status, current_period_end").eq("user_id", user.id).maybeSingle(),
      ])
      if (c) {
        company = {
          name: c.name ?? "", siren: c.siren ?? "", city: c.city ?? "",
          vat_number: c.vat_number ?? "", iban: c.iban ?? "",
        }
      }
      if (sub && canIssueInvoices(sub.status) && isPlanId(sub.plan)) {
        const p = PLANS[sub.plan]
        const period = sub.billing_period === "yearly" ? "yearly" : "monthly"
        plan = {
          name: p.name,
          period,
          amountTtc: withVat(periodPrice(p, period)),
          renewsAt: sub.current_period_end ?? null,
          pastDue: sub.status === "past_due",
        }
      }
    }
  } catch {
    // Affichage sans données
  }

  return <SettingsOverview mode="app" company={company} plan={plan} email={email} />
}
