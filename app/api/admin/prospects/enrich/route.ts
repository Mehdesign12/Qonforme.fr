/**
 * POST /api/admin/prospects/enrich
 *
 * Lance manuellement l'enrichissement des prospects (scraping + API + vérification).
 * Réservé à l'admin (cookie admin_session).
 */

import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { scrapeEmailsBatch } from "@/lib/scraping/email-scraper"
import { enrichProspectsBatch } from "@/lib/scraping/email-enrichment"
import { verifyEmailsBatch } from "@/lib/scraping/email-verifier"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    // Étape 1 : Scraping sites web
    const scraping = await scrapeEmailsBatch(50)

    // Étape 2 : Enrichissement API (Dropcontact / Hunter)
    const enrichment = await enrichProspectsBatch(50)

    // Étape 3 : Vérification MX
    const verification = await verifyEmailsBatch(200)

    return NextResponse.json({
      ok: true,
      results: { scraping, enrichment, verification },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[Admin Enrich] Erreur:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
