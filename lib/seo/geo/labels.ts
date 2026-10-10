/**
 * Libellés des relevés de la visibilité IA (module pur, dates à l'heure de Paris).
 */
import { fmtDay } from "@/lib/seo/format"
import { parisDayOf } from "@/lib/utils/paris-date"
import type { GeoRunKind, GeoRunRow } from "@/lib/seo/geo/types"

export const RUN_KIND_LABELS: Record<GeoRunKind, string> = {
  monthly: "relevé mensuel",
  immediate: "analyse immédiate",
  import: "importé de PushRank",
}

/** Jour du relevé (AAAA-MM-JJ, Paris). */
export function runDay(run: Pick<GeoRunRow, "created_at">): string {
  return parisDayOf(run.created_at)
}

/** « 28 sept. 2026 ». */
export function runDate(run: Pick<GeoRunRow, "created_at">): string {
  return fmtDay(runDay(run), true)
}

/** « Relevé du 28 sept. 2026 · importé de PushRank ». */
export function runTitle(run: Pick<GeoRunRow, "created_at" | "kind">): string {
  return `Relevé du ${runDate(run)} · ${RUN_KIND_LABELS[run.kind] ?? run.kind}`
}

/** « 3 exécutions par moteur » (« 1 exécution par moteur »). */
export function executionsLabel(repetitions: number): string {
  return `${repetitions} exécution${repetitions > 1 ? "s" : ""} par moteur`
}

/** Texte brut lisible d'une réponse en Markdown (gras, titres, liens, puces). */
export function plainAnswer(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Raccourci d'une question pour le fil d'Ariane. */
export function shortQuestion(question: string, max = 60): string {
  const q = question.trim()
  return q.length <= max ? q : `${q.slice(0, max - 1).trimEnd()}…`
}
