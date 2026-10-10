/**
 * Ligne de seo_keywords telle que la lisent l'écran Mots-clés et les tâches
 * (migration 20261009_seo_admin.sql, § 6 et § 12).
 */
import type { KeywordIntent, KeywordSource, KeywordStatus } from "@/lib/seo/types"

/** Devise du CPC : EUR (valeurs reprises de PushRank) ou USD (Google Ads via DataForSEO). */
export type CpcCurrency = "EUR" | "USD"

export interface KeywordRow {
  id: string
  keyword: string
  status: KeywordStatus
  intent: KeywordIntent | null
  source: KeywordSource
  target_path: string | null
  notes: string | null
  volume: number | null
  difficulty: number | null
  cpc: number | null
  /** NULL : valeur reprise de PushRank, affichée en euros comme dans PushRank. */
  cpc_currency: CpcCurrency | null
  metrics_checked_at: string | null
  position: number | null
  impressions: number | null
  clicks: number | null
  gsc_updated_at: string | null
  created_at: string
  updated_at: string
}

export const KEYWORD_COLUMNS =
  "id, keyword, status, intent, source, target_path, notes, volume, difficulty, cpc, cpc_currency, metrics_checked_at, position, impressions, clicks, gsc_updated_at, created_at, updated_at"

export const KEYWORD_STATUSES: KeywordStatus[] = ["candidate", "targeted", "covered", "ignored"]
export const KEYWORD_INTENTS: KeywordIntent[] = ["informational", "transactional", "navigational", "commercial"]

export function isKeywordStatus(value: unknown): value is KeywordStatus {
  return typeof value === "string" && (KEYWORD_STATUSES as string[]).includes(value)
}

export function isKeywordIntent(value: unknown): value is KeywordIntent {
  return typeof value === "string" && (KEYWORD_INTENTS as string[]).includes(value)
}

/** Nombre ou null (numeric de PostgREST, parfois rendu en texte). */
export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Ligne brute de la base → KeywordRow (nombres convertis, valeurs inconnues écartées). */
export function toKeywordRow(raw: Record<string, unknown>): KeywordRow {
  return {
    id: String(raw.id),
    keyword: String(raw.keyword ?? ""),
    status: isKeywordStatus(raw.status) ? raw.status : "candidate",
    intent: isKeywordIntent(raw.intent) ? raw.intent : null,
    source: (["search_console", "manual", "suggestion", "import"] as const).includes(raw.source as KeywordSource)
      ? (raw.source as KeywordSource)
      : "manual",
    target_path: typeof raw.target_path === "string" && raw.target_path ? raw.target_path : null,
    notes: typeof raw.notes === "string" ? raw.notes : null,
    volume: numOrNull(raw.volume),
    difficulty: numOrNull(raw.difficulty),
    cpc: numOrNull(raw.cpc),
    cpc_currency: raw.cpc_currency === "USD" || raw.cpc_currency === "EUR" ? raw.cpc_currency : null,
    metrics_checked_at: typeof raw.metrics_checked_at === "string" ? raw.metrics_checked_at : null,
    position: numOrNull(raw.position),
    impressions: numOrNull(raw.impressions),
    clicks: numOrNull(raw.clicks),
    gsc_updated_at: typeof raw.gsc_updated_at === "string" ? raw.gsc_updated_at : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  }
}
