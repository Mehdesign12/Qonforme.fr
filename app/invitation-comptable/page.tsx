import type { Metadata } from "next"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import AuthLayout from "@/components/auth/AuthLayout"
import { InvitationView } from "@/components/accountant/InvitationView"
import { resolveInvitation } from "@/lib/accountant/server"
import { INVITE_COOKIE, type InvitationState } from "@/lib/accountant/types"

/**
 * Invitation du comptable. Le lien de l'email passe par
 * /api/invitation-comptable/[jeton], qui range le jeton dans un cookie
 * HttpOnly : l'adresse de cette page ne le contient jamais.
 * Jamais indexée ni mise en cache (rendu dynamique, absente du service worker).
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Invitation de votre client — Qonforme",
  description: "Accès en lecture seule à la facturation d'une entreprise sur Qonforme.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  alternates: { canonical: null },
  openGraph: null,
}

export default async function InvitationPage() {
  const token = (await cookies()).get(INVITE_COOKIE)?.value ?? null
  let viewer: { id: string; email: string | null } | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) viewer = { id: user.id, email: user.email ?? null }
  } catch {
    // Visiteur non connecté
  }
  const invitation: InvitationState = token ? await resolveInvitation(token, viewer) : { state: "not_found" }

  return (
    <AuthLayout maxWidth="md">
      <InvitationView invitation={invitation} viewerEmail={viewer?.email ?? null} />
    </AuthLayout>
  )
}
