/**
 * GET /api/tracking/click?id={send_id}&url={destination}
 *
 * Redirect tracké. Log le clic puis redirige vers la destination.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const sendId = request.nextUrl.searchParams.get("id")
  const destination = request.nextUrl.searchParams.get("url")

  // Toujours rediriger, même si le tracking échoue
  const fallbackUrl = destination || "https://qonforme.fr"

  if (sendId) {
    try {
      const supabase = createAdminClient()

      // Mettre à jour le campaign_send
      await supabase
        .from("campaign_sends")
        .update({
          statut: "clique",
          date_clic: new Date().toISOString(),
          // Mettre aussi la date d'ouverture si pas encore définie
          date_ouverture: new Date().toISOString(),
        })
        .eq("id", sendId)
        .in("statut", ["envoye", "ouvert"]) // Ne pas rétrograder

      // Incrémenter le compteur de la campagne
      const { data: send } = await supabase
        .from("campaign_sends")
        .select("campaign_id")
        .eq("id", sendId)
        .single()

      if (send?.campaign_id) {
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("total_clics")
          .eq("id", send.campaign_id)
          .single()

        if (campaign) {
          await supabase
            .from("campaigns")
            .update({ total_clics: ((campaign as { total_clics: number }).total_clics ?? 0) + 1 })
            .eq("id", send.campaign_id)
        }
      }
    } catch {
      // Ne jamais bloquer la redirection
    }
  }

  return NextResponse.redirect(fallbackUrl, { status: 302 })
}
