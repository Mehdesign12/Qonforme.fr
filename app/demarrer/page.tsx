import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import AuthLayout from "@/components/auth/AuthLayout"
import { StartScreen, type StartPanel } from "@/components/onboarding/StartScreen"
import { dashboardHref } from "@/lib/onboarding/links"
import { loadPendingReminder } from "@/lib/onboarding/store"
import type { PendingReminder } from "@/lib/onboarding/types"

export const metadata: Metadata = {
  title: "Par quoi commencer ? — Qonforme",
  robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

/** Étapes de l'inscription dans le code (le canevas en a davantage : prestations, premier devis). */
const STEPS = [{ label: "Compte" }, { label: "Entreprise" }, { label: "Démarrer" }]

/**
 * Étape « Par quoi voulez-vous commencer ? » (DECISIONS-STRATEGIQUES.md § 8),
 * après l'entreprise. Le tableau de bord d'un compte neuf y renvoie une fois
 * (app/dashboard/page.tsx) ; l'afficher marque les premiers pas comme vus, et
 * « Passer au tableau de bord » ne revient jamais ici.
 *
 * Accès : compte connecté avec son entreprise (sinon connexion, puis entreprise).
 */
export default async function StartPage({ searchParams }: { searchParams: { choix?: string } }) {
  let userId: string | null = null
  let firstName = ""
  let email = ""
  let companyMissing = false
  let available = false
  let reminder: PendingReminder | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      userId = user.id
      email = user.email ?? ""
      firstName = (user.user_metadata?.first_name as string) || ""

      const { data: company, error } = await supabase
        .from("companies")
        .select("id, onboarding_seen_at")
        .eq("user_id", user.id)
        .maybeSingle()
      if (!company && !error) companyMissing = true

      // Premiers pas vus : la fenêtre de bienvenue ne s'ouvrira pas en plus
      if (company && !company.onboarding_seen_at) {
        await createAdminClient()
          .from("companies")
          .update({ onboarding_seen_at: new Date().toISOString() })
          .eq("user_id", user.id)
      }

      // Devis d'essai et rappel : seulement une fois la migration appliquée
      const pending = await loadPendingReminder(supabase, user.id)
      available = pending.available && !pending.error
      reminder = pending.reminder
    }
  } catch {
    // Non bloquant : l'écran s'affiche avec les deux choix toujours disponibles
  }

  // Hors du try/catch : redirect() lève une exception interne de Next.js
  if (!userId) redirect("/login")
  if (companyMissing) redirect("/signup/company")

  const initialPanel: StartPanel | null =
    searchParams?.choix === "essai" ? "essai" : searchParams?.choix === "plus-tard" ? "plus-tard" : null

  return (
    <AuthLayout
      maxWidth="2xl"
      bar={{
        steps: STEPS,
        current: 2,
        logoHref: dashboardHref("app"),
        right: (
          <Link href={dashboardHref("app")} className="q-link text-[14px]">
            Passer au tableau de bord
          </Link>
        ),
      }}
    >
      <StartScreen
        mode="app"
        firstName={firstName}
        email={email}
        available={available}
        initialPanel={initialPanel}
        pendingReminder={reminder}
      />
    </AuthLayout>
  )
}
