/**
 * Vérification à 14 jours d'une action faite : fenêtres de mesure, verdict
 * (« mieux », « stable », « moins bien ») et lecture de la colonne
 * `verification`. Module pur (utilisable dans le navigateur), testé dans
 * __tests__/seo-actions-verify.test.ts.
 *
 * - Avant : les 14 jours connus qui précèdent le jour où l'action a été marquée
 *   faite (Search Console a 2 à 3 jours de décalage) ;
 * - Après : les 14 jours qui suivent, mesurés dès que Search Console les a.
 */
import type { Tone } from "@/components/app/kit"
import { VERIFY_AFTER_DAYS } from "@/lib/seo/types"
import type { DateRange } from "@/lib/seo/period"
import { addDays, parisDayOf } from "@/lib/utils/paris-date"
import { fmtCount, fmtPosition } from "@/lib/seo/format"

export type Verdict = "mieux" | "stable" | "moins bien"

export const VERDICTS: Record<Verdict, { label: string; tone: Tone }> = {
  mieux: { label: "Mieux", tone: "ok" },
  stable: { label: "Stable", tone: "neutral" },
  "moins bien": { label: "Moins bien", tone: "warn" },
}

export interface WindowMetrics {
  from: string
  to: string
  clicks: number
  impressions: number
  ctr: number | null
  position: number | null
}

export interface Verification {
  before: WindowMetrics | null
  after: WindowMetrics | null
  verdict: Verdict | null
  measuredAt?: string
}

/** Fenêtre « avant » : 14 jours se terminant la veille de l'action, ou au dernier jour connu s'il est plus ancien. */
export function beforeWindow(doneAt: string, lastDataDay: string): DateRange {
  const doneDay = parisDayOf(doneAt)
  const dayBefore = addDays(doneDay, -1)
  const to = lastDataDay < dayBefore ? lastDataDay : dayBefore
  return { from: addDays(to, -(VERIFY_AFTER_DAYS - 1)), to }
}

/** Fenêtre « après » : les 14 jours qui suivent le jour de l'action. */
export function afterWindow(doneAt: string): DateRange {
  const doneDay = parisDayOf(doneAt)
  return { from: addDays(doneDay, 1), to: addDays(doneDay, VERIFY_AFTER_DAYS) }
}

/** Date de mesure prévue (verify_after) : 14 jours après l'action. */
export function verifyAfterOf(doneAt: Date): string {
  return new Date(doneAt.getTime() + VERIFY_AFTER_DAYS * 86_400_000).toISOString()
}

/**
 * Verdict d'une action : un point par mesure qui progresse (clics, position
 * gagnée d'au moins une place, impressions en hausse d'au moins 20 % et de 5),
 * un point de moins par mesure qui recule d'autant.
 */
export function verdictOf(before: Pick<WindowMetrics, "clicks" | "impressions" | "position">, after: Pick<WindowMetrics, "clicks" | "impressions" | "position">): Verdict {
  let score = 0
  if (after.clicks > before.clicks) score++
  else if (after.clicks < before.clicks) score--

  if (before.position !== null && after.position !== null) {
    const gained = before.position - after.position
    if (gained >= 1) score++
    else if (gained <= -1) score--
  }

  const diff = after.impressions - before.impressions
  if (diff >= 5 && (before.impressions === 0 || after.impressions >= before.impressions * 1.2)) score++
  else if (diff <= -5 && after.impressions <= before.impressions * 0.8) score--

  return score > 0 ? "mieux" : score < 0 ? "moins bien" : "stable"
}

export function readVerification(value: unknown): Verification | null {
  if (!value || typeof value !== "object") return null
  const v = value as Partial<Verification>
  return { before: v.before ?? null, after: v.after ?? null, verdict: v.verdict ?? null, measuredAt: v.measuredAt }
}

/** « 122 impressions, 0 clic, position 6,2 » d'une fenêtre de mesure. */
export function windowLine(m: WindowMetrics): string {
  return `${fmtCount(m.impressions)} impression${m.impressions > 1 ? "s" : ""}, ${fmtCount(m.clicks)} clic${m.clicks > 1 ? "s" : ""}, position ${fmtPosition(m.position)}`
}
