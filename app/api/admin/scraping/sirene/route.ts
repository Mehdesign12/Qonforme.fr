/**
 * POST /api/admin/scraping/sirene
 *
 * Lance une extraction de prospects via l'API Sirene INSEE.
 * Réservé à l'admin (cookie admin_session).
 *
 * Body JSON :
 *   metier?       string  — slug métier (ex: "plombier"). Si absent, lance un batch auto.
 *   departement?  string  — code département pour filtrer (ex: "75")
 *   maxResults?   number  — limite de résultats par métier (défaut 5000)
 *
 * GET /api/admin/scraping/sirene
 *
 * Retourne l'historique des runs de scraping.
 */

import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { extractMetier, extractNextBatch } from "@/lib/scraping/sirene-extractor"
import { NAF_MAPPING } from "@/lib/scraping/naf-mapping"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes max (Vercel Pro)

// ── GET : historique des runs ──────────────────────────────────────────────────

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: runs, error } = await supabase
    .from("scraping_runs")
    .select("*")
    .eq("type", "sirene")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ runs })
}

// ── POST : lancer une extraction ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  // Vérifier que la clé INSEE est configurée
  if (!process.env.INSEE_API_KEY) {
    return NextResponse.json(
      { error: "INSEE_API_KEY non configurée. Ajoutez-la dans les variables d'environnement." },
      { status: 500 },
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { metier, departement, maxResults = 5000 } = body as {
      metier?: string
      departement?: string
      maxResults?: number
    }

    // Si un métier spécifique est demandé
    if (metier) {
      if (!NAF_MAPPING[metier]) {
        return NextResponse.json(
          { error: `Métier inconnu : ${metier}` },
          { status: 400 },
        )
      }

      const result = await extractMetier(metier, { maxResults, departement })
      return NextResponse.json({ ok: true, results: [result] })
    }

    // Sinon, lancer un batch automatique (5 prochains métiers)
    const results = await extractNextBatch(5, maxResults)
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[Admin Scraping Sirene] Erreur:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
