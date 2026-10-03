/**
 * Mur de la formule Artisan, côté serveur : une seule fonction, appelée par
 * toutes les routes qui créent, modifient ou émettent un document propre à la
 * formule (chantiers, acomptes, situations, solde, retenue de garantie,
 * autoliquidation). Consulter et télécharger ce qui existe reste toujours
 * possible (CLAUDE.md : jamais de coupure d'accès aux documents).
 *
 * Même lecture que requireIssuingAccess (lib/stripe/subscription.ts) : une
 * erreur de lecture répond 503, jamais un faux « sans formule ».
 * 402 `ARTISAN_REQUIRED` : l'interface ouvre PaywallDialog sur la formule
 * Artisan (ou explique qu'elle n'est pas encore en vente).
 */
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { PLANS } from "@/lib/stripe/plans"
import { ARTISAN_REQUIRED, hasArtisanPlan } from "./plan"

/** true / false selon la formule ; null si la lecture a échoué. */
export async function hasArtisanAccess(supabase: SupabaseClient, userId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle()
  if (error) return null
  return hasArtisanPlan(data as { plan?: string | null; status?: string | null } | null)
}

export async function requireArtisanAccess(supabase: SupabaseClient, userId: string): Promise<NextResponse | null> {
  const access = await hasArtisanAccess(supabase, userId)
  if (access === null) {
    console.error("[requireArtisanAccess] Lecture de l'abonnement impossible")
    return NextResponse.json(
      { error: "Vérification de votre formule impossible pour le moment. Réessayez dans un instant." },
      { status: 503 },
    )
  }
  if (access) return null
  const onSale = PLANS.pro.available
  return NextResponse.json(
    {
      error: onSale
        ? `Cette fonction fait partie de la formule ${PLANS.pro.name}.`
        : `Cette fonction fait partie de la formule ${PLANS.pro.name}, qui n'est pas encore en vente. Vous pouvez l'essayer dans la démo.`,
      code: ARTISAN_REQUIRED,
      onSale,
    },
    { status: 402 },
  )
}
