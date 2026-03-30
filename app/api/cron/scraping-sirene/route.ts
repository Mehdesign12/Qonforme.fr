/**
 * GET /api/cron/scraping-sirene
 *
 * Route appelée quotidiennement par cron-job.org.
 * Lance l'extraction d'un batch de 5 métiers via l'API Sirene INSEE.
 *
 * En ~8 jours, les 39+ métiers sont couverts (5 par jour).
 * Ne re-traite pas un métier déjà extrait dans les dernières 24h.
 *
 * Sécurité : Authorization: Bearer {CRON_SECRET}
 * Config cron-job.org : 1x/jour, header Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { extractNextBatch } from "@/lib/scraping/sirene-extractor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes max

export async function GET(request: NextRequest) {
  // ── Authentification du cron ───────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/scraping-sirene] CRON_SECRET non défini")
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 })
  }

  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  // Vérifier que la clé INSEE est configurée
  if (!process.env.INSEE_API_KEY) {
    console.error("[cron/scraping-sirene] INSEE_API_KEY non définie")
    return NextResponse.json({ error: "INSEE_API_KEY manquante" }, { status: 500 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  try {
    // Extraire le prochain batch (5 métiers non traités dans les 24h)
    const results = await extractNextBatch(5, 5000)

    const duration = Date.now() - startedAt
    const totalInserted = results.reduce((sum, r) => sum + r.totalInserted, 0)
    const totalFound = results.reduce((sum, r) => sum + r.totalFound, 0)
    const hasErrors = results.some((r) => !!r.error)

    // ── Log dans cron_logs ─────────────────────────────────────────────────
    await admin.from("cron_logs").insert({
      job_name: "scraping-sirene",
      status: hasErrors ? "error" : "ok",
      results: {
        batch_size: results.length,
        metiers: results.map((r) => r.metier),
        total_found: totalFound,
        total_inserted: totalInserted,
        details: results,
      },
      duration_ms: duration,
    })

    console.log(
      `[cron/scraping-sirene] Terminé : ${results.length} métiers, ${totalFound} trouvés, ${totalInserted} insérés (${duration}ms)`,
    )

    return NextResponse.json({
      ok: true,
      batch_size: results.length,
      total_found: totalFound,
      total_inserted: totalInserted,
      duration_ms: duration,
      results,
    })
  } catch (err) {
    const duration = Date.now() - startedAt
    const message = err instanceof Error ? err.message : String(err)

    console.error("[cron/scraping-sirene] Erreur:", message)

    await admin.from("cron_logs").insert({
      job_name: "scraping-sirene",
      status: "error",
      results: { error: message },
      duration_ms: duration,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
