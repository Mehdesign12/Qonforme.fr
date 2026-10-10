/**
 * POST /api/admin/seo/keywords/analyze → { ok, requested, measured, withVolume, skipped }
 *
 * « Lancer l'analyse » : volumes, difficulté, CPC et intention par DataForSEO
 * des mots-clés non ignorés sans mesures ou mesurés il y a plus de 30 jours
 * (lib/seo/keywords/metrics.ts), à travers runTask (verrou et état
 * « keywords-metrics » dans seo_jobs).
 *
 * 409 : DataForSEO non configuré, analyse réussie il y a moins de 30 jours,
 * analyse déjà en cours. 502 : l'analyse a échoué (relançable).
 *
 * Si aucun mot-clé en attente n'est accepté par Google Ads (trop long,
 * symboles), ils sont marqués comme vérifiés sans lancer la tâche : rien n'est
 * interrogé, le délai de 30 jours ne part pas.
 *
 * L'heure limite part de l'entrée dans la route (lectures comprises) ; les
 * appels à DataForSEO gardent le temps d'écrire les mesures déjà facturées
 * avant maxDuration.
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { errorPayload, seoDb } from "@/lib/seo/db"
import { readJob, runTask } from "@/lib/seo/cron"
import { isConfigured } from "@/lib/seo/connections"
import { METRICS_JOB, NOT_CONFIGURED_MESSAGE, analysisState, cooldownMessage } from "@/lib/seo/keywords/analysis"
import { keywordsMetricsTask, keywordsToAnalyze, markRefused, splitPending } from "@/lib/seo/keywords/metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Temps laissé à l'analyse depuis l'entrée dans la route (maxDuration moins la marge de la réponse). */
const BUDGET_MS = 48_000

export async function POST() {
  const started = Date.now()
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  if (!isConfigured("dataforseo")) {
    return NextResponse.json({ error: NOT_CONFIGURED_MESSAGE, code: "not_configured" }, { status: 409 })
  }

  try {
    const db = seoDb()
    const now = new Date()
    const state = analysisState(await readJob(db, METRICS_JOB), now)
    if (state.kind === "cooldown") {
      return NextResponse.json({ error: cooldownMessage(state.nextDay), code: "cooldown", nextDay: state.nextDay }, { status: 409 })
    }
    if (state.kind === "running") {
      return NextResponse.json({ error: "Une analyse est déjà en cours.", code: "running" }, { status: 409 })
    }

    const pending = await keywordsToAnalyze(db, now)
    if (pending.length === 0) {
      return NextResponse.json({ ok: true, requested: 0, measured: 0, withVolume: 0, skipped: 0, message: "Tous les mots-clés suivis ont déjà leurs volumes." })
    }
    const { sendable, refused } = splitPending(pending)
    if (sendable.length === 0) {
      await markRefused(db, refused, now)
      return NextResponse.json({
        ok: true,
        requested: pending.length,
        measured: 0,
        withVolume: 0,
        skipped: refused.length,
        message: `Google Ads ne mesure pas ${refused.length > 1 ? "les mots-clés en attente" : "le mot-clé en attente"} (trop long ou avec des symboles) : aucune analyse lancée.`,
      })
    }

    const outcome = await runTask(db, keywordsMetricsTask, { trigger: "manual", deadline: started + BUDGET_MS, now })
    if (outcome.status === "locked") {
      return NextResponse.json({ error: "Une analyse est déjà en cours.", code: "running" }, { status: 409 })
    }
    if (outcome.status !== "ok") {
      return NextResponse.json({ error: outcome.error ?? "L'analyse n'a pas pu aboutir.", code: "failed" }, { status: 502 })
    }
    return NextResponse.json({ ok: true, ...(outcome.result ?? {}) })
  } catch (error) {
    const { status, body } = errorPayload(error)
    return NextResponse.json(body, { status })
  }
}
