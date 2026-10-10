/**
 * Lecture d'une réponse de PageSpeed Insights (API v5, catégorie performance)
 * et seuils d'affichage. Module pur : testé avec une réponse réelle abrégée.
 *
 * - Laboratoire (Lighthouse, lighthouseResult.audits) : LCP, CLS, TBT, FCP,
 *   Speed Index, JavaScript inutilisé, score de performance (0 à 100).
 * - Terrain (Chrome UX Report, loadingExperience) : LCP, INP et CLS au 75ᵉ
 *   centile, seulement quand Google en a pour la page (ou, à défaut, pour
 *   l'origine : `origin_fallback`). L'INP n'existe qu'en terrain.
 *
 * Seuils LCP : bon ≤ 2,5 s, à améliorer ≤ 4 s, mauvais au-delà
 * (https://web.dev/articles/lcp#what-is-a-good-lcp-score).
 * Référence de la réponse : https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed
 */
import type { Tone } from "@/components/app/kit"
import type { PageSpeedStrategy } from "@/lib/seo/google"

export type { PageSpeedStrategy }
export const STRATEGIES: PageSpeedStrategy[] = ["mobile", "desktop"]

export const STRATEGY_LABELS: Record<PageSpeedStrategy, string> = {
  mobile: "Mobile",
  desktop: "Ordinateur",
}

/* ------------------------------------------------------------------ */
/* Seuils et verdicts                                                  */
/* ------------------------------------------------------------------ */

export const LCP_GOOD_MS = 2500
export const LCP_POOR_MS = 4000
/** Échelle de la barre de seuils (2,5 s + 1,5 s + 2 s). */
export const LCP_SCALE_MS = 6000

export type Verdict = "good" | "improve" | "poor"

export const VERDICTS: Record<Verdict, { label: string; tone: Tone }> = {
  good: { label: "Bon", tone: "ok" },
  improve: { label: "À améliorer", tone: "warn" },
  poor: { label: "Mauvais", tone: "danger" },
}

export function lcpVerdict(ms: number | null | undefined): Verdict | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null
  if (ms <= LCP_GOOD_MS) return "good"
  if (ms <= LCP_POOR_MS) return "improve"
  return "poor"
}

/** Catégorie du Chrome UX Report (« FAST », « AVERAGE », « SLOW ») → verdict. */
export function fieldVerdict(category: string | null | undefined): Verdict | null {
  switch (category) {
    case "FAST":
      return "good"
    case "AVERAGE":
      return "improve"
    case "SLOW":
      return "poor"
    default:
      return null
  }
}

/* ------------------------------------------------------------------ */
/* Analyse de la réponse                                               */
/* ------------------------------------------------------------------ */

export interface FieldMetric {
  /** 75ᵉ centile : millisecondes (LCP, INP) ou valeur du CLS (0,05). */
  p75: number
  category: string | null
}

export interface FieldData {
  /** « page » : données de l'adresse ; « origin » : repli sur tout qonforme.fr. */
  scope: "page" | "origin"
  overall: string | null
  lcp?: FieldMetric
  inp?: FieldMetric
  cls?: FieldMetric
}

/** Colonnes d'une ligne de seo_pagespeed tirées d'une réponse. */
export interface PageSpeedMeasures {
  performance_score: number | null
  lcp_ms: number | null
  cls: number | null
  tbt_ms: number | null
  fcp_ms: number | null
  si_ms: number | null
  unused_js_bytes: number | null
  field: FieldData | null
  /** Message en français si Lighthouse n'a pas pu mesurer la page. */
  error: string | null
}

type Json = Record<string, unknown>

const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null)
const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
const roundOrNull = (v: number | null): number | null => (v === null ? null : Math.round(v))

function auditValue(audits: Json | null, id: string): number | null {
  return finite(obj(audits?.[id])?.numericValue)
}

