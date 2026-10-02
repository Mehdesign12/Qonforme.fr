import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/layout/Header"
import { PLANS, isPlanId } from "@/lib/stripe/plans"
import { canIssueInvoices } from "@/lib/stripe/access"

/**
 * Wrapper Server Component.
 * Récupère first_name / last_name / email / formule depuis Supabase
 * et les transmet au Header (client component).
 */
export async function HeaderServer() {
  let firstName = ""
  let lastName  = ""
  let email     = ""
  let planName: string | null = null

  try {
    const supabase = await createClient()
    const [{ data: { user } }, { data: sub }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("subscriptions").select("plan, status").maybeSingle(),
    ])
    if (user?.user_metadata) {
      firstName = (user.user_metadata.first_name as string) || ""
      lastName  = (user.user_metadata.last_name  as string) || ""
    }
    if (user?.email) {
      email = user.email
    }
    // Formule affichée seulement si elle permet d'émettre (résiliée → version gratuite)
    if (sub && canIssueInvoices(sub.status) && isPlanId(sub.plan)) {
      planName = PLANS[sub.plan].name
    }
  } catch {
    // Non bloquant — le Header s'affiche quand même
  }

  return <Header firstName={firstName} lastName={lastName} email={email} planName={planName} />
}
