import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/layout/Header"
import type { PlanId } from "@/lib/stripe/plans"

/**
 * Wrapper Server Component.
 * Récupère first_name / last_name / email / plan depuis Supabase
 * et les transmet au Header (client component).
 */
export async function HeaderServer() {
  let firstName = ""
  let lastName  = ""
  let email     = ""
  let plan: PlanId | null = null

  try {
    const supabase = await createClient()
    const [{ data: { user } }, { data: sub }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("subscriptions").select("plan").maybeSingle(),
    ])
    if (user?.user_metadata) {
      firstName = (user.user_metadata.first_name as string) || ""
      lastName  = (user.user_metadata.last_name  as string) || ""
    }
    if (user?.email) {
      email = user.email
    }
    if (sub?.plan) {
      plan = sub.plan as PlanId
    }
  } catch {
    // Non bloquant — le Header s'affiche quand même
  }

  return <Header firstName={firstName} lastName={lastName} email={email} plan={plan} />
}
