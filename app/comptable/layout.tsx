import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { AccountantShell } from "@/components/accountant/AccountantShell"

/**
 * Espace comptable : route protégée par le middleware (compte connecté), sans
 * la coque de l'application. Un compte comptable n'a pas besoin d'entreprise.
 */
export const metadata: Metadata = {
  title: "Espace comptable",
  robots: { index: false, follow: false },
}

export default async function ComptableLayout({ children }: { children: React.ReactNode }) {
  let email: string | null = null
  let hasCompany = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      email = user.email ?? null
      const { data } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle()
      hasCompany = !!data
    }
  } catch {
    // Non bloquant : la coque s'affiche sans l'adresse
  }
  return (
    <AccountantShell mode="app" email={email} appHref={hasCompany ? "/dashboard" : null}>
      {children}
    </AccountantShell>
  )
}
