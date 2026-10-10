/**
 * Historique d'un constat (colonne `history` de seo_findings) : détection,
 * action faite, ignorée, rouverte, résolution d'elle-même, vérification à
 * 14 jours, suggestion rédigée. Module pur.
 */

export type FindingEvent = "detected" | "done" | "ignored" | "reopened" | "resolved" | "verified" | "suggested"

export interface FindingHistoryEntry {
  at: string
  event: FindingEvent | string
  note?: string
}

export const HISTORY_LABELS: Record<FindingEvent, string> = {
  detected: "Constat détecté",
  done: "Marqué comme fait",
  ignored: "Ignoré",
  reopened: "Rouvert",
  resolved: "Résolu de lui-même",
  verified: "Résultat mesuré",
  suggested: "Suggestion proposée",
}

const MAX_ENTRIES = 50

export function readHistory(value: unknown): FindingHistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (e): e is FindingHistoryEntry => Boolean(e) && typeof e === "object" && typeof (e as FindingHistoryEntry).at === "string" && typeof (e as FindingHistoryEntry).event === "string",
  )
}

/** Ajoute une entrée (les 50 dernières sont gardées). */
export function appendHistory(value: unknown, entry: FindingHistoryEntry): FindingHistoryEntry[] {
  return readHistory(value).concat([entry]).slice(-MAX_ENTRIES)
}

export function historyLabel(event: string): string {
  return (HISTORY_LABELS as Record<string, string>)[event] ?? event
}
