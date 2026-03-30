/**
 * GET /api/cron/outreach-sequence
 *
 * Séquence d'outreach automatisée. Appelé quotidiennement par cron-job.org.
 *
 * Pour chaque campagne en cours :
 * - J0   : envoyer Template 1 (alerte réglementaire)
 * - J+5  : envoyer Template 2 (invitation démo) à ceux qui n'ont PAS cliqué
 * - J+10 : envoyer Template 3 (offre lancement) à ceux qui n'ont PAS converti
 *
 * Respecte la limite quotidienne (warm-up progressif).
 * Stop si prospect désabonné, converti ou bounce.
 *
 * Sécurité : Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendCampaignBatch } from "@/lib/outreach/sender"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  // ── Authentification ─────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/outreach-sequence] CRON_SECRET non défini")
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 })
  }

  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://qonforme.fr"

  try {
    // Récupérer les campagnes en cours
    const { data: campaigns } = await admin
      .from("campaigns")
      .select("*")
      .eq("statut", "en_cours")

    if (!campaigns || campaigns.length === 0) {
      console.log("[cron/outreach-sequence] Aucune campagne en cours")
      return NextResponse.json({ ok: true, message: "Aucune campagne en cours", results: [] })
    }

    const results = []

    for (const campaign of campaigns) {
      const campaignId = (campaign as { id: string }).id
      const dateEnvoi = (campaign as { date_envoi: string }).date_envoi

      if (!dateEnvoi) continue

      const daysSinceStart = Math.floor(
        (Date.now() - new Date(dateEnvoi).getTime()) / (24 * 60 * 60 * 1000)
      )

      // Déterminer quelle étape envoyer
      let step: number | null = null

      if (daysSinceStart >= 10) {
        step = 3 // Offre lancement (J+10)
      } else if (daysSinceStart >= 5) {
        step = 2 // Invitation démo (J+5)
      } else if (daysSinceStart >= 0) {
        step = 1 // Alerte réglementaire (J0)
      }

      if (!step) continue

      console.log(`[cron/outreach-sequence] Campagne ${campaignId} — étape ${step} (J+${daysSinceStart})`)

      const result = await sendCampaignBatch(campaignId, step, baseUrl)
      results.push(result)

      // Si la limite quotidienne est atteinte, arrêter
      if (result.dailyLimitReached) {
        console.log("[cron/outreach-sequence] Limite quotidienne atteinte, arrêt")
        break
      }

      // Vérifier si la campagne est terminée (step 3 envoyé et plus de prospects)
      if (step === 3 && result.sent === 0 && result.skipped === 0) {
        await admin
          .from("campaigns")
          .update({ statut: "terminee" })
          .eq("id", campaignId)
        console.log(`[cron/outreach-sequence] Campagne ${campaignId} terminée`)
      }
    }

    const duration = Date.now() - startedAt
    const totalSent = results.reduce((sum, r) => sum + r.sent, 0)
    const hasErrors = results.some((r) => r.errors > 0)

    // ── Log dans cron_logs ───────────────────────────────────────────────
    await admin.from("cron_logs").insert({
      job_name: "outreach-sequence",
      status: hasErrors ? "error" : "ok",
      results: {
        campaigns_processed: results.length,
        total_sent: totalSent,
        details: results,
      },
      duration_ms: duration,
    })

    console.log(`[cron/outreach-sequence] Terminé : ${totalSent} emails envoyés (${duration}ms)`)

    return NextResponse.json({ ok: true, duration_ms: duration, total_sent: totalSent, results })
  } catch (err) {
    const duration = Date.now() - startedAt
    const message = err instanceof Error ? err.message : String(err)

    console.error("[cron/outreach-sequence] Erreur:", message)

    await admin.from("cron_logs").insert({
      job_name: "outreach-sequence",
      status: "error",
      results: { error: message },
      duration_ms: duration,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
