/**
 * GET /api/outreach/unsubscribe?id={send_id}
 *
 * Page de confirmation de désinscription.
 * Marque le prospect comme "desabonne" — PLUS JAMAIS contacté.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const sendId = request.nextUrl.searchParams.get("id")

  let success = false
  let error = ""

  if (sendId) {
    try {
      const supabase = createAdminClient()

      // Récupérer le prospect via le campaign_send
      const { data: send } = await supabase
        .from("campaign_sends")
        .select("prospect_id, campaign_id")
        .eq("id", sendId)
        .single()

      if (send?.prospect_id) {
        // Marquer le prospect comme désabonné (DÉFINITIF)
        await supabase
          .from("prospects")
          .update({ statut: "desabonne" })
          .eq("id", send.prospect_id)

        // Marquer le send
        await supabase
          .from("campaign_sends")
          .update({ statut: "desabonne" })
          .eq("id", sendId)

        // Incrémenter le compteur de la campagne
        if (send.campaign_id) {
          const { data: campaign } = await supabase
            .from("campaigns")
            .select("total_desabo")
            .eq("id", send.campaign_id)
            .single()

          if (campaign) {
            await supabase
              .from("campaigns")
              .update({ total_desabo: ((campaign as { total_desabo: number }).total_desabo ?? 0) + 1 })
              .eq("id", send.campaign_id)
          }
        }

        success = true
      } else {
        error = "Lien invalide ou expiré."
      }
    } catch {
      error = "Une erreur est survenue. Veuillez réessayer."
    }
  } else {
    error = "Lien invalide."
  }

  // Page HTML de confirmation
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Désinscription — Qonforme</title>
  <style>
    body { margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F1F5F9; color: #1E293B; }
    .card { max-width: 480px; margin: 60px auto; background: white; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 12px; }
    p { font-size: 15px; color: #64748B; line-height: 1.6; margin: 0 0 8px; }
    .footer { margin-top: 24px; font-size: 12px; color: #94A3B8; }
    a { color: #2563EB; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    ${success ? `
      <div class="icon">✅</div>
      <h1>Désinscription confirmée</h1>
      <p>Vous ne recevrez plus d'emails de Qonforme.</p>
      <p>Si c'est une erreur, contactez-nous à <a href="mailto:contact@qonforme.fr">contact@qonforme.fr</a>.</p>
    ` : `
      <div class="icon">⚠️</div>
      <h1>Erreur</h1>
      <p>${error}</p>
      <p>Contactez-nous à <a href="mailto:contact@qonforme.fr">contact@qonforme.fr</a> pour vous désinscrire manuellement.</p>
    `}
    <div class="footer">
      Qonforme.fr — Facturation électronique pour artisans et TPE
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
