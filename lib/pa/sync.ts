/**
 * Relève d'un raccordement : nouvelles factures reçues et nouveaux statuts,
 * par curseur (documentation Super PDP « Synchronisation » : identifiants
 * strictement croissants, `starting_after_id`, `has_after`). Le curseur
 * n'avance qu'après l'enregistrement de chaque facture : une panne au milieu
 * reprend au même endroit au passage suivant, sans trou ni doublon (une facture
 * déjà enregistrée est reconnue par son identifiant de plateforme).
 *
 * À appeler SOUS VERROU (claimLock), après un `checkConnection` si l'état
 * l'exige. Ne lève pas pour une facture illisible : elle est comptée et passée,
 * pour ne pas bloquer toutes les suivantes.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { statusFromCode, type ReceivedStatus } from "@/lib/reception/lifecycle"
import { applyPlatformStatus, ingestInboundInvoice } from "@/lib/reception/ingest"
import { apiFor, updateConnection, type ConnectionRow } from "@/lib/pa/store"
import type { Fetch } from "@/lib/pa/superpdp/oauth"

/** Identifiant d'une facture Super PDP dans la colonne `platform_id`. */
export const platformIdOf = (id: number) => `superpdp:${id}`
export function superPdpInvoiceId(platformId: string | null | undefined): number | null {
  const m = /^superpdp:(\d+)$/.exec(platformId ?? "")
  return m ? Number(m[1]) : null
}

/**
 * Statuts posés côté plateforme (par elle ou par le fournisseur) que Qonforme
 * reprend. Ceux que l'artisan pose lui-même (204 à 211) reviennent aussi dans
 * la liste des événements : déjà enregistrés dans Qonforme, ils sont ignorés.
 */
const PLATFORM_CODES = new Set(["fr:209", "fr:212", "fr:213"])

export function platformStatusOf(code: string): ReceivedStatus | null {
  if (!PLATFORM_CODES.has(code)) return null
  return statusFromCode(code.slice(3))
}

export interface SyncResult {
  newInvoices: number
  unreadable: number
  statuses: number
  /** Une page entière a été lue jusqu'au bout (rien d'autre en attente). */
  complete: boolean
}

const MAX_PAGES = 5

export async function syncConnection(
  admin: SupabaseClient,
  row: ConnectionRow,
  opts: { fetch?: Fetch; maxPages?: number } = {},
): Promise<SyncResult> {
  const api = await apiFor(admin, row, opts)
  const result: SyncResult = { newInvoices: 0, unreadable: 0, statuses: 0, complete: true }
  const maxPages = opts.maxPages ?? MAX_PAGES

  // 1. Factures reçues
  let cursor = row.invoices_cursor ?? null
  for (let page = 0; page < maxPages; page++) {
    const { data, hasAfter } = await api.listInboundInvoices(cursor)
    for (const inv of data) {
      if (inv.direction !== "in") {
        cursor = inv.id
        continue
      }
      const file = await api.invoiceOriginal(inv.id)
      const isPdf = (file.mime ?? "").includes("pdf") || (file.bytes[0] === 0x25 && file.bytes[1] === 0x50)
      const res = await ingestInboundInvoice(admin, {
        platformId: platformIdOf(inv.id),
        recipientSiren: row.mode === "live" ? row.siren ?? "" : "",
        receivedAt: inv.created_at,
        file: { bytes: file.bytes, filename: `facture-${inv.id}.${isPdf ? "pdf" : "xml"}`, mime: file.mime },
      }, { userId: row.user_id })
      if (!res.ok) {
        // Panne passagère : on s'arrête là, le curseur reste avant cette facture
        if (res.reason === "unavailable" || res.reason === "error") {
          await updateConnection(admin, row.user_id, { invoices_cursor: cursor })
          throw new Error(`Enregistrement de la facture ${inv.id} impossible : ${res.message ?? res.reason}`)
        }
        result.unreadable++
      } else if (!res.linked) {
        result.newInvoices++
      }
      cursor = inv.id
    }
    if (!hasAfter || data.length === 0) break
    if (page === maxPages - 1) result.complete = false
  }

  // 2. Statuts venus de la plateforme
  let evCursor = row.events_cursor ?? null
  for (let page = 0; page < maxPages; page++) {
    const { data, hasAfter } = await api.listEvents(evCursor)
    for (const ev of data) {
      const status = platformStatusOf(ev.status_code)
      if (status) {
        const detail = ev.details?.[0]
        const note = detail?.notes?.[0]?.contents?.map((c) => c.content).join(" ").slice(0, 1000) || null
        const applied = await applyPlatformStatus(admin, {
          platformId: platformIdOf(ev.invoice_id),
          status,
          reasonCode: detail?.reason ?? null,
          reason: note,
          at: ev.created_at,
        }, { userId: row.user_id })
        if (applied.ok) result.statuses++
      }
      evCursor = ev.id
    }
    if (!hasAfter || data.length === 0) break
    if (page === maxPages - 1) result.complete = false
  }

  await updateConnection(admin, row.user_id, {
    invoices_cursor: cursor,
    events_cursor: evCursor,
    last_sync_at: new Date().toISOString(),
    last_sync_error: null,
    pending_digest_count: (row.pending_digest_count ?? 0) + result.newInvoices,
  })
  row.invoices_cursor = cursor
  row.events_cursor = evCursor
  row.pending_digest_count = (row.pending_digest_count ?? 0) + result.newInvoices
  return result
}

/** Code de la norme pour un statut posé par l'artisan (« approved » → « fr:205 »), ou null s'il ne se transmet pas. */
export function recipientEventCode(code: string): string | null {
  const c = `fr:${code}`
  return ["fr:204", "fr:205", "fr:206", "fr:207", "fr:208", "fr:210", "fr:211"].includes(c) ? c : null
}
