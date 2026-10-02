/**
 * Données d'un client, communes à l'application et à la démo : types
 * normalisés et calculs (à encaisser, chiffre d'affaires, documents).
 *
 * Les pages réelles les alimentent avec l'API, les pages de démo avec
 * lib/demo/data.ts : mêmes calculs, donc mêmes montants affichés pour les
 * mêmes documents (règle « Mode démo » de CLAUDE.md).
 */
import type { InvoiceStatus, QuoteStatus } from "@/types"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Fiche client telle que l'affichent la liste et le détail. */
export interface ClientRecord {
  id: string
  name: string
  siren: string | null
  vat_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  zip_code: string | null
  city: string | null
  country: string
  is_archived: boolean
  created_at: string
}

/** Facture minimale pour les calculs (API : invoices(*), démo : DEMO_INVOICES). */
export interface MetricInvoice {
  id: string
  client_id: string
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  total_ttc: number
  is_archived?: boolean | null
  lines?: { description?: string | null }[] | null
}

export interface MetricQuote {
  id: string
  quote_number: string
  status: QuoteStatus
  issue_date: string
  total_ttc: number
  lines?: { description?: string | null }[] | null
}

export interface MetricCreditNote {
  id: string
  client_id: string
  credit_note_number: string
  /** Facture d'origine (null si inconnue). */
  original_invoice_id: string | null
  reason?: string | null
  issue_date: string
  total_ttc: number
}

/* ------------------------------------------------------------------ */
/* Statuts                                                             */
/* ------------------------------------------------------------------ */

/** Factures émises et pas encore réglées : elles restent à encaisser. */
export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ["sent", "pending", "received", "accepted", "overdue"]

/** Factures émises (comptées dans le chiffre d'affaires) : ni brouillon, ni annulée, ni rejetée. */
const NOT_ISSUED: InvoiceStatus[] = ["draft", "cancelled", "rejected"]

const round2 = (n: number) => Math.round(n * 100) / 100

/** Date locale « AAAA-MM-JJ » (et non UTC, qui décale d'un jour le soir en France). */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                         */
/* ------------------------------------------------------------------ */

export interface ClientMetrics {
  /** Reste à encaisser sur les factures émises non réglées (avoirs déjà émis déduits). */
  due: number
  openCount: number
  /** Factures ouvertes dont l'échéance est passée. */
  lateCount: number
  /** Chiffre d'affaires TTC de l'année : factures émises, avoirs de l'année déduits. */
  billedYear: number
  /** Total des factures payées. */
  paid: number
  paidCount: number
}

const EMPTY: ClientMetrics = { due: 0, openCount: 0, lateCount: 0, billedYear: 0, paid: 0, paidCount: 0 }

/**
 * Indicateurs par client. Une facture archivée n'entre dans aucun total
 * (la liste des factures la masque aussi).
 */
export function metricsByClient(
  invoices: MetricInvoice[],
  creditNotes: MetricCreditNote[],
  { year, today }: { year: number; today: string },
): Map<string, ClientMetrics> {
  const credited = new Map<string, number>()
  for (const cn of creditNotes) {
    if (!cn.original_invoice_id) continue
    credited.set(cn.original_invoice_id, (credited.get(cn.original_invoice_id) ?? 0) + (cn.total_ttc || 0))
  }

  const out = new Map<string, ClientMetrics>()
  const get = (clientId: string) => {
    let m = out.get(clientId)
    if (!m) { m = { ...EMPTY }; out.set(clientId, m) }
    return m
  }

  for (const inv of invoices) {
    if (inv.is_archived || !inv.client_id) continue
    const m = get(inv.client_id)
    const total = inv.total_ttc || 0
    if (OPEN_INVOICE_STATUSES.includes(inv.status)) {
      const rest = Math.max(0, total - (credited.get(inv.id) ?? 0))
      if (rest > 0.004) {
        m.due += rest
        m.openCount += 1
        if (inv.status === "overdue" || (inv.due_date && inv.due_date.slice(0, 10) < today)) m.lateCount += 1
      }
    }
    if (inv.status === "paid") {
      m.paid += total
      m.paidCount += 1
    }
    if (!NOT_ISSUED.includes(inv.status) && inv.issue_date?.slice(0, 4) === String(year)) {
      m.billedYear += total
    }
  }

  for (const cn of creditNotes) {
    if (!cn.client_id || cn.issue_date?.slice(0, 4) !== String(year)) continue
    get(cn.client_id).billedYear -= cn.total_ttc || 0
  }

  for (const m of Array.from(out.values())) {
    m.due = round2(m.due)
    m.paid = round2(m.paid)
    m.billedYear = round2(Math.max(0, m.billedYear))
  }
  return out
}

