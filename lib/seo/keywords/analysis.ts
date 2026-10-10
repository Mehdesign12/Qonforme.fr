/**
 * « Lancer l'analyse » (volumes, difficulté, CPC, intention par DataForSEO) :
 * délai de 30 jours entre deux analyses réussies, gardé dans seo_jobs (ligne
 * « keywords-metrics », colonne last_ok_at, écrite par runTask). Une analyse
 * échouée ne déclenche pas le délai : elle peut être relancée. Une analyse
 * coupée net (fonction arrêtée par l'hébergeur, verrou expiré sans fin
 * enregistrée) est montrée comme échouée, relançable elle aussi.
 *
 * Le délai se compte partout en jours calendaires de Paris : le bouton
 * (analysisState) et le choix des mots-clés à remesurer (needsMetrics)
 * redeviennent actifs le même jour.
 *
 * Module pur (dates à l'heure de Paris), testé dans
 * __tests__/seo-keywords-rules.test.ts (bloc « délai de 30 jours entre deux analyses »).
 */
import type { SeoJobRow } from "@/lib/seo/cron"
import { addDays, parisDayOf, todayInParis } from "@/lib/utils/paris-date"

export const METRICS_JOB = "keywords-metrics"
export const ANALYSIS_COOLDOWN_DAYS = 30

/** Premier jour (AAAA-MM-JJ, Paris) où une nouvelle analyse est permise. */
export function nextAnalysisDay(lastOkAt: string): string {
  return addDays(parisDayOf(lastOkAt), ANALYSIS_COOLDOWN_DAYS)
}

export type AnalysisState =
  /** Aucune analyse réussie depuis 30 jours : le bouton est actif. */
  | { kind: "available"; lastOkAt: string | null; failed: { at: string | null; error: string | null } | null }
  /** Délai en cours : le bouton est désactivé jusqu'à `nextDay`. */
  | { kind: "cooldown"; lastOkAt: string; nextDay: string }
  /** Une analyse tourne (verrou posé). */
  | { kind: "running"; startedAt: string | null }

export const INTERRUPTED_MESSAGE = "L'analyse précédente s'est arrêtée avant la fin, sans enregistrer son résultat."

type JobLike = Pick<SeoJobRow, "status" | "last_ok_at" | "lock_until" | "started_at" | "finished_at" | "error">

/** État du bouton « Lancer l'analyse » d'après la ligne de seo_jobs (null : jamais lancée). */
export function analysisState(job: JobLike | null, now: Date = new Date()): AnalysisState {
  if (job?.status === "running" && job.lock_until && Date.parse(job.lock_until) > now.getTime()) {
    return { kind: "running", startedAt: job.started_at }
  }
  if (job?.last_ok_at) {
    const nextDay = nextAnalysisDay(job.last_ok_at)
    if (todayInParis(now) < nextDay) return { kind: "cooldown", lastOkAt: job.last_ok_at, nextDay }
  }
  const failed =
    job?.status === "error"
      ? { at: job.finished_at, error: job.error }
      : job?.status === "running"
        ? // Verrou expiré sans fin enregistrée : l'analyse a été coupée avant la fin.
          { at: job.started_at, error: INTERRUPTED_MESSAGE }
        : null
  return { kind: "available", lastOkAt: job?.last_ok_at ?? null, failed }
}

/**
 * Un mot-clé non ignoré est à analyser sans mesures, ou à partir du même jour
 * (Paris) que celui où le bouton redevient actif : même unité que
 * nextAnalysisDay, sinon le jour de fin du délai l'analyse ne reprendrait pas
 * les mots-clés déjà mesurés (et leur nouvelle mesure attendrait 30 jours de plus).
 */
export function needsMetrics(k: { status: string; metrics_checked_at: string | null }, now: Date = new Date()): boolean {
  if (k.status === "ignored") return false
  if (!k.metrics_checked_at) return true
  return todayInParis(now) >= nextAnalysisDay(k.metrics_checked_at)
}

const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

/** « 2026-11-02 » → « 2 novembre 2026 » (« 1er » pour le premier du mois), espaces insécables. */
export function fmtLongDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return "—"
  const nbsp = String.fromCharCode(0xa0)
  return `${d === 1 ? "1er" : d}${nbsp}${MONTHS_LONG[m - 1]}${nbsp}${y}`
}

/** Phrase de la ligne d'information et du refus 409. */
export function cooldownMessage(nextDay: string): string {
  const nbsp = String.fromCharCode(0xa0)
  return `Prochaine recherche de mots-clés à partir du ${fmtLongDay(nextDay)}${nbsp}: réanalyser avant ne trouvera pas de nouveaux mots-clés.`
}

export const NOT_CONFIGURED_MESSAGE = "DataForSEO n'est pas configuré : Paramètres › Connexions"
/** Ligne visible sous l'en-tête quand DataForSEO n'est pas configuré (suivie du lien vers Connexions). */
export const NOT_CONFIGURED_LINE = "Les volumes, la difficulté et le CPC demandent DataForSEO, qui n'est pas configuré."
export const AVAILABLE_MESSAGE = "Les volumes de recherche peuvent être relevés."
