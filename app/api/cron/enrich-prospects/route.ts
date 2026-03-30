/**
 * GET /api/cron/enrich-prospects
 *
 * Route appelée quotidiennement par cron-job.org.
 * Enrichit les prospects sans email en 3 étapes :
 * 1. Scraping des sites web (gratuit)
 * 2. API d'enrichissement Dropcontact/Hunter (payant, si configuré)
 * 3. Vérification MX des emails trouvés
 *
 * Sécurité : Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { scrapeEmailsBatch } from "@/lib/scraping/email-scraper"
import { enrichProspectsBatch } from "@/lib/scraping/email-enrichment"
import { verifyEmailsBatch } from "@/lib/scraping/email-verifier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  // ── Authentification ─────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/enrich-prospects] CRON_SECRET non défini")
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 })
  }

  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  try {
    // Étape 1 : Scraping des sites web (batch de 50)
    console.log("[cron/enrich-prospects] Étape 1 : Scraping sites web...")
    const scrapeResult = await scrapeEmailsBatch(50)

    // Étape 2 : Enrichissement API (batch de 50)
    console.log("[cron/enrich-prospects] Étape 2 : Enrichissement API...")
    const enrichResult = await enrichProspectsBatch(50)

    // Étape 3 : Vérification MX (batch de 200)
    console.log("[cron/enrich-prospects] Étape 3 : Vérification MX...")
    const verifyResult = await verifyEmailsBatch(200)

    const duration = Date.now() - startedAt

    const results = {
      scraping: scrapeResult,
      enrichment: enrichResult,
      verification: verifyResult,
    }

    const hasErrors = scrapeResult.errors > 0 || enrichResult.errors > 0

    // ── Log dans cron_logs ───────────────────────────────────────────────
    await admin.from("cron_logs").insert({
      job_name: "enrich-prospects",
      status: hasErrors ? "error" : "ok",
      results,
      duration_ms: duration,
    })

    console.log(
      `[cron/enrich-prospects] Terminé : scrape=${scrapeResult.found}, enrichi=${enrichResult.enriched}, vérifié=${verifyResult.valid}/${verifyResult.total} (${duration}ms)`,
    )

    return NextResponse.json({ ok: true, duration_ms: duration, results })
  } catch (err) {
    const duration = Date.now() - startedAt
    const message = err instanceof Error ? err.message : String(err)

    console.error("[cron/enrich-prospects] Erreur:", message)

    await admin.from("cron_logs").insert({
      job_name: "enrich-prospects",
      status: "error",
      results: { error: message },
      duration_ms: duration,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
