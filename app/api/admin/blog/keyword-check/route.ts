/**
 * POST /api/admin/blog/keyword-check — « Mesurer ce mot-clé » de l'éditeur
 * d'articles, pour un mot-clé principal saisi à la main (donc pas encore
 * suivi, sans aucune mesure).
 *
 * Corps : { keyword, metrics? } (metrics à faux : la phrase est seulement
 * cherchée dans Google, sans appel payant). Réponse : KeywordCheckResponse.
 *
 * - Existence de la phrase : saisie semi-automatique de Google (sans clé, sans
 *   coût). Google injoignable : « unreachable », jamais une erreur.
 * - Volume, difficulté, CPC, intention : le compte OpenSEO, ou DataForSEO à défaut (une demande, quelques
 *   centimes), sauf si le mot-clé est déjà suivi avec ses mesures (reprises
 *   telles quelles, rien n'est repayé). Identifiants absents, service
 *   injoignable ou mot-clé refusé par Google Ads : l'état et la raison sont
 *   rendus, pour que l'écran dise pourquoi une donnée manque.
 * - Rien n'est enregistré ici : « Suivre ce mot-clé » passe par
 *   /api/admin/seo/ideas/adopt.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, must, seoDb } from "@/lib/seo/db"
import { zodError } from "@/lib/seo/articles/input"
import { getSettings } from "@/lib/seo/settings"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { normalizeKeyword } from "@/lib/seo/keywords/normalize"
import { DataForSeoError, DFS_WRITE_RESERVE_MS, fetchKeywordMetrics, isSendableKeyword, keywordDataSource } from "@/lib/seo/keywords/dataforseo"
import { verifyKeywords } from "@/lib/seo/ideas/autocomplete"
import type { KeywordCheckResponse } from "@/lib/seo/articles/editor-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const schema = z.object({
  keyword: z.string({ message: "Mot-clé attendu" }),
  metrics: z.boolean().optional(),
})

const AUTOCOMPLETE_BUDGET_MS = 8_000
const METRICS_BUDGET_MS = 30_000 + DFS_WRITE_RESERVE_MS

interface TrackedRow {
  id: string
  status: string
  volume: number | null
  difficulty: number | null
  cpc: number | null
  intent: string | null
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })
  const normalized = normalizeKeyword(parsed.data.keyword)
  if (!normalized.ok) return NextResponse.json({ error: normalized.error }, { status: 400 })
  const keyword = normalized.keyword

  try {
    const db = seoDb()
    const targeting = await getSettings(db, "targeting")
    const competitor = findCompetitorMentions(keyword, targeting.value.competitors).length > 0

    // Mesures déjà suivies : reprises, jamais repayées
    let tracked: TrackedRow | null = null
    try {
      tracked = must(await db.from("seo_keywords").select("id, status, volume, difficulty, cpc, intent").eq("keyword", keyword).maybeSingle(), "les mots-clés suivis") as TrackedRow | null
    } catch {
      tracked = null
    }

    const wantMetrics = parsed.data.metrics !== false
    const known = tracked && tracked.volume !== null
    const [verified, measure] = await Promise.all([
      verifyKeywords([keyword], { deadline: Date.now() + AUTOCOMPLETE_BUDGET_MS }),
      known || !wantMetrics || competitor || !isSendableKeyword(keyword) || !keywordDataSource()
        ? Promise.resolve(null)
        : fetchKeywordMetrics([keyword], { deadline: Date.now() + METRICS_BUDGET_MS }).then(
            (map) => ({ ok: true as const, value: map.get(keyword) ?? null }),
            (error: unknown) => ({ ok: false as const, message: error instanceof DataForSeoError ? error.message : "La mesure n'a pas répondu." }),
          ),
    ])

    const v = verified.results.get(keyword)
    const body: KeywordCheckResponse = {
      keyword,
      tracked: tracked ? { status: tracked.status } : null,
      google: { state: v?.reached ? "ok" : "unreachable", verified: Boolean(v?.verified), also: v?.also ?? [] },
      metrics: { state: "skipped", volume: null, difficulty: null, cpc: null, intent: null, message: null },
      competitor,
    }

    if (known && tracked) {
      body.metrics = { state: "tracked", volume: tracked.volume, difficulty: tracked.difficulty, cpc: tracked.cpc, intent: tracked.intent, message: null }
    } else if (competitor) {
      body.metrics.message = "Ce mot-clé nomme un concurrent suivi (usage interne) : il n'est pas mesuré."
    } else if (!wantMetrics) {
      body.metrics.message = null
    } else if (!isSendableKeyword(keyword)) {
      body.metrics = { ...body.metrics, state: "unsendable", message: "Google Ads (d'où viennent les volumes) n'accepte pas ce mot-clé : 80 caractères et 10 mots au plus, sans symbole comme ? ! , ( ) \" ;." }
    } else if (!keywordDataSource()) {
      body.metrics = {
        ...body.metrics,
        state: "not_configured",
        message: "Aucune source de mesures n'est configurée : ajoutez OPENSEO_API_KEY (ou DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD) dans Vercel (Paramètres › Connexions) pour mesurer les recherches.",
      }
    } else if (measure && !measure.ok) {
      body.metrics = { ...body.metrics, state: "unavailable", message: measure.message }
    } else if (measure && measure.ok) {
      const m = measure.value
      body.metrics = { state: "ok", volume: m?.volume ?? null, difficulty: m?.difficulty ?? null, cpc: m?.cpc ?? null, intent: m?.intent ?? null, message: null }
      if (!m || (m.volume === null && m.difficulty === null)) {
        body.metrics.message = "Il n'y a aucune donnée pour cette phrase : elle est trop rare ou trop précise pour être mesurée. Cela ne veut pas dire que personne ne la tape."
      }
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