function unusedJsBytes(audits: Json | null): number | null {
  const details = obj(obj(audits?.["unused-javascript"])?.details)
  if (!details) return null
  const total = finite(details.overallSavingsBytes)
  if (total !== null) return Math.round(total)
  const items = Array.isArray(details.items) ? details.items : null
  if (!items) return null
  return Math.round(items.reduce((sum: number, item) => sum + (finite(obj(item)?.wastedBytes) ?? 0), 0))
}

function fieldMetric(metrics: Json | null, key: string, divide = 1): FieldMetric | undefined {
  const m = obj(metrics?.[key])
  const p = finite(m?.percentile)
  if (!m || p === null) return undefined
  return { p75: divide === 1 ? p : p / divide, category: typeof m.category === "string" ? m.category : null }
}

/** Données terrain de la réponse (null si Google n'en a pas). */
export function parseField(json: Json): FieldData | null {
  const le = obj(json.loadingExperience)
  const metrics = obj(le?.metrics)
  if (!le || !metrics) return null
  const field: FieldData = {
    scope: le.origin_fallback === true ? "origin" : "page",
    overall: typeof le.overall_category === "string" ? le.overall_category : null,
  }
  const lcp = fieldMetric(metrics, "LARGEST_CONTENTFUL_PAINT_MS")
  const inp = fieldMetric(metrics, "INTERACTION_TO_NEXT_PAINT")
  // Le Chrome UX Report donne le CLS multiplié par 100 (5 = 0,05)
  const cls = fieldMetric(metrics, "CUMULATIVE_LAYOUT_SHIFT_SCORE", 100)
  if (lcp) field.lcp = lcp
  if (inp) field.inp = inp
  if (cls) field.cls = cls
  return lcp || inp || cls ? field : null
}

/** Colonnes de seo_pagespeed tirées d'une réponse de l'API. */
export function parsePageSpeed(json: Json): PageSpeedMeasures {
  const lh = obj(json.lighthouseResult)
  const audits = obj(lh?.audits)
  const runtimeError = obj(lh?.runtimeError)
  const score = finite(obj(obj(lh?.categories)?.performance)?.score)
  const measures: PageSpeedMeasures = {
    performance_score: score === null ? null : Math.round(score * 100),
    lcp_ms: roundOrNull(auditValue(audits, "largest-contentful-paint")),
    cls: auditValue(audits, "cumulative-layout-shift"),
    tbt_ms: roundOrNull(auditValue(audits, "total-blocking-time")),
    fcp_ms: roundOrNull(auditValue(audits, "first-contentful-paint")),
    si_ms: roundOrNull(auditValue(audits, "speed-index")),
    unused_js_bytes: unusedJsBytes(audits),
    field: parseField(json),
    error: null,
  }
  if (!lh) {
    measures.error = "Réponse de PageSpeed sans résultat Lighthouse."
  } else if (runtimeError && typeof runtimeError.code === "string" && runtimeError.code !== "NO_ERROR") {
    const detail = typeof runtimeError.message === "string" ? ` : ${runtimeError.message}` : ""
    measures.error = `Lighthouse n'a pas pu mesurer la page${detail}`.slice(0, 500)
  } else if (measures.lcp_ms === null && measures.performance_score === null) {
    measures.error = "Lighthouse n'a rendu aucune mesure pour cette page."
  }
  return measures
}

/* ------------------------------------------------------------------ */
/* Formats propres à PageSpeed                                         */
/* ------------------------------------------------------------------ */

const NBSP = " "

/** « 150 ms ». */
export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—"
  return `${Math.round(ms).toLocaleString("fr-FR")}${NBSP}ms`
}

/** CLS « 0,05 » (trois décimales au plus). */
export function fmtCls(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })
}

/** Position d'une valeur sur la barre de seuils (0 à 100 %). */
export function lcpScalePercent(ms: number): number {
  return Math.max(0, Math.min(100, (ms / LCP_SCALE_MS) * 100))
}