export function metricsFor(map: Map<string, ClientMetrics> | null, clientId: string): ClientMetrics {
  return map?.get(clientId) ?? { ...EMPTY }
}

/* ------------------------------------------------------------------ */
/* Documents d'un client                                               */
/* ------------------------------------------------------------------ */

export type ClientDocType = "invoice" | "quote" | "credit_note"

export interface ClientDoc {
  key: string
  type: ClientDocType
  number: string
  /** Objet affiché : première ligne du document, ou motif de l'avoir. */
  title: string
  issue_date: string
  /** Montant TTC, négatif pour un avoir. */
  amount: number
  /** Statut de la facture ou du devis (absent pour un avoir). */
  status?: string
  href: string
}

export const DOC_TYPE_LABEL: Record<ClientDocType, string> = {
  invoice: "Facture",
  quote: "Devis",
  credit_note: "Avoir",
}

function firstLine(lines: { description?: string | null }[] | null | undefined): string | null {
  const d = lines?.find((l) => l?.description?.trim())?.description?.trim()
  return d || null
}

/** Devis, factures et avoirs d'un client, du plus récent au plus ancien. */
export function buildClientDocs(
  { invoices, quotes, creditNotes }: { invoices: MetricInvoice[]; quotes: MetricQuote[]; creditNotes: MetricCreditNote[] },
  href: { invoice: (id: string) => string; quote: (id: string) => string; creditNote: (id: string) => string },
): ClientDoc[] {
  const numberOf = new Map(invoices.map((i) => [i.id, i.invoice_number]))
  const docs: ClientDoc[] = [
    ...invoices.map((i) => ({
      key: `invoice-${i.id}`, type: "invoice" as const, number: i.invoice_number,
      title: firstLine(i.lines) ?? "Facture", issue_date: i.issue_date, amount: i.total_ttc || 0,
      status: i.status, href: href.invoice(i.id),
    })),
    ...quotes.map((q) => ({
      key: `quote-${q.id}`, type: "quote" as const, number: q.quote_number,
      title: firstLine(q.lines) ?? "Devis", issue_date: q.issue_date, amount: q.total_ttc || 0,
      status: q.status, href: href.quote(q.id),
    })),
    ...creditNotes.map((c) => {
      const origin = c.original_invoice_id ? numberOf.get(c.original_invoice_id) : undefined
      return {
        key: `credit-${c.id}`, type: "credit_note" as const, number: c.credit_note_number,
        title: c.reason?.trim() || (origin ? `Avoir sur ${origin}` : "Avoir"),
        issue_date: c.issue_date, amount: -(c.total_ttc || 0), href: href.creditNote(c.id),
      }
    }),
  ]
  // Même date : l'ordre d'insertion (factures, devis, avoirs) départage
  return docs.sort((a, b) => (b.issue_date ?? "").localeCompare(a.issue_date ?? ""))
}

/* ------------------------------------------------------------------ */
/* Mise en forme                                                       */
/* ------------------------------------------------------------------ */

/** « 501234567 » → « 501 234 567 » (rendu tel quel si ce n'est pas un SIREN). */
export function formatSirenDisplay(siren: string | null | undefined): string {
  const d = (siren ?? "").replace(/\s/g, "")
  return /^\d{9}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d
}

/** « 12 sept. », « 1er oct. » (avec l'année si ce n'est pas l'année en cours). */
export function formatShortDate(iso: string | null | undefined, year: number): string {
  if (!iso) return "—"
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return "—"
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
  if (d.getFullYear() !== year) opts.year = "numeric"
  const out = new Intl.DateTimeFormat("fr-FR", opts).format(d)
  // Premier du mois en ordinal, comme l'écrit la typographie française
  return d.getDate() === 1 ? out.replace(/^1(?=\s)/, "1er") : out
}

/** « 44000 Nantes » ou « Nantes ». */
export function cityLine(c: Pick<ClientRecord, "zip_code" | "city">): string {
  return [c.zip_code, c.city].filter(Boolean).join(" ")
}

/** Pluriel simple : « 1 facture », « 3 factures ». */
export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`
}
