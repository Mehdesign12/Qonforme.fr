/**
 * Mur de paiement de la signature en ligne (DECISIONS-STRATEGIQUES.md § 12,
 * point 4) : réservée aux formules Essentiel et Artisan. Sans formule, le
 * devis part par email avec son PDF et un lien de consultation, et l'artisan
 * le marque accepté à la main.
 *
 * Même règle que requireIssuingAccess (lib/stripe/subscription.ts) — même
 * statut d'abonnement, même code 402 SUBSCRIPTION_REQUIRED, même 503 sur une
 * erreur de lecture — avec un message propre à la signature.
 */
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { canIssueInvoices, SUBSCRIPTION_REQUIRED } from "@/lib/stripe/access"

/** true / false selon la formule ; null si la lecture a échoué (réseau). */
export async function hasSignatureAccess(supabase: SupabaseClient, userId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from("subscriptions").select("status").eq("user_id", userId).maybeSingle()
  if (error) return null
  return canIssueInvoices(data?.status)
}

export async function requireSignatureAccess(supabase: SupabaseClient, userId: string): Promise<NextResponse | null> {
  const access = await hasSignatureAccess(supabase, userId)
  if (access === null) {
    return NextResponse.json(
      { error: "Vérification de votre formule impossible pour le moment. Réessayez dans un instant." },
      { status: 503 },
    )
  }
  if (access) return null
  return NextResponse.json(
    {
      error: "La signature en ligne fait partie de la formule Essentiel. Vos devis restent gratuits : envoyez-les par email avec leur PDF.",
      code: SUBSCRIPTION_REQUIRED,
    },
    { status: 402 },
  )
}
