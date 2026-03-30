/**
 * GET /api/tracking/open?id={send_id}
 *
 * Pixel de tracking 1x1 transparent.
 * Quand le client email charge cette image, on log l'ouverture.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GIF 1x1 transparent (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
)

export async function GET(request: NextRequest) {
  const sendId = request.nextUrl.searchParams.get("id")

  if (sendId) {
    try {
      const supabase = createAdminClient()

      // Mettre à jour le campaign_send
      await supabase
        .from("campaign_sends")
        .update({
          statut: "ouvert",
          date_ouverture: new Date().toISOString(),
        })
        .eq("id", sendId)
        .in("statut", ["envoye"]) // Ne pas rétrograder un "clique" en "ouvert"

      // Incrémenter le compteur de la campagne
      const { data: send } = await supabase
        .from("campaign_sends")
        .select("campaign_id")
        .eq("id", sendId)
        .single()

      if (send?.campaign_id) {
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("total_ouverts")
          .eq("id", send.campaign_id)
          .single()

        if (campaign) {
          await supabase
            .from("campaigns")
            .update({ total_ouverts: ((campaign as { total_ouverts: number }).total_ouverts ?? 0) + 1 })
            .eq("id", send.campaign_id)
        }
      }
    } catch {
      // Ne jamais bloquer le rendu du pixel
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
    },
  })
}
