import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { canIssueInvoices } from "@/lib/stripe/access"
import { NotificationsView } from "@/components/settings/NotificationsView"

export const metadata: Metadata = { title: "Notifications" }
export const dynamic = "force-dynamic"

export default async function NotificationsPage() {
  let companyEmail = ""
  let accountEmail = ""
  let hasPlan = false

  // Non bloquant : sans lecture, la page décrit quand même les envois.
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      accountEmail = user.email ?? ""
      const [{ data: company }, { data: sub }] = await Promise.all([
        supabase.from("companies").select("email").eq("user_id", user.id).maybeSingle(),
        supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle(),
      ])
      companyEmail = company?.email?.trim() ?? ""
      hasPlan = canIssueInvoices(sub?.status)
    }
  } catch {
    // Affichage sans données
  }

  return <NotificationsView mode="app" companyEmail={companyEmail} accountEmail={accountEmail} hasPlan={hasPlan} />
}
