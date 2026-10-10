/**
 * Lectures des écrans Actions SEO et Performance › Audit du site. Chaque
 * lecture lève SeoDbError en cas d'échec (jamais une liste vide à la place).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import type { FindingSeverity, FindingSource, FindingStatus, PageType } from "@/lib/seo/types"
import { readAllRows } from "@/lib/seo/actions/paginate"

export interface FindingRow {
  id: string
  rule: string
  path: string
  page_type: PageType | null
  title: string
  explanation: string | null
  recommendation: string | null
  severity: FindingSeverity
  source: FindingSource
  effort_minutes: number | null
  metrics: Record<string, unknown>
  suggestion: string | null
  status: FindingStatus
  detected_at: string
  last_seen_at: string
  done_at: string | null
  ignored_at: string | null
  resolved_at: string | null
  verify_after: string | null
  verification: unknown
  history: unknown
}

const COLUMNS =
  "id, rule, path, page_type, title, explanation, recommendation, severity, source, effort_minutes, metrics, suggestion, status, detected_at, last_seen_at, done_at, ignored_at, resolved_at, verify_after, verification, history"

/** Identifiant de constat valide (uuid) : un autre texte n'est jamais envoyé à la base. */
export function isFindingId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * Constats à faire, faits et ignorés (pas les constats résolus d'eux-mêmes),
 * lus en entier par tranches sur un ordre unique (date de détection, puis
 * identifiant : tous les constats d'un même passage partagent leur date).
 */
export async function listFindings(db: SeoDb): Promise<FindingRow[]> {
  const rows = await readAllRows<FindingRow>(
    (from, to) =>
      db
        .from("seo_findings")
        .select(COLUMNS)
        .in("status", ["open", "done", "ignored"])
        .order("detected_at", { ascending: false })
        .order("id")
        .range(from, to),
    "les constats",
  )
  return rows.map((r) => ({ ...r, metrics: r.metrics ?? {} }))
}

export async function getFinding(db: SeoDb, id: string): Promise<FindingRow | null> {
  if (!isFindingId(id)) return null
  const row = must(await db.from("seo_findings").select(COLUMNS).eq("id", id).maybeSingle(), "le constat") as FindingRow | null
  return row ? { ...row, metrics: row.metrics ?? {} } : null
}

export interface AuditHistoryItem {
  id: string
  title: string
  path: string
  done_at: string | null
}

/** Données de la page Performance › Audit du site, hors exploration. */
export async function readAuditFindings(db: SeoDb): Promise<{
  openCrawl: { id: string; rule: string }[]
  doneCount: number
  history: AuditHistoryItem[]
}> {
  const [openRows, done, history] = await Promise.all([
    readAllRows<{ id: string; rule: string }>(
      (from, to) => db.from("seo_findings").select("id, rule").eq("status", "open").eq("source", "crawl").order("detected_at", { ascending: false }).order("id").range(from, to),
      "les constats de l'exploration",
    ),
    db.from("seo_findings").select("id", { count: "exact", head: true }).eq("status", "done"),
    db.from("seo_findings").select("id, title, path, done_at").eq("status", "done").order("done_at", { ascending: false }).order("id").limit(8),
  ])
  must(done, "les actions faites")
  return {
    openCrawl: openRows.map((r) => ({ id: r.id, rule: r.rule })),
    doneCount: done.count ?? 0,
    history: must(history, "l'historique des actions") as AuditHistoryItem[],
  }
}
