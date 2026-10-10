/**
 * POST /api/admin/seo/findings/<id>/suggest → { suggestion }
 *
 * « Proposer un title et une description » : Gemini (gemini-2.5-flash) reçoit
 * le chemin, le title et la description actuels, les requêtes de la page et le
 * contexte de marque — jamais les concurrents. Le résultat est contrôlé
 * (longueurs, vouvoiement, lib/blog-audit.ts, aucun concurrent) puis enregistré
 * « à relire » dans la colonne `suggestion`.
 *
 * 401 · 404 · 409 constat modifié pendant la rédaction · 422 règle sans
 * proposition ou proposition refusée · 503 clé absente ou Gemini indisponible.
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"
import { resolvePeriod } from "@/lib/seo/period"
import { getFinding, isFindingId } from "@/lib/seo/actions/data"
import { readGscBounds, readQueriesByPage } from "@/lib/seo/actions/gsc"
import { appendHistory } from "@/lib/seo/actions/history"
import { isSuggestible, proposeTitleAndDescription, SuggestionError } from "@/lib/seo/actions/suggest"
import { latestDoneRun } from "@/lib/seo/audit/crawler"
import type { QueryStat } from "@/lib/seo/actions/rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> | { id: string } }

export async function POST(_request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  if (!isFindingId(id)) return NextResponse.json({ error: "Constat introuvable" }, { status: 404 })

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: "Clé Gemini absente : ajoutez GEMINI_API_KEY dans les variables d'environnement (Paramètres › Connexions).", code: "not_configured" },
      { status: 503 },
    )
  }

  try {
    const db = seoDb()
    const finding = await getFinding(db, id)
    if (!finding) return NextResponse.json({ error: "Constat introuvable" }, { status: 404 })
    if (!isSuggestible(finding.rule)) {
      return NextResponse.json({ error: "Ce constat ne porte pas sur le title ni la description de la page.", code: "not_suggestible" }, { status: 422 })
    }

    // Title et description actuels : ceux du constat, sinon ceux de la dernière exploration.
    let title = typeof finding.metrics.title === "string" ? finding.metrics.title : null
    let description = typeof finding.metrics.description === "string" ? finding.metrics.description : null
    if (title === null && description === null) {
      const run = await latestDoneRun(db)
      if (run) {
        const page = must(
          await db.from("seo_crawl_pages").select("title, description").eq("run_id", run.id).eq("path", finding.path).maybeSingle(),
          "la page explorée",
        ) as { title: string | null; description: string | null } | null
        title = page?.title ?? null
        description = page?.description ?? null
      }
    }

    let queries: QueryStat[] = []
    const bounds = await readGscBounds(db)
    if (bounds.last) {
      const period = resolvePeriod("28j", bounds.last)
      queries = (await readQueriesByPage(db, period.current.from, period.current.to))[finding.path] ?? []
    }

    const [brand, targeting] = await Promise.all([getSettings(db, "brand"), getSettings(db, "targeting")])
    const problem = `${finding.title}${finding.explanation ? ` (${finding.explanation})` : ""}`
    const suggestion = await proposeTitleAndDescription({
      path: finding.path,
      title,
      description,
      queries,
      brand: brand.value,
      problem,
      competitors: targeting.value.competitors,
      apiKey,
    })

    // L'appel à Gemini dure jusqu'à 2 × 25 s : le constat a pu changer entre-temps
    // (résolu par la tâche, fait ou ignoré dans un autre onglet). L'historique est
    // relu juste avant l'écriture, conditionnée à l'état relu ; un second essai
    // si l'état change encore, sinon 409 (jamais une entrée effacée).
    const at = suggestion.generatedAt
    for (let attempt = 0; attempt < 2; attempt++) {
      const fresh = await getFinding(db, id)
      if (!fresh) return NextResponse.json({ error: "Constat introuvable" }, { status: 404 })
      const rows = must(
        await db
          .from("seo_findings")
          .update({ suggestion: JSON.stringify(suggestion), history: appendHistory(fresh.history, { at, event: "suggested" }) })
          .eq("id", id)
          .eq("status", fresh.status)
          .select("id"),
        "la suggestion",
      ) as { id: string }[] | null
      if (rows && rows.length > 0) return NextResponse.json({ ok: true, suggestion })
    }
    return NextResponse.json({ error: "Le constat a changé pendant la rédaction. Rechargez la page puis proposez à nouveau.", code: "conflict" }, { status: 409 })
  } catch (error) {
    if (error instanceof SuggestionError) {
      const status = error.kind === "rejected" ? 422 : 503
      return NextResponse.json({ error: error.message, code: error.kind, problems: error.problems }, { status })
    }
    if (error instanceof Error && error.name === "CompetitorLeakError") {
      return NextResponse.json({ error: "Un concurrent figurait dans la consigne : proposition bloquée.", code: "competitor_leak" }, { status: 422 })
    }
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
